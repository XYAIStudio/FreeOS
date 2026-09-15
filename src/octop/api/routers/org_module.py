"""FreeOS organization module BFF — enable/disable, catalog, sidecar proxy."""

from __future__ import annotations

from contextlib import suppress
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server, require_permission
from octop.infra.server import OctopServer
from octop.modules.org_os.catalog import OPENXYOS_MODULES
from octop.modules.org_os.proxy import identity_headers, proxy_request
from octop.modules.org_os.service import OrgModuleService, org_module_from_paths

router = APIRouter()


class OrgModulePatch(BaseModel):
    enabled: bool
    sidecar_url: str | None = Field(default=None, description="openXYOS origin")


def _service(server: OctopServer) -> OrgModuleService:
    return org_module_from_paths(server.paths)


@router.get("/status", summary="Organization module status")
async def org_module_status(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    return _service(server).status().to_dict()


@router.get("/catalog", summary="openXYOS capability catalog")
async def org_module_catalog(
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    return {"modules": list(OPENXYOS_MODULES)}


@router.patch("", summary="Enable or disable the organization module")
async def patch_org_module(
    body: OrgModulePatch,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    service = _service(server)
    service.set_enabled(body.enabled, sidecar_url=body.sidecar_url)
    mgr = getattr(server, "plugin_manager", None)
    if mgr is None and getattr(server, "services", None) is not None:
        mgr = getattr(server.services, "plugins", None)
    if mgr is not None and hasattr(mgr, "set_enabled"):
        # Plugin may not be seeded yet; config.json is the source of truth.
        with suppress(Exception):
            mgr.set_enabled("org-os", body.enabled)
    if body.enabled and server.app_runtime is not None:
        with suppress(Exception):
            await server.app_runtime.agent_registry.reload_all()
    return service.status().to_dict()


@router.api_route(
    "/sidecar/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    summary="Proxy an authenticated request to the openXYOS sidecar",
)
async def org_module_proxy(
    path: str,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> Response:
    service = _service(server)
    if not service.is_enabled():
        raise HTTPException(
            status_code=409,
            detail="organization module is disabled; enable it from /organization",
        )
    health = service.probe_sidecar()
    if not health.reachable:
        raise HTTPException(
            status_code=503,
            detail=f"openXYOS sidecar is not reachable at {health.url}",
        )
    try:
        return await proxy_request(
            request,
            base_url=service.sidecar_url(),
            path=path,
            extra_headers=identity_headers(user, tenant_id=service.tenant_id()),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class GovernanceCheckBody(BaseModel):
    tool_name: str
    category: str = ""
    action: str = ""
    actor_id: str = ""
    tenant_id: str = ""
    approval_id: str = ""
    args: dict[str, Any] = Field(default_factory=dict)
    auto_pause: bool = True


class GovernanceResolveBody(BaseModel):
    pause_id: str
    approve: bool = True


class SkillsGenerateBody(BaseModel):
    modules: list[str] | None = None
    out_dir: str | None = None


class SkillsPublishBody(BaseModel):
    skill_dir: str
    out_dir: str | None = None


@router.post("/governance/check", summary="Policy-check a tool (default-deny high-risk)")
async def governance_check(
    body: GovernanceCheckBody,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any]:
    from octop.modules.org_os.governance.engine import GovernanceEngine
    from octop.modules.org_os.governance.types import PolicyRequest

    service = _service(server)
    engine = GovernanceEngine.from_home(service.home, sidecar_url=service.sidecar_url())
    actor = body.actor_id or str(getattr(user, "id", "") or getattr(user, "username", "") or "")
    tenant = body.tenant_id or service.tenant_id()
    decision = engine.evaluate(
        PolicyRequest(
            tool_name=body.tool_name,
            category=body.category,
            action=body.action,
            actor_id=actor,
            tenant_id=tenant,
            args=body.args,
            approval_id=body.approval_id,
            auto_pause=body.auto_pause,
        )
    )
    return decision.to_dict()


@router.post("/governance/resolve", summary="Approve or reject a durable governance pause")
async def governance_resolve(
    body: GovernanceResolveBody,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    from octop.modules.org_os.governance.engine import GovernanceEngine

    service = _service(server)
    engine = GovernanceEngine.from_home(service.home, sidecar_url=service.sidecar_url())
    decision = engine.approve(body.pause_id) if body.approve else engine.reject(body.pause_id)
    return decision.to_dict()


@router.get("/governance/audit", summary="Tail local governance audit JSONL")
async def governance_audit(
    limit: int = 50,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    from octop.modules.org_os.governance.engine import GovernanceEngine

    service = _service(server)
    engine = GovernanceEngine.from_home(service.home, sidecar_url=service.sidecar_url())
    return {"events": engine.store.tail_audit(limit)}


@router.post("/skills/generate", summary="Generate FreeOS skills from the openXYOS catalog")
async def skills_generate(
    body: SkillsGenerateBody,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    from pathlib import Path

    from octop.modules.org_os.skill_bridge.generate import generate_module_skills

    service = _service(server)
    out = Path(body.out_dir) if body.out_dir else service.home / "org-skills"
    generated = generate_module_skills(out, module_keys=body.modules)
    return {"out_dir": str(out), "skills": [item.to_dict() for item in generated]}


@router.post("/skills/publish", summary="Publish a skill as a tenant-toggleable plugin draft")
async def skills_publish(
    body: SkillsPublishBody,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    from pathlib import Path

    from octop.modules.org_os.skill_bridge.publish import publish_skill

    out = Path(body.out_dir) if body.out_dir else None
    try:
        draft = publish_skill(Path(body.skill_dir), out_dir=out)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return draft.to_dict()

"""FreeOS organization module BFF — enable/disable, catalog, sidecar proxy."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server, require_permission
from octop.infra.server import OctopServer
from octop.modules.org_os.catalog import OPENXYOS_MODULES
from octop.modules.org_os.empower import assemble_from_blueprint, pack_to_openxyos
from octop.modules.org_os.overview import build_overview
from octop.modules.org_os.proxy import identity_headers, proxy_request
from octop.modules.org_os.service import OrgModuleService, org_module_from_paths
from octop.modules.org_os.sidecar_launch import (
    sidecar_can_start,
    sidecar_start_command,
    start_sidecar,
)

router = APIRouter()


class OrgModulePatch(BaseModel):
    enabled: bool
    sidecar_url: str | None = Field(default=None, description="openXYOS origin")


def _service(server: OctopServer) -> OrgModuleService:
    return org_module_from_paths(server.paths)


def _plane_counts(server: OctopServer, user: Any) -> dict[str, int]:
    services = getattr(server, "services", None)
    user_id = getattr(user, "id", None)
    agents = 0
    connectors = 0
    cron_jobs = 0
    skill_packages = 0
    if services is not None:
        try:
            agents = len(services.agent_repo.list_all())
        except Exception:
            agents = 0
        try:
            if user_id is not None:
                connectors = len(services.connector_repo.list_visible(int(user_id)))
        except Exception:
            connectors = 0
        try:
            cron_jobs = len(services.cron_repo.list_all())
        except Exception:
            cron_jobs = 0
        try:
            skill_packages = len(services.skill_package_repo.list_all())
        except Exception:
            skill_packages = 0
    return {
        "agents": agents,
        "connectors": connectors,
        "cron_jobs": cron_jobs,
        "skill_packages": skill_packages,
    }


@router.get("/status", summary="Organization module status")
async def org_module_status(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    return _service(server).status().to_dict()


@router.get("/overview", summary="FreeOS ↔ openXYOS dual-loop snapshot")
async def org_module_overview(
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any]:
    service = _service(server)
    counts = _plane_counts(server, user)
    snapshot = build_overview(
        service,
        agents=counts["agents"],
        connectors=counts["connectors"],
        cron_jobs=counts["cron_jobs"],
        skill_packages=counts["skill_packages"],
        start_available=sidecar_can_start(),
    )
    payload = snapshot.to_dict()
    payload["start_command"] = sidecar_start_command()
    return payload


@router.post("/sidecar/start", summary="Start the bundled openXYOS sidecar")
async def org_module_start_sidecar(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    service = _service(server)
    if not service.is_enabled():
        service.set_enabled(True)
    started = await asyncio.to_thread(start_sidecar, service)
    return started.to_dict()


@router.post("/assemble", summary="Assemble digital employees from an openXYOS blueprint")
async def org_module_assemble(
    server: OctopServer = Depends(get_server),
    _: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    service = _service(server)
    if not service.is_enabled():
        service.set_enabled(True)
    return await asyncio.to_thread(assemble_from_blueprint, service)


@router.post("/pack", summary="Pack FreeOS skills/MCP back to openXYOS")
async def org_module_pack(
    server: OctopServer = Depends(get_server),
    _: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    service = _service(server)
    if not service.is_enabled():
        service.set_enabled(True)
    return await asyncio.to_thread(pack_to_openxyos, service)


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


class BlueprintCompileBody(BaseModel):
    blueprint: dict[str, Any] | None = None
    blueprint_path: str | None = None
    tenant_id: str = ""
    out_dir: str | None = None


class EmployeeTransitionBody(BaseModel):
    slug: str
    state: str
    tenant_id: str = ""
    reason: str = ""


class AssetImportBody(BaseModel):
    catalog: bool = False
    blueprint_path: str | None = None
    policies_path: str | None = None
    from_sidecar: bool = False
    tenant_id: str = ""


@router.post("/blueprints/compile", summary="Compile openxyos.agent-blueprint.v1")
async def compile_blueprint_api(
    body: BlueprintCompileBody,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    from pathlib import Path

    from octop.modules.org_os.compiler.compile import compile_blueprint
    from octop.modules.org_os.lifecycle.store import LifecycleStore
    from octop.modules.org_os.lifecycle.transitions import register_compiled

    service = _service(server)
    source: dict[str, Any] | Path
    if body.blueprint is not None:
        source = body.blueprint
    elif body.blueprint_path:
        source = Path(body.blueprint_path)
    else:
        raise HTTPException(status_code=400, detail="blueprint or blueprint_path required")
    tid = body.tenant_id or service.tenant_id() or "default"
    compiled = compile_blueprint(
        source,
        home=service.home,
        tenant_id=tid,
        sidecar_url=service.sidecar_url(),
        out_dir=Path(body.out_dir) if body.out_dir else None,
    )
    register_compiled(
        LifecycleStore(service.home, tid),
        slug=compiled.slug,
        name=compiled.slug,
        workspace=compiled.workspace,
        lifecycle="draft",
    )
    return compiled.to_dict()


@router.get("/employees", summary="List digital colleagues for the configured tenant")
async def list_employees(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    from octop.modules.org_os.lifecycle.store import LifecycleStore

    service = _service(server)
    tid = service.tenant_id() or "default"
    return {
        "tenant_id": tid,
        "colleagues": [item.to_dict() for item in LifecycleStore(service.home, tid).list()],
    }


@router.post("/employees/transition", summary="Advance or offboard a digital colleague")
async def transition_employee(
    body: EmployeeTransitionBody,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    from octop.modules.org_os.lifecycle.store import LifecycleStore
    from octop.modules.org_os.lifecycle.transitions import transition

    service = _service(server)
    tid = body.tenant_id or service.tenant_id() or "default"
    try:
        record = transition(
            LifecycleStore(service.home, tid), body.slug, body.state, reason=body.reason
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return record.to_dict()


@router.post("/assets/publish", summary="Publish a FreeOS asset pack draft")
async def publish_assets(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    from octop.modules.org_os.assets.pack import publish_asset_pack

    service = _service(server)
    return publish_asset_pack(service.home, tenant_id=service.tenant_id()).to_dict()


@router.post("/assets/import", summary="Import openXYOS catalog/blueprint/policies")
async def import_assets(
    body: AssetImportBody,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    from pathlib import Path

    from octop.modules.org_os.assets.importer import import_openxyos_assets

    service = _service(server)
    try:
        imported = import_openxyos_assets(
            service.home,
            tenant_id=body.tenant_id or service.tenant_id() or "default",
            sidecar_url=service.sidecar_url(),
            catalog=body.catalog,
            blueprint_path=Path(body.blueprint_path) if body.blueprint_path else None,
            policies_path=Path(body.policies_path) if body.policies_path else None,
            from_sidecar=body.from_sidecar,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return imported.to_dict()


class AssetApplyBody(BaseModel):
    pack_dir: str | None = None
    tenant_id: str = ""
    base_url: str = ""


class LoopRunBody(BaseModel):
    tenant_id: str = "1"
    blueprint_path: str | None = None
    policies_path: str | None = None
    base_url: str = ""


class EmployeeSpawnBody(BaseModel):
    slug: str
    tenant_id: str = ""


@router.post("/assets/apply", summary="Apply an asset pack to openXYOS (HTTP + local mirror)")
async def apply_assets(
    body: AssetApplyBody,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    from pathlib import Path

    from octop.modules.org_os.apply.apply import apply_asset_pack

    service = _service(server)
    dest = Path(body.pack_dir) if body.pack_dir else service.home / "asset-packs" / "latest"
    return apply_asset_pack(
        dest,
        home=service.home,
        tenant_id=body.tenant_id or service.tenant_id() or "default",
        base_url=body.base_url,
    ).to_dict()


@router.post("/employees/spawn", summary="Register a compiled colleague as a FreeOS chat agent")
async def spawn_employee(
    body: EmployeeSpawnBody,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    from octop.modules.org_os.lifecycle.store import LifecycleStore
    from octop.modules.org_os.runtime.spawn import spawn_colleague_agent

    service = _service(server)
    tid = body.tenant_id or service.tenant_id() or "default"
    record = LifecycleStore(service.home, tid).get(body.slug)
    if record is None:
        raise HTTPException(status_code=404, detail=f"unknown colleague: {body.slug}")
    return spawn_colleague_agent(service.home, record).to_dict()


@router.post("/loop/run", summary="Run the finished FreeOS self-growth loop")
async def run_loop(
    body: LoopRunBody,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(require_permission("plugins")),
) -> dict[str, Any]:
    from pathlib import Path

    from octop.modules.org_os.loop.run import run_growth_loop

    service = _service(server)
    proof = run_growth_loop(
        service.home,
        tenant_id=body.tenant_id or service.tenant_id() or "1",
        blueprint_path=Path(body.blueprint_path) if body.blueprint_path else None,
        policies_path=Path(body.policies_path) if body.policies_path else None,
        sidecar_url=body.base_url or service.sidecar_url(),
        config_path=service.config_path,
    )
    return proof.to_dict()

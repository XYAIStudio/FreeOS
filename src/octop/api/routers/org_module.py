"""FreeOS organization module BFF — enable/disable, catalog, sidecar proxy."""

from __future__ import annotations

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
        try:
            mgr.set_enabled("org-os", body.enabled)
        except Exception:
            # Plugin may not be seeded yet; config.json is the source of truth.
            pass
    if body.enabled and server.app_runtime is not None:
        try:
            await server.app_runtime.agent_registry.reload_all()
        except Exception:
            pass
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
            extra_headers=identity_headers(user),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

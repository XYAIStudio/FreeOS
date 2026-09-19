"""Same-origin organization identity and authenticated business API transport."""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Depends, Request, Response

from octop.api.deps import current_user, get_server
from octop.infra.errors import ErrorCode, OctopError
from octop.modules.org_os.integration import integrated_organization
from octop.modules.org_os.proxy import proxy_request
from octop.modules.org_os.service import org_module_from_paths

router = APIRouter()


def require_integrated() -> None:
    if not integrated_organization():
        raise OctopError(ErrorCode.FORBIDDEN, "integrated organization is disabled")


@router.get("/identity/status", summary="Organization identity authority")
async def identity_status() -> dict[str, Any]:
    return {"integrated": integrated_organization(), "authority": "organization"}


async def forward(request: Request, server: Any, path: str) -> Response:
    require_integrated()
    try:
        return await proxy_request(
            request,
            base_url=org_module_from_paths(server.paths).sidecar_url(),
            path=path,
            extra_headers={"Authorization": request.headers.get("authorization", "")},
        )
    except httpx.HTTPError as exc:
        raise OctopError(
            ErrorCode.INTERNAL_ERROR, "organization service unavailable", status=503
        ) from exc


@router.post("/identity/login", summary="Sign in using the organization account")
async def organization_login(request: Request, server: Any = Depends(get_server)) -> Response:
    return await forward(request, server, "api/auth/login")


@router.post("/identity/register", summary="Register an organization account")
async def organization_register(request: Request, server: Any = Depends(get_server)) -> Response:
    return await forward(request, server, "api/auth/register")


@router.post("/identity/refresh", summary="Refresh an organization session")
async def organization_refresh(request: Request, server: Any = Depends(get_server)) -> Response:
    return await forward(request, server, "api/auth/refresh")


@router.api_route(
    "/business/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
    summary="Organization business API (organization identity required)",
)
async def business_proxy(
    path: str,
    request: Request,
    server: Any = Depends(get_server),
    _user: Any = Depends(current_user),
) -> Response:
    if not (path.startswith("api/") or path.startswith("uploads/")):
        raise OctopError(ErrorCode.FORBIDDEN, "unsupported organization resource")
    return await forward(request, server, path)

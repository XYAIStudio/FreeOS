"""In-host talent market — openXYOS ``/api/talent`` shape, FreeOS JWT."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server
from octop.i18n import tr
from octop.infra.server import OctopServer
from octop.infra.utils.locale import resolve_request_locale
from octop.modules.org_os.org_chart.host_ingest import recruit_host_talent
from octop.modules.org_os.org_chart.store import OrgChartStore
from octop.modules.org_os.service import org_module_from_paths

router = APIRouter()


class TalentRecruitBody(BaseModel):
    department_id: int | None = Field(default=None)


def _tenant_id(server: OctopServer) -> str:
    return org_module_from_paths(server.paths).tenant_id() or "default"


def _store(server: OctopServer) -> OrgChartStore:
    return OrgChartStore(server.paths.root)


def _locale(request: Request) -> str:
    return resolve_request_locale(request)


def _fail(request: Request, key: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"success": False, "error": tr(key, _locale(request))},
    )


def _ok(data: Any = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"success": True}
    if data is not None:
        payload["data"] = data
    return payload


def _can_write(user: Any) -> bool:
    return bool(getattr(user, "is_admin", False))


@router.get("/talent", summary="List host talent-market rows")
async def list_talent(
    type: str = Query(default=""),
    status: str = Query(default="available"),
    search: str = Query(default=""),
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    rows = await asyncio.to_thread(
        store.list_talent,
        tenant_id=_tenant_id(server),
        status=status or "available",
        talent_type=type or None,
        search=search,
    )
    return _ok(rows)


@router.get("/talent/stats", summary="Host talent-market stats")
async def talent_stats(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    data = await asyncio.to_thread(store.talent_stats, tenant_id=_tenant_id(server))
    return _ok(data)


@router.get("/talent/{talent_id}", summary="Host talent detail", response_model=None)
async def get_talent(
    talent_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    store = _store(server)
    row = await asyncio.to_thread(store.get_talent, talent_id, tenant_id=_tenant_id(server))
    if row is None:
        return _fail(request, "org.talent.not_found", 404)
    return _ok(row)


@router.post("/talent/{talent_id}/recruit", summary="Recruit talent into the host directory")
async def recruit_talent(
    talent_id: int,
    request: Request,
    body: TalentRecruitBody | None = None,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_write(user):
        return _fail(request, "org.talent.forbidden", 403)
    try:
        landed = await asyncio.to_thread(
            recruit_host_talent,
            server.paths.root,
            tenant_id=_tenant_id(server),
            talent_id=talent_id,
            department_id=body.department_id if body is not None else None,
        )
    except KeyError as exc:
        reason = str(exc).strip("'\"")
        if reason == "department":
            return _fail(request, "org.chart.department_not_found", 400)
        return _fail(request, "org.talent.not_found", 404)
    return _ok(landed)

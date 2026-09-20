"""In-host org chart CRUD — openXYOS ``/api/org`` shape, FreeOS JWT."""

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
from octop.modules.org_os.org_chart.store import OrgChartStore
from octop.modules.org_os.service import org_module_from_paths

router = APIRouter()


class DepartmentWriteBody(BaseModel):
    name: str | None = None
    parent_id: int | None = Field(default=None)
    sort_order: int | None = None
    description: str | None = None
    department_code: str | None = None
    function_type: str | None = None
    level: int | None = None


class OrgImportBody(BaseModel):
    departments: list[dict[str, Any]] = Field(default_factory=list)
    reporting_lines: list[dict[str, Any]] = Field(default_factory=list)


class EmployeeWriteBody(BaseModel):
    name: str | None = None
    department_id: int | None = None
    role: str | None = None
    description: str | None = None
    employee_type: str | None = None
    agent_type: str | None = None
    skills: str | None = None
    avatar_emoji: str | None = None
    status: str | None = None
    reports_to: int | None = None


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


@router.get("/org/tree", summary="Organization tree (departments + active employees)")
async def org_tree(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    roots = await asyncio.to_thread(store.tree, tenant_id=_tenant_id(server))
    return _ok(roots)


@router.get("/org/departments", summary="List organization departments")
async def list_departments(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    rows = await asyncio.to_thread(store.list_departments, tenant_id=_tenant_id(server))
    return _ok(rows)


@router.post("/org/departments", summary="Create a department", response_model=None)
async def create_department(
    body: DepartmentWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_write(user):
        return _fail(request, "org.chart.forbidden", 403)
    name = (body.name or "").strip()
    if not name:
        return _fail(request, "org.chart.name_required", 400)
    store = _store(server)
    try:
        row = await asyncio.to_thread(
            store.create_department,
            tenant_id=_tenant_id(server),
            name=name,
            parent_id=body.parent_id,
            sort_order=body.sort_order or 0,
            description=body.description or "",
            department_code=body.department_code,
            function_type=body.function_type or "functional",
            level=body.level or 1,
        )
    except KeyError:
        return _fail(request, "org.chart.parent_not_found", 400)
    return _ok({"id": row["id"], **row})


@router.put("/org/departments/{department_id}", summary="Update a department", response_model=None)
async def update_department(
    department_id: int,
    body: DepartmentWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_write(user):
        return _fail(request, "org.chart.forbidden", 403)
    fields = body.model_dump(exclude_unset=True)
    if "name" in fields and not str(fields.get("name") or "").strip():
        return _fail(request, "org.chart.name_required", 400)
    if "name" in fields:
        fields["name"] = str(fields["name"]).strip()
    if not fields:
        return _fail(request, "org.chart.no_updates", 400)
    store = _store(server)
    try:
        row = await asyncio.to_thread(
            store.update_department,
            department_id,
            tenant_id=_tenant_id(server),
            fields=fields,
        )
    except KeyError:
        return _fail(request, "org.chart.parent_not_found", 400)
    except ValueError:
        return _fail(request, "org.chart.cycle", 400)
    if row is None:
        return _fail(request, "org.chart.department_not_found", 404)
    return _ok(row)


@router.delete(
    "/org/departments/{department_id}",
    summary="Delete an empty department",
    response_model=None,
)
async def delete_department(
    department_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_write(user):
        return _fail(request, "org.chart.forbidden", 403)
    store = _store(server)
    reason = await asyncio.to_thread(
        store.delete_department, department_id, tenant_id=_tenant_id(server)
    )
    if reason == "missing":
        return _fail(request, "org.chart.department_not_found", 404)
    if reason == "has_employees":
        return _fail(request, "org.chart.has_employees", 400)
    if reason == "has_children":
        return _fail(request, "org.chart.has_children", 400)
    return _ok()


@router.get("/org/employees", summary="List directory employees")
async def list_employees(
    type: str = Query(default=""),
    department_id: int | None = Query(default=None),
    status: str = Query(default="active"),
    search: str = Query(default=""),
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    rows = await asyncio.to_thread(
        store.list_employees,
        tenant_id=_tenant_id(server),
        status=status or "active",
        employee_type=type or None,
        department_id=department_id,
        search=search,
    )
    return _ok(rows)


@router.get("/org/employees/stats", summary="Directory employee stats")
async def employee_stats(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    data = await asyncio.to_thread(store.employee_stats, tenant_id=_tenant_id(server))
    return _ok(data)


@router.get(
    "/org/employees/{employee_id}",
    summary="Directory employee detail",
    response_model=None,
)
async def get_employee(
    employee_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    store = _store(server)
    row = await asyncio.to_thread(store.get_employee, employee_id, tenant_id=_tenant_id(server))
    if row is None:
        return _fail(request, "org.chart.employee_not_found", 404)
    return _ok(row)


@router.post("/org/employees", summary="Create a directory employee", response_model=None)
async def create_employee(
    body: EmployeeWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_write(user):
        return _fail(request, "org.chart.forbidden", 403)
    name = (body.name or "").strip()
    if not name or body.department_id is None:
        return _fail(request, "org.chart.name_department_required", 400)
    store = _store(server)
    try:
        row = await asyncio.to_thread(
            store.create_employee,
            tenant_id=_tenant_id(server),
            name=name,
            department_id=int(body.department_id),
            role=body.role or "",
            description=body.description or "",
            employee_type=body.employee_type or "human",
            agent_type=body.agent_type,
            skills=body.skills or "",
            avatar_emoji=body.avatar_emoji or "👤",
            status=body.status or "active",
            reports_to=body.reports_to,
        )
    except KeyError as exc:
        if str(exc) == "'reports_to'" or "reports_to" in str(exc):
            return _fail(request, "org.chart.reports_to_not_found", 400)
        return _fail(request, "org.chart.department_not_found", 400)
    except ValueError:
        return _fail(request, "org.chart.reports_to_cycle", 400)
    return _ok({"id": row["id"], **row})


@router.put(
    "/org/employees/{employee_id}", summary="Update a directory employee", response_model=None
)
async def update_employee(
    employee_id: int,
    body: EmployeeWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_write(user):
        return _fail(request, "org.chart.forbidden", 403)
    fields = body.model_dump(exclude_unset=True)
    if "name" in fields and not str(fields.get("name") or "").strip():
        return _fail(request, "org.chart.name_required", 400)
    if "name" in fields:
        fields["name"] = str(fields["name"]).strip()
    if not fields:
        return _fail(request, "org.chart.no_updates", 400)
    store = _store(server)
    try:
        row = await asyncio.to_thread(
            store.update_employee,
            employee_id,
            tenant_id=_tenant_id(server),
            fields=fields,
        )
    except KeyError as exc:
        if str(exc) == "'reports_to'" or "reports_to" in str(exc):
            return _fail(request, "org.chart.reports_to_not_found", 400)
        return _fail(request, "org.chart.department_not_found", 400)
    except ValueError as exc:
        if "reports_to" in str(exc):
            return _fail(request, "org.chart.reports_to_cycle", 400)
        return _fail(request, "org.chart.cycle", 400)
    if row is None:
        return _fail(request, "org.chart.employee_not_found", 404)
    return _ok(row)


@router.post("/org/import", summary="Import departments and reporting lines", response_model=None)
async def import_org_chart(
    body: OrgImportBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_write(user):
        return _fail(request, "org.chart.forbidden", 403)
    store = _store(server)
    tenant = _tenant_id(server)
    departments = await asyncio.to_thread(
        store.import_departments, tenant_id=tenant, items=list(body.departments)
    )
    reporting = await asyncio.to_thread(
        store.import_reporting_lines, tenant_id=tenant, items=list(body.reporting_lines)
    )
    tree = await asyncio.to_thread(store.tree, tenant_id=tenant)
    return _ok({"departments": departments, "reporting_lines": reporting, "tree": tree})


@router.delete(
    "/org/employees/{employee_id}",
    summary="Deactivate a directory employee",
    response_model=None,
)
async def delete_employee(
    employee_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_write(user):
        return _fail(request, "org.chart.forbidden", 403)
    store = _store(server)
    deleted = await asyncio.to_thread(
        store.deactivate_employee, employee_id, tenant_id=_tenant_id(server)
    )
    if not deleted:
        return _fail(request, "org.chart.employee_not_found", 404)
    return _ok()

"""In-host organization reflections CRUD — openXYOS-shaped envelope, FreeOS JWT."""

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
from octop.modules.org_os.reflections.store import (
    REFLECTION_TYPES,
    ReflectionStore,
    has_content,
)
from octop.modules.org_os.service import org_module_from_paths
from octop.modules.org_os.tasks.store import TaskStore

router = APIRouter()


class ReflectionWriteBody(BaseModel):
    employee_id: int | None = Field(default=None)
    task_id: int | None = Field(default=None)
    reflection_type: str | None = None
    success_factors: str | None = None
    failure_reasons: str | None = None
    knowledge_gaps: str | None = None
    improvement_plans: str | None = None
    extracted_skills: str | None = None
    learned_knowledge: str | None = None
    importance_score: int | None = Field(default=None)


def _tenant_id(server: OctopServer) -> str:
    return org_module_from_paths(server.paths).tenant_id() or "default"


def _store(server: OctopServer) -> ReflectionStore:
    return ReflectionStore(server.paths.root)


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


def _resolve_employee(server: OctopServer, tenant_id: str, employee_id: int | None) -> int | None:
    if employee_id is None or int(employee_id) <= 0:
        return 0
    chart = OrgChartStore(server.paths.root)
    employee = chart.get_employee(int(employee_id), tenant_id=tenant_id)
    if employee is None or employee.get("status") != "active":
        return None
    return int(employee["id"])


def _resolve_task(
    server: OctopServer, tenant_id: str, task_id: int | None
) -> tuple[bool, int | None]:
    if task_id is None:
        return True, None
    task = TaskStore(server.paths.root).get(int(task_id), tenant_id=tenant_id)
    if task is None:
        return False, None
    return True, int(task["id"])


@router.get("/reflections", summary="List organization reflections")
async def list_reflections(
    employee_id: int | None = Query(default=None),
    reflection_type: str = Query(default="", alias="type"),
    search: str = Query(default=""),
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    rows = await asyncio.to_thread(
        store.list,
        tenant_id=_tenant_id(server),
        employee_id=employee_id,
        reflection_type=reflection_type,
        search=search,
    )
    return _ok(rows)


@router.get("/reflections/stats", summary="Organization reflection counts by type")
async def reflection_stats(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    data = await asyncio.to_thread(store.stats, tenant_id=_tenant_id(server))
    return _ok(data)


@router.get(
    "/reflections/{reflection_id}",
    summary="Organization reflection detail",
    response_model=None,
)
async def get_reflection(
    reflection_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    store = _store(server)
    row = await asyncio.to_thread(store.get, reflection_id, tenant_id=_tenant_id(server))
    if row is None:
        return _fail(request, "org.reflections.not_found", 404)
    return _ok(row)


@router.post("/reflections", summary="Create an organization reflection", response_model=None)
async def create_reflection(
    body: ReflectionWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    payload = body.model_dump()
    if not has_content(payload):
        return _fail(request, "org.reflections.content_required", 400)
    kind = (body.reflection_type or "task_completion").strip().lower()
    if kind not in REFLECTION_TYPES:
        return _fail(request, "org.reflections.invalid_type", 400)
    tenant = _tenant_id(server)
    employee_id = _resolve_employee(server, tenant, body.employee_id)
    if employee_id is None:
        return _fail(request, "org.reflections.employee_invalid", 400)
    task_ok, task_id = _resolve_task(server, tenant, body.task_id)
    if not task_ok:
        return _fail(request, "org.reflections.task_invalid", 400)
    store = _store(server)
    row = await asyncio.to_thread(
        store.create,
        tenant_id=tenant,
        employee_id=employee_id,
        task_id=task_id,
        reflection_type=kind,
        success_factors=body.success_factors,
        failure_reasons=body.failure_reasons,
        knowledge_gaps=body.knowledge_gaps,
        improvement_plans=body.improvement_plans,
        extracted_skills=body.extracted_skills,
        learned_knowledge=body.learned_knowledge,
        importance_score=body.importance_score if body.importance_score is not None else 50,
    )
    return _ok(row)


@router.delete(
    "/reflections/{reflection_id}",
    summary="Delete an organization reflection",
    response_model=None,
)
async def delete_reflection(
    reflection_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    store = _store(server)
    deleted = await asyncio.to_thread(store.delete, reflection_id, tenant_id=_tenant_id(server))
    if not deleted:
        return _fail(request, "org.reflections.not_found", 404)
    return _ok()

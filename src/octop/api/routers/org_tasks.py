"""In-host organization tasks CRUD — openXYOS-shaped envelope, FreeOS JWT."""

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
from octop.modules.org_os.tasks.store import TASK_STATUSES, TaskStore

router = APIRouter()


class TaskWriteBody(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    assigned_to: int | None = Field(default=None)


class TaskTransitionBody(BaseModel):
    to: str = ""


class SubtaskWriteBody(BaseModel):
    title: str | None = None
    completed: bool | int | None = None


class CommentWriteBody(BaseModel):
    content: str = ""


def _tenant_id(server: OctopServer) -> str:
    return org_module_from_paths(server.paths).tenant_id() or "default"


def _store(server: OctopServer) -> TaskStore:
    return TaskStore(server.paths.root)


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


def _user_id(user: Any) -> int:
    return int(getattr(user, "id", 0) or 0)


def _creator_name(user: Any) -> str:
    label = getattr(user, "label", None)
    if isinstance(label, str) and label.strip():
        return label.strip()
    return str(getattr(user, "display_name", "") or getattr(user, "username", "") or "")


def _resolve_assignee(
    server: OctopServer, tenant_id: str, assigned_to: int | None
) -> tuple[int | None, str | None] | None:
    if assigned_to is None:
        return (None, None)
    chart = OrgChartStore(server.paths.root)
    employee = chart.get_employee(assigned_to, tenant_id=tenant_id)
    if employee is None or employee.get("status") != "active":
        return None
    name = str(employee.get("name") or "").strip() or None
    return (int(employee["id"]), name)


@router.get("/tasks", summary="List organization tasks")
async def list_tasks(
    status: str = Query(default="all"),
    priority: str = Query(default=""),
    assigned_to: int | None = Query(default=None),
    search: str = Query(default=""),
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    rows = await asyncio.to_thread(
        store.list,
        tenant_id=_tenant_id(server),
        status=status,
        priority=priority,
        assigned_to=assigned_to,
        search=search,
    )
    return _ok(rows)


@router.get("/tasks/stats", summary="Organization task counts by status")
async def task_stats(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    data = await asyncio.to_thread(store.stats, tenant_id=_tenant_id(server))
    return _ok(data)


@router.get("/tasks/{task_id}", summary="Organization task detail", response_model=None)
async def get_task(
    task_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    store = _store(server)
    row = await asyncio.to_thread(store.get, task_id, tenant_id=_tenant_id(server))
    if row is None:
        return _fail(request, "org.tasks.not_found", 404)
    return _ok(row)


@router.post("/tasks", summary="Create an organization task", response_model=None)
async def create_task(
    body: TaskWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    title = (body.title or "").strip()
    if not title:
        return _fail(request, "org.tasks.title_required", 400)
    tenant = _tenant_id(server)
    assignee = _resolve_assignee(server, tenant, body.assigned_to)
    if assignee is None:
        return _fail(request, "org.tasks.assignee_invalid", 400)
    assigned_to, assignee_name = assignee
    store = _store(server)
    row = await asyncio.to_thread(
        store.create,
        tenant_id=tenant,
        title=title,
        description=(body.description or "").strip(),
        priority=body.priority or "medium",
        assigned_to=assigned_to,
        assignee_name=assignee_name,
        created_by=_user_id(user),
        creator_name=_creator_name(user),
    )
    return _ok(row)


@router.put("/tasks/{task_id}", summary="Update an organization task", response_model=None)
async def update_task(
    task_id: int,
    body: TaskWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    tenant = _tenant_id(server)
    assigned_to: Any = ...
    assignee_name: Any = ...
    if "assigned_to" in body.model_fields_set:
        assignee = _resolve_assignee(server, tenant, body.assigned_to)
        if assignee is None:
            return _fail(request, "org.tasks.assignee_invalid", 400)
        assigned_to, assignee_name = assignee
    title = body.title.strip() if body.title is not None else None
    if title is not None and not title:
        return _fail(request, "org.tasks.title_required", 400)
    store = _store(server)
    row = await asyncio.to_thread(
        store.update,
        task_id,
        tenant_id=tenant,
        title=title,
        description=body.description,
        priority=body.priority,
        assigned_to=assigned_to,
        assignee_name=assignee_name,
    )
    if row is None:
        return _fail(request, "org.tasks.not_found", 404)
    return _ok(row)


@router.delete("/tasks/{task_id}", summary="Delete an organization task", response_model=None)
async def delete_task(
    task_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    store = _store(server)
    deleted = await asyncio.to_thread(store.delete, task_id, tenant_id=_tenant_id(server))
    if not deleted:
        return _fail(request, "org.tasks.not_found", 404)
    return _ok()


@router.post(
    "/tasks/{task_id}/transition",
    summary="Move an organization task to another status",
    response_model=None,
)
async def transition_task(
    task_id: int,
    body: TaskTransitionBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    target = (body.to or "").strip().lower()
    if target not in TASK_STATUSES:
        return _fail(request, "org.tasks.invalid_status", 400)
    store = _store(server)
    row = await asyncio.to_thread(
        store.transition, task_id, tenant_id=_tenant_id(server), to=target
    )
    if row is None:
        return _fail(request, "org.tasks.not_found", 404)
    return _ok(row)


@router.post(
    "/tasks/{task_id}/subtasks",
    summary="Add a subtask",
    response_model=None,
)
async def add_subtask(
    task_id: int,
    body: SubtaskWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    title = (body.title or "").strip()
    if not title:
        return _fail(request, "org.tasks.title_required", 400)
    store = _store(server)
    row = await asyncio.to_thread(
        store.add_subtask, task_id, tenant_id=_tenant_id(server), title=title
    )
    if row is None:
        return _fail(request, "org.tasks.not_found", 404)
    return _ok(row)


@router.put(
    "/tasks/{task_id}/subtasks/{subtask_id}",
    summary="Update a subtask",
    response_model=None,
)
async def update_subtask(
    task_id: int,
    subtask_id: int,
    body: SubtaskWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if body.title is None and body.completed is None:
        return _fail(request, "org.tasks.no_updates", 400)
    title = body.title.strip() if body.title is not None else None
    if title is not None and not title:
        return _fail(request, "org.tasks.title_required", 400)
    store = _store(server)
    row = await asyncio.to_thread(
        store.update_subtask,
        task_id,
        subtask_id,
        tenant_id=_tenant_id(server),
        title=title,
        completed=body.completed,
    )
    if row is None:
        return _fail(request, "org.tasks.not_found", 404)
    return _ok(row)


@router.delete(
    "/tasks/{task_id}/subtasks/{subtask_id}",
    summary="Delete a subtask",
    response_model=None,
)
async def delete_subtask(
    task_id: int,
    subtask_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    store = _store(server)
    deleted = await asyncio.to_thread(
        store.delete_subtask, task_id, subtask_id, tenant_id=_tenant_id(server)
    )
    if not deleted:
        return _fail(request, "org.tasks.not_found", 404)
    return _ok()


@router.post(
    "/tasks/{task_id}/comments",
    summary="Add a human comment (not agent chat)",
    response_model=None,
)
async def add_comment(
    task_id: int,
    body: CommentWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    content = body.content.strip()
    if not content:
        return _fail(request, "org.tasks.content_required", 400)
    store = _store(server)
    row = await asyncio.to_thread(
        store.add_comment,
        task_id,
        tenant_id=_tenant_id(server),
        content=content,
        user_id=_user_id(user),
        user_name=_creator_name(user),
    )
    if row is None:
        return _fail(request, "org.tasks.not_found", 404)
    return _ok(row)

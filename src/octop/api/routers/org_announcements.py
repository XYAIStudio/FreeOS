"""In-host announcements CRUD — openXYOS-shaped envelope, FreeOS JWT."""

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
from octop.modules.org_os.announcements.store import AnnouncementStore
from octop.modules.org_os.service import org_module_from_paths

router = APIRouter()


class AnnouncementWriteBody(BaseModel):
    title: str = ""
    content: str = ""
    type: str = "notice"
    priority: str = "normal"
    is_pinned: bool | int = 0
    expires_at: str | None = Field(default=None)


def _tenant_id(server: OctopServer) -> str:
    return org_module_from_paths(server.paths).tenant_id() or "default"


def _store(server: OctopServer) -> AnnouncementStore:
    return AnnouncementStore(server.paths.root)


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


def _can_publish(user: Any) -> bool:
    return bool(getattr(user, "is_admin", False))


def _creator_name(user: Any) -> str:
    label = getattr(user, "label", None)
    if isinstance(label, str) and label.strip():
        return label.strip()
    return str(getattr(user, "username", "") or getattr(user, "display_name", "") or "")


def _total_users(server: OctopServer) -> int:
    services = getattr(server, "services", None)
    if services is None:
        return 1
    repo = getattr(services, "user_repo", None)
    if repo is None:
        return 1
    try:
        users = repo.list()
        return max(1, len(users))
    except Exception:
        return 1


def _user_id(user: Any) -> int:
    return int(getattr(user, "id", 0) or 0)


@router.get("/announcements", summary="List organization announcements")
async def list_announcements(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    type: str = Query(default="all"),
    search: str = Query(default=""),
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    data = await asyncio.to_thread(
        store.list_page,
        tenant_id=_tenant_id(server),
        user_id=_user_id(user),
        page=page,
        limit=limit,
        type=type,
        search=search,
        total_users=_total_users(server),
    )
    return _ok(data)


@router.get("/announcements/pinned", summary="List pinned announcements")
async def list_pinned_announcements(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    rows = await asyncio.to_thread(store.pinned, tenant_id=_tenant_id(server))
    return _ok(rows)


@router.get("/announcements/action/unread", summary="Unread announcement count")
async def unread_announcements(
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    count = await asyncio.to_thread(
        store.unread_count,
        tenant_id=_tenant_id(server),
        user_id=_user_id(user),
    )
    return _ok({"count": count})


@router.post("/announcements/read-all", summary="Mark all announcements read")
async def read_all_announcements(
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any]:
    store = _store(server)
    marked = await asyncio.to_thread(
        store.mark_all_read,
        tenant_id=_tenant_id(server),
        user_id=_user_id(user),
    )
    return _ok({"marked": marked})


@router.get(
    "/announcements/{announcement_id}",
    summary="Announcement detail (marks read)",
    response_model=None,
)
async def get_announcement(
    announcement_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    store = _store(server)
    tenant = _tenant_id(server)
    row = await asyncio.to_thread(store.get, announcement_id, tenant_id=tenant)
    if row is None:
        return _fail(request, "org.announcements.not_found", 404)
    uid = _user_id(user)
    await asyncio.to_thread(store.mark_read, announcement_id, user_id=uid)
    decorated = await asyncio.to_thread(
        store.decorate,
        row,
        user_id=uid,
        total_users=_total_users(server),
    )
    return _ok(decorated)


@router.post(
    "/announcements/{announcement_id}/read",
    summary="Mark one announcement read",
    response_model=None,
)
async def read_announcement(
    announcement_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    store = _store(server)
    row = await asyncio.to_thread(store.get, announcement_id, tenant_id=_tenant_id(server))
    if row is None:
        return _fail(request, "org.announcements.not_found", 404)
    await asyncio.to_thread(store.mark_read, announcement_id, user_id=_user_id(user))
    return _ok()


@router.post("/announcements", summary="Publish an announcement", response_model=None)
async def create_announcement(
    body: AnnouncementWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_publish(user):
        return _fail(request, "org.announcements.forbidden", 403)
    title = body.title.strip()
    content = body.content.strip()
    if not title or not content:
        return _fail(request, "org.announcements.title_content_required", 400)
    store = _store(server)
    row = await asyncio.to_thread(
        store.create,
        tenant_id=_tenant_id(server),
        title=title,
        content=content,
        created_by=_user_id(user),
        creator_name=_creator_name(user),
        type=body.type,
        priority=body.priority,
        is_pinned=body.is_pinned,
        expires_at=body.expires_at,
    )
    return _ok(row)


@router.put(
    "/announcements/{announcement_id}",
    summary="Update an announcement",
    response_model=None,
)
async def update_announcement(
    announcement_id: int,
    body: AnnouncementWriteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_publish(user):
        return _fail(request, "org.announcements.forbidden", 403)
    title = body.title.strip()
    content = body.content.strip()
    if not title or not content:
        return _fail(request, "org.announcements.title_content_required", 400)
    store = _store(server)
    row = await asyncio.to_thread(
        store.update,
        announcement_id,
        tenant_id=_tenant_id(server),
        title=title,
        content=content,
        type=body.type,
        priority=body.priority,
        is_pinned=body.is_pinned,
        expires_at=body.expires_at,
    )
    if row is None:
        return _fail(request, "org.announcements.not_found", 404)
    return _ok(row)


@router.delete(
    "/announcements/{announcement_id}",
    summary="Soft-delete an announcement",
    response_model=None,
)
async def delete_announcement(
    announcement_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_publish(user):
        return _fail(request, "org.announcements.forbidden", 403)
    store = _store(server)
    deleted = await asyncio.to_thread(
        store.soft_delete, announcement_id, tenant_id=_tenant_id(server)
    )
    if not deleted:
        return _fail(request, "org.announcements.not_found", 404)
    return _ok()


@router.put(
    "/announcements/{announcement_id}/toggle-pin",
    summary="Toggle announcement pin",
    response_model=None,
)
async def toggle_pin_announcement(
    announcement_id: int,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_publish(user):
        return _fail(request, "org.announcements.forbidden", 403)
    store = _store(server)
    data = await asyncio.to_thread(store.toggle_pin, announcement_id, tenant_id=_tenant_id(server))
    if data is None:
        return _fail(request, "org.announcements.not_found", 404)
    return _ok(data)

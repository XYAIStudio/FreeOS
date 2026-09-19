"""In-host announcements store and /api/org-module/announcements."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from octop.api.deps import current_user, get_server
from octop.api.routers.org_announcements import router as announcements_router
from octop.api.routers.org_module import router
from octop.infra.users.identity import Role, User
from octop.modules.org_os.announcements.store import AnnouncementStore
from octop.modules.org_os.contract import (
    SHARED_ORG_UI_MODULES,
    assert_shared_modules_in_catalog,
)


def _admin() -> User:
    return User(id=1, username="admin", role=Role.ADMIN, display_name="Ada")


def _member() -> User:
    return User(id=2, username="member", role=Role.USER, display_name="Mo")


def _client(tmp_path: Path, user: User) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/org-module")
    server = SimpleNamespace(
        paths=SimpleNamespace(config=tmp_path / "config.json", root=tmp_path),
        services=None,
    )
    app.dependency_overrides[current_user] = lambda: user
    app.dependency_overrides[get_server] = lambda: server
    return TestClient(app)


def test_shared_announcements_module_is_in_catalog() -> None:
    assert "announcements" in SHARED_ORG_UI_MODULES
    assert_shared_modules_in_catalog()


def test_store_create_list_read(tmp_path: Path) -> None:
    store = AnnouncementStore(tmp_path)
    row = store.create(
        tenant_id="default",
        title="Hello",
        content="World",
        created_by=1,
        creator_name="Ada",
        type="notice",
        is_pinned=True,
    )
    assert row["id"] == 1
    assert row["is_pinned"] == 1
    listed = store.list_page(tenant_id="default", user_id=2, total_users=2)
    assert listed["total"] == 1
    item = listed["list"][0]
    assert item["is_read"] is False
    assert item["title"] == "Hello"
    store.mark_read(1, user_id=2)
    listed = store.list_page(tenant_id="default", user_id=2, total_users=2)
    assert listed["list"][0]["is_read"] is True
    assert listed["list"][0]["read_count"] == 1
    assert listed["list"][0]["read_percent"] == 50
    assert store.unread_count(tenant_id="default", user_id=2) == 0


def test_store_search_and_soft_delete(tmp_path: Path) -> None:
    store = AnnouncementStore(tmp_path)
    store.create(
        tenant_id="default",
        title="Policy A",
        content="Keep secrets",
        created_by=1,
        creator_name="Ada",
        type="policy",
    )
    store.create(
        tenant_id="default",
        title="News B",
        content="Ship it",
        created_by=1,
        creator_name="Ada",
        type="news",
    )
    found = store.list_page(tenant_id="default", user_id=1, search="secrets")
    assert found["total"] == 1
    assert found["list"][0]["title"] == "Policy A"
    store.soft_delete(found["list"][0]["id"], tenant_id="default")
    assert store.list_page(tenant_id="default", user_id=1)["total"] == 1


def test_store_isolates_tenants(tmp_path: Path) -> None:
    store = AnnouncementStore(tmp_path)
    store.create(
        tenant_id="a",
        title="A",
        content="one",
        created_by=1,
        creator_name="Ada",
    )
    store.create(
        tenant_id="b",
        title="B",
        content="two",
        created_by=1,
        creator_name="Ada",
    )
    assert store.list_page(tenant_id="a", user_id=1)["total"] == 1
    assert store.get(1, tenant_id="b") is None


def test_api_list_create_mark_read(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    created = admin.post(
        "/api/org-module/announcements",
        json={"title": "All hands", "content": "Friday 4pm", "type": "notice"},
    )
    assert created.status_code == 200
    body = created.json()
    assert body["success"] is True
    announcement_id = body["data"]["id"]

    listed = admin.get("/api/org-module/announcements")
    assert listed.json()["data"]["total"] == 1
    assert listed.json()["data"]["list"][0]["title"] == "All hands"

    member = _client(tmp_path, _member())
    unread = member.get("/api/org-module/announcements/action/unread")
    assert unread.json()["data"]["count"] == 1
    detail = member.get(f"/api/org-module/announcements/{announcement_id}")
    assert detail.status_code == 200
    assert detail.json()["data"]["is_read"] is True
    unread = member.get("/api/org-module/announcements/action/unread")
    assert unread.json()["data"]["count"] == 0


def test_api_member_cannot_publish(tmp_path: Path) -> None:
    member = _client(tmp_path, _member())
    response = member.post(
        "/api/org-module/announcements",
        json={"title": "Nope", "content": "denied"},
    )
    assert response.status_code == 403
    assert response.json()["success"] is False


def test_api_create_requires_title(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    response = admin.post(
        "/api/org-module/announcements",
        json={"title": "  ", "content": "x"},
    )
    assert response.status_code == 400


def test_api_update_pin_delete(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    created = admin.post(
        "/api/org-module/announcements",
        json={"title": "Pin me", "content": "body"},
    )
    announcement_id = created.json()["data"]["id"]
    updated = admin.put(
        f"/api/org-module/announcements/{announcement_id}",
        json={"title": "Pinned", "content": "body", "is_pinned": 1},
    )
    assert updated.json()["data"]["title"] == "Pinned"
    pinned = admin.put(
        f"/api/org-module/announcements/{announcement_id}/toggle-pin",
    )
    assert pinned.json()["data"]["is_pinned"] is False
    deleted = admin.delete(f"/api/org-module/announcements/{announcement_id}")
    assert deleted.status_code == 200
    missing = admin.get(f"/api/org-module/announcements/{announcement_id}")
    assert missing.status_code == 404


def test_announcement_routes_registered() -> None:
    paths = {getattr(route, "path", "") for route in announcements_router.routes}
    assert "/announcements" in paths
    assert "/announcements/action/unread" in paths
    assert "/announcements/{announcement_id}" in paths

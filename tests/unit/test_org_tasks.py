"""In-host organization tasks store and /api/org-module/tasks."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from octop.api.deps import current_user, get_server
from octop.api.routers.org_module import router
from octop.infra.users.identity import Role, User
from octop.modules.org_os.contract import (
    SHARED_ORG_UI_MODULES,
    assert_shared_modules_in_catalog,
)
from octop.modules.org_os.org_chart.store import OrgChartStore
from octop.modules.org_os.tasks.store import TaskStore


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


def test_shared_tasks_module_is_in_catalog() -> None:
    assert "tasks" in SHARED_ORG_UI_MODULES
    assert_shared_modules_in_catalog()


def test_store_create_list_stats(tmp_path: Path) -> None:
    store = TaskStore(tmp_path)
    row = store.create(
        tenant_id="default",
        title="Ship Tasks slice",
        description="Host org tasks",
        created_by=1,
        creator_name="Ada",
        priority="high",
    )
    assert row["id"] == 1
    assert row["status"] == "todo"
    assert row["subtask_count"] == 0
    listed = store.list(tenant_id="default")
    assert len(listed) == 1
    assert listed[0]["title"] == "Ship Tasks slice"
    stats = store.stats(tenant_id="default")
    assert stats == {
        "total": 1,
        "todo": 1,
        "in_progress": 0,
        "review": 0,
        "done": 0,
    }


def test_store_search_transition_subtask_comment(tmp_path: Path) -> None:
    store = TaskStore(tmp_path)
    store.create(
        tenant_id="default",
        title="Write docs",
        description="README",
        created_by=1,
        creator_name="Ada",
    )
    other = store.create(
        tenant_id="default",
        title="Ignore me",
        created_by=1,
        creator_name="Ada",
    )
    found = store.list(tenant_id="default", search="README")
    assert len(found) == 1
    task_id = found[0]["id"]
    moved = store.transition(task_id, tenant_id="default", to="in_progress")
    assert moved is not None
    assert moved["status"] == "in_progress"
    sub = store.add_subtask(task_id, tenant_id="default", title="Draft")
    assert sub is not None
    toggled = store.update_subtask(task_id, int(sub["id"]), tenant_id="default", completed=True)
    assert toggled is not None
    assert toggled["completed"] == 1
    comment = store.add_comment(
        task_id,
        tenant_id="default",
        content="Looks good",
        user_id=2,
        user_name="Mo",
    )
    assert comment is not None
    detail = store.get(task_id, tenant_id="default")
    assert detail is not None
    assert detail["subtask_done"] == 1
    assert detail["comment_count"] == 1
    assert detail["comments"][0]["content"] == "Looks good"
    assert store.delete_subtask(task_id, int(sub["id"]), tenant_id="default")
    assert store.delete(other["id"], tenant_id="default")
    assert store.list(tenant_id="default", search="Ignore") == []


def test_store_isolates_tenants(tmp_path: Path) -> None:
    store = TaskStore(tmp_path)
    store.create(tenant_id="a", title="A", created_by=1, creator_name="Ada")
    store.create(tenant_id="b", title="B", created_by=1, creator_name="Ada")
    assert [row["title"] for row in store.list(tenant_id="a")] == ["A"]
    assert store.get(1, tenant_id="b") is None


def test_api_member_can_create_and_transition(tmp_path: Path) -> None:
    member = _client(tmp_path, _member())
    created = member.post(
        "/api/org-module/tasks",
        json={"title": "Review policy", "description": "Legal", "priority": "medium"},
    )
    assert created.status_code == 200
    task_id = created.json()["data"]["id"]
    listed = member.get("/api/org-module/tasks")
    assert listed.status_code == 200
    assert listed.json()["data"][0]["title"] == "Review policy"
    stats = member.get("/api/org-module/tasks/stats")
    assert stats.json()["data"]["todo"] == 1
    moved = member.post(
        f"/api/org-module/tasks/{task_id}/transition",
        json={"to": "in_progress"},
    )
    assert moved.status_code == 200
    assert moved.json()["data"]["status"] == "in_progress"
    detail = member.get(f"/api/org-module/tasks/{task_id}")
    assert detail.json()["data"]["creator_name"] == "Mo"


def test_api_subtasks_comments_and_missing(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    created = admin.post("/api/org-module/tasks", json={"title": "Ship"})
    task_id = created.json()["data"]["id"]
    sub = admin.post(
        f"/api/org-module/tasks/{task_id}/subtasks",
        json={"title": "Check tests"},
    )
    assert sub.status_code == 200
    sub_id = sub.json()["data"]["id"]
    toggled = admin.put(
        f"/api/org-module/tasks/{task_id}/subtasks/{sub_id}",
        json={"completed": True},
    )
    assert toggled.json()["data"]["completed"] == 1
    comment = admin.post(
        f"/api/org-module/tasks/{task_id}/comments",
        json={"content": "Done on host"},
    )
    assert comment.json()["data"]["content"] == "Done on host"
    assert admin.delete(f"/api/org-module/tasks/{task_id}/subtasks/{sub_id}").status_code == 200
    missing = admin.get("/api/org-module/tasks/999")
    assert missing.status_code == 404
    blank = admin.post("/api/org-module/tasks", json={"title": "  "})
    assert blank.status_code == 400
    bad_status = admin.post(
        f"/api/org-module/tasks/{task_id}/transition",
        json={"to": "flying"},
    )
    assert bad_status.status_code == 400
    assert admin.delete(f"/api/org-module/tasks/{task_id}").status_code == 200
    assert admin.get(f"/api/org-module/tasks/{task_id}").status_code == 404


def test_api_assignee_uses_org_chart_employee(tmp_path: Path) -> None:
    chart = OrgChartStore(tmp_path)
    dept = chart.create_department(tenant_id="default", name="HQ")
    employee = chart.create_employee(
        tenant_id="default",
        name="Ada",
        department_id=int(dept["id"]),
    )
    admin = _client(tmp_path, _admin())
    created = admin.post(
        "/api/org-module/tasks",
        json={"title": "Pair", "assigned_to": employee["id"]},
    )
    assert created.status_code == 200
    assert created.json()["data"]["assignee_name"] == "Ada"
    denied = admin.post(
        "/api/org-module/tasks",
        json={"title": "Ghost", "assigned_to": 999},
    )
    assert denied.status_code == 400

"""In-host organization reflections store and /api/org-module/reflections."""

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
from octop.modules.org_os.reflections.store import ReflectionStore
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


def test_shared_reflections_module_is_in_catalog() -> None:
    assert "reflections" in SHARED_ORG_UI_MODULES
    assert_shared_modules_in_catalog()


def test_store_create_list_stats(tmp_path: Path) -> None:
    store = ReflectionStore(tmp_path)
    row = store.create(
        tenant_id="default",
        employee_id=0,
        reflection_type="error_learning",
        failure_reasons="const dead zone",
        improvement_plans="re-read after edit",
        importance_score=90,
    )
    assert row["id"] == 1
    assert row["reflection_type"] == "error_learning"
    assert row["importance_score"] == 90
    listed = store.list(tenant_id="default")
    assert len(listed) == 1
    assert listed[0]["failure_reasons"] == "const dead zone"
    stats = store.stats(tenant_id="default")
    assert stats["total"] == 1
    assert stats["error_learning"] == 1
    assert stats["task_completion"] == 0


def test_store_search_filter_and_delete(tmp_path: Path) -> None:
    store = ReflectionStore(tmp_path)
    store.create(
        tenant_id="default",
        reflection_type="knowledge_capture",
        learned_knowledge="Deploy after tsc",
        importance_score=80,
    )
    other = store.create(
        tenant_id="default",
        reflection_type="improvement",
        improvement_plans="Ignore me",
    )
    found = store.list(tenant_id="default", search="tsc")
    assert len(found) == 1
    typed = store.list(tenant_id="default", reflection_type="improvement")
    assert len(typed) == 1
    assert typed[0]["id"] == other["id"]
    assert store.delete(other["id"], tenant_id="default")
    assert store.list(tenant_id="default", search="Ignore") == []
    assert store.get(other["id"], tenant_id="default") is None


def test_store_isolates_tenants(tmp_path: Path) -> None:
    store = ReflectionStore(tmp_path)
    store.create(tenant_id="a", success_factors="A")
    store.create(tenant_id="b", success_factors="B")
    assert [row["success_factors"] for row in store.list(tenant_id="a")] == ["A"]
    assert store.get(1, tenant_id="b") is None


def test_api_member_can_create_list_and_delete(tmp_path: Path) -> None:
    member = _client(tmp_path, _member())
    created = member.post(
        "/api/org-module/reflections",
        json={
            "reflection_type": "task_completion",
            "success_factors": "Wrote tests first",
            "importance_score": 70,
        },
    )
    assert created.status_code == 200
    reflection_id = created.json()["data"]["id"]
    listed = member.get("/api/org-module/reflections")
    assert listed.status_code == 200
    assert listed.json()["data"][0]["success_factors"] == "Wrote tests first"
    stats = member.get("/api/org-module/reflections/stats")
    assert stats.json()["data"]["task_completion"] == 1
    detail = member.get(f"/api/org-module/reflections/{reflection_id}")
    assert detail.json()["data"]["importance_score"] == 70
    assert member.delete(f"/api/org-module/reflections/{reflection_id}").status_code == 200
    assert member.get(f"/api/org-module/reflections/{reflection_id}").status_code == 404


def test_api_validates_content_type_employee_and_task(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    blank = admin.post("/api/org-module/reflections", json={"reflection_type": "task_completion"})
    assert blank.status_code == 400
    bad_type = admin.post(
        "/api/org-module/reflections",
        json={"reflection_type": "poetry", "success_factors": "x"},
    )
    assert bad_type.status_code == 400
    ghost = admin.post(
        "/api/org-module/reflections",
        json={"employee_id": 999, "success_factors": "x"},
    )
    assert ghost.status_code == 400
    missing_task = admin.post(
        "/api/org-module/reflections",
        json={"task_id": 999, "success_factors": "x"},
    )
    assert missing_task.status_code == 400
    missing = admin.get("/api/org-module/reflections/999")
    assert missing.status_code == 404


def test_api_links_org_chart_employee_and_task(tmp_path: Path) -> None:
    chart = OrgChartStore(tmp_path)
    dept = chart.create_department(tenant_id="default", name="HQ")
    employee = chart.create_employee(
        tenant_id="default",
        name="Ada",
        department_id=int(dept["id"]),
    )
    task = TaskStore(tmp_path).create(
        tenant_id="default",
        title="Ship Reflections slice",
        created_by=1,
        creator_name="Ada",
    )
    admin = _client(tmp_path, _admin())
    created = admin.post(
        "/api/org-module/reflections",
        json={
            "employee_id": employee["id"],
            "task_id": task["id"],
            "reflection_type": "knowledge_capture",
            "learned_knowledge": "Host org store, no sidecar",
        },
    )
    assert created.status_code == 200
    data = created.json()["data"]
    assert data["employee_id"] == employee["id"]
    assert data["task_id"] == task["id"]
    filtered = admin.get(f"/api/org-module/reflections?employee_id={employee['id']}")
    assert len(filtered.json()["data"]) == 1

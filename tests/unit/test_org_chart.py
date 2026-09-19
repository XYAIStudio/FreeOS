"""In-host org chart store and /api/org-module/org."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from octop.api.deps import current_user, get_server
from octop.api.routers.org_chart import router as org_chart_router
from octop.api.routers.org_module import router
from octop.infra.users.identity import Role, User
from octop.modules.org_os.contract import (
    SHARED_ORG_UI_MODULES,
    assert_shared_modules_in_catalog,
)
from octop.modules.org_os.org_chart.store import OrgChartStore


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


def test_shared_organization_module_is_in_catalog() -> None:
    assert "organization" in SHARED_ORG_UI_MODULES
    assert "announcements" in SHARED_ORG_UI_MODULES
    assert "employees" in SHARED_ORG_UI_MODULES
    assert_shared_modules_in_catalog()


def test_store_tree_create_and_isolate(tmp_path: Path) -> None:
    store = OrgChartStore(tmp_path)
    hq = store.create_department(tenant_id="default", name="HQ")
    eng = store.create_department(tenant_id="default", name="Eng", parent_id=hq["id"])
    store.create_employee(
        tenant_id="default",
        name="Ada",
        department_id=eng["id"],
        role="Lead",
        employee_type="human",
    )
    store.create_employee(
        tenant_id="other",
        name="Other",
        department_id=store.create_department(tenant_id="other", name="Other HQ")["id"],
    )
    tree = store.tree(tenant_id="default")
    assert len(tree) == 1
    assert tree[0]["name"] == "HQ"
    assert tree[0]["children"][0]["name"] == "Eng"
    assert tree[0]["children"][0]["employees"][0]["name"] == "Ada"
    assert tree[0]["children"][0]["employees"][0]["is_online"] is False
    assert store.tree(tenant_id="other")[0]["name"] == "Other HQ"
    listed = store.list_employees(tenant_id="default", search="Ada")
    assert listed[0]["department_name"] == "Eng"
    stats = store.employee_stats(tenant_id="default")
    assert stats["total"] == 1
    assert stats["human"] == 1
    assert store.get_employee(listed[0]["id"], tenant_id="default")["name"] == "Ada"


def test_store_delete_guards_and_deactivate(tmp_path: Path) -> None:
    store = OrgChartStore(tmp_path)
    hq = store.create_department(tenant_id="default", name="HQ")
    child = store.create_department(tenant_id="default", name="Child", parent_id=hq["id"])
    emp = store.create_employee(tenant_id="default", name="Ada", department_id=child["id"])
    assert store.delete_department(hq["id"], tenant_id="default") == "has_children"
    assert store.delete_department(child["id"], tenant_id="default") == "has_employees"
    assert store.deactivate_employee(emp["id"], tenant_id="default") is True
    assert store.delete_department(child["id"], tenant_id="default") is None
    assert store.delete_department(hq["id"], tenant_id="default") is None


def test_store_rejects_parent_cycle(tmp_path: Path) -> None:
    store = OrgChartStore(tmp_path)
    hq = store.create_department(tenant_id="default", name="HQ")
    child = store.create_department(tenant_id="default", name="Child", parent_id=hq["id"])
    try:
        store.update_department(
            hq["id"],
            tenant_id="default",
            fields={"parent_id": child["id"]},
        )
        raise AssertionError("expected cycle")
    except ValueError as exc:
        assert "cycle" in str(exc)


def test_api_tree_create_update_delete(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    created = admin.post("/api/org-module/org/departments", json={"name": "HQ"})
    assert created.status_code == 200
    hq_id = created.json()["data"]["id"]
    child = admin.post(
        "/api/org-module/org/departments",
        json={"name": "Eng", "parent_id": hq_id, "function_type": "functional"},
    )
    child_id = child.json()["data"]["id"]
    emp = admin.post(
        "/api/org-module/org/employees",
        json={"name": "Ada", "department_id": child_id, "role": "Lead"},
    )
    assert emp.status_code == 200
    emp_id = emp.json()["data"]["id"]

    listed = admin.get("/api/org-module/org/employees")
    assert listed.status_code == 200
    assert listed.json()["data"][0]["name"] == "Ada"
    assert listed.json()["data"][0]["department_name"] == "Eng"
    detail = admin.get(f"/api/org-module/org/employees/{emp_id}")
    assert detail.json()["data"]["role"] == "Lead"
    stats = admin.get("/api/org-module/org/employees/stats")
    assert stats.json()["data"]["total"] == 1
    searched = admin.get("/api/org-module/org/employees?search=Ada&type=human")
    assert len(searched.json()["data"]) == 1
    missing = admin.get("/api/org-module/org/employees/999999")
    assert missing.status_code == 404

    tree = admin.get("/api/org-module/org/tree")
    assert tree.status_code == 200
    roots = tree.json()["data"]
    assert roots[0]["name"] == "HQ"
    assert roots[0]["children"][0]["employees"][0]["name"] == "Ada"

    updated = admin.put(
        f"/api/org-module/org/employees/{emp_id}",
        json={"role": "Principal"},
    )
    assert updated.json()["data"]["role"] == "Principal"
    renamed = admin.put(
        f"/api/org-module/org/departments/{child_id}",
        json={"name": "Engineering"},
    )
    assert renamed.json()["data"]["name"] == "Engineering"

    blocked = admin.delete(f"/api/org-module/org/departments/{child_id}")
    assert blocked.status_code == 400
    removed = admin.delete(f"/api/org-module/org/employees/{emp_id}")
    assert removed.status_code == 200
    gone = admin.get("/api/org-module/org/tree").json()["data"]
    assert gone[0]["children"][0]["employees"] == []
    assert admin.delete(f"/api/org-module/org/departments/{child_id}").status_code == 200


def test_api_member_cannot_write(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    admin.post("/api/org-module/org/departments", json={"name": "HQ"})
    member = _client(tmp_path, _member())
    tree = member.get("/api/org-module/org/tree")
    assert tree.status_code == 200
    assert tree.json()["data"][0]["name"] == "HQ"
    directory = member.get("/api/org-module/org/employees")
    assert directory.status_code == 200
    denied = member.post("/api/org-module/org/departments", json={"name": "Nope"})
    assert denied.status_code == 403
    assert denied.json()["success"] is False


def test_api_create_requires_name(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    response = admin.post("/api/org-module/org/departments", json={"name": "  "})
    assert response.status_code == 400
    missing_dept = admin.post("/api/org-module/org/employees", json={"name": "Ada"})
    assert missing_dept.status_code == 400


def test_org_chart_routes_registered() -> None:
    paths = {getattr(route, "path", "") for route in org_chart_router.routes}
    assert "/org/tree" in paths
    assert "/org/departments" in paths
    assert "/org/departments/{department_id}" in paths
    assert "/org/employees" in paths
    assert "/org/employees/stats" in paths
    assert "/org/employees/{employee_id}" in paths
    # Lifecycle colleagues stay on /employees; directory CRUD is /org/employees.
    module_paths = {getattr(route, "path", "") for route in router.routes}
    assert "/employees" in module_paths
    assert "/employees/spawn" in module_paths

"""In-host talent market BFF used by the org-ui Employees talent tab."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from octop.api.deps import current_user, get_server
from octop.api.routers.org_module import router
from octop.infra.users.identity import Role, User
from octop.modules.org_os.org_chart.host_ingest import land_host_org_surfaces
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


def test_talent_list_stats_and_recruit(tmp_path: Path) -> None:
    store = OrgChartStore(tmp_path)
    row = store.create_talent(
        tenant_id="default",
        name="Policy Analyst",
        talent_type="ai",
        skills="policy",
        slug="policy-analyst",
    )
    admin = _client(tmp_path, _admin())
    listed = admin.get("/api/org-module/talent")
    assert listed.status_code == 200
    assert listed.json()["data"][0]["name"] == "Policy Analyst"
    stats = admin.get("/api/org-module/talent/stats")
    assert stats.json()["data"]["total"] == 1
    recruited = admin.post(f"/api/org-module/talent/{row['id']}/recruit", json={})
    assert recruited.status_code == 200
    body = recruited.json()["data"]
    assert body["employee"]["name"] == "Policy Analyst"
    assert body["talent"]["status"] == "recruited"
    assert body["colleague_slug"] == "policy-analyst"
    empty = admin.get("/api/org-module/talent")
    assert empty.json()["data"] == []


def test_talent_recruit_missing_is_404(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    missing = admin.post("/api/org-module/talent/999/recruit", json={})
    assert missing.status_code == 404


def test_talent_recruit_forbidden_for_member(tmp_path: Path) -> None:
    store = OrgChartStore(tmp_path)
    row = store.create_talent(tenant_id="default", name="Ada")
    member = _client(tmp_path, _member())
    denied = member.post(f"/api/org-module/talent/{row['id']}/recruit", json={})
    assert denied.status_code == 403


def test_host_ingest_lands_directory_and_talent_without_node(tmp_path: Path) -> None:
    receipt = land_host_org_surfaces(
        tmp_path,
        tenant_id="acme",
        employees=[{"name": "Ops", "employee_type": "ai", "slug": "ops", "skills": "ops"}],
        talent=[{"name": "Scout", "talent_type": "ai", "slug": "scout", "skills": "search"}],
    )
    assert receipt.employees["created"] == 1
    assert receipt.talent["created"] == 1
    store = OrgChartStore(tmp_path)
    assert store.list_employees(tenant_id="acme")[0]["name"] == "Ops"
    assert store.list_talent(tenant_id="acme")[0]["name"] == "Scout"

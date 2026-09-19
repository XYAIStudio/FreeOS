"""In-host organization Agent Studio: colleagues + blueprint compile."""

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


def _blueprint() -> dict[str, object]:
    return {
        "schema": "openxyos.agent-blueprint.v1",
        "name": "Policy Analyst",
        "industry": "public-sector",
        "positioning": "Help operators review policy drafts with evidence.",
        "capabilities": ["Knowledge lookup", "Risk alerts"],
        "experience": "Escalate high-risk conclusions.",
    }


def test_shared_agents_module_is_in_catalog() -> None:
    assert "agents" in SHARED_ORG_UI_MODULES
    assert_shared_modules_in_catalog()


def test_api_snapshot_lists_empty_colleagues(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    snap = admin.get("/api/org-module/agents")
    assert snap.status_code == 200
    body = snap.json()["data"]
    assert body["scope"] == "org_module"
    assert body["schema"] == "openxyos.agent-blueprint.v1"
    assert body["colleagues"] == []
    assert body["stats"]["total"] == 0
    assert body["host_surfaces"]["experts"] == "/experts"
    assert body["host_surfaces"]["personalization"] == "/personalization"
    assert "chat_runtime" in body["not_on_this_page"]
    assert "sidecar_agent_studio" in body["not_on_this_page"]
    assert body["compile"] == "/api/org-module/blueprints/compile"
    assert "draft" in body["states"]
    assert "market" in body["next_states"]["draft"]


def test_api_member_can_read_snapshot(tmp_path: Path) -> None:
    member = _client(tmp_path, _member())
    snap = member.get("/api/org-module/agents")
    assert snap.status_code == 200
    assert snap.json()["data"]["colleagues"] == []


def test_compile_registers_draft_colleague(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    compiled = admin.post(
        "/api/org-module/blueprints/compile",
        json={"blueprint": _blueprint()},
    )
    assert compiled.status_code == 200, compiled.text
    payload = compiled.json()
    assert payload["slug"] == "policy-analyst"
    assert (tmp_path / "tenants" / "default" / "employees" / "policy-analyst" / "SOUL.md").is_file()

    snap = admin.get("/api/org-module/agents").json()["data"]
    assert snap["stats"]["total"] == 1
    row = snap["colleagues"][0]
    assert row["slug"] == "policy-analyst"
    assert row["lifecycle"] == "draft"
    assert row["spawned"] is False
    assert "market" in row["next"]


def test_compile_rejects_invalid_blueprint(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    response = admin.post(
        "/api/org-module/blueprints/compile",
        json={"blueprint": {"name": "Nope"}},
    )
    assert response.status_code == 400
    assert "positioning" in response.json()["detail"]


def test_transition_and_spawn_use_existing_lifecycle_routes(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    assert (
        admin.post(
            "/api/org-module/blueprints/compile",
            json={"blueprint": _blueprint()},
        ).status_code
        == 200
    )
    moved = admin.post(
        "/api/org-module/employees/transition",
        json={"slug": "policy-analyst", "state": "market"},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["lifecycle"] == "market"

    spawned = admin.post(
        "/api/org-module/employees/spawn",
        json={"slug": "policy-analyst"},
    )
    assert spawned.status_code == 200, spawned.text
    assert spawned.json()["slug"] == "policy-analyst"
    assert spawned.json()["agent_id"]

    snap = admin.get("/api/org-module/agents").json()["data"]
    row = snap["colleagues"][0]
    assert row["lifecycle"] == "market"
    assert row["spawned"] is True
    assert snap["stats"]["spawned"] == 1

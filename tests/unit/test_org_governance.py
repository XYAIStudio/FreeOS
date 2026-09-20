"""In-host governance pauses/audit BFF used by the org-ui Governance page."""

from __future__ import annotations

import time
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from octop.api.deps import current_user, get_server
from octop.api.routers.org_module import router
from octop.infra.errors import OctopError
from octop.infra.users.identity import Role, User
from octop.modules.org_os.contract import (
    SHARED_ORG_UI_MODULES,
    assert_shared_modules_in_catalog,
)
from octop.modules.org_os.governance.store import DurableGovernanceStore
from octop.modules.org_os.governance.types import PolicyRequest


def _admin() -> User:
    return User(id=1, username="admin", role=Role.ADMIN, display_name="Ada")


def _member() -> User:
    return User(id=2, username="member", role=Role.USER, display_name="Mo")


def _client(tmp_path: Path, user: User) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/org-module")

    @app.exception_handler(OctopError)
    async def _octop(_request: object, exc: OctopError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=exc.to_envelope())

    server = SimpleNamespace(
        paths=SimpleNamespace(config=tmp_path / "config.json", root=tmp_path),
        services=None,
    )
    app.dependency_overrides[current_user] = lambda: user
    app.dependency_overrides[get_server] = lambda: server
    return TestClient(app)


def test_shared_governance_module_is_in_catalog() -> None:
    assert "governance" in SHARED_ORG_UI_MODULES
    assert "announcements" in SHARED_ORG_UI_MODULES
    assert "organization" in SHARED_ORG_UI_MODULES
    assert "employees" in SHARED_ORG_UI_MODULES
    assert "skills" in SHARED_ORG_UI_MODULES
    assert "knowledge" in SHARED_ORG_UI_MODULES
    assert_shared_modules_in_catalog()


def test_store_list_pauses_filters_and_expires(tmp_path: Path) -> None:
    store = DurableGovernanceStore(tmp_path / "governance")
    pending = store.create_pause(
        tool_name="delete_employee",
        category="delete",
        action="delete",
        actor_id="1",
        tenant_id="default",
        args_digest="abc",
        reason="default deny",
    )
    approved = store.create_pause(
        tool_name="pay_invoice",
        category="pay",
        action="pay",
        actor_id="1",
        tenant_id="default",
        args_digest="def",
        reason="needs approval",
    )
    store.resolve(approved.pause_id, "approved")
    stale = store.create_pause(
        tool_name="http_request",
        category="outbound",
        action="",
        actor_id="1",
        tenant_id="default",
        args_digest="ghi",
        reason="stale",
    )
    stale.created_at = time.time() - stale.ttl_seconds - 10
    store._write_pause(stale)

    all_rows = store.list_pauses()
    assert {row.pause_id for row in all_rows} == {
        pending.pause_id,
        approved.pause_id,
        stale.pause_id,
    }
    assert [row.pause_id for row in store.list_pauses("pending")] == [pending.pause_id]
    assert [row.pause_id for row in store.list_pauses("approved")] == [approved.pause_id]
    expired = store.list_pauses("expired")
    assert len(expired) == 1
    assert expired[0].pause_id == stale.pause_id
    assert expired[0].status == "expired"


def test_api_lists_pauses_and_admin_can_resolve(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    checked = admin.post(
        "/api/org-module/governance/check",
        json={"tool_name": "delete_employee", "category": "delete", "args": {"id": "1"}},
    )
    assert checked.status_code == 200
    pause_id = checked.json()["pause_id"]
    assert checked.json()["status"] == "pending"
    assert checked.json()["execute"] is False

    listed = admin.get("/api/org-module/governance/pauses")
    assert listed.status_code == 200
    body = listed.json()
    assert body["enabled"] is False
    assert len(body["pauses"]) == 1
    assert body["pauses"][0]["pause_id"] == pause_id
    assert body["pauses"][0]["status"] == "pending"

    pending_only = admin.get("/api/org-module/governance/pauses?status=pending")
    assert len(pending_only.json()["pauses"]) == 1
    bad = admin.get("/api/org-module/governance/pauses?status=nope")
    assert bad.status_code == 400

    resolved = admin.post(
        "/api/org-module/governance/resolve",
        json={"pause_id": pause_id, "approve": True},
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "allow"
    assert resolved.json()["execute"] is False

    after = admin.get("/api/org-module/governance/pauses?status=pending")
    assert after.json()["pauses"] == []
    approved = admin.get("/api/org-module/governance/pauses?status=approved")
    assert approved.json()["pauses"][0]["pause_id"] == pause_id

    audit = admin.get("/api/org-module/governance/audit?limit=20")
    assert audit.status_code == 200
    events = audit.json()["events"]
    assert any(row.get("event") == "check" for row in events)
    assert any(row.get("event") == "approve" for row in events)


def test_api_member_can_read_but_cannot_resolve(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    pause_id = admin.post(
        "/api/org-module/governance/check",
        json={"tool_name": "delete_employee", "category": "delete"},
    ).json()["pause_id"]

    member = _client(tmp_path, _member())
    listed = member.get("/api/org-module/governance/pauses")
    assert listed.status_code == 200
    assert listed.json()["pauses"][0]["pause_id"] == pause_id
    audit = member.get("/api/org-module/governance/audit")
    assert audit.status_code == 200
    denied = member.post(
        "/api/org-module/governance/resolve",
        json={"pause_id": pause_id, "approve": False},
    )
    assert denied.status_code == 403


def test_engine_evaluate_roundtrip_used_by_ui(tmp_path: Path) -> None:
    from octop.modules.org_os.governance.engine import GovernanceEngine

    engine = GovernanceEngine(DurableGovernanceStore(tmp_path / "governance"))
    decision = engine.evaluate(
        PolicyRequest(tool_name="delete_employee", category="delete", args={"id": "9"})
    )
    assert decision.status == "pending"
    assert engine.store.list_pauses("pending")[0].pause_id == decision.pause_id


def test_overview_includes_pending_pause_rows(tmp_path: Path) -> None:
    from octop.modules.org_os.overview import build_overview
    from octop.modules.org_os.service import OrgModuleService

    store = DurableGovernanceStore(tmp_path / "governance")
    pause = store.create_pause(
        tool_name="delete_employee",
        category="delete",
        action="delete",
        actor_id="1",
        tenant_id="default",
        args_digest="abc",
        reason="needs a human",
    )
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    payload = build_overview(service).to_dict()
    assert payload["governance"]["pending_pauses"] == 1
    assert payload["governance"]["pauses"][0]["pause_id"] == pause.pause_id
    assert payload["governance"]["pauses"][0]["tool_name"] == "delete_employee"

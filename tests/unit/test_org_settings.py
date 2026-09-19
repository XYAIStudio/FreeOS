"""In-host organization-module settings: prefs + catalog toggles."""

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
from octop.modules.org_os.module_toggles import load_module_toggles, save_module_toggles
from octop.modules.org_os.prefs import load_org_prefs, save_org_prefs


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


def test_shared_settings_module_is_in_catalog() -> None:
    assert "settings" in SHARED_ORG_UI_MODULES
    assert_shared_modules_in_catalog()


def test_prefs_roundtrip_and_ignore_unknown(tmp_path: Path) -> None:
    saved = save_org_prefs(
        tmp_path, {"name": "  Acme  ", "description": "HQ", "llm_api_key": "nope"}
    )
    assert saved == {"name": "Acme", "description": "HQ"}
    assert load_org_prefs(tmp_path)["name"] == "Acme"
    assert "llm_api_key" not in load_org_prefs(tmp_path)


def test_prefs_reject_overlong_name(tmp_path: Path) -> None:
    try:
        save_org_prefs(tmp_path, {"name": "x" * 121})
    except ValueError as exc:
        assert str(exc) == "name"
    else:
        raise AssertionError("expected ValueError")


def test_api_snapshot_and_prefs_reuse_modules(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    snap = admin.get("/api/org-module/settings")
    assert snap.status_code == 200
    body = snap.json()["data"]
    assert body["scope"] == "org_module"
    assert "llm_keys" in body["not_on_this_page"]
    assert body["system_settings"]["overview"] == "/system-settings"
    assert any(row["key"] == "settings" and row["locked"] for row in body["catalog"])
    assert body["modules"]["settings"] is True
    assert body["prefs"] == {"name": "", "description": ""}

    saved = admin.put("/api/org-module/prefs", json={"name": "Northwind", "description": "Ops"})
    assert saved.status_code == 200
    assert saved.json()["data"]["name"] == "Northwind"

    toggled = admin.put("/api/org-module/modules", json={"updates": {"chat": False}})
    assert toggled.status_code == 200
    assert toggled.json()["updates"]["chat"] is False
    assert toggled.json()["updates"]["settings"] is True
    again = admin.get("/api/org-module/settings").json()["data"]
    assert again["prefs"]["name"] == "Northwind"
    assert again["modules"]["chat"] is False
    assert load_module_toggles(tmp_path)["chat"] is False


def test_api_member_can_read_but_not_write_prefs(tmp_path: Path) -> None:
    save_org_prefs(tmp_path, {"name": "Visible"})
    save_module_toggles(tmp_path, {"announcements": False})
    member = _client(tmp_path, _member())
    snap = member.get("/api/org-module/settings")
    assert snap.status_code == 200
    assert snap.json()["data"]["prefs"]["name"] == "Visible"
    assert snap.json()["data"]["modules"]["announcements"] is False
    denied = member.put("/api/org-module/prefs", json={"name": "Nope"})
    assert denied.status_code == 403
    assert denied.json()["success"] is False
    assert load_org_prefs(tmp_path)["name"] == "Visible"


def test_api_invalid_prefs(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    response = admin.put("/api/org-module/prefs", json={"name": "x" * 121})
    assert response.status_code == 400
    assert response.json()["success"] is False

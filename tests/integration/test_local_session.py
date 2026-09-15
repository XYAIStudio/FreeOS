"""Local guest session: skip login on first open; save requires an account."""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from octop.infra.server import OctopServer
from tests.support.app import octop_client
from tests.support.auth import bootstrap_admin, create_user


@pytest.fixture
async def fresh_client(
    tmp_octop_home: Path,
) -> tuple[httpx.AsyncClient, OctopServer, Path]:
    async with octop_client(tmp_octop_home, bind_database=False) as (c, srv):
        yield c, srv, tmp_octop_home


async def test_local_session_skips_login_on_first_open(fresh_client) -> None:
    c, _srv, _home = fresh_client
    status = await c.get("/api/setup/status")
    assert status.json()["setup_required"] is True

    r = await c.post("/api/auth/local-session")
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["user"]["username"] == "local"
    assert body["user"]["is_local"] is True
    assert body["user"]["role"] == "admin"

    token = body["access_token"]
    me = await c.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["is_local"] is True

    after = await c.get("/api/setup/status")
    assert after.json()["setup_required"] is False


async def test_save_requires_account_then_register(fresh_client) -> None:
    c, _srv, _home = fresh_client
    session = await c.post("/api/auth/local-session")
    token = session.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    denied = await c.post("/api/admin/backup/create", headers=auth, json={})
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "ACCOUNT_REQUIRED"

    claimed = await c.post(
        "/api/auth/register",
        headers=auth,
        json={"username": "owner", "password": "TestPass12", "display_name": "Owner"},
    )
    assert claimed.status_code == 200
    assert claimed.json()["user"]["username"] == "owner"
    assert claimed.json()["user"]["is_local"] is False

    new_auth = {"Authorization": f"Bearer {claimed.json()['access_token']}"}
    me = await c.get("/api/auth/me", headers=new_auth)
    assert me.json()["is_local"] is False


async def test_local_session_refuses_when_multiple_users(app_client) -> None:
    c, _srv, home = app_client
    await bootstrap_admin(c, home, username="alice", password="TestPass12")
    tok = (
        await c.post("/api/auth/login", json={"username": "alice", "password": "TestPass12"})
    ).json()["access_token"]
    admin_auth = {"Authorization": f"Bearer {tok}"}
    await create_user(c, admin_auth, username="bob", password="TestPass12")
    r = await c.post("/api/auth/local-session")
    assert r.status_code == 403

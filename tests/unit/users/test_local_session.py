"""Unit tests for local guest session helpers."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from octop.infra.errors import ErrorCode, OctopError
from octop.infra.users.identity import Role, User
from octop.infra.users.local_session import (
    LOCAL_SESSION_SETTING,
    LOCAL_USERNAME,
    hostname_from_host_header,
    is_desktop_process,
    is_loopback_host,
    is_organization_mapped_user,
    is_unclaimed_local_user,
    preferred_existing_user,
    request_looks_local,
    require_claimed_account,
)


def _user(username: str = LOCAL_USERNAME) -> User:
    return User(id=1, username=username, role=Role.ADMIN, display_name="FreeOS")


def test_unclaimed_local_user_reads_settings() -> None:
    settings = {LOCAL_SESSION_SETTING: "1"}
    server = SimpleNamespace(
        services=SimpleNamespace(settings_repo=SimpleNamespace(get=settings.get))
    )
    assert is_unclaimed_local_user(server, _user()) is True
    assert is_unclaimed_local_user(server, _user("owner")) is False
    settings.clear()
    assert is_unclaimed_local_user(server, _user()) is False


def test_require_claimed_account_blocks_guest() -> None:
    settings = {LOCAL_SESSION_SETTING: "1"}
    server = SimpleNamespace(
        services=SimpleNamespace(settings_repo=SimpleNamespace(get=settings.get))
    )
    with pytest.raises(OctopError) as exc:
        require_claimed_account(server, _user())
    assert exc.value.code is ErrorCode.ACCOUNT_REQUIRED
    assert exc.value.status == 403

    require_claimed_account(server, _user("owner"))


def test_is_desktop_process_reads_desktop_and_green_env(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("OCTOP_DESKTOP", raising=False)
    monkeypatch.delenv("FREEOS_DESKTOP", raising=False)
    monkeypatch.delenv("OCTOP_GREEN_PACKAGES", raising=False)
    assert is_desktop_process() is False
    monkeypatch.setenv("OCTOP_DESKTOP", "1")
    assert is_desktop_process() is True
    monkeypatch.delenv("OCTOP_DESKTOP")
    monkeypatch.setenv("FREEOS_DESKTOP", "true")
    assert is_desktop_process() is True
    monkeypatch.delenv("FREEOS_DESKTOP")
    monkeypatch.setenv("OCTOP_GREEN_PACKAGES", str(tmp_path / "packages"))
    assert is_desktop_process() is True


def test_is_loopback_host_accepts_mapped_ipv4() -> None:
    assert is_loopback_host("127.0.0.1") is True
    assert is_loopback_host("::1") is True
    assert is_loopback_host("[::1]") is True
    assert is_loopback_host("::ffff:127.0.0.1") is True
    assert is_loopback_host("10.0.0.4") is False


def test_is_loopback_host_accepts_localhost_names_and_ports() -> None:
    assert is_loopback_host("localhost:8088") is True
    assert is_loopback_host("127.0.0.1:8088") is True
    assert is_loopback_host("[::1]:8088") is True
    assert is_loopback_host("wails.localhost") is True
    assert is_loopback_host("wails.localhost:34115") is True
    assert hostname_from_host_header("[::1]:8088") == "::1"


def test_request_looks_local_uses_origin_when_peer_is_lan(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OCTOP_DESKTOP", raising=False)
    monkeypatch.delenv("FREEOS_DESKTOP", raising=False)
    monkeypatch.delenv("OCTOP_GREEN_PACKAGES", raising=False)
    assert (
        request_looks_local(
            client_host="192.168.1.50",
            http_host="192.168.1.50:8088",
            origin="http://127.0.0.1:8088",
        )
        is True
    )
    assert (
        request_looks_local(
            client_host="8.8.8.8",
            http_host="example.com",
            origin="https://example.com",
        )
        is False
    )


def test_request_looks_local_true_on_desktop_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OCTOP_DESKTOP", "1")
    assert request_looks_local(client_host="8.8.8.8", http_host="example.com") is True


def test_preferred_existing_user_picks_sole_admin() -> None:
    alice = User(id=2, username="alice", role=Role.ADMIN, display_name="Alice")
    bob = User(id=3, username="bob", role=Role.USER, display_name="Bob")
    server = SimpleNamespace(user_manager=SimpleNamespace(list=lambda: [bob, alice]))
    assert preferred_existing_user(server) is alice


def test_preferred_existing_user_picks_unclaimed_local() -> None:
    settings = {LOCAL_SESSION_SETTING: "1"}
    local = _user()
    admin = User(id=9, username="owner", role=Role.ADMIN, display_name="Owner")
    server = SimpleNamespace(
        user_manager=SimpleNamespace(list=lambda: [admin, local]),
        services=SimpleNamespace(settings_repo=SimpleNamespace(get=settings.get)),
    )
    assert preferred_existing_user(server) is local


def test_preferred_existing_user_skips_organization_mapped_rows() -> None:
    mapped = User(
        id=1,
        username="org_" + ("a" * 40),
        role=Role.USER,
        display_name="Owner",
        organization_user_id=9,
        organization_role="admin",
    )
    alice = User(id=2, username="alice", role=Role.ADMIN, display_name="Alice")
    server = SimpleNamespace(user_manager=SimpleNamespace(list=lambda: [mapped, alice]))
    assert is_organization_mapped_user(mapped) is True
    assert is_organization_mapped_user(alice) is False
    assert preferred_existing_user(server) is alice


def test_preferred_existing_user_does_not_adopt_only_org_mirrors() -> None:
    mapped = User(
        id=1,
        username="org_" + ("b" * 40),
        role=Role.USER,
        display_name="Room admin",
        organization_user_id=3,
    )
    server = SimpleNamespace(user_manager=SimpleNamespace(list=lambda: [mapped]))
    assert preferred_existing_user(server) is None

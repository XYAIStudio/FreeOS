"""Unit tests for local guest session helpers."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from octop.infra.errors import ErrorCode, OctopError
from octop.infra.users.identity import Role, User
from octop.infra.users.local_session import (
    LOCAL_SESSION_SETTING,
    LOCAL_USERNAME,
    is_unclaimed_local_user,
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

"""tests/unit/test_identity.py"""

from __future__ import annotations

import pytest

from octop.infra.users.identity import Role, User


def test_role_values():
    assert Role("admin") is Role.ADMIN
    assert Role("user") is Role.USER
    with pytest.raises(ValueError):
        Role("nope")


def test_user_label_falls_back_to_username():
    u = User(id=1, username="alice", role=Role.USER, display_name=None)
    assert u.label == "alice"
    u2 = User(id=2, username="bob", role=Role.USER, display_name="Bobby")
    assert u2.label == "Bobby"


def test_user_is_admin():
    assert User(id=1, username="a", role=Role.ADMIN, display_name=None).is_admin
    assert not User(id=2, username="b", role=Role.USER, display_name=None).is_admin


def test_organization_mapping_is_not_host_admin():
    guest = User(id=1, username="local", role=Role.ADMIN, display_name="FreeOS")
    mapped = User(
        id=2,
        username="org_abc",
        role=Role.USER,
        display_name="Owner",
        organization_id=3,
        organization_user_id=7,
        organization_role="super_admin",
    )
    assert guest.is_admin
    assert not guest.has_organization_identity
    assert mapped.has_organization_identity
    assert not mapped.is_admin

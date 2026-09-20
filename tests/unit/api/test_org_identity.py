"""Dual-identity bounds: studio session vs organization-room session."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from octop.api.deps import is_organization_business_path
from octop.api.routers.org_identity import business_proxy, identity_status
from octop.infra.errors import ErrorCode, OctopError
from octop.infra.users.identity import Role, User
from octop.modules.org_os.proxy import identity_headers


@pytest.mark.asyncio
async def test_identity_status_studio_door(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("octop.api.routers.org_identity.integrated_organization", lambda: False)
    payload = await identity_status()
    assert payload["integrated"] is False
    assert payload["authority"] == "studio"
    assert payload["studio"] == "freeos"
    assert payload["room"] is None


@pytest.mark.asyncio
async def test_identity_status_dual_doors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("octop.api.routers.org_identity.integrated_organization", lambda: True)
    payload = await identity_status()
    assert payload["integrated"] is True
    assert payload["authority"] == "dual"
    assert payload["room"] == "organization"


def test_organization_business_path() -> None:
    assert is_organization_business_path("/api/org-module/business/api/org")
    assert not is_organization_business_path("/api/org-module/overview")
    assert not is_organization_business_path("/api/auth/me")


@pytest.mark.asyncio
async def test_business_proxy_rejects_studio_guest() -> None:
    guest = User(id=1, username="local", role=Role.ADMIN, display_name="FreeOS")
    with pytest.raises(OctopError) as exc:
        await business_proxy(
            "api/org",
            SimpleNamespace(),
            SimpleNamespace(),
            guest,
        )
    assert exc.value.code is ErrorCode.FORBIDDEN


def test_identity_headers_never_copy_host_admin() -> None:
    guest = User(id=1, username="local", role=Role.ADMIN, display_name="FreeOS")
    assert identity_headers(guest)["X-FreeOS-Role"] == "guest"
    mapped = User(
        id=8,
        username="org_x",
        role=Role.USER,
        display_name="Owner",
        organization_id=2,
        organization_user_id=9,
        organization_role="admin",
    )
    assert identity_headers(mapped)["X-FreeOS-Role"] == "admin"
    assert identity_headers(mapped)["X-FreeOS-Tenant-Id"] == "2"

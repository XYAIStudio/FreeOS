"""Route contracts for the same-origin OpenXYOS delivery proxy."""

import inspect

from octop.api.routers import org_ui
from octop.api.routers.org_ui import router
from octop.infra.users.identity import Role, User
from octop.modules.org_os.proxy import _filter_request_headers, identity_headers


def test_organization_proxy_accepts_local_auth_and_settings_mutations() -> None:
    route = next(route for route in router.routes if route.path == "/organization-app/{path:path}")
    assert {"POST", "PUT", "PATCH", "DELETE"}.issubset(route.methods or set())


def test_local_organization_token_can_be_forwarded_to_its_sidecar() -> None:
    headers = _filter_request_headers(
        {"authorization": "Bearer local-openxyos-token"},
        {"Authorization": "Bearer local-openxyos-token"},
    )
    assert headers["Authorization"] == "Bearer local-openxyos-token"


def test_organization_app_does_not_attach_host_identity_headers() -> None:
    source = inspect.getsource(org_ui._organization_ui)
    assert "identity_headers(" not in source


def test_host_cookies_and_freeos_identity_are_not_forwarded() -> None:
    headers = _filter_request_headers(
        {
            "cookie": "auth_token=freeos-guest",
            "Cookie": "session=studio",
            "X-FreeOS-User": "local",
            "X-FreeOS-User-Id": "1",
            "X-FreeOS-Role": "admin",
            "accept": "application/json",
        },
        {"Authorization": "Bearer openxyos-token"},
    )
    assert headers["Authorization"] == "Bearer openxyos-token"
    assert "cookie" not in {key.lower() for key in headers}
    assert not any(key.lower().startswith("x-freeos-") for key in headers)
    assert headers["accept"] == "application/json"


def test_bff_extra_identity_headers_replace_spoofed_incoming() -> None:
    guest = User(id=1, username="local", role=Role.ADMIN, display_name="FreeOS")
    headers = _filter_request_headers(
        {"X-FreeOS-User": "spoofed", "X-FreeOS-Role": "super_admin"},
        identity_headers(guest),
    )
    assert headers["X-FreeOS-User"] == "local"
    assert headers["X-FreeOS-Role"] == "guest"

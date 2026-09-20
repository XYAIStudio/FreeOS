"""Route contracts for the same-origin OpenXYOS delivery proxy."""

from octop.api.routers.org_ui import router
from octop.modules.org_os.proxy import _filter_request_headers


def test_organization_proxy_accepts_local_auth_and_settings_mutations() -> None:
    route = next(route for route in router.routes if route.path == "/organization-app/{path:path}")
    assert {"POST", "PUT", "PATCH", "DELETE"}.issubset(route.methods or set())


def test_local_organization_token_can_be_forwarded_to_its_sidecar() -> None:
    headers = _filter_request_headers(
        {"authorization": "Bearer local-openxyos-token"},
        {"Authorization": "Bearer local-openxyos-token"},
    )
    assert headers["Authorization"] == "Bearer local-openxyos-token"

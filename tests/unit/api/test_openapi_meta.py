"""Unit tests for OpenAPI schema customization."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from tests.support.app import ensure_control_plane_bound, write_octop_config

from octop.api.app import build_app
from octop.infra.server import OctopServer


async def test_openapi_has_bearer_security_and_descriptions(tmp_octop_home: Path) -> None:
    write_octop_config(tmp_octop_home, enable_api_docs=True)
    srv = OctopServer(home=tmp_octop_home)
    await srv.start()
    await ensure_control_plane_bound(srv)
    try:
        app = build_app(srv)
        with TestClient(app) as c:
            spec = c.get("/api/openapi.json").json()
        assert spec["info"]["description"]
        assert "BearerAuth" in spec["components"]["securitySchemes"]
        login = spec["paths"]["/api/auth/login"]["post"]
        assert login["summary"] == "Sign in"
        me = spec["paths"]["/api/auth/me"]["get"]
        assert "BearerAuth" in me["security"][0]
        assert "security" not in spec["paths"]["/api/setup/status"]["get"]
        ids = [
            op["operationId"]
            for item in spec.get("paths", {}).values()
            if isinstance(item, dict)
            for op in item.values()
            if isinstance(op, dict) and op.get("operationId")
        ]
        assert len(ids) == len(set(ids))
    finally:
        await srv.stop()


def test_uniquify_operation_ids_suffixes_duplicates() -> None:
    from octop.api.openapi_meta import uniquify_operation_ids

    schema = {
        "paths": {
            "/api/org-module/sidecar/{path}": {
                "get": {"operationId": "org_module_proxy"},
                "post": {"operationId": "org_module_proxy"},
            }
        }
    }
    uniquify_operation_ids(schema)
    ops = schema["paths"]["/api/org-module/sidecar/{path}"]
    assert ops["get"]["operationId"] == "org_module_proxy"
    assert ops["post"]["operationId"] == "org_module_proxy_post"

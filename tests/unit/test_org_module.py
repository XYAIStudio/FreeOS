"""Organization module catalog, home resolution helpers, and BFF service."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.catalog import (
    catalog_keys,
    default_openxyos_catalog_path,
    load_upstream_catalog_keys,
)
from octop.modules.org_os.proxy import identity_headers, sidecar_target
from octop.modules.org_os.service import (
    DEFAULT_SIDECAR_URL,
    ORG_PLUGIN_ID,
    OrgModuleService,
)


def test_catalog_matches_vendored_openxyos() -> None:
    upstream = default_openxyos_catalog_path()
    assert upstream.is_file(), "modules/openxyos must be vendored"
    assert catalog_keys() == load_upstream_catalog_keys(upstream)


def test_path_layout_prefers_freeos_home(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("FREEOS_HOME", str(tmp_path / "free"))
    monkeypatch.setenv("OCTOP_HOME", str(tmp_path / "oct"))
    assert PathLayout.from_env().root == tmp_path / "free"


def test_path_layout_honors_octop_home_without_freeos(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("FREEOS_HOME", raising=False)
    monkeypatch.setenv("OCTOP_HOME", str(tmp_path / "oct"))
    assert PathLayout.from_env().root == tmp_path / "oct"


def test_path_layout_defaults_to_dot_freeos_when_neither_exists(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("FREEOS_HOME", raising=False)
    monkeypatch.delenv("OCTOP_HOME", raising=False)
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    assert PathLayout.from_env().root == tmp_path / ".freeos"


def test_path_layout_keeps_existing_octop_home(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("FREEOS_HOME", raising=False)
    monkeypatch.delenv("OCTOP_HOME", raising=False)
    (tmp_path / ".octop").mkdir()
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    assert PathLayout.from_env().root == tmp_path / ".octop"


def test_org_module_enable_persists(tmp_path: Path) -> None:
    config = tmp_path / "config.json"
    service = OrgModuleService(config_path=config, home=tmp_path)
    assert service.is_enabled() is False
    service.set_enabled(True, sidecar_url="http://127.0.0.1:3780")
    raw = json.loads(config.read_text(encoding="utf-8"))
    assert raw["modules"]["org_os"]["enabled"] is True
    assert raw["plugins"][ORG_PLUGIN_ID]["enabled"] is True
    assert service.sidecar_url() == "http://127.0.0.1:3780"
    service.set_enabled(False)
    assert service.is_enabled() is False


def test_probe_sidecar_unreachable(tmp_path: Path) -> None:
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    health = service.probe_sidecar(timeout=0.2)
    assert health.reachable is False
    assert health.url == DEFAULT_SIDECAR_URL


def test_probe_sidecar_livez(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    class _Resp:
        status_code = 200

        def json(self) -> dict[str, str]:
            return {"status": "live"}

    class _Client:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> _Client:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def get(self, url: str) -> _Resp:
            assert url.endswith("/api/health/livez")
            return _Resp()

    monkeypatch.setattr(httpx, "Client", _Client)
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    health = service.probe_sidecar()
    assert health.reachable is True
    assert health.payload["status"] == "live"


def test_sidecar_target_rejects_traversal() -> None:
    with pytest.raises(ValueError, match="traversal"):
        sidecar_target("http://127.0.0.1:3780", "../secret")


def test_sidecar_target_joins_path() -> None:
    assert (
        sidecar_target("http://127.0.0.1:3780", "api/org", "limit=1")
        == "http://127.0.0.1:3780/api/org?limit=1"
    )


def test_identity_headers() -> None:
    class _User:
        id = 7
        username = "ada"
        role = "admin"

    headers = identity_headers(_User())
    assert headers["X-FreeOS-User"] == "ada"
    assert headers["X-FreeOS-User-Id"] == "7"
    assert headers["X-FreeOS-Role"] == "admin"

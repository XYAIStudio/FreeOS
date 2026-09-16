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


def test_path_layout_prefers_freeos_home(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
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
    monkeypatch.delenv("OCTOP_DESKTOP", raising=False)
    monkeypatch.delenv("FREEOS_DESKTOP", raising=False)
    (tmp_path / ".octop").mkdir()
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    assert PathLayout.from_env().root == tmp_path / ".octop"


def test_path_layout_desktop_skips_legacy_octop(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("FREEOS_HOME", raising=False)
    monkeypatch.delenv("OCTOP_HOME", raising=False)
    monkeypatch.setenv("OCTOP_DESKTOP", "1")
    (tmp_path / ".octop").mkdir()
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    assert PathLayout.from_env().root == tmp_path / ".freeos"


def test_enable_from_desktop_env_first_run_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config = tmp_path / "config.json"
    service = OrgModuleService(config_path=config, home=tmp_path)
    monkeypatch.delenv("FREEOS_ORG_ENABLE", raising=False)
    assert service.enable_from_desktop_env() is False
    monkeypatch.setenv("FREEOS_ORG_ENABLE", "1")
    monkeypatch.setenv("FREEOS_ORG_SIDECAR_URL", "http://127.0.0.1:3780")
    assert service.enable_from_desktop_env() is True
    assert service.is_enabled() is True
    assert service.sidecar_url() == "http://127.0.0.1:3780"
    service.set_enabled(False)
    assert service.enable_from_desktop_env() is False
    assert service.is_enabled() is False


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


def test_identity_headers_tenant_override() -> None:
    class _User:
        id = 7
        username = "ada"
        role = "admin"
        tenant_id = 3

    headers = identity_headers(_User(), tenant_id="99")
    assert headers["X-FreeOS-Tenant-Id"] == "99"


def test_overview_reports_real_empty_counts(tmp_path: Path) -> None:
    from octop.modules.org_os.overview import build_overview

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    snapshot = build_overview(service, agents=2, connectors=1, cron_jobs=3, skill_packages=0)
    payload = snapshot.to_dict()
    assert payload["freeos"]["employees"] == 0
    assert payload["freeos"]["agents"] == 2
    assert payload["freeos"]["mcp"] == 1
    assert payload["freeos"]["tasks"] == 3
    assert payload["sidecar_reachable"] is False
    assert payload["last_loop"] is None
    assert any("FreeOS does the work" in note for note in payload["notes"])


def test_assemble_from_bundled_blueprint(tmp_path: Path) -> None:
    from octop.modules.org_os.empower import assemble_from_blueprint

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    result = assemble_from_blueprint(service)
    assert result["employees"]
    assert result["spawned"]
    assert result["sidecar_reachable"] is False
    assert any("blueprint" in note for note in result["notes"])


def test_pack_to_openxyos_writes_local_mirror(tmp_path: Path) -> None:
    from octop.modules.org_os.empower import assemble_from_blueprint, pack_to_openxyos

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    assemble_from_blueprint(service)
    packed = pack_to_openxyos(service)
    assert Path(packed["pack"]["directory"]).is_dir()
    assert packed["applied"]["mirrored"] is True
    assert packed["applied"]["remote_applied"] is False


def test_produce_from_corpus_spawns_colleague(tmp_path: Path) -> None:
    from octop.modules.org_os.empower import produce_from_corpus

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    result = produce_from_corpus(service, name="Corpus Analyst", ima_url="https://ima.example/kb")
    assert result["slug"]
    assert Path(result["workspace"]).is_dir()
    assert (Path(result["distill_path"]) / "CLOUD_SOURCE.md").is_file()
    assert result["spawned"]["agent_id"]


def test_produce_from_corpus_ignores_outside_distill_path(tmp_path: Path) -> None:
    from octop.modules.org_os.empower import produce_from_corpus

    outside = tmp_path.parent / "outside-corpus"
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    result = produce_from_corpus(
        service,
        name="Safe Analyst",
        distill_path=str(outside / ".." / "etc"),
        kb_id="../etc",
    )
    dest = Path(result["distill_path"])
    assert dest == (tmp_path / "org-corpus" / "default").resolve()
    assert dest.is_relative_to(tmp_path.resolve())
    assert not outside.exists()


def test_governance_enable_persists(tmp_path: Path) -> None:
    config = tmp_path / "config.json"
    service = OrgModuleService(config_path=config, home=tmp_path)
    assert service.governance_enabled() is False
    service.set_governance_enabled(True, tenant_id="42")
    assert service.governance_enabled() is True
    assert service.tenant_id() == "42"

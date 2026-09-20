"""Organization module catalog, home resolution helpers, and BFF service."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import httpx
import pytest

from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.catalog import (
    catalog_keys,
    default_openxyos_catalog_path,
    load_upstream_catalog_keys,
)
from octop.modules.org_os.managed_runtime import (
    clear_runtime_record,
    read_runtime_base_url,
    write_runtime_record,
)
from octop.modules.org_os.proxy import identity_headers, sidecar_target
from octop.modules.org_os.service import (
    DEFAULT_SIDECAR_URL,
    ORG_PLUGIN_ID,
    OrgModuleService,
)

posix_only = pytest.mark.skipif(os.name != "posix", reason="pid liveness uses os.kill")


def test_catalog_matches_vendored_openxyos() -> None:
    upstream = default_openxyos_catalog_path()
    assert upstream.is_file(), "modules/openxyos must be vendored"
    assert catalog_keys() == load_upstream_catalog_keys(upstream)
    from octop.modules.org_os.catalog import CATALOG_HOST_DELIVERY, catalog_with_host_delivery

    assert set(CATALOG_HOST_DELIVERY) == set(catalog_keys())
    overlay = catalog_with_host_delivery()
    employees = next(row for row in overlay if row["key"] == "employees")
    assert employees["host_path"] == "/organization/employees"
    assert employees["delivery"] == "org_ui_slice"
    chat = next(row for row in overlay if row["key"] == "chat")
    assert chat["delivery"] == "managed_node_iframe"
    assert chat["host_path"] == ""


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


def test_sidecar_livez_route_is_registered() -> None:
    from octop.api.routers.org_module import router

    paths = {getattr(route, "path", "") for route in router.routes}
    assert "/sidecar/livez" in paths


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

    monkeypatch.setenv("FREEOS_ORG_SIDECAR_URL", "http://127.0.0.1:3780")
    monkeypatch.setattr(httpx, "Client", _Client)
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    health = service.probe_sidecar()
    assert health.reachable is True
    assert health.payload["status"] == "live"


def test_probe_sidecar_embed_rejects_self_origin_500(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _Resp:
        def __init__(self, status_code: int) -> None:
            self.status_code = status_code

    class _Client:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> _Client:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def get(self, url: str, headers: dict[str, str] | None = None) -> _Resp:
            assert url == "http://127.0.0.1:3780/"
            assert headers is not None
            assert headers["Origin"] == "http://127.0.0.1:3780"
            return _Resp(500)

    monkeypatch.setenv("FREEOS_ORG_SIDECAR_URL", "http://127.0.0.1:3780")
    monkeypatch.setattr(httpx, "Client", _Client)
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    assert service.probe_sidecar_embed() is False


def test_probe_sidecar_embed_allows_self_origin(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _Resp:
        status_code = 200

    class _Client:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> _Client:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def get(self, url: str, headers: dict[str, str] | None = None) -> _Resp:
            return _Resp()

    monkeypatch.setenv("FREEOS_ORG_SIDECAR_URL", "http://127.0.0.1:3780")
    monkeypatch.setattr(httpx, "Client", _Client)
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    assert service.probe_sidecar_embed() is True


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
    assert headers["X-FreeOS-Role"] == "guest"


def test_identity_headers_organization_room_keeps_org_role() -> None:
    class _User:
        id = 7
        username = "org_ada"
        role = "admin"
        organization_user_id = 3
        organization_role = "super_admin"
        organization_id = 9

    headers = identity_headers(_User())
    assert headers["X-FreeOS-Role"] == "super_admin"
    assert headers["X-FreeOS-Tenant-Id"] == "9"


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
    assert payload["sidecar_embed_ok"] is False
    assert payload["install_ready"] is False
    assert payload["last_loop"] is None
    assert payload["runtime"] == "in_host"
    assert payload["sidecar_optional"] is True
    assert payload["colleagues"] == []
    assert payload["experts"] == []
    assert payload["org_surfaces"]["employees"] == 0
    assert payload["org_surfaces"]["talent"] == 0
    assert payload["governance"]["pending_pauses"] == 0
    assert payload["freeos"]["directory_employees"] == 0
    catalog = payload["catalog"]
    assert any(row["key"] == "employees" and row.get("host_path") for row in catalog)
    assert any(
        "in-host" in note.lower() or "FreeOS does the work" in note for note in payload["notes"]
    )
    assert not any("start it to sync" in note for note in payload["notes"])


def test_probe_sidecar_skips_default_3780_without_opt_in(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _boom(*args: object, **kwargs: object) -> None:
        raise AssertionError("must not probe implicit 3780")

    monkeypatch.delenv("FREEOS_ORG_SIDECAR_URL", raising=False)
    monkeypatch.delenv("OPENXYOS_BASE_URL", raising=False)
    monkeypatch.delenv("FREEOS_ORG_SIDECAR", raising=False)
    monkeypatch.setattr(httpx, "Client", _boom)
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    health = service.probe_sidecar(timeout=0.2)
    assert health.reachable is False
    assert health.detail == "sidecar optional; not configured"
    assert service.explicit_sidecar_url() == ""
    assert service.workspace_tenant_id() == "default"
    assert service.workspace_tenant_id(organization_id=7) == "7"


def test_explicit_sidecar_url_reads_runtime_json(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("OPENXYOS_BASE_URL", raising=False)
    monkeypatch.delenv("FREEOS_ORG_SIDECAR_URL", raising=False)
    monkeypatch.delenv("FREEOS_ORG_SIDECAR", raising=False)
    write_runtime_record(tmp_path, base_url="http://127.0.0.1:4099", port=4099)
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    assert service.explicit_sidecar_url() == "http://127.0.0.1:4099"
    assert read_runtime_base_url(tmp_path) == "http://127.0.0.1:4099"
    clear_runtime_record(tmp_path)
    assert service.explicit_sidecar_url() == ""


def test_workspace_tenant_prefers_config_over_organization_id(tmp_path: Path) -> None:
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    service.set_governance_enabled(True, tenant_id="42")
    assert service.workspace_tenant_id("", organization_id=9) == "42"
    assert service.workspace_tenant_id("acme", organization_id=9) == "acme"


@posix_only
def test_runtime_json_ignores_dead_pid(tmp_path: Path) -> None:
    proc = subprocess.Popen(  # noqa: S603
        [sys.executable, "-c", "import time; time.sleep(30)"],
    )
    pid = int(proc.pid)
    proc.kill()
    proc.wait()
    write_runtime_record(tmp_path, base_url="http://127.0.0.1:4099", pid=pid)
    assert read_runtime_base_url(tmp_path) == ""


def test_overview_lists_in_host_colleagues_after_assemble(tmp_path: Path) -> None:
    from octop.modules.org_os.empower import assemble_from_blueprint, pack_to_openxyos
    from octop.modules.org_os.overview import build_overview

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    assembled = assemble_from_blueprint(service)
    packed = pack_to_openxyos(service)
    snapshot = build_overview(service)
    payload = snapshot.to_dict()
    slugs = {row["slug"] for row in payload["colleagues"]}
    assert slugs
    assert slugs <= set(assembled["employees"])
    assert any(row["spawned"] for row in payload["colleagues"])
    assert payload["experts"]
    assert payload["org_surfaces"]["employees"] >= 1
    assert payload["org_surfaces"]["talent"] >= 1
    assert packed["applied"]["mirrored"] is True
    assert packed["applied"]["remote_applied"] is False
    assert payload["sidecar_reachable"] is False


def test_assemble_from_bundled_blueprint(tmp_path: Path) -> None:
    from octop.modules.org_os.empower import assemble_from_blueprint

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    result = assemble_from_blueprint(service)
    assert result["employees"]
    assert result["spawned"]
    assert result["preview_path"] == "/experts"
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

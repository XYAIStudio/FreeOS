"""Asset-pack apply writes a durable mirror and talks HTTP when the plane is up."""

from __future__ import annotations

import json
from pathlib import Path

from octop.modules.org_os.apply.apply import apply_asset_pack, import_applied_surfaces
from octop.modules.org_os.assets.importer import import_openxyos_assets
from octop.modules.org_os.assets.pack import publish_asset_pack
from tests.support.openxyos_harness import ControlPlaneState, start_control_plane

_FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "org-loop" / "agent-blueprint.v1.json"


def test_apply_without_url_is_mirror_only(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("OPENXYOS_BASE_URL", raising=False)
    monkeypatch.delenv("FREEOS_ORG_SIDECAR_URL", raising=False)
    import_openxyos_assets(
        tmp_path, tenant_id="acme", catalog=True, blueprint_path=_FIXTURE, spawn_agents=False
    )
    pack = publish_asset_pack(tmp_path, tenant_id="acme", out_dir=tmp_path / "pack")
    result = apply_asset_pack(pack.directory, home=tmp_path, tenant_id="acme", base_url="")
    assert result.mirrored is True
    assert result.remote_applied is False
    employees = json.loads((result.mirror_dir / "employees.json").read_text(encoding="utf-8"))
    assert employees["employees"][0]["slug"] == "policy-analyst"
    roundtrip = import_applied_surfaces(tmp_path, tenant_id="acme")
    assert "employees" in roundtrip["local"]


def test_apply_import_roundtrip_against_harness(tmp_path: Path) -> None:
    import_openxyos_assets(
        tmp_path, tenant_id="acme", catalog=True, blueprint_path=_FIXTURE, spawn_agents=False
    )
    pack = publish_asset_pack(tmp_path, tenant_id="acme", out_dir=tmp_path / "pack")
    state = ControlPlaneState()
    url, server = start_control_plane(state)
    try:
        result = apply_asset_pack(pack.directory, home=tmp_path, tenant_id="acme", base_url=url)
        assert result.remote_applied is True
        assert state.employees
        assert state.plugins
        imported = import_applied_surfaces(tmp_path, tenant_id="acme", base_url=url)
        assert imported["remote"]["employees"]
        assert imported["local"]["employees"]["enabled_by_default"] is False
    finally:
        server.shutdown()
        server.server_close()


def test_apply_uses_ingest_token(tmp_path: Path) -> None:
    import_openxyos_assets(
        tmp_path, tenant_id="acme", catalog=True, blueprint_path=_FIXTURE, spawn_agents=False
    )
    pack = publish_asset_pack(tmp_path, tenant_id="acme", out_dir=tmp_path / "pack")
    state = ControlPlaneState()
    state.ingest_token = "secret-token"
    url, server = start_control_plane(state)
    try:
        denied = apply_asset_pack(
            pack.directory,
            home=tmp_path,
            tenant_id="acme",
            base_url=url,
            headers={"X-FreeOS-Ingest-Token": "wrong"},
        )
        assert denied.remote_applied is False
        accepted = apply_asset_pack(
            pack.directory,
            home=tmp_path,
            tenant_id="acme",
            base_url=url,
            headers={"X-FreeOS-Ingest-Token": "secret-token"},
        )
        assert accepted.remote_applied is True
        assert state.employees
        assert "/api/freeos/ingest" in state.posts
    finally:
        server.shutdown()
        server.server_close()

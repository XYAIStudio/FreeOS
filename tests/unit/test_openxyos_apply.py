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
    pack = publish_asset_pack(
        tmp_path, tenant_id="acme", out_dir=tmp_path / "asset-packs" / "latest"
    )
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
    pack = publish_asset_pack(
        tmp_path, tenant_id="acme", out_dir=tmp_path / "asset-packs" / "latest"
    )
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
    pack = publish_asset_pack(
        tmp_path, tenant_id="acme", out_dir=tmp_path / "asset-packs" / "latest"
    )
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
        assert accepted.tenant_id == state.ui_tenant_id
        assert accepted.preview_path == "/employees"
        assert state.ingested.get("tenant_id") == state.ui_tenant_id
    finally:
        server.shutdown()
        server.server_close()


def test_apply_sends_ui_tenant_not_configured_tenant(tmp_path: Path) -> None:
    import_openxyos_assets(
        tmp_path, tenant_id="1", catalog=True, blueprint_path=_FIXTURE, spawn_agents=False
    )
    pack = publish_asset_pack(tmp_path, tenant_id="1", out_dir=tmp_path / "asset-packs" / "latest")
    state = ControlPlaneState()
    state.ui_tenant_id = 2
    url, server = start_control_plane(state)
    try:
        result = apply_asset_pack(pack.directory, home=tmp_path, tenant_id="1", base_url=url)
        assert result.remote_applied is True
        assert result.tenant_id == 2
        assert state.ingested.get("tenant_id") == 2
        assert result.landed.get("tenant_id") == 2
        assert result.preview_path == "/employees"
        assert result.landed.get("landed", {}).get("employees", {}).get("created", 0) >= 1
        employees = state.ingested.get("employees") or []
        assert employees
        assert all(item.get("status") == "active" for item in employees)
        assert all(item.get("employment_category") == "internal" for item in employees)
        talent = state.ingested.get("talent") or []
        assert talent
        assert all(item.get("status") == "available" for item in talent)
    finally:
        server.shutdown()
        server.server_close()


def test_import_sidecar_assets_are_selectable_on_freeos(tmp_path: Path) -> None:
    state = ControlPlaneState()
    state.employees = [
        {"name": "Ops Coordinator", "role": "ops", "skills": ""},
        {"name": "No Skills Bot", "role": "analyst"},
    ]
    state.skills = [
        {"name": "org-governance", "slug": "org-governance", "content": "gate high-risk tools"}
    ]
    state.plugins = [{"name": "bridge", "slug": "bridge", "description": "FreeOS bridge"}]
    state.mcp = [{"name": "xyos-governance-mcp", "slug": "xyos-governance-mcp"}]
    url, server = start_control_plane(state)
    try:
        imported = import_openxyos_assets(
            tmp_path,
            tenant_id="acme",
            sidecar_url=url,
            from_sidecar=True,
            spawn_agents=True,
        )
        assert "ops-coordinator" in imported.employees
        assert "no-skills-bot" in imported.employees
        assert "org-governance" in imported.skills
        assert (tmp_path / "org-skills" / "org-governance" / "SKILL.md").is_file()
        assert "bridge" in imported.plugins
        assert (tmp_path / "org-plugins" / "bridge.json").is_file()
        assert "xyos-governance-mcp" in imported.mcp
        assert (tmp_path / "org-mcps" / "xyos-governance-mcp.json").is_file()
        assert imported.agents
        pack = publish_asset_pack(
            tmp_path, tenant_id="acme", out_dir=tmp_path / "asset-packs" / "latest"
        )
        result = apply_asset_pack(pack.directory, home=tmp_path, tenant_id="acme", base_url=url)
        assert result.remote_applied is True
        pushed = state.ingested.get("employees") or []
        assert pushed
        assert all(item.get("status") == "active" for item in pushed)
        assert all(item.get("employment_category") == "internal" for item in pushed)
    finally:
        server.shutdown()
        server.server_close()

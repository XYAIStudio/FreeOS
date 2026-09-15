"""Bidirectional asset factory: import catalog/blueprint and publish a pack."""

from __future__ import annotations

import json
from pathlib import Path

from octop.modules.org_os.assets.importer import import_openxyos_assets
from octop.modules.org_os.assets.pack import ASSET_PACK_SCHEMA, publish_asset_pack
from octop.modules.org_os.catalog import catalog_keys

_FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "agent-blueprint.v1.json"


def test_import_catalog_and_blueprint(tmp_path: Path) -> None:
    imported = import_openxyos_assets(
        tmp_path,
        tenant_id="loop",
        catalog=True,
        blueprint_path=_FIXTURE,
    )
    assert imported.skills == [f"org-{key}" for key in catalog_keys()]
    assert "policy-analyst" in imported.employees
    workspace = tmp_path / "tenants" / "loop" / "employees" / "policy-analyst"
    assert (workspace / "SOUL.md").is_file()
    assert (tmp_path / "org-skills" / "org-governance" / "SKILL.md").is_file()


def test_import_policies(tmp_path: Path) -> None:
    policies = tmp_path / "matrix.json"
    policies.write_text(
        json.dumps({"rules": [{"action": "delete", "allow": False}]}), encoding="utf-8"
    )
    imported = import_openxyos_assets(tmp_path, tenant_id="loop", policies_path=policies)
    dest = Path(imported.policies)
    assert dest.is_file()
    raw = json.loads(dest.read_text(encoding="utf-8"))
    assert raw["tenant_id"] == "loop"
    assert raw["rules"]["rules"][0]["allow"] is False


def test_publish_asset_pack_includes_skills_mcp_agents(tmp_path: Path) -> None:
    import_openxyos_assets(tmp_path, tenant_id="loop", catalog=True, blueprint_path=_FIXTURE)
    pack = publish_asset_pack(tmp_path, tenant_id="loop", out_dir=tmp_path / "pack")
    assert pack.skill_count == len(catalog_keys())
    assert pack.plugin_count == pack.skill_count
    assert pack.mcp_count == 1
    assert pack.agent_count >= 1
    manifest = json.loads(pack.manifest.read_text(encoding="utf-8"))
    assert manifest["schema"] == ASSET_PACK_SCHEMA
    assert manifest["enabled_by_default"] is False
    assert (pack.directory / "mcps" / "xyos-governance-mcp.json").is_file()
    assert (pack.directory / "agents" / "policy-analyst" / "SOUL.md").is_file()
    assert (pack.directory / "openxyos" / "org-employees.publish.json").is_file()

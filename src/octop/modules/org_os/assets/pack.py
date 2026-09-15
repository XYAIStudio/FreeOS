"""Outbound: package FreeOS-produced skills/plugins/MCPs/agents for openXYOS."""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.modules.org_os.governance.mcp_server import stdio_spec
from octop.modules.org_os.skill_bridge.publish import publish_skill

ASSET_PACK_SCHEMA = "freeos.asset-pack.v1"


@dataclass
class AssetPack:
    directory: Path
    manifest: Path
    skill_count: int
    plugin_count: int
    mcp_count: int
    agent_count: int
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "directory": str(self.directory),
            "manifest": str(self.manifest),
            "skill_count": self.skill_count,
            "plugin_count": self.plugin_count,
            "mcp_count": self.mcp_count,
            "agent_count": self.agent_count,
            "notes": list(self.notes),
        }


def _copy_tree(source: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if source.is_file():
        dest.write_bytes(source.read_bytes())
        return
    shutil.copytree(source, dest, dirs_exist_ok=True)


def publish_asset_pack(
    home: Path,
    *,
    tenant_id: str = "",
    out_dir: Path | None = None,
) -> AssetPack:
    """Assemble produced assets into an openXYOS-shaped draft pack (not auto-on)."""
    dest = out_dir or (home / "asset-packs" / "latest")
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "skills").mkdir(exist_ok=True)
    (dest / "plugins").mkdir(exist_ok=True)
    (dest / "mcps").mkdir(exist_ok=True)
    (dest / "agents").mkdir(exist_ok=True)
    (dest / "openxyos").mkdir(exist_ok=True)

    skill_count = 0
    plugin_count = 0
    skills_root = home / "org-skills"
    if skills_root.is_dir():
        for skill_dir in sorted(path for path in skills_root.iterdir() if path.is_dir()):
            if not (skill_dir / "SKILL.md").is_file():
                continue
            _copy_tree(skill_dir, dest / "skills" / skill_dir.name)
            skill_count += 1
            try:
                draft = publish_skill(
                    skill_dir, out_dir=dest / "plugins" / f"{skill_dir.name}.plugin"
                )
                plugin_count += 1
                _copy_tree(draft.payload_path, dest / "openxyos" / f"{skill_dir.name}.publish.json")
            except ValueError:
                continue

    mcp_spec = {"xyos-governance-mcp": stdio_spec()}
    mcp_path = dest / "mcps" / "xyos-governance-mcp.json"
    mcp_path.write_text(json.dumps(mcp_spec, indent=2) + "\n", encoding="utf-8")
    mcp_count = 1
    _copy_tree(mcp_path, dest / "openxyos" / "xyos-governance-mcp.json")

    agent_count = 0
    tenants_root = home / "tenants"
    if tenants_root.is_dir():
        for employee_dir in tenants_root.glob("*/employees/*"):
            if not employee_dir.is_dir() or employee_dir.name == "registry.json":
                continue
            if not (employee_dir / "SOUL.md").is_file():
                continue
            _copy_tree(employee_dir, dest / "agents" / employee_dir.name)
            agent_count += 1

    manifest = {
        "schema": ASSET_PACK_SCHEMA,
        "tenant_id": tenant_id,
        "enabled_by_default": False,
        "counts": {
            "skills": skill_count,
            "plugins": plugin_count,
            "mcps": mcp_count,
            "agents": agent_count,
        },
        "openxyos": {
            "module_settings": "/api/module-settings",
            "plugins": "/api/plugins",
            "employees": "/api/employees",
            "note": "Drafts only. Tenant must toggle each asset on.",
        },
        "governance": "xyos-governance-mcp remains required for high-risk tools.",
    }
    manifest_path = dest / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return AssetPack(
        directory=dest,
        manifest=manifest_path,
        skill_count=skill_count,
        plugin_count=plugin_count,
        mcp_count=mcp_count,
        agent_count=agent_count,
        notes=[
            "Not installed into the sidecar. Operator reviews openxyos/ then enables per tenant.",
            "One tenant = one workspace; do not unpack this pack into a shared sandbox.",
        ],
    )

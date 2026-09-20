"""Outbound: package FreeOS-produced skills/plugins/MCPs/agents for openXYOS."""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.modules.org_os.compiler.telemetry import export_capability_digest
from octop.modules.org_os.governance.mcp_server import stdio_spec
from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.lifecycle.transitions import KEEP_ENV_KEYS
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


def _redact_env(env_file: Path) -> None:
    if not env_file.is_file():
        return
    lines: list[str] = []
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, _sep, _value = line.partition("=")
            if key in KEEP_ENV_KEYS:
                lines.append(line)
            else:
                lines.append(f"{key}=")
        else:
            lines.append(line)
    lines.append("# secrets stripped from freeos.asset-pack.v1")
    env_file.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _iter_employee_dirs(home: Path, tenant_id: str) -> list[Path]:
    tenants_root = home / "tenants"
    if not tenants_root.is_dir():
        return []
    if tenant_id:
        roots = [tenants_root / tenant_id / "employees"]
    else:
        roots = [path / "employees" for path in sorted(tenants_root.iterdir()) if path.is_dir()]
    found: list[Path] = []
    for root in roots:
        if not root.is_dir():
            continue
        for employee_dir in sorted(root.iterdir()):
            if employee_dir.is_dir() and (employee_dir / "SOUL.md").is_file():
                found.append(employee_dir)
    return found


def _employee_payloads(home: Path, tenant_id: str) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    tenants_root = home / "tenants"
    if not tenants_root.is_dir():
        return payloads
    tenant_ids = (
        [tenant_id]
        if tenant_id
        else [path.name for path in tenants_root.iterdir() if path.is_dir()]
    )
    for tid in tenant_ids:
        for record in LifecycleStore(home, tid).list():
            workspace = Path(record.workspace)
            if not workspace.is_dir() or not (workspace / "SOUL.md").is_file():
                continue
            digest = export_capability_digest(workspace, lifecycle=record.lifecycle)
            profile = digest.to_openxyos_profile()
            profile["slug"] = record.slug
            profile["lifecycle"] = record.lifecycle
            profile["enabled_by_default"] = False
            payloads.append(profile)
    return payloads


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

    plugins_inbox = home / "org-plugins"
    if plugins_inbox.is_dir():
        for child in sorted(plugins_inbox.iterdir()):
            if not child.is_file() or child.suffix.lower() != ".json":
                continue
            _copy_tree(child, dest / "openxyos" / child.name)
            plugin_count += 1

    mcp_spec = {"xyos-governance-mcp": stdio_spec()}
    mcp_path = dest / "mcps" / "xyos-governance-mcp.json"
    mcp_path.write_text(json.dumps(mcp_spec, indent=2) + "\n", encoding="utf-8")
    mcp_count = 1
    _copy_tree(mcp_path, dest / "openxyos" / "xyos-governance-mcp.json")
    mcps_inbox = home / "org-mcps"
    if mcps_inbox.is_dir():
        for child in sorted(mcps_inbox.iterdir()):
            if not child.is_file() or child.suffix.lower() != ".json":
                continue
            _copy_tree(child, dest / "mcps" / child.name)
            mcp_count += 1

    agent_count = 0
    for employee_dir in _iter_employee_dirs(home, tenant_id):
        target = dest / "agents" / employee_dir.name
        _copy_tree(employee_dir, target)
        _redact_env(target / ".env")
        agent_count += 1

    employees = _employee_payloads(home, tenant_id)
    employees_path = dest / "openxyos" / "org-employees.publish.json"
    employees_path.write_text(
        json.dumps(
            {
                "enabled_by_default": False,
                "endpoint": "/api/employees",
                "employees": employees,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    talent = [
        {
            "name": item["name"],
            "talent_type": "ai",
            "agent_type": item.get("agent_type"),
            "status": "available",
            "talent_status": "available",
            "skills": item.get("skills"),
            "source": "FreeOS",
            "integration_type": "agent-blueprint-v1",
            "tenant_id": item.get("tenant_id"),
            "slug": item.get("slug"),
            "enabled_by_default": False,
        }
        for item in employees
    ]
    (dest / "openxyos" / "org-talent.publish.json").write_text(
        json.dumps(
            {
                "enabled_by_default": False,
                "endpoint": "/api/talent",
                "talent": talent,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    manifest = {
        "schema": ASSET_PACK_SCHEMA,
        "tenant_id": tenant_id,
        "enabled_by_default": False,
        "counts": {
            "skills": skill_count,
            "plugins": plugin_count,
            "mcps": mcp_count,
            "agents": agent_count,
            "employees": len(employees),
            "talent": len(talent),
        },
        "openxyos": {
            "module_settings": "/api/module-settings",
            "plugins": "/api/plugins",
            "employees": "/api/employees",
            "talent": "/api/talent",
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
            "Assets land on this organization's Employees, Talent, Skills, and Plugins lists.",
            "One tenant = one workspace; do not unpack this pack into a shared sandbox.",
            "Agent .env values are redacted except tenant/slug/schema keys.",
        ],
    )

"""Publish a polished FreeOS skill back as a tenant-toggleable plugin draft."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_FRONTMATTER_NAME = re.compile(r"^name:\s*([a-z0-9-]+)\s*$", re.MULTILINE)
_MODULE_KEY = re.compile(r"module_key:\s*([a-z0-9-]+)")


@dataclass
class PublishDraft:
    plugin_id: str
    module_key: str
    source_skill: Path
    output_dir: Path
    plugin_yaml: Path
    payload_path: Path
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "plugin_id": self.plugin_id,
            "module_key": self.module_key,
            "source_skill": str(self.source_skill),
            "output_dir": str(self.output_dir),
            "plugin_yaml": str(self.plugin_yaml),
            "payload": str(self.payload_path),
            "notes": list(self.notes),
        }


def _read_skill(skill_dir: Path) -> tuple[str, str, str]:
    manifest = skill_dir / "SKILL.md"
    if not manifest.is_file():
        raise ValueError(f"{skill_dir} is not a Skill directory (missing SKILL.md)")
    text = manifest.read_text(encoding="utf-8")
    name_match = _FRONTMATTER_NAME.search(text)
    slug = name_match.group(1) if name_match else skill_dir.name
    module_match = _MODULE_KEY.search(text)
    module_key = module_match.group(1) if module_match else slug.removeprefix("org-")
    return slug, module_key, text


def _plugin_yaml(plugin_id: str, module_key: str) -> str:
    return (
        f"id: {plugin_id}\n"
        "version: 0.1.0\n"
        f"name: OpenXYOS {module_key} skill\n"
        "description: Tenant-toggleable plugin published from a FreeOS module skill\n"
        'icon: "🧩"\n'
        "kind: tool\n"
        "entry: main.py\n"
        "ui:\n"
        "  entry: ui/index.js\n"
        "  manifest: ui/manifest.json\n"
    )


def _main_py(plugin_id: str, module_key: str) -> str:
    return f'''\
"""Published org skill plugin (draft). Enable per tenant — not globally."""

from __future__ import annotations

import json

from harness_agent.plugins import PluginContext


def {plugin_id.replace("-", "_")}_info() -> str:
    return json.dumps(
        {{
            "plugin_id": "{plugin_id}",
            "module_key": "{module_key}",
            "enabled_by_default": False,
            "note": "Tenant must toggle this plugin on; isolation is one tenant per workspace.",
        }},
        ensure_ascii=False,
    )


def setup(ctx: PluginContext) -> None:
    ctx.tool(
        "{plugin_id.replace("-", "_")}_info",
        {plugin_id.replace("-", "_")}_info,
        description="Describe the published openXYOS module skill plugin (disabled by default).",
    )
'''


def _ui_files() -> tuple[str, str]:
    manifest = json.dumps({"renderer": "org_skill_card", "version": 1}, indent=2) + "\n"
    index = "export default function render(data) { return String(data && data.text || ''); }\n"
    return manifest, index


def publish_skill(skill_dir: Path, *, out_dir: Path | None = None) -> PublishDraft:
    """Write a plugin draft + sidecar tenant-toggle payload. Does not auto-enable."""
    skill_dir = skill_dir.resolve()
    slug, module_key, _text = _read_skill(skill_dir)
    plugin_id = slug if slug.startswith("org-") else f"org-{slug}"
    dest = (out_dir or skill_dir.parent / f"{plugin_id}.plugin").resolve()
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "ui").mkdir(parents=True, exist_ok=True)

    plugin_yaml = dest / "plugin.yaml"
    plugin_yaml.write_text(_plugin_yaml(plugin_id, module_key), encoding="utf-8")
    (dest / "main.py").write_text(_main_py(plugin_id, module_key), encoding="utf-8")
    manifest, index = _ui_files()
    (dest / "ui" / "manifest.json").write_text(manifest, encoding="utf-8")
    (dest / "ui" / "index.js").write_text(index, encoding="utf-8")

    payload = {
        "plugin_id": plugin_id,
        "module_key": module_key,
        "enabled": False,
        "tenant_toggleable": True,
        "source_skill": str(skill_dir),
        "sidecar": {
            "method": "POST",
            "path": "/api/plugins",
            "body": {
                "id": plugin_id,
                "module_key": module_key,
                "enabled": False,
                "source": "freeos-skill-bridge",
            },
        },
        "module_settings": {
            "method": "PUT",
            "path": "/api/module-settings",
            "note": "Enable only for the target tenant; never broadcast to all tenants.",
        },
    }
    payload_path = dest / "publish.json"
    payload_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    notes = [
        "Draft only — not installed into ~/.freeos/plugins or the sidecar.",
        "Copy plugin.yaml into a tenant workspace or POST publish.json to the sidecar.",
        "Keep enabled=false until the tenant opts in.",
        "One tenant = one workspace/sandbox; do not reuse this plugin across tenants.",
    ]
    return PublishDraft(
        plugin_id=plugin_id,
        module_key=module_key,
        source_skill=skill_dir,
        output_dir=dest,
        plugin_yaml=plugin_yaml,
        payload_path=payload_path,
        notes=notes,
    )

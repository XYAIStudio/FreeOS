"""Inbound: openXYOS catalog / blueprints / policies → FreeOS generators."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.modules.org_os.compiler.blueprint import parse_blueprint
from octop.modules.org_os.compiler.compile import compile_blueprint
from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.lifecycle.transitions import register_compiled
from octop.modules.org_os.skill_bridge.generate import generate_module_skills


@dataclass
class ImportedAssets:
    skills: list[str] = field(default_factory=list)
    employees: list[str] = field(default_factory=list)
    policies: str = ""
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "skills": list(self.skills),
            "employees": list(self.employees),
            "policies": self.policies,
            "notes": list(self.notes),
        }


def import_openxyos_assets(
    home: Path,
    *,
    tenant_id: str = "",
    sidecar_url: str = "http://127.0.0.1:3780",
    catalog: bool = False,
    blueprint_path: Path | None = None,
    policies_path: Path | None = None,
) -> ImportedAssets:
    result = ImportedAssets()
    tid = tenant_id or "default"

    if catalog:
        generated = generate_module_skills(home / "org-skills")
        result.skills = [item.slug for item in generated]
        result.notes.append(f"generated {len(generated)} module skills from the openXYOS catalog")

    if blueprint_path is not None:
        blueprint = parse_blueprint(blueprint_path, tenant_id=tid)
        compiled = compile_blueprint(blueprint, home=home, tenant_id=tid, sidecar_url=sidecar_url)
        store = LifecycleStore(home, tid)
        register_compiled(
            store,
            slug=compiled.slug,
            name=blueprint.name,
            workspace=compiled.workspace,
            lifecycle="draft",
        )
        result.employees.append(compiled.slug)
        result.notes.append(f"compiled blueprint → {compiled.workspace}")

    if policies_path is not None:
        dest = home / "governance" / "imported-policies.json"
        dest.parent.mkdir(parents=True, exist_ok=True)
        raw = json.loads(policies_path.read_text(encoding="utf-8"))
        payload = {
            "source": str(policies_path),
            "tenant_id": tid,
            "rules": raw,
            "note": (
                "Imported for the xyos-governance-mcp default-deny engine. "
                "Unmatched high-risk actions still deny."
            ),
        }
        dest.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        result.policies = str(dest)
        result.notes.append("wrote imported governance policies (fail-closed)")

    if not (catalog or blueprint_path or policies_path):
        raise ValueError("specify --catalog, --blueprint, and/or --policies")
    return result

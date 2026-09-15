"""Inbound: openXYOS catalog / blueprints / policies → FreeOS generators."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from octop.modules.org_os.compiler.blueprint import parse_blueprint
from octop.modules.org_os.compiler.compile import compile_blueprint
from octop.modules.org_os.governance.imported import write_imported_policies
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


def _sidecar_get_json(sidecar_url: str, path: str, *, timeout: float = 2.0) -> Any | None:
    parsed = urlparse(sidecar_url or "")
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    url = f"{sidecar_url.rstrip('/')}{path}"
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.get(url)
    except httpx.HTTPError:
        return None
    if response.status_code >= 400:
        return None
    try:
        body = response.json()
    except ValueError:
        return None
    if isinstance(body, dict) and "data" in body:
        return body["data"]
    return body


def import_openxyos_assets(
    home: Path,
    *,
    tenant_id: str = "",
    sidecar_url: str = "http://127.0.0.1:3780",
    catalog: bool = False,
    blueprint_path: Path | None = None,
    policies_path: Path | None = None,
    from_sidecar: bool = False,
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

    policies_raw: Any | None = None
    policies_source = ""
    if policies_path is not None:
        policies_raw = json.loads(policies_path.read_text(encoding="utf-8"))
        policies_source = str(policies_path)
    elif from_sidecar:
        fetched = _sidecar_get_json(sidecar_url, "/api/governance/permissions")
        if fetched is not None:
            policies_raw = fetched
            policies_source = f"{sidecar_url.rstrip('/')}/api/governance/permissions"
        else:
            result.notes.append(
                "sidecar permissions unreachable; pass --policies or retry when signed in"
            )

    if policies_raw is not None:
        dest = write_imported_policies(
            home / "governance",
            policies_raw,
            tenant_id=tid,
            source=policies_source,
        )
        result.policies = str(dest)
        result.notes.append("wrote imported governance policies (fail-closed; engine loads them)")

    if not (catalog or blueprint_path or policies_path or from_sidecar):
        raise ValueError("specify --catalog, --blueprint, --policies, and/or --from-sidecar")
    return result

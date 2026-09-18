"""Inbound: openXYOS catalog / blueprints / policies → FreeOS generators."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from octop.modules.org_os.apply.client import OpenXyosControlClient
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
    agents: list[str] = field(default_factory=list)
    plugins: list[str] = field(default_factory=list)
    mcp: list[str] = field(default_factory=list)
    policies: str = ""
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "skills": list(self.skills),
            "employees": list(self.employees),
            "agents": list(self.agents),
            "plugins": list(self.plugins),
            "mcp": list(self.mcp),
            "policies": self.policies,
            "notes": list(self.notes),
        }


def _safe_slug(raw: str, fallback: str = "imported") -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in raw.strip().lower())
    cleaned = cleaned.strip("-")[:64]
    return cleaned or fallback


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


def _write_org_skill(home: Path, item: dict[str, Any]) -> str:
    slug = _safe_slug(str(item.get("slug") or item.get("name") or ""))
    name = str(item.get("name") or slug)
    dest = home / "org-skills" / slug
    dest.mkdir(parents=True, exist_ok=True)
    body = str(item.get("content") or item.get("description") or "").strip()
    if not body:
        body = f"Imported from openXYOS as `{name}`."
    (dest / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: Imported from openXYOS\n---\n\n# {name}\n\n{body}\n",
        encoding="utf-8",
    )
    return slug


def _write_org_plugin(home: Path, item: dict[str, Any]) -> str:
    slug = _safe_slug(str(item.get("slug") or item.get("name") or item.get("id") or "plugin"))
    dest = home / "org-plugins"
    dest.mkdir(parents=True, exist_ok=True)
    payload = dict(item)
    payload.setdefault("slug", slug)
    payload.setdefault("status", "active")
    payload.setdefault("source", "openXYOS")
    (dest / f"{slug}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if not str(item.get("content") or "").strip():
        item = {
            **item,
            "content": str(item.get("description") or f"Plugin `{slug}` imported from openXYOS."),
        }
    _write_org_skill(home, {**item, "slug": slug, "name": str(item.get("name") or slug)})
    return slug


def _write_org_mcp(home: Path, item: dict[str, Any]) -> str:
    slug = _safe_slug(str(item.get("slug") or item.get("name") or "mcp"))
    dest = home / "org-mcps"
    dest.mkdir(parents=True, exist_ok=True)
    payload = dict(item)
    payload.setdefault("slug", slug)
    payload.setdefault("name", slug)
    (dest / f"{slug}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return slug


def _employee_capabilities(item: dict[str, Any]) -> list[str]:
    raw = item.get("skills") or item.get("capabilities")
    if isinstance(raw, list):
        parts = [str(part).strip() for part in raw if str(part).strip()]
    else:
        parts = [part.strip() for part in str(raw or "").split(",") if part.strip()]
    if parts:
        return parts
    fallback = str(item.get("role") or item.get("agent_type") or "imported-colleague").strip()
    return [fallback or "imported-colleague"]


def _compile_sidecar_employee(
    home: Path,
    item: dict[str, Any],
    *,
    tenant_id: str,
    sidecar_url: str,
    spawn_agents: bool,
    owner_user_id: int | None,
    result: ImportedAssets,
) -> None:
    name = str(item.get("name") or item.get("slug") or "").strip()
    if not name:
        return
    capabilities = _employee_capabilities(item)
    compiled = compile_blueprint(
        {
            "schema": "openxyos.agent-blueprint.v1",
            "name": name,
            "positioning": str(item.get("description") or item.get("role") or name),
            "industry": "organization",
            "capabilities": capabilities,
        },
        home=home,
        tenant_id=tenant_id,
        sidecar_url=sidecar_url,
    )
    store = LifecycleStore(home, tenant_id)
    register_compiled(
        store,
        slug=compiled.slug,
        name=name,
        workspace=compiled.workspace,
        lifecycle="market",
    )
    result.employees.append(compiled.slug)
    result.notes.append(f"compiled blueprint → {compiled.workspace}")
    if spawn_agents:
        from octop.modules.org_os.runtime.spawn import spawn_colleague_agent

        record = store.get(compiled.slug)
        if record is not None:
            spawned = spawn_colleague_agent(home, record, owner_user_id=owner_user_id)
            result.agents.append(spawned.agent_id)
            result.notes.append(f"spawned FreeOS assistant {spawned.agent_id}")


def import_openxyos_assets(
    home: Path,
    *,
    tenant_id: str = "",
    sidecar_url: str = "http://127.0.0.1:3780",
    catalog: bool = False,
    blueprint_path: Path | None = None,
    policies_path: Path | None = None,
    from_sidecar: bool = False,
    spawn_agents: bool = True,
    owner_user_id: int | None = None,
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
        if spawn_agents:
            from octop.modules.org_os.runtime.spawn import spawn_colleague_agent

            record = store.get(compiled.slug)
            if record is not None:
                spawned = spawn_colleague_agent(home, record, owner_user_id=owner_user_id)
                result.agents.append(spawned.agent_id)
                result.notes.append(f"spawned FreeOS assistant {spawned.agent_id}")

    if from_sidecar:
        client = OpenXyosControlClient(sidecar_url, home=home)
        exported = client.export()
        if isinstance(exported, dict):
            result.notes.append("imported live control-plane export")
            for item in exported.get("employees") or []:
                if isinstance(item, dict):
                    _compile_sidecar_employee(
                        home,
                        item,
                        tenant_id=tid,
                        sidecar_url=sidecar_url,
                        spawn_agents=spawn_agents,
                        owner_user_id=owner_user_id,
                        result=result,
                    )
            seen = set(result.employees)
            for item in exported.get("talent") or []:
                if not isinstance(item, dict):
                    continue
                label = _safe_slug(str(item.get("slug") or item.get("name") or ""))
                if not label or label in seen:
                    continue
                _compile_sidecar_employee(
                    home,
                    item,
                    tenant_id=tid,
                    sidecar_url=sidecar_url,
                    spawn_agents=spawn_agents,
                    owner_user_id=owner_user_id,
                    result=result,
                )
                seen.update(result.employees)
            for item in exported.get("skills") or []:
                if not isinstance(item, dict):
                    continue
                slug = _write_org_skill(home, item)
                result.skills.append(slug)
                result.notes.append(f"imported openXYOS skill {slug}")
            for item in exported.get("plugins") or []:
                if not isinstance(item, dict):
                    continue
                slug = _write_org_plugin(home, item)
                result.plugins.append(slug)
                result.skills.append(slug)
                result.notes.append(f"imported openXYOS plugin {slug}")
            for item in exported.get("mcp") or []:
                if not isinstance(item, dict):
                    continue
                slug = _write_org_mcp(home, item)
                result.mcp.append(slug)
                result.notes.append(f"imported openXYOS MCP {slug}")
        elif sidecar_url:
            result.notes.append("sidecar export unreachable; using catalog/blueprint fallback")

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

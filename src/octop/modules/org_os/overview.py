"""Dual-loop snapshot: FreeOS data plane ↔ openXYOS control plane."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.modules.org_os.apply.client import mirror_root
from octop.modules.org_os.catalog import catalog_keys, catalog_with_host_delivery
from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.org_chart.store import OrgChartStore
from octop.modules.org_os.runtime.spawn import list_spawned_agents
from octop.modules.org_os.service import OrgModuleService


def _mtime_iso(path: Path) -> str | None:
    if not path.is_file():
        return None
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(path.stat().st_mtime))


def _count_skill_dirs(home: Path) -> int:
    root = home / "org-skills"
    if not root.is_dir():
        return 0
    return sum(1 for child in root.iterdir() if child.is_dir() and (child / "SKILL.md").is_file())


def _list_len(doc: Any, key: str) -> int:
    if isinstance(doc, dict) and isinstance(doc.get(key), list):
        return len(doc[key])
    if isinstance(doc, list):
        return len(doc)
    return 0


def _mirror_surfaces(home: Path, tenant_id: str) -> dict[str, int]:
    root = mirror_root(home, tenant_id)
    counts = {"employees": 0, "talent": 0, "skills": 0, "plugins": 0}
    if not root.is_dir():
        return counts
    mapping = {
        "employees": ("employees.json", "employees"),
        "talent": ("talent.json", "talent"),
        "skills": ("skills.json", "skills"),
        "plugins": ("plugins.json", "plugins"),
    }
    for surface, (name, key) in mapping.items():
        path = root / name
        if not path.is_file():
            continue
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        counts[surface] = _list_len(raw, key)
    return counts


def _host_surfaces(home: Path, tenant_id: str) -> dict[str, int]:
    store = OrgChartStore(home)
    directory = store.list_employees(tenant_id=tenant_id, status="active")
    talent = store.list_talent(tenant_id=tenant_id, status="available")
    return {
        "employees": len(directory),
        "talent": len(talent),
        "directory": len(directory),
        "skills": _count_skill_dirs(home),
        "plugins": 0,
    }


def _pending_pauses(home: Path) -> int:
    from octop.modules.org_os.governance.store import DurableGovernanceStore

    return len(DurableGovernanceStore(home / "governance").list_pauses("pending"))


def _colleague_rows(home: Path, tenant_id: str) -> list[dict[str, Any]]:
    spawned = {row.slug: row for row in list_spawned_agents(home)}
    rows: list[dict[str, Any]] = []
    for rec in LifecycleStore(home, tenant_id).list():
        agent = spawned.get(rec.slug)
        rows.append(
            {
                "slug": rec.slug,
                "name": rec.name or rec.slug,
                "lifecycle": rec.lifecycle,
                "agent_id": rec.agent_id or (agent.agent_id if agent else ""),
                "spawned": agent is not None or bool(rec.agent_id),
            }
        )
    return rows


def _read_loop_proof(home: Path) -> dict[str, Any] | None:
    path = home / "asset-packs" / "loop-proof.json"
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if not isinstance(raw, dict):
        return None
    raw["updated_at"] = _mtime_iso(path)
    return raw


@dataclass
class DualLoopOverview:
    enabled: bool
    sidecar_reachable: bool
    sidecar_embed_ok: bool
    sidecar_url: str
    start_available: bool
    install_ready: bool
    start_command: str
    home: str
    last_sync: str | None
    freeos: dict[str, Any]
    openxyos: dict[str, Any]
    last_loop: dict[str, Any] | None = None
    notes: list[str] = field(default_factory=list)
    runtime: str = "in_host"
    sidecar_optional: bool = True
    colleagues: list[dict[str, Any]] = field(default_factory=list)
    experts: list[dict[str, Any]] = field(default_factory=list)
    org_surfaces: dict[str, int] = field(default_factory=dict)
    governance: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "runtime": self.runtime,
            "sidecar_optional": self.sidecar_optional,
            "sidecar_reachable": self.sidecar_reachable,
            "sidecar_embed_ok": self.sidecar_embed_ok,
            "sidecar_url": self.sidecar_url,
            "start_available": self.start_available,
            "install_ready": self.install_ready,
            "start_command": self.start_command,
            "home": self.home,
            "last_sync": self.last_sync,
            "freeos": dict(self.freeos),
            "openxyos": dict(self.openxyos),
            "colleagues": list(self.colleagues),
            "experts": list(self.experts),
            "org_surfaces": dict(self.org_surfaces),
            "governance": dict(self.governance),
            "last_loop": self.last_loop,
            "notes": list(self.notes),
            "catalog": catalog_with_host_delivery(),
        }


def build_overview(
    service: OrgModuleService,
    *,
    agents: int = 0,
    connectors: int = 0,
    cron_jobs: int = 0,
    skill_packages: int = 0,
    start_available: bool = False,
    install_ready: bool = False,
) -> DualLoopOverview:
    status = service.status()
    tid = service.tenant_id() or "default"
    colleagues = LifecycleStore(service.home, tid).list()
    spawned = list_spawned_agents(service.home)
    colleague_rows = _colleague_rows(service.home, tid)
    mirror = _mirror_surfaces(service.home, tid)
    host = _host_surfaces(service.home, tid)
    org_surfaces = {
        "employees": host["employees"] or mirror["employees"],
        "talent": host["talent"] or mirror["talent"],
        "skills": host["skills"] or mirror["skills"],
        "plugins": mirror["plugins"],
        "directory": host["directory"],
    }
    pending_pauses = _pending_pauses(service.home)
    org_skills = _count_skill_dirs(service.home)
    proof = _read_loop_proof(service.home)
    last_sync = None
    if proof and isinstance(proof.get("updated_at"), str):
        last_sync = str(proof["updated_at"])
    pack_manifest = service.home / "asset-packs" / "latest" / "manifest.json"
    if last_sync is None:
        last_sync = _mtime_iso(pack_manifest)

    freeos = {
        "employees": len(colleagues),
        "employee_states": {
            row.lifecycle: sum(1 for item in colleagues if item.lifecycle == row.lifecycle)
            for row in colleagues
        },
        "agents": max(agents, len(spawned)),
        "spawned_colleagues": len(spawned),
        "org_skills": org_skills,
        "skill_packages": skill_packages,
        "mcp": connectors,
        "tasks": cron_jobs,
        "directory_employees": host["directory"],
        "talent_available": host["talent"],
        "pending_pauses": pending_pauses,
    }
    openxyos = {
        "reachable": status.sidecar.reachable,
        "url": status.sidecar.url,
        "detail": status.sidecar.detail,
        "modules": len(catalog_keys()),
        "governance": status.governance_enabled,
        "tenant_id": status.tenant_id or tid,
        "approvals": pending_pauses,
    }
    notes = [
        "Organization runs in the FreeOS Python host. The Node sidecar is optional.",
        "FreeOS does the work. Organization capabilities (catalog, employees, growth loop) live in-host.",
        "The organization room is arranged on its own; everyday studio login stays a separate space.",
        "Data plane: colleagues / experts / skills / MCP / tasks. Control plane: department employees / blueprints / modules / governance.",
    ]
    embed_ok = False
    if status.sidecar.reachable:
        try:
            embed_ok = service.probe_sidecar_embed()
        except Exception:
            embed_ok = True
        if not embed_ok:
            notes.append(
                "Optional openXYOS console is up but the embed origin is blocked (advanced preview)."
            )
    elif service.explicit_sidecar_url():
        notes.append(
            "Optional openXYOS sidecar is offline — in-host org storage and the growth loop still work."
        )
    return DualLoopOverview(
        enabled=status.enabled,
        sidecar_reachable=status.sidecar.reachable,
        sidecar_embed_ok=embed_ok,
        sidecar_url=status.sidecar.url,
        start_available=start_available,
        install_ready=install_ready,
        start_command=status.start_command,
        home=status.home,
        last_sync=last_sync,
        freeos=freeos,
        openxyos=openxyos,
        last_loop=proof,
        notes=notes,
        colleagues=colleague_rows,
        experts=[
            {
                "agent_id": row.agent_id,
                "slug": row.slug,
                "name": row.name,
            }
            for row in spawned
        ],
        org_surfaces=org_surfaces,
        governance={
            "pending_pauses": pending_pauses,
            "enabled": status.governance_enabled,
            "href": "/organization/governance",
        },
    )

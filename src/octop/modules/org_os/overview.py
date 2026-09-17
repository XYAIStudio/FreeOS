"""Dual-loop snapshot: FreeOS data plane ↔ openXYOS control plane."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.modules.org_os.catalog import OPENXYOS_MODULES, catalog_keys
from octop.modules.org_os.lifecycle.store import LifecycleStore
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

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
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
            "last_loop": self.last_loop,
            "notes": list(self.notes),
            "catalog": list(OPENXYOS_MODULES),
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
    }
    openxyos = {
        "reachable": status.sidecar.reachable,
        "url": status.sidecar.url,
        "detail": status.sidecar.detail,
        "modules": len(catalog_keys()),
        "governance": status.governance_enabled,
        "tenant_id": status.tenant_id or tid,
        "approvals": 0,
    }
    notes = [
        "FreeOS does the work. openXYOS owns organization and governance.",
        "Data plane: colleagues / experts / skills / MCP / tasks. Control plane: department employees / blueprints / modules / governance.",
    ]
    embed_ok = False
    if status.sidecar.reachable:
        try:
            embed_ok = service.probe_sidecar_embed()
        except Exception:
            embed_ok = True
    if not status.sidecar.reachable:
        if install_ready:
            notes.append(
                "openXYOS sidecar is offline — reconnecting the install-time local console."
            )
        else:
            notes.append("openXYOS sidecar is offline — start it to sync blueprints and approvals.")
    elif not embed_ok:
        notes.append(
            "openXYOS livez is up but the embed origin is blocked (blank preview)."
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
    )

"""One operator path: blueprint → employee → publish → apply → import → agents."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.modules.org_os.apply.apply import apply_asset_pack, import_applied_surfaces
from octop.modules.org_os.apply.client import resolve_control_plane_url
from octop.modules.org_os.assets.importer import import_openxyos_assets
from octop.modules.org_os.assets.pack import publish_asset_pack
from octop.modules.org_os.governance.interceptor import (
    GovernanceBlockedError,
    gate_tool_call,
)
from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.lifecycle.transitions import (
    already_at_or_beyond,
    can_transition,
    transition,
)
from octop.modules.org_os.loop.fixtures import (
    blueprint_fixture,
    extra_blueprint_fixtures,
    policies_fixture,
)
from octop.modules.org_os.runtime.spawn import SpawnedAgent, spawn_colleague_agent
from octop.modules.org_os.service import OrgModuleService


@dataclass
class LoopProof:
    tenant_id: str
    home: str
    skills: list[str] = field(default_factory=list)
    employees: list[str] = field(default_factory=list)
    agents: list[dict[str, Any]] = field(default_factory=list)
    lifecycle: dict[str, str] = field(default_factory=dict)
    pack_dir: str = ""
    mirror_dir: str = ""
    remote_applied: bool = False
    imported_roundtrip: dict[str, Any] = field(default_factory=dict)
    governance_blocked: bool = False
    governance: dict[str, Any] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    landed: dict[str, Any] = field(default_factory=dict)
    ok: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "tenant_id": self.tenant_id,
            "home": self.home,
            "skills": list(self.skills),
            "employees": list(self.employees),
            "agents": list(self.agents),
            "lifecycle": dict(self.lifecycle),
            "pack_dir": self.pack_dir,
            "mirror_dir": self.mirror_dir,
            "remote_applied": self.remote_applied,
            "imported_roundtrip": dict(self.imported_roundtrip),
            "governance_blocked": self.governance_blocked,
            "governance": dict(self.governance),
            "landed": dict(self.landed),
            "notes": list(self.notes),
        }


def _promote(store: LifecycleStore, slug: str) -> tuple[dict[str, str], list[str]]:
    """Walk *slug* toward ``active`` along allowed edges only.

    Already-deployed colleagues (e.g. ``active``) and illegal pairs such as
    ``active → market`` are recorded as skips instead of raising.
    """
    states = ("market", "recruit", "shadow", "active")
    record = store.get(slug)
    if record is None:
        return {}, [f"skipped promotion for {slug}: unknown colleague"]

    initial = record.lifecycle
    seen: dict[str, str] = {}
    notes: list[str] = []
    skipped_states: list[str] = []
    if initial == "draft":
        seen["draft"] = "draft"

    for state in states:
        current = record.lifecycle
        if current == state:
            seen[state] = current
            continue
        if already_at_or_beyond(current, state):
            seen[state] = current
            skipped_states.append(state)
            continue
        if not can_transition(current, state):
            seen[state] = current
            notes.append(f"skipped illegal transition for {slug}: cannot move {current} → {state}")
            continue
        try:
            record = transition(store, slug, state, reason="org loop run")
        except ValueError as exc:
            notes.append(f"skipped illegal transition for {slug}: {exc}")
            seen[state] = record.lifecycle
            continue
        seen[state] = record.lifecycle

    seen[record.lifecycle] = record.lifecycle
    if skipped_states:
        notes.append(f"skipped promotion for {slug}: already {initial}")
    return seen, notes


def run_growth_loop(
    home: Path,
    *,
    tenant_id: str = "1",
    blueprint_path: Path | None = None,
    policies_path: Path | None = None,
    sidecar_url: str = "",
    config_path: Path | None = None,
    owner_user_id: int | None = None,
) -> LoopProof:
    """Run the finished self-growth loop against *home*.

    Uses bundled fixtures and the in-host org registry. When
    ``OPENXYOS_BASE_URL`` (or an explicit *sidecar_url*) is set, outbound
    packs are also POSTed to that optional control plane. The loop never
    starts or waits for a local Node sidecar.
    """
    home = Path(home)
    home.mkdir(parents=True, exist_ok=True)
    tid = tenant_id or "1"
    service = OrgModuleService(config_path=config_path or (home / "config.json"), home=home)
    service.set_enabled(True, sidecar_url=sidecar_url or None)
    service.set_governance_enabled(True, tenant_id=tid)

    blueprint = Path(blueprint_path) if blueprint_path else blueprint_fixture()
    policies = Path(policies_path) if policies_path else policies_fixture()
    if not blueprint.is_file():
        raise FileNotFoundError(f"blueprint fixture missing: {blueprint}")
    control_url = resolve_control_plane_url(sidecar_url)

    imported = import_openxyos_assets(
        home,
        tenant_id=tid,
        sidecar_url=control_url or service.sidecar_url(),
        catalog=True,
        blueprint_path=blueprint,
        policies_path=policies if policies.is_file() else None,
        from_sidecar=bool(control_url),
        spawn_agents=False,
        owner_user_id=owner_user_id,
    )
    for extra in extra_blueprint_fixtures():
        more = import_openxyos_assets(
            home,
            tenant_id=tid,
            sidecar_url=control_url or service.sidecar_url(),
            blueprint_path=extra,
            spawn_agents=False,
            owner_user_id=owner_user_id,
        )
        imported.employees.extend(more.employees)
        imported.notes.extend(more.notes)

    store = LifecycleStore(home, tid)
    lifecycle: dict[str, str] = {}
    spawned: list[SpawnedAgent] = []
    promotion_notes: list[str] = []
    for slug in dict.fromkeys(imported.employees):
        advanced, skipped = _promote(store, slug)
        lifecycle.update(advanced)
        promotion_notes.extend(skipped)
        record = store.get(slug)
        if record is None:
            continue
        spawned.append(spawn_colleague_agent(home, record, owner_user_id=owner_user_id))

    pack = publish_asset_pack(home, tenant_id=tid)
    applied = apply_asset_pack(
        pack.directory,
        home=home,
        tenant_id=tid,
        base_url=control_url,
    )
    roundtrip = import_applied_surfaces(home, tenant_id=tid, base_url=control_url)

    # Inbound feedback: re-import catalog/policies from the applied pack so
    # the control plane strengthens the next FreeOS generation.
    feedback = import_openxyos_assets(
        home,
        tenant_id=tid,
        sidecar_url=control_url or service.sidecar_url(),
        catalog=True,
        from_sidecar=bool(roundtrip.get("remote")),
        spawn_agents=True,
        owner_user_id=owner_user_id,
    )

    governance: dict[str, Any] = {}
    blocked = False
    try:
        gate_tool_call(
            home=home,
            tool_name="delete_employee",
            category="delete",
            action="delete",
            tenant_id=tid,
            actor_id="org-loop",
            args={"slug": imported.employees[0] if imported.employees else "demo"},
            sidecar_url=control_url,
            enabled=True,
        )
    except GovernanceBlockedError as exc:
        blocked = True
        governance = exc.decision.to_dict()

    proof = LoopProof(
        tenant_id=tid,
        home=str(home),
        skills=list(dict.fromkeys([*imported.skills, *feedback.skills])),
        employees=list(imported.employees),
        agents=[item.to_dict() for item in spawned],
        lifecycle=lifecycle,
        pack_dir=str(pack.directory),
        mirror_dir=str(applied.mirror_dir),
        remote_applied=applied.remote_applied,
        imported_roundtrip={
            "local_surfaces": sorted((roundtrip.get("local") or {}).keys()),
            "remote_surfaces": sorted((roundtrip.get("remote") or {}).keys()),
            "feedback_skills": list(feedback.skills),
            "feedback_employees": list(feedback.employees),
        },
        governance_blocked=blocked,
        governance=governance,
        landed=applied.landed if isinstance(applied.landed, dict) else {},
        notes=[
            *imported.notes,
            *applied.notes,
            *feedback.notes,
            *promotion_notes,
            "Loop produced colleagues, published an asset pack, applied department employees, and imported back.",
        ],
    )
    proof.ok = bool(
        proof.skills
        and proof.employees
        and proof.agents
        and proof.lifecycle.get("active") == "active"
        and proof.pack_dir
        and applied.mirrored
        and proof.governance_blocked
    )
    dest = home / "asset-packs" / "loop-proof.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(proof.to_dict(), indent=2) + "\n", encoding="utf-8")
    return proof

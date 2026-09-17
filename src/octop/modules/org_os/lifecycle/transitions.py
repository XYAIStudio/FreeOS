"""Lifecycle transitions with real workspace side effects."""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

from octop.modules.org_os.compiler.telemetry import OPENXYOS_STATUS_MAP
from octop.modules.org_os.lifecycle.store import (
    LIFECYCLE_STATES,
    ColleagueRecord,
    LifecycleStore,
)

KEEP_ENV_KEYS = frozenset(
    {"FREEOS_ORG_TENANT_ID", "FREEOS_COLLEAGUE_SLUG", "XYOS_BLUEPRINT_SCHEMA"}
)

ALLOWED: dict[str, frozenset[str]] = {
    "draft": frozenset({"market", "offboard"}),
    "market": frozenset({"recruit", "offboard"}),
    "recruit": frozenset({"shadow", "offboard"}),
    "shadow": frozenset({"active", "offboard"}),
    "active": frozenset({"shadow", "offboard"}),
    "offboard": frozenset(),
}

# Happy-path ladder used by the self-growth loop. ``offboard`` is terminal.
PROMOTION_ORDER: tuple[str, ...] = ("draft", "market", "recruit", "shadow", "active")


def can_transition(current: str, target: str) -> bool:
    """Return True when *target* is a no-op or an allowed FSM edge."""
    if target not in LIFECYCLE_STATES:
        return False
    if current == target:
        return True
    return target in ALLOWED.get(current, frozenset())


def already_at_or_beyond(current: str, target: str) -> bool:
    """True when *current* is at or past *target* on the happy-path ladder.

    ``offboard`` is terminal and treated as beyond every promotion target.
    """
    if current == "offboard":
        return True
    try:
        return PROMOTION_ORDER.index(current) >= PROMOTION_ORDER.index(target)
    except ValueError:
        return False


def _apply_flags(record: ColleagueRecord) -> None:
    record.read_only = record.lifecycle in {"shadow", "offboard"}
    record.cron_enabled = record.lifecycle == "active"
    mapping = OPENXYOS_STATUS_MAP.get(record.lifecycle, OPENXYOS_STATUS_MAP["draft"])
    record.openxyos_talent_status = str(mapping["talent"] or "")
    record.openxyos_employment_category = str(mapping["employment_category"] or "")


def _set_cron_enabled(workspace: Path, enabled: bool) -> None:
    cron_file = workspace / "cron.json"
    if not cron_file.is_file():
        return
    try:
        jobs = json.loads(cron_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return
    if not isinstance(jobs, list):
        return
    for job in jobs:
        if isinstance(job, dict):
            job["enabled"] = bool(enabled)
    cron_file.write_text(json.dumps(jobs, indent=2) + "\n", encoding="utf-8")


def _revoke_credentials(workspace: Path) -> None:
    env_file = workspace / ".env"
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
    lines.append("# credentials revoked on offboard")
    env_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    (workspace / "OFFBOARDED").write_text("revoked\n", encoding="utf-8")


def _archive_memory(workspace: Path, home: Path, tenant_id: str, slug: str) -> str:
    memory = workspace / "MEMORY.md"
    dest_dir = home / "tenants" / tenant_id / "org-knowledge" / "archived-colleagues"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{slug}-MEMORY.md"
    if memory.is_file():
        shutil.copy2(memory, dest)
    else:
        dest.write_text(f"# archived {slug}\n", encoding="utf-8")
    return str(dest)


def transition(
    store: LifecycleStore,
    slug: str,
    target: str,
    *,
    reason: str = "",
) -> ColleagueRecord:
    if target not in LIFECYCLE_STATES:
        raise ValueError(f"unknown lifecycle state: {target}")
    record = store.get(slug)
    if record is None:
        raise ValueError(f"unknown colleague: {slug}")
    if target == record.lifecycle:
        return record
    allowed = ALLOWED.get(record.lifecycle, frozenset())
    if target not in allowed:
        raise ValueError(f"cannot move {record.lifecycle} → {target}")
    workspace = Path(record.workspace)
    previous = record.lifecycle
    record.lifecycle = target
    record.updated_at = time.time()
    record.history.append(
        {
            "from": previous,
            "to": target,
            "at": record.updated_at,
            "reason": reason,
        }
    )
    _apply_flags(record)
    if workspace.is_dir():
        _set_cron_enabled(workspace, record.cron_enabled)
        from octop.modules.org_os.runtime.memory import sync_colleague_memory

        sync_colleague_memory(record, store.home)
        if target in {"shadow", "active"} and not record.agent_id:
            from octop.modules.org_os.runtime.spawn import spawn_colleague_agent

            spawned = spawn_colleague_agent(store.home, record)
            record.agent_id = spawned.agent_id
        if target == "offboard":
            _revoke_credentials(workspace)
            record.credentials_revoked = True
            record.memory_archived = _archive_memory(
                workspace, store.home, record.tenant_id, record.slug
            )
    return store.upsert(record)


def register_compiled(
    store: LifecycleStore,
    *,
    slug: str,
    name: str,
    workspace: Path,
    lifecycle: str = "draft",
) -> ColleagueRecord:
    if lifecycle not in LIFECYCLE_STATES:
        lifecycle = "draft"
    now = time.time()
    existing = store.get(slug)
    record = ColleagueRecord(
        slug=slug,
        tenant_id=store.tenant_id,
        name=name,
        lifecycle=lifecycle,
        workspace=str(workspace),
        created_at=existing.created_at if existing else now,
        updated_at=now,
        history=list(existing.history) if existing else [],
    )
    _apply_flags(record)
    if workspace.is_dir():
        _set_cron_enabled(workspace, record.cron_enabled)
    return store.upsert(record)

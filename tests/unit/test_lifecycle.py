"""Digital-colleague lifecycle transitions and offboard side effects."""

from __future__ import annotations

from pathlib import Path

import pytest

from octop.modules.org_os.compiler.compile import compile_blueprint
from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.lifecycle.transitions import (
    already_at_or_beyond,
    can_transition,
    register_compiled,
    transition,
)

_FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "agent-blueprint.v1.json"


def _spawn(tmp_path: Path) -> tuple[LifecycleStore, str, Path]:
    compiled = compile_blueprint(_FIXTURE, home=tmp_path, tenant_id="acme")
    store = LifecycleStore(tmp_path, "acme")
    register_compiled(
        store,
        slug=compiled.slug,
        name="Policy Analyst",
        workspace=compiled.workspace,
        lifecycle="draft",
    )
    return store, compiled.slug, compiled.workspace


def test_happy_path_draft_to_active(tmp_path: Path) -> None:
    store, slug, workspace = _spawn(tmp_path)
    for state in ("market", "recruit", "shadow", "active"):
        record = transition(store, slug, state)
        assert record.lifecycle == state
    active = store.get(slug)
    assert active is not None
    assert active.read_only is False
    assert active.cron_enabled is True
    cron = (workspace / "cron.json").read_text(encoding="utf-8")
    assert '"enabled": true' in cron
    assert active.openxyos_employment_category == "staff"


def test_shadow_is_read_only(tmp_path: Path) -> None:
    store, slug, _workspace = _spawn(tmp_path)
    transition(store, slug, "market")
    transition(store, slug, "recruit")
    record = transition(store, slug, "shadow")
    assert record.read_only is True
    assert record.cron_enabled is False
    assert record.openxyos_employment_category == "probation"


def test_illegal_skip_rejected(tmp_path: Path) -> None:
    store, slug, _workspace = _spawn(tmp_path)
    with pytest.raises(ValueError, match="cannot move"):
        transition(store, slug, "active")
    assert can_transition("draft", "active") is False
    assert can_transition("active", "market") is False
    assert can_transition("active", "active") is True
    assert can_transition("shadow", "active") is True
    assert already_at_or_beyond("active", "market") is True
    assert already_at_or_beyond("draft", "market") is False
    assert already_at_or_beyond("offboard", "active") is True


def test_offboard_revokes_and_archives_memory(tmp_path: Path) -> None:
    store, slug, workspace = _spawn(tmp_path)
    (workspace / ".env").write_text(
        "FREEOS_ORG_TENANT_ID=acme\nFREEOS_ORG_SIDECAR_URL=http://127.0.0.1:3780\nSECRET=hunter2\n",
        encoding="utf-8",
    )
    record = transition(store, slug, "offboard", reason="contract ended")
    assert record.lifecycle == "offboard"
    assert record.credentials_revoked is True
    env = (workspace / ".env").read_text(encoding="utf-8")
    assert "SECRET=" in env
    assert "hunter2" not in env
    assert (workspace / "OFFBOARDED").is_file()
    assert Path(record.memory_archived).is_file()
    assert "Policy Analyst" in Path(record.memory_archived).read_text(encoding="utf-8")
    assert store.get(slug) is not None
    with pytest.raises(ValueError, match="cannot move"):
        transition(store, slug, "active")

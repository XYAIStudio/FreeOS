"""Finished self-growth loop: fixtures prove produce → apply → import → agents."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from octop.modules.org_os.catalog import catalog_keys
from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.lifecycle.transitions import (
    can_transition,
    register_compiled,
    transition,
)
from octop.modules.org_os.loop.run import _promote, run_growth_loop
from octop.modules.org_os.runtime.routing import ColleagueRouter, resolve_routed_agent
from octop.modules.org_os.runtime.spawn import list_spawned_agents
from tests.support.openxyos_harness import ControlPlaneState, start_control_plane


def _register(tmp_path: Path, slug: str, name: str) -> LifecycleStore:
    workspace = tmp_path / "tenants" / "loop" / "employees" / slug
    workspace.mkdir(parents=True)
    store = LifecycleStore(tmp_path, "loop")
    register_compiled(store, slug=slug, name=name, workspace=workspace, lifecycle="draft")
    return store


def _walk(store: LifecycleStore, slug: str, *states: str) -> None:
    for state in states:
        record = store.get(slug)
        if record is None or record.lifecycle == state:
            continue
        if not can_transition(record.lifecycle, state):
            continue
        transition(store, slug, state)


def test_growth_loop_does_not_require_node_sidecar(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from octop.modules.org_os import sidecar_launch

    def _boom(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("growth loop must not start the Node sidecar")

    monkeypatch.delenv("OPENXYOS_BASE_URL", raising=False)
    monkeypatch.delenv("FREEOS_ORG_SIDECAR_URL", raising=False)
    monkeypatch.delenv("FREEOS_ORG_SIDECAR", raising=False)
    monkeypatch.setattr(sidecar_launch, "ensure_sidecar", _boom)
    proof = run_growth_loop(tmp_path, tenant_id="loop")
    assert proof.ok is True
    assert proof.remote_applied is False
    assert (tmp_path / "openxyos-mirror" / "loop" / "employees.json").is_file()
    assert (tmp_path / "org-agents" / "registry.json").is_file()


def test_growth_loop_with_fixtures(tmp_path: Path) -> None:
    proof = run_growth_loop(tmp_path, tenant_id="loop")
    assert proof.ok is True
    assert proof.governance_blocked is True
    assert "policy-analyst" in proof.employees
    assert "ops-coordinator" in proof.employees
    assert proof.lifecycle.get("active") == "active"
    assert set(proof.skills) >= {f"org-{key}" for key in catalog_keys()}
    assert proof.agents
    workspace = tmp_path / "tenants" / "loop" / "employees" / "policy-analyst"
    assert (workspace / "SOUL.md").is_file()
    assert (workspace / "agent.json").is_file()
    assert (tmp_path / "org-skills" / "org-governance" / "SKILL.md").is_file()
    assert (tmp_path / "asset-packs" / "latest" / "manifest.json").is_file()
    assert (tmp_path / "openxyos-mirror" / "loop" / "employees.json").is_file()
    assert (tmp_path / "openxyos-mirror" / "loop" / "skills.json").is_file()
    assert (tmp_path / "openxyos-mirror" / "loop" / "apply-receipt.json").is_file()
    assert (
        tmp_path / "tenants" / "loop" / "org-knowledge" / "live" / "policy-analyst" / "MEMORY.md"
    ).is_file()
    routed = resolve_routed_agent(tmp_path, "Policy Analyst", tenant_id="loop")
    assert routed.startswith("org-")
    assert ColleagueRouter(tmp_path, "loop").get("policy-analyst") is not None
    spawned = list_spawned_agents(tmp_path)
    assert {item.slug for item in spawned} >= {"policy-analyst", "ops-coordinator"}
    saved = json.loads((tmp_path / "asset-packs" / "loop-proof.json").read_text(encoding="utf-8"))
    assert saved["ok"] is True


def test_promote_skips_already_active_without_raising(tmp_path: Path) -> None:
    store = _register(tmp_path, "ops-coordinator", "Ops Coordinator")
    _walk(store, "ops-coordinator", "market", "recruit", "shadow", "active")

    seen, notes = _promote(store, "ops-coordinator")

    record = store.get("ops-coordinator")
    assert record is not None
    assert record.lifecycle == "active"
    assert seen["active"] == "active"
    assert any("already active" in note for note in notes)


def test_promote_skips_illegal_offboard_without_raising(tmp_path: Path) -> None:
    store = _register(tmp_path, "policy-analyst", "Policy Analyst")
    _walk(store, "policy-analyst", "offboard")

    seen, notes = _promote(store, "policy-analyst")

    record = store.get("policy-analyst")
    assert record is not None
    assert record.lifecycle == "offboard"
    assert seen["offboard"] == "offboard"
    assert any("already offboard" in note for note in notes)


def test_promote_from_shadow_reaches_active(tmp_path: Path) -> None:
    store = _register(tmp_path, "policy-analyst", "Policy Analyst")
    _walk(store, "policy-analyst", "market", "recruit", "shadow")

    seen, notes = _promote(store, "policy-analyst")

    record = store.get("policy-analyst")
    assert record is not None
    assert record.lifecycle == "active"
    assert seen["active"] == "active"
    assert any("already shadow" in note for note in notes)


def test_growth_loop_succeeds_when_employees_already_active(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from octop.modules.org_os.loop import run as loop_mod

    real_import = loop_mod.import_openxyos_assets

    def _import_then_activate(*args: Any, **kwargs: Any) -> Any:
        result = real_import(*args, **kwargs)
        home = Path(args[0] if args else kwargs["home"])
        tid = str(kwargs.get("tenant_id") or "loop")
        store = LifecycleStore(home, tid)
        for slug in result.employees:
            _walk(store, slug, "market", "recruit", "shadow", "active")
        return result

    monkeypatch.setattr(loop_mod, "import_openxyos_assets", _import_then_activate)
    proof = run_growth_loop(tmp_path, tenant_id="loop")
    assert proof.ok is True
    assert proof.lifecycle.get("active") == "active"
    assert any("already active" in note for note in proof.notes)
    assert (tmp_path / "asset-packs" / "loop-proof.json").is_file()


def test_growth_loop_applies_to_live_control_plane(tmp_path: Path) -> None:
    state = ControlPlaneState()
    url, server = start_control_plane(state)
    try:
        proof = run_growth_loop(tmp_path, tenant_id="live", sidecar_url=url)
        assert proof.ok is True
        assert proof.remote_applied is True
        assert state.employees
        assert "/api/freeos/ingest" in state.posts
        assert "employees" in proof.imported_roundtrip["remote_surfaces"]
        assert proof.landed
        spawned = list_spawned_agents(tmp_path)
        assert {item.slug for item in spawned} >= {"policy-analyst", "ops-coordinator"}
        assert all(item.agent_id.startswith("org-") for item in spawned)
    finally:
        server.shutdown()
        server.server_close()


def test_growth_loop_ingests_when_runtime_json_present(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from octop.modules.org_os.managed_runtime import write_runtime_record
    from octop.modules.org_os.service import OrgModuleService

    monkeypatch.delenv("OPENXYOS_BASE_URL", raising=False)
    monkeypatch.delenv("FREEOS_ORG_SIDECAR_URL", raising=False)
    monkeypatch.delenv("FREEOS_ORG_SIDECAR", raising=False)
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    service.set_enabled(True)
    service.set_governance_enabled(True, tenant_id="42")
    state = ControlPlaneState()
    state.ui_tenant_id = 9
    url, server = start_control_plane(state)
    try:
        write_runtime_record(tmp_path, base_url=url)
        proof = run_growth_loop(tmp_path, config_path=tmp_path / "config.json")
        assert proof.ok is True
        assert proof.remote_applied is True
        assert proof.tenant_id == "42"
        assert state.ingested.get("tenant_id") == 42
        assert "/api/freeos/ingest" in state.posts
        spawned = list_spawned_agents(tmp_path)
        assert spawned
        assert all(item.agent_id.startswith("org-") for item in spawned)
        assert (tmp_path / "org-agents" / "registry.json").is_file()
    finally:
        server.shutdown()
        server.server_close()

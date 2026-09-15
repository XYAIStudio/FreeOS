"""Finished self-growth loop: fixtures prove produce → apply → import → agents."""

from __future__ import annotations

import json
from pathlib import Path

from octop.modules.org_os.catalog import catalog_keys
from octop.modules.org_os.loop.run import run_growth_loop
from octop.modules.org_os.runtime.routing import ColleagueRouter, resolve_routed_agent
from octop.modules.org_os.runtime.spawn import list_spawned_agents
from tests.support.openxyos_harness import ControlPlaneState, start_control_plane


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
    assert (tmp_path / "openxyos-mirror" / "loop" / "module-settings.json").is_file()
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


def test_growth_loop_applies_to_live_control_plane(tmp_path: Path) -> None:
    state = ControlPlaneState()
    url, server = start_control_plane(state)
    try:
        proof = run_growth_loop(tmp_path, tenant_id="live", sidecar_url=url)
        assert proof.ok is True
        assert proof.remote_applied is True
        assert state.employees
        assert state.module_settings.get("updates")
        assert "/api/employees" in state.posts
        assert "/api/module-settings" in state.posts
        assert "employees" in proof.imported_roundtrip["remote_surfaces"]
    finally:
        server.shutdown()
        server.server_close()

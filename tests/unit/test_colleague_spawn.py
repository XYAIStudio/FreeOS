"""Inbound compile/import registers a real FreeOS agent, not just files."""

from __future__ import annotations

import json
from pathlib import Path

from octop.modules.org_os.compiler.compile import compile_blueprint
from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.lifecycle.transitions import register_compiled
from octop.modules.org_os.runtime.routing import resolve_routed_agent
from octop.modules.org_os.runtime.spawn import spawn_colleague_agent

_FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "org-loop" / "agent-blueprint.v1.json"


def test_spawn_writes_registry_and_agent_row(tmp_path: Path) -> None:
    compiled = compile_blueprint(_FIXTURE, home=tmp_path, tenant_id="acme")
    store = LifecycleStore(tmp_path, "acme")
    record = register_compiled(
        store,
        slug=compiled.slug,
        name="Policy Analyst",
        workspace=compiled.workspace,
        lifecycle="draft",
    )
    spawned = spawn_colleague_agent(tmp_path, record)
    assert spawned.agent_id == "org-policy-analyst"
    assert spawned.persisted_to_db is True
    assert (tmp_path / "org-agents" / "registry.json").is_file()
    assert (compiled.workspace / "agent.json").is_file()
    assert (tmp_path / "skill-packages" / spawned.skill_package_id / "skills").is_dir()
    assert resolve_routed_agent(tmp_path, "policy-analyst") == spawned.agent_id

    from octop.cli.support.db import open_cli_services

    with open_cli_services(tmp_path) as services:
        row = services.agent_repo.get(spawned.agent_id)
        assert row is not None
        assert row.name == "Policy Analyst"
        assert row.system_prompt and "Policy Analyst" in row.system_prompt
        cfg = json.loads(row.config_json or "{}")
        assert Path(cfg["workspace_dir"]) == compiled.workspace

"""Scripted proof: blueprint → compile → recruit→active → publish → apply → import."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from click.testing import CliRunner
from tests.support.openxyos_harness import ControlPlaneState, start_control_plane

from octop.cli.main import cli
from octop.modules.org_os.catalog import catalog_keys
from octop.modules.org_os.loop.run import run_growth_loop


def test_e2e_loop_command_and_artifacts(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:

    state = ControlPlaneState()
    url, server = start_control_plane(state)
    monkeypatch.setenv("FREEOS_HOME", str(tmp_path))
    monkeypatch.setenv("OPENXYOS_BASE_URL", url)
    monkeypatch.setenv("FREEOS_ORG_TENANT_ID", "e2e")
    try:
        runner = CliRunner()
        result = runner.invoke(cli, ["org", "loop", "run", "--tenant-id", "e2e", "--base-url", url])
        assert result.exit_code == 0, result.output
        proof = json.loads(result.output)
        assert proof["ok"] is True
        assert proof["governance_blocked"] is True
        assert "policy-analyst" in proof["employees"]
        assert proof["lifecycle"]["active"] == "active"
        assert proof["remote_applied"] is True
        assert (tmp_path / "tenants" / "e2e" / "employees" / "policy-analyst" / "SOUL.md").is_file()
        assert (tmp_path / "org-skills" / "org-employees" / "SKILL.md").is_file()
        assert (tmp_path / "org-agents" / "registry.json").is_file()
        assert (
            tmp_path / "asset-packs" / "latest" / "openxyos" / "org-employees.publish.json"
        ).is_file()
        assert (tmp_path / "openxyos-mirror" / "e2e" / "apply-receipt.json").is_file()
        assert len(proof["skills"]) >= len(catalog_keys())
        assert state.employees
        assert "/api/freeos/ingest" in state.posts
    finally:
        server.shutdown()
        server.server_close()


def test_e2e_library_path_matches_cli(tmp_path: Path) -> None:
    proof = run_growth_loop(tmp_path, tenant_id="lib")
    assert proof.ok
    assert (tmp_path / "asset-packs" / "loop-proof.json").is_file()

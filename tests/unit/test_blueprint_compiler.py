"""xyos2freeos blueprint compiler and reverse HR digest."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from octop.modules.org_os.compiler.blueprint import parse_blueprint
from octop.modules.org_os.compiler.compile import compile_blueprint
from octop.modules.org_os.compiler.telemetry import (
    export_capability_digest,
)

_FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "agent-blueprint.v1.json"


def test_parse_rejects_wrong_schema() -> None:
    with pytest.raises(ValueError, match="unsupported"):
        parse_blueprint(
            {"schema": "other.v0", "name": "A", "positioning": "p", "capabilities": ["x"]}
        )


def test_compile_writes_soul_skills_knowledge_memory_env_cron(tmp_path: Path) -> None:
    compiled = compile_blueprint(_FIXTURE, home=tmp_path, tenant_id="t1")
    assert compiled.slug == "policy-analyst"
    assert compiled.tenant_id == "t1"
    assert compiled.soul.is_file()
    soul = compiled.soul.read_text(encoding="utf-8")
    assert "Policy Analyst" in soul
    assert "xyos-governance-mcp" in soul
    assert compiled.memory.is_file()
    assert "Staff must not share" in compiled.memory.read_text(encoding="utf-8")
    env = compiled.env_file.read_text(encoding="utf-8")
    assert "FREEOS_ORG_TENANT_ID=t1" in env
    cron = json.loads(compiled.cron_file.read_text(encoding="utf-8"))
    assert cron[0]["schedule_spec"] == "0 9 * * 1-5"
    assert cron[0]["enabled"] is False
    assert any("policy-research" in str(path) for path in compiled.skill_files)
    assert compiled.knowledge_files
    assert "staff-handbook" in compiled.knowledge_files[0].name


def test_capability_digest_maps_to_openxyos_profile(tmp_path: Path) -> None:
    compiled = compile_blueprint(_FIXTURE, home=tmp_path, tenant_id="9")
    digest = export_capability_digest(compiled.workspace, lifecycle="shadow")
    profile = digest.to_openxyos_profile()
    assert profile["employee_type"] == "ai"
    assert "policy-research" in profile["skills"]
    assert profile["employment_category"] == "probation"
    assert profile["talent_status"] == "recruited"
    assert digest.skill_count >= 2
    assert digest.cron_count == 1

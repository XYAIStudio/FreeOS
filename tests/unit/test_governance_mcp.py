"""xyos-governance-mcp: default-deny, durable pause, approval must block."""

from __future__ import annotations

from pathlib import Path

import pytest

from octop.modules.org_os.governance.engine import GovernanceEngine
from octop.modules.org_os.governance.imported import write_imported_policies
from octop.modules.org_os.governance.interceptor import (
    GovernanceBlockedError,
    GovernanceInterceptor,
)
from octop.modules.org_os.governance.policy import classify_tool, is_high_risk
from octop.modules.org_os.governance.store import DurableGovernanceStore
from octop.modules.org_os.governance.types import PolicyRequest


def test_classify_high_risk_classes() -> None:
    assert classify_tool("delete_employee", "delete") == "delete"
    assert classify_tool("http_request") == "outbound"
    assert classify_tool("stripe_pay_invoice") == "pay"
    assert classify_tool("deploy_production") == "prod"
    assert classify_tool("list_employees") == "low"
    assert is_high_risk("rm_workspace", "delete") is True
    assert is_high_risk("org_os_status") is False


def _engine(tmp_path: Path, sidecar_url: str = "") -> GovernanceEngine:
    return GovernanceEngine(
        DurableGovernanceStore(tmp_path / "governance"), sidecar_url=sidecar_url
    )


def test_low_risk_allows(tmp_path: Path) -> None:
    decision = _engine(tmp_path).evaluate(PolicyRequest(tool_name="org_os_status"))
    assert decision.status == "allow"
    assert decision.execute is True
    assert decision.blocked is False


def test_high_risk_unmatched_default_denies_and_does_not_execute(tmp_path: Path) -> None:
    decision = _engine(tmp_path).evaluate(
        PolicyRequest(tool_name="delete_employee", category="delete", auto_pause=False)
    )
    assert decision.status == "deny"
    assert decision.execute is False
    assert decision.blocked is True
    assert "default deny" in decision.reason


def test_high_risk_auto_pause_is_pending_not_executable(tmp_path: Path) -> None:
    engine = _engine(tmp_path)
    decision = engine.evaluate(
        PolicyRequest(tool_name="delete_employee", category="delete", args={"id": "1"})
    )
    assert decision.status == "pending"
    assert decision.execute is False
    assert decision.pause_id
    stored = engine.store.get(decision.pause_id)
    assert stored is not None
    assert stored.status == "pending"


def test_approval_then_recheck_allows_same_digest_only(tmp_path: Path) -> None:
    engine = _engine(tmp_path)
    first = engine.evaluate(
        PolicyRequest(tool_name="delete_employee", category="delete", args={"id": "1"})
    )
    approved = engine.approve(first.pause_id)
    assert approved.status == "allow"
    assert approved.execute is False  # approve itself does not run the tool

    again = engine.evaluate(
        PolicyRequest(
            tool_name="delete_employee",
            category="delete",
            args={"id": "1"},
            approval_id=first.pause_id,
            auto_pause=False,
        )
    )
    assert again.execute is True
    assert again.status == "allow"

    other = engine.evaluate(
        PolicyRequest(
            tool_name="delete_employee",
            category="delete",
            args={"id": "2"},
            approval_id=first.pause_id,
            auto_pause=False,
        )
    )
    assert other.execute is False
    assert other.status == "deny"


def test_durable_pause_survives_new_store_instance(tmp_path: Path) -> None:
    engine = _engine(tmp_path)
    first = engine.evaluate(
        PolicyRequest(tool_name="send_email", category="outbound", args={"to": "a@b"})
    )
    restarted = _engine(tmp_path)
    record = restarted.store.get(first.pause_id)
    assert record is not None
    assert record.status == "pending"
    restarted.approve(first.pause_id)
    allowed = restarted.evaluate(
        PolicyRequest(
            tool_name="send_email",
            category="outbound",
            args={"to": "a@b"},
            approval_id=first.pause_id,
        )
    )
    assert allowed.execute is True


def test_interceptor_raises_and_must_not_be_treated_as_allow(tmp_path: Path) -> None:
    interceptor = GovernanceInterceptor.from_home(tmp_path)
    with pytest.raises(GovernanceBlockedError) as excinfo:
        interceptor.enforce(PolicyRequest(tool_name="pay_invoice", category="pay"))
    assert excinfo.value.decision.execute is False
    assert excinfo.value.decision.blocked is True


def test_audit_written_locally(tmp_path: Path) -> None:
    engine = _engine(tmp_path)
    engine.evaluate(PolicyRequest(tool_name="delete_employee", category="delete"))
    rows = engine.store.tail_audit(10)
    assert rows
    assert rows[-1]["result"] in {"pending", "deny"}
    assert rows[-1]["execute"] is False


def test_sidecar_explicit_deny(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    class _Resp:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {"success": True, "data": {"allowed": False, "reason": "matrix deny"}}

    class _Client:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> _Client:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def post(self, url: str, json: dict[str, object]) -> _Resp:
            assert url.endswith("/api/governance/validate")
            return _Resp()

    import httpx

    monkeypatch.setattr(httpx, "Client", _Client)
    decision = _engine(tmp_path, sidecar_url="http://127.0.0.1:3780").evaluate(
        PolicyRequest(tool_name="delete_employee", category="delete", auto_pause=False)
    )
    assert decision.status == "deny"
    assert decision.execute is False
    assert decision.sidecar_reached is True
    assert "matrix deny" in decision.reason


def test_imported_deny_rule_blocks_without_sidecar(tmp_path: Path) -> None:
    write_imported_policies(
        tmp_path / "governance",
        {"rules": [{"category": "delete", "allow": False, "reason": "matrix deny"}]},
        tenant_id="loop",
        source="test",
    )
    decision = _engine(tmp_path).evaluate(
        PolicyRequest(tool_name="delete_employee", category="delete", auto_pause=False)
    )
    assert decision.status == "deny"
    assert decision.execute is False
    assert decision.rule_source == "imported-policies"
    assert "matrix deny" in decision.reason


def test_imported_allow_still_requires_human_approval(tmp_path: Path) -> None:
    write_imported_policies(
        tmp_path / "governance",
        [{"category": "delete", "allow": True}],
        tenant_id="loop",
    )
    decision = _engine(tmp_path).evaluate(
        PolicyRequest(tool_name="delete_employee", category="delete")
    )
    assert decision.execute is False
    assert decision.status == "pending"
    assert decision.rule_source == "imported-policies"


def test_stdio_spec_is_stdio() -> None:
    from octop.modules.org_os.governance.mcp_server import stdio_spec

    spec = stdio_spec()
    assert spec["transport"] == "stdio"
    assert spec["command"] == "xyos-governance-mcp"

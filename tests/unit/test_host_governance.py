"""Host tool path must actually block high-risk calls."""

from __future__ import annotations

from pathlib import Path

import pytest

from octop.infra.agents.middleware.org_governance import (
    OrgGovernanceMiddleware,
    host_gate_tool,
)
from octop.modules.org_os.governance.interceptor import GovernanceBlockedError
from octop.modules.org_os.service import OrgModuleService


def test_host_gate_blocks_high_risk_delete(tmp_path: Path) -> None:
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    service.set_governance_enabled(True, tenant_id="1")
    with pytest.raises(GovernanceBlockedError) as exc:
        host_gate_tool(
            home=tmp_path,
            tool_name="delete_employee",
            args={"id": "9"},
            tenant_id="1",
            enabled=True,
        )
    assert exc.value.decision.execute is False
    assert exc.value.decision.blocked is True


def test_host_gate_allows_low_risk(tmp_path: Path) -> None:
    host_gate_tool(home=tmp_path, tool_name="list_employees", enabled=True)


def test_middleware_from_home_follows_org_enablement(tmp_path: Path) -> None:
    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    service.set_enabled(True)
    service.set_governance_enabled(True)
    mw = OrgGovernanceMiddleware.from_home(tmp_path, config_path=tmp_path / "config.json")
    assert mw.enabled is True
    assert mw.home == tmp_path

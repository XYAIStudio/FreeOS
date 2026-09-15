"""List FreeOS organization-module capabilities for chat."""

from __future__ import annotations

import json
from typing import Any

from harness_agent.plugins import PluginContext

from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.catalog import OPENXYOS_MODULES
from octop.modules.org_os.service import OrgModuleService


def _payload(data: dict[str, Any], text: str) -> str:
    return json.dumps(
        {
            "octop_ui": {"renderer": "org_os_card", "version": 1},
            "data": data,
            "text": text,
        },
        ensure_ascii=False,
    )


def org_os_status() -> str:
    """Report whether the organization module is enabled and list capabilities."""
    paths = PathLayout.from_env()
    service = OrgModuleService(config_path=paths.config, home=paths.root)
    status = service.status()
    keys = [item["key"] for item in OPENXYOS_MODULES]
    state = "enabled" if status.enabled else "disabled"
    sidecar = "up" if status.sidecar.reachable else "down"
    text = (
        f"FreeOS organization module is {state}; sidecar {sidecar} "
        f"({status.sidecar.url}). Capabilities: {', '.join(keys)}. "
        "Open /organization in the dashboard to toggle the module."
    )
    return _payload(
        {
            "enabled": status.enabled,
            "sidecar_reachable": status.sidecar.reachable,
            "sidecar_url": status.sidecar.url,
            "capabilities": list(OPENXYOS_MODULES),
            "dashboard_path": "/organization",
        },
        text,
    )


def org_os_governance_check(tool_name: str, category: str = "", approval_id: str = "") -> str:
    """Hard-stop policy check. Do not run the named tool unless execute is true."""
    from octop.modules.org_os.governance.types import PolicyRequest

    paths = PathLayout.from_env()
    service = OrgModuleService(config_path=paths.config, home=paths.root)
    from octop.modules.org_os.governance.engine import GovernanceEngine

    decision = GovernanceEngine.from_home(paths.root, sidecar_url=service.sidecar_url()).evaluate(
        PolicyRequest(
            tool_name=tool_name,
            category=category,
            tenant_id=service.tenant_id(),
            approval_id=approval_id,
            auto_pause=True,
        )
    )
    payload = decision.to_dict()
    payload["instruction"] = (
        "If execute is false, stop. Do not call the tool. Ask a human to "
        "approve the pause_id via FreeOS/Octop IM or `freeos org governance approve`."
    )
    return _payload(payload, payload["instruction"] + " " + decision.reason)


def setup(ctx: PluginContext) -> None:
    ctx.tool(
        "org_os_status",
        org_os_status,
        description=(
            "Show FreeOS organization-module status and the openXYOS capability "
            "catalog (organization, employees, governance, …)."
        ),
    )
    ctx.tool(
        "org_os_governance_check",
        org_os_governance_check,
        description=(
            "Insert before high-risk org/tool calls (outbound/delete/pay/prod). "
            "Default-denies unmatched rules; execute stays false until human approval."
        ),
    )

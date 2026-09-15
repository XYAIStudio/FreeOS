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


def setup(ctx: PluginContext) -> None:
    ctx.tool(
        "org_os_status",
        org_os_status,
        description=(
            "Show FreeOS organization-module status and the openXYOS capability "
            "catalog (organization, employees, governance, …)."
        ),
    )

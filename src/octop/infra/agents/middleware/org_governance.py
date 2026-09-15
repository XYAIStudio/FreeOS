"""Host-wide governance gate on the FreeOS/Octop tool path.

High-risk tool calls (outbound / delete / pay / prod) go through
``xyos-governance-mcp`` before the handler runs. A pending or deny
decision returns an error ToolMessage — the tool does not execute.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain_core.messages import ToolMessage
from langgraph.prebuilt.tool_node import ToolCallRequest
from langgraph.types import Command

from octop.modules.org_os.governance.interceptor import (
    GovernanceBlockedError,
    gate_tool_call,
)
from octop.modules.org_os.governance.policy import is_high_risk
from octop.modules.org_os.service import OrgModuleService

logger = logging.getLogger(__name__)


def host_gate_tool(
    *,
    home: Path,
    tool_name: str,
    args: dict[str, Any] | None = None,
    tenant_id: str = "",
    actor_id: str = "",
    approval_id: str = "",
    sidecar_url: str = "",
    enabled: bool = True,
) -> None:
    """Raise ``GovernanceBlockedError`` when a high-risk host tool must not run."""
    if not enabled or not is_high_risk(tool_name):
        return
    gate_tool_call(
        home=home,
        tool_name=tool_name,
        action=tool_name,
        tenant_id=tenant_id,
        actor_id=actor_id,
        args=args or {},
        approval_id=approval_id,
        sidecar_url=sidecar_url,
        enabled=True,
    )


class OrgGovernanceMiddleware(AgentMiddleware[Any, Any]):
    """Block high-risk harness tool calls when org governance is enabled."""

    def __init__(
        self,
        *,
        home: Path,
        sidecar_url: str = "",
        tenant_id: str = "",
        enabled: bool = True,
        actor_id: str = "",
    ) -> None:
        super().__init__()
        self.home = Path(home)
        self.sidecar_url = sidecar_url
        self.tenant_id = tenant_id
        self.enabled = enabled
        self.actor_id = actor_id

    @classmethod
    def from_home(cls, home: Path, *, config_path: Path | None = None) -> OrgGovernanceMiddleware:
        service = OrgModuleService(config_path=config_path or (home / "config.json"), home=home)
        return cls(
            home=home,
            sidecar_url=service.sidecar_url(),
            tenant_id=service.tenant_id(),
            enabled=service.governance_enabled() or service.is_enabled(),
        )

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command[Any]]],
    ) -> ToolMessage | Command[Any]:
        tool_call = request.tool_call
        tool_name = str(tool_call.get("name") or "")
        raw_args = tool_call.get("args")
        args = raw_args if isinstance(raw_args, dict) else {}
        approval_id = str(args.get("approval_id") or args.get("governance_approval_id") or "")
        try:
            host_gate_tool(
                home=self.home,
                tool_name=tool_name,
                args=args,
                tenant_id=self.tenant_id,
                actor_id=self.actor_id,
                approval_id=approval_id,
                sidecar_url=self.sidecar_url,
                enabled=self.enabled,
            )
        except GovernanceBlockedError as exc:
            logger.info("OrgGovernance blocked %s: %s", tool_name, exc.decision.reason)
            payload = json_payload(exc.decision.to_dict())
            return ToolMessage(
                content=payload,
                tool_call_id=str(tool_call.get("id") or ""),
                status="error",
            )
        return await handler(request)


def json_payload(data: dict[str, Any]) -> str:
    import json

    return json.dumps(
        {
            "blocked": True,
            "execute": False,
            "governance": data,
            "message": data.get("reason") or "FreeOS governance blocked this high-risk tool.",
        },
        ensure_ascii=False,
    )

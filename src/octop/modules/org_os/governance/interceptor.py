"""Hard gate: pending/deny raises. Callers must not catch-and-continue."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from octop.modules.org_os.governance.engine import GovernanceEngine
from octop.modules.org_os.governance.types import PolicyDecision, PolicyRequest


class GovernanceBlockedError(RuntimeError):
    """Raised when a high-risk tool must not run.

    Catching this and executing the tool anyway makes governance cosmetic.
    """

    def __init__(self, decision: PolicyDecision) -> None:
        super().__init__(decision.reason)
        self.decision = decision


@dataclass
class GovernanceInterceptor:
    engine: GovernanceEngine
    enabled: bool = True

    @classmethod
    def from_home(
        cls,
        home: Path,
        *,
        sidecar_url: str = "",
        enabled: bool = True,
    ) -> GovernanceInterceptor:
        return cls(GovernanceEngine.from_home(home, sidecar_url=sidecar_url), enabled=enabled)

    def check(self, request: PolicyRequest) -> PolicyDecision:
        if not self.enabled:
            return PolicyDecision(
                status="allow",
                execute=True,
                blocked=False,
                reason="governance interceptor disabled",
                category="low",
                rule_source="disabled",
            )
        return self.engine.evaluate(request)

    def enforce(self, request: PolicyRequest) -> PolicyDecision:
        """Return only when ``execute`` is true; otherwise raise."""
        decision = self.check(request)
        if not decision.execute:
            raise GovernanceBlockedError(decision)
        return decision


def gate_tool_call(
    *,
    home: Path,
    tool_name: str,
    category: str = "",
    action: str = "",
    actor_id: str = "",
    tenant_id: str = "",
    args: dict[str, Any] | None = None,
    approval_id: str = "",
    sidecar_url: str = "",
    enabled: bool = True,
) -> PolicyDecision:
    """Library entry used by MCP, CLI, generated skills, and the org-os plugin."""
    interceptor = GovernanceInterceptor.from_home(home, sidecar_url=sidecar_url, enabled=enabled)
    return interceptor.enforce(
        PolicyRequest(
            tool_name=tool_name,
            category=category,
            action=action,
            actor_id=actor_id,
            tenant_id=tenant_id,
            args=args or {},
            approval_id=approval_id,
            auto_pause=True,
        )
    )

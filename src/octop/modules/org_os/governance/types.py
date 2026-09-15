"""Shared types for the governance gate."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

DecisionStatus = Literal["allow", "deny", "pending"]
PauseStatus = Literal["pending", "approved", "rejected", "expired"]
RiskCategory = Literal["outbound", "delete", "pay", "prod", "low"]


@dataclass(frozen=True)
class PolicyRequest:
    tool_name: str
    category: str = ""
    action: str = ""
    actor_id: str = ""
    actor_level: int = 0
    tenant_id: str = ""
    target_type: str = ""
    args: dict[str, Any] = field(default_factory=dict)
    approval_id: str = ""
    auto_pause: bool = True

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PolicyDecision:
    status: DecisionStatus
    execute: bool
    blocked: bool
    reason: str
    category: str = "low"
    pause_id: str = ""
    rule_source: str = "local-default-deny"
    sidecar_reached: bool = False
    audit_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

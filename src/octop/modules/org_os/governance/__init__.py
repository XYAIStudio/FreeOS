"""xyos-governance-mcp — openXYOS governance as a FreeOS data-plane gate.

High-risk tools (outbound / delete / pay / prod) are default-denied until a
durable human approval exists. A pending or deny decision never executes.
"""

from octop.modules.org_os.governance.engine import GovernanceEngine
from octop.modules.org_os.governance.interceptor import (
    GovernanceBlockedError,
    GovernanceInterceptor,
    gate_tool_call,
)
from octop.modules.org_os.governance.policy import (
    HIGH_RISK_CATEGORIES,
    classify_tool,
    is_high_risk,
)
from octop.modules.org_os.governance.store import DurableGovernanceStore
from octop.modules.org_os.governance.types import PolicyDecision, PolicyRequest

__all__ = [
    "HIGH_RISK_CATEGORIES",
    "DurableGovernanceStore",
    "GovernanceBlockedError",
    "GovernanceEngine",
    "GovernanceInterceptor",
    "PolicyDecision",
    "PolicyRequest",
    "classify_tool",
    "gate_tool_call",
    "is_high_risk",
]

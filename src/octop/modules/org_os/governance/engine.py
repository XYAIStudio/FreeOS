"""Policy engine: sidecar validate when reachable, otherwise default-deny."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from octop.modules.org_os.governance.imported import (
    load_imported_rules,
    match_imported_rule,
    rule_is_allowed,
)
from octop.modules.org_os.governance.policy import (
    HIGH_RISK_CATEGORIES,
    args_digest,
    classify_tool,
)
from octop.modules.org_os.governance.store import DurableGovernanceStore
from octop.modules.org_os.governance.types import PolicyDecision, PolicyRequest

logger = logging.getLogger(__name__)


class GovernanceEngine:
    """Default-deny high-risk actions unless a durable approval matches.

    Mirrors openXYOS ``GovernanceEngine.validateAction`` (unmatched rule →
    deny) and writes a local audit even when the sidecar is down. SQL.js in
    the sidecar is never treated as the database of record.
    """

    def __init__(
        self,
        store: DurableGovernanceStore,
        *,
        sidecar_url: str = "",
        sidecar_timeout: float = 2.0,
    ) -> None:
        self.store = store
        self.sidecar_url = (sidecar_url or "").rstrip("/")
        self.sidecar_timeout = sidecar_timeout

    @classmethod
    def from_home(
        cls,
        home: Path,
        *,
        sidecar_url: str = "",
    ) -> GovernanceEngine:
        return cls(DurableGovernanceStore(home / "governance"), sidecar_url=sidecar_url)

    def evaluate(self, request: PolicyRequest) -> PolicyDecision:
        category = classify_tool(request.tool_name, request.category, request.action)
        digest = args_digest(request.args)
        if category not in HIGH_RISK_CATEGORIES:
            decision = PolicyDecision(
                status="allow",
                execute=True,
                blocked=False,
                reason="not a high-risk class",
                category=category,
                rule_source="classifier",
            )
            return self._audit(request, decision, digest)

        if request.approval_id and self.store.is_approved_for(
            request.approval_id, args_digest=digest, tool_name=request.tool_name
        ):
            decision = PolicyDecision(
                status="allow",
                execute=True,
                blocked=False,
                reason="durable human approval matches this action",
                category=category,
                pause_id=request.approval_id,
                rule_source="durable-approval",
            )
            return self._audit(request, decision, digest)

        imported = match_imported_rule(
            load_imported_rules(self.store.root),
            tool_name=request.tool_name,
            category=category,
            action=request.action,
        )
        if imported is not None:
            allowed = rule_is_allowed(imported)
            if allowed is False:
                decision = PolicyDecision(
                    status="deny",
                    execute=False,
                    blocked=True,
                    reason=str(imported.get("reason") or "imported policy denied"),
                    category=category,
                    rule_source="imported-policies",
                )
                return self._audit(request, decision, digest)
            return self._pending_or_deny(
                request,
                category,
                digest,
                "imported rule matched; human approval required",
                sidecar_reached=False,
                rule_source="imported-policies",
            )

        sidecar = self._sidecar_validate(request)
        if sidecar is not None:
            if sidecar.get("allowed") is False:
                decision = PolicyDecision(
                    status="deny",
                    execute=False,
                    blocked=True,
                    reason=str(sidecar.get("reason") or "sidecar denied"),
                    category=category,
                    rule_source="sidecar-validate",
                    sidecar_reached=True,
                )
                return self._audit(request, decision, digest)
            # Sidecar allow still requires human approval for high-risk
            # classes — otherwise governance is a rubber stamp.
            reason = str(sidecar.get("reason") or "sidecar matched; human approval required")
            return self._pending_or_deny(request, category, digest, reason, sidecar_reached=True)

        # Unmatched / sidecar down → default deny (never fail open).
        return self._pending_or_deny(
            request,
            category,
            digest,
            "no matching governance rule; default deny",
            sidecar_reached=False,
        )

    def approve(self, pause_id: str) -> PolicyDecision:
        record = self.store.resolve(pause_id, "approved")
        if record is None:
            return PolicyDecision(
                status="deny",
                execute=False,
                blocked=True,
                reason="unknown pause id",
                pause_id=pause_id,
            )
        if record.status != "approved":
            return PolicyDecision(
                status="deny",
                execute=False,
                blocked=True,
                reason=f"pause is {record.status}, not approved",
                pause_id=pause_id,
                category=record.category,
            )
        decision = PolicyDecision(
            status="allow",
            execute=False,
            blocked=True,
            reason="approved; re-check the original tool with this approval_id to execute",
            category=record.category,
            pause_id=pause_id,
            rule_source="durable-approval",
        )
        # execute stays false on the approve call itself — the tool must
        # present the approval_id so the digest is re-bound.
        self.store.append_audit(
            {
                "event": "approve",
                "pause_id": pause_id,
                "tool_name": record.tool_name,
                "result": "approved",
            }
        )
        return decision

    def reject(self, pause_id: str) -> PolicyDecision:
        record = self.store.resolve(pause_id, "rejected")
        if record is None:
            return PolicyDecision(
                status="deny",
                execute=False,
                blocked=True,
                reason="unknown pause id",
                pause_id=pause_id,
            )
        self.store.append_audit(
            {
                "event": "reject",
                "pause_id": pause_id,
                "tool_name": record.tool_name,
                "result": "rejected",
            }
        )
        return PolicyDecision(
            status="deny",
            execute=False,
            blocked=True,
            reason="human rejected this action",
            category=record.category,
            pause_id=pause_id,
            rule_source="durable-rejection",
        )

    def _pending_or_deny(
        self,
        request: PolicyRequest,
        category: str,
        digest: str,
        reason: str,
        *,
        sidecar_reached: bool,
        rule_source: str = "local-default-deny",
    ) -> PolicyDecision:
        if not request.auto_pause:
            decision = PolicyDecision(
                status="deny",
                execute=False,
                blocked=True,
                reason=reason,
                category=category,
                rule_source=rule_source,
                sidecar_reached=sidecar_reached,
            )
            return self._audit(request, decision, digest)
        pause = self.store.create_pause(
            tool_name=request.tool_name,
            category=category,
            action=request.action,
            actor_id=request.actor_id,
            tenant_id=request.tenant_id,
            args_digest=digest,
            reason=reason,
        )
        decision = PolicyDecision(
            status="pending",
            execute=False,
            blocked=True,
            reason=f"{reason}; paused for human approval via FreeOS/Octop IM or "
            f"`freeos org governance approve {pause.pause_id}`",
            category=category,
            pause_id=pause.pause_id,
            rule_source=rule_source,
            sidecar_reached=sidecar_reached,
        )
        return self._audit(request, decision, digest)

    def _sidecar_validate(self, request: PolicyRequest) -> dict[str, Any] | None:
        if not self.sidecar_url:
            return None
        parsed = urlparse(self.sidecar_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return None
        url = f"{self.sidecar_url}/api/governance/validate"
        payload = {
            "actor_level": request.actor_level,
            "action_type": request.action or request.category or request.tool_name,
            "target_type": request.target_type or None,
        }
        try:
            with httpx.Client(timeout=self.sidecar_timeout, follow_redirects=True) as client:
                response = client.post(url, json=payload)
        except httpx.HTTPError:
            logger.info("governance sidecar unreachable; fail closed")
            return None
        if response.status_code >= 400:
            return None
        try:
            body = response.json()
        except ValueError:
            return None
        if not isinstance(body, dict):
            return None
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        if not isinstance(data, dict) or "allowed" not in data:
            return None
        return data

    def _audit(
        self, request: PolicyRequest, decision: PolicyDecision, digest: str
    ) -> PolicyDecision:
        audit_id = self.store.append_audit(
            {
                "event": "check",
                "tool_name": request.tool_name,
                "category": decision.category,
                "action": request.action,
                "actor_id": request.actor_id,
                "tenant_id": request.tenant_id,
                "args_digest": digest,
                "result": decision.status,
                "execute": decision.execute,
                "reason": decision.reason,
                "pause_id": decision.pause_id,
                "rule_source": decision.rule_source,
            }
        )
        return PolicyDecision(
            status=decision.status,
            execute=decision.execute,
            blocked=decision.blocked,
            reason=decision.reason,
            category=decision.category,
            pause_id=decision.pause_id,
            rule_source=decision.rule_source,
            sidecar_reached=decision.sidecar_reached,
            audit_id=audit_id,
        )

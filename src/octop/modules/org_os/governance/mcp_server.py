"""stdio MCP server: ``xyos-governance-mcp``.

Tools wrap :class:`GovernanceEngine`. High-risk checks default-deny and
never set ``execute`` until a durable approval matches.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.governance.engine import GovernanceEngine
from octop.modules.org_os.governance.policy import classify_tool
from octop.modules.org_os.governance.types import PolicyRequest
from octop.modules.org_os.service import OrgModuleService


def _engine() -> GovernanceEngine:
    paths = PathLayout.from_env()
    paths.ensure_root()
    service = OrgModuleService(config_path=paths.config, home=paths.root)
    return GovernanceEngine.from_home(paths.root, sidecar_url=service.sidecar_url())


def _dumps(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, default=str)


def tool_classify(tool_name: str, category: str = "", action: str = "") -> str:
    label = classify_tool(tool_name, category, action)
    return _dumps({"tool_name": tool_name, "category": label, "high_risk": label != "low"})


def tool_check_policy(
    tool_name: str,
    category: str = "",
    action: str = "",
    actor_id: str = "",
    tenant_id: str = "",
    approval_id: str = "",
    args_json: str = "{}",
    auto_pause: bool = True,
) -> str:
    try:
        args = json.loads(args_json) if args_json else {}
    except json.JSONDecodeError:
        args = {"_raw": args_json}
    if not isinstance(args, dict):
        args = {"_value": args}
    if not tenant_id:
        tenant_id = os.environ.get("FREEOS_ORG_TENANT_ID", "")
    engine = _engine()
    decision = engine.evaluate(
        PolicyRequest(
            tool_name=tool_name,
            category=category,
            action=action,
            actor_id=actor_id,
            tenant_id=tenant_id,
            args=args,
            approval_id=approval_id,
            auto_pause=auto_pause,
        )
    )
    payload = decision.to_dict()
    payload["instruction"] = (
        "Do not execute the tool unless execute is true. "
        "pending/deny is a hard stop; ask a human to approve the pause_id."
    )
    return _dumps(payload)


def tool_resolve(pause_id: str, approve: bool = True) -> str:
    engine = _engine()
    decision = engine.approve(pause_id) if approve else engine.reject(pause_id)
    return _dumps(decision.to_dict())


def tool_audit_tail(limit: int = 20) -> str:
    engine = _engine()
    return _dumps(engine.store.tail_audit(limit))


def _register_fastmcp() -> Any:
    from mcp.server.fastmcp import FastMCP

    server = FastMCP("xyos-governance-mcp")

    @server.tool()
    def classify(tool_name: str, category: str = "", action: str = "") -> str:
        """Classify a tool as outbound/delete/pay/prod/low."""
        return tool_classify(tool_name, category, action)

    @server.tool()
    def check_policy(
        tool_name: str,
        category: str = "",
        action: str = "",
        actor_id: str = "",
        tenant_id: str = "",
        approval_id: str = "",
        args_json: str = "{}",
        auto_pause: bool = True,
    ) -> str:
        """Policy-check a tool. High-risk default-denies; execute is false until approved."""
        return tool_check_policy(
            tool_name,
            category,
            action,
            actor_id,
            tenant_id,
            approval_id,
            args_json,
            auto_pause,
        )

    @server.tool()
    def resolve_approval(pause_id: str, approve: bool = True) -> str:
        """Human resolve. Approving does not run the tool; the agent must re-check."""
        return tool_resolve(pause_id, approve)

    @server.tool()
    def audit_tail(limit: int = 20) -> str:
        """Recent local governance audit events (FreeOS home, not sidecar SQL.js)."""
        return tool_audit_tail(limit)

    return server


def stdio_spec(command: str = "xyos-governance-mcp") -> dict[str, Any]:
    """Octop connector overlay: stdio MCP with tenant/home env."""
    paths = PathLayout.from_env()
    env = {
        "FREEOS_HOME": str(paths.root),
    }
    tenant = os.environ.get("FREEOS_ORG_TENANT_ID", "").strip()
    if tenant:
        env["FREEOS_ORG_TENANT_ID"] = tenant
    sidecar = os.environ.get("FREEOS_ORG_SIDECAR_URL", "").strip()
    if sidecar:
        env["FREEOS_ORG_SIDECAR_URL"] = sidecar
    return {
        "transport": "stdio",
        "command": command,
        "args": [],
        "env": env,
    }


def write_connector_snippet(path: Path | None = None) -> Path:
    """Write a connector JSON snippet operators can paste into Octop MCP config."""
    paths = PathLayout.from_env()
    paths.ensure_root()
    target = path or (paths.root / "governance" / "xyos-governance-mcp.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    spec = {"xyos-governance-mcp": stdio_spec()}
    target.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    return target


def main() -> None:
    """Entry point for the ``xyos-governance-mcp`` console script."""
    try:
        server = _register_fastmcp()
    except ImportError as exc:
        raise SystemExit(
            "xyos-governance-mcp requires the `mcp` package (project dependency). "
            "Install with `uv sync` and retry."
        ) from exc
    run = getattr(server, "run", None)
    if run is None:
        raise SystemExit("FastMCP server has no run()")
    run(transport="stdio")


if __name__ == "__main__":
    main()

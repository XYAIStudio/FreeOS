"""Load operator-imported openXYOS policy matrices into the local engine.

Imported allow rules never skip human approval. Unmatched high-risk
actions still default-deny.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

IMPORTED_POLICIES_NAME = "imported-policies.json"

_MATCH_KEYS = (
    "tool",
    "tool_name",
    "action",
    "action_type",
    "category",
    "permission_type",
    "permission_check",
)


def imported_policies_path(governance_dir: Path) -> Path:
    return governance_dir / IMPORTED_POLICIES_NAME


def normalize_rules(raw: Any) -> list[dict[str, Any]]:
    """Accept a list, ``{rules: [...]}``, or a single rule object."""
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if not isinstance(raw, dict):
        return []
    nested = raw.get("rules")
    if isinstance(nested, list):
        return [item for item in nested if isinstance(item, dict)]
    if isinstance(nested, dict):
        return normalize_rules(nested)
    matrix = raw.get("matrix")
    if isinstance(matrix, list):
        return [item for item in matrix if isinstance(item, dict)]
    if any(key in raw for key in (*_MATCH_KEYS, "allow", "allowed", "is_allowed")):
        return [raw]
    return []


def write_imported_policies(
    governance_dir: Path,
    raw: Any,
    *,
    tenant_id: str = "",
    source: str = "",
) -> Path:
    dest = imported_policies_path(governance_dir)
    dest.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": source,
        "tenant_id": tenant_id,
        "rules": normalize_rules(raw),
        "note": (
            "Imported for the xyos-governance-mcp default-deny engine. "
            "Explicit allow still requires a durable human approval. "
            "Unmatched high-risk actions still deny."
        ),
    }
    dest.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return dest


def load_imported_rules(governance_dir: Path) -> list[dict[str, Any]]:
    path = imported_policies_path(governance_dir)
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return normalize_rules(raw)


def rule_is_allowed(rule: dict[str, Any]) -> bool | None:
    for key in ("allow", "allowed", "is_allowed"):
        if key not in rule:
            continue
        value = rule[key]
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"1", "true", "yes", "allow", "allowed"}:
                return True
            if lowered in {"0", "false", "no", "deny", "denied"}:
                return False
    return None


def match_imported_rule(
    rules: list[dict[str, Any]],
    *,
    tool_name: str,
    category: str,
    action: str,
) -> dict[str, Any] | None:
    haystack = {part.strip().lower() for part in (tool_name, category, action) if part.strip()}
    if not haystack:
        return None
    for rule in rules:
        for key in _MATCH_KEYS:
            value = str(rule.get(key) or "").strip().lower()
            if value and value in haystack:
                return rule
    return None

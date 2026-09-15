"""Classify high-risk tools. Unmatched high-risk rules default-deny."""

from __future__ import annotations

import re
from typing import Any

HIGH_RISK_CATEGORIES = frozenset({"outbound", "delete", "pay", "prod"})

# Explicit category aliases operators may pass through MCP / CLI.
_CATEGORY_ALIASES = {
    "outbound": "outbound",
    "out": "outbound",
    "network": "outbound",
    "http": "outbound",
    "delete": "delete",
    "remove": "delete",
    "destroy": "delete",
    "pay": "pay",
    "payment": "pay",
    "transfer": "pay",
    "prod": "prod",
    "production": "prod",
    "deploy": "prod",
    "low": "low",
    "read": "low",
}

_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "pay",
        re.compile(
            r"(pay|payment|invoice|transfer|checkout|billing|stripe|alipay)",
            re.IGNORECASE,
        ),
    ),
    (
        "delete",
        re.compile(r"(delete|unlink|rm\b|drop_|destroy|purge|wipe)", re.IGNORECASE),
    ),
    (
        "prod",
        re.compile(
            r"(deploy|kubectl|production|prod[_-]|migrate|terraform\b|helm\b)",
            re.IGNORECASE,
        ),
    ),
    (
        "outbound",
        re.compile(
            r"(http_request|web_fetch|webhook|send_email|im_send|smtp|curl\b)",
            re.IGNORECASE,
        ),
    ),
)


def normalize_category(raw: str | None) -> str:
    key = (raw or "").strip().lower()
    if not key:
        return ""
    return _CATEGORY_ALIASES.get(key, key if key in HIGH_RISK_CATEGORIES or key == "low" else "")


def classify_tool(tool_name: str, category: str = "", action: str = "") -> str:
    """Return a risk category. Empty / unknown names are ``low`` unless tagged."""
    explicit = normalize_category(category)
    if explicit:
        return explicit
    haystack = " ".join(part for part in (tool_name, action) if part)
    if not haystack.strip():
        return "low"
    for label, pattern in _PATTERNS:
        if pattern.search(haystack):
            return label
    return "low"


def is_high_risk(tool_name: str, category: str = "", action: str = "") -> bool:
    return classify_tool(tool_name, category, action) in HIGH_RISK_CATEGORIES


def args_digest(args: dict[str, Any] | None) -> str:
    """Stable digest so an approval cannot be reused on a different payload."""
    import hashlib
    import json

    payload = args if isinstance(args, dict) else {}
    encoded = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()[:16]

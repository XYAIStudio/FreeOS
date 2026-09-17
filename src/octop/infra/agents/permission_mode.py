"""Per-turn chat permission modes (composer 使用权限).

``default`` keeps the agent security policy.
``auto`` skips HITL inside the workspace sandbox; tool-guard stays on so
high-risk / sandbox-boundary actions can still warn or ask.
``full`` disables HITL and tool-guard for that turn (higher privilege).
"""

from __future__ import annotations

from typing import Any, Literal

ChatPermissionMode = Literal["default", "auto", "full"]

PERMISSION_MODES: tuple[ChatPermissionMode, ...] = ("default", "auto", "full")
CONFIG_KEY = "octop_permission_mode"
_MODE_BY_VALUE: dict[str, ChatPermissionMode] = {
    "default": "default",
    "auto": "auto",
    "full": "full",
}


def normalize_permission_mode(raw: Any) -> ChatPermissionMode | None:
    if isinstance(raw, str):
        return _MODE_BY_VALUE.get(raw)
    return None


def permission_mode_security_override(mode: ChatPermissionMode) -> dict[str, Any] | None:
    """Partial SecurityPolicy patch applied for one dashboard turn.

    ``default`` returns ``None`` so the stored global/agent policy wins.
    """
    if mode == "auto":
        return {
            "hitl": {"enabled": False},
            "tool_guard": {"enabled": True, "mode": "require_approval"},
        }
    if mode == "full":
        return {
            "hitl": {"enabled": False},
            "tool_guard": {"enabled": False},
        }
    return None


__all__ = [
    "CONFIG_KEY",
    "PERMISSION_MODES",
    "ChatPermissionMode",
    "normalize_permission_mode",
    "permission_mode_security_override",
]

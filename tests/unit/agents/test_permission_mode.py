from octop.infra.agents.permission_mode import (
    normalize_permission_mode,
    permission_mode_security_override,
)


def test_normalize_permission_mode() -> None:
    assert normalize_permission_mode("default") == "default"
    assert normalize_permission_mode("auto") == "auto"
    assert normalize_permission_mode("full") == "full"
    assert normalize_permission_mode("yolo") is None
    assert normalize_permission_mode(None) is None


def test_security_override_default_is_passthrough() -> None:
    assert permission_mode_security_override("default") is None


def test_security_override_auto_keeps_tool_guard() -> None:
    patch = permission_mode_security_override("auto")
    assert patch is not None
    assert patch["hitl"]["enabled"] is False
    assert patch["tool_guard"]["enabled"] is True
    assert patch["tool_guard"]["mode"] == "require_approval"


def test_security_override_full_relaxes_guards() -> None:
    patch = permission_mode_security_override("full")
    assert patch is not None
    assert patch["hitl"]["enabled"] is False
    assert patch["tool_guard"]["enabled"] is False

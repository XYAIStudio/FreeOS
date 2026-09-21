"""Managed Node: uv run may skip; FreeOS desktop treats a missing runtime as failure."""

from __future__ import annotations

from pathlib import Path

import pytest

from octop.modules.org_os.managed_runtime import (
    ManagedOrganizationRuntime,
    resolve_organization_command,
)


def test_resolve_organization_command_returns_none_without_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OCTOP_GREEN_PACKAGES", raising=False)
    monkeypatch.setattr("octop.modules.org_os.managed_runtime.shutil.which", lambda _name: None)
    monkeypatch.setattr("octop.modules.org_os.managed_runtime.find_sidecar_runtime", lambda: None)
    assert resolve_organization_command() is None


@pytest.mark.asyncio
async def test_managed_runtime_start_skips_without_node_outside_desktop(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.delenv("OCTOP_DESKTOP", raising=False)
    monkeypatch.delenv("FREEOS_DESKTOP", raising=False)
    monkeypatch.setattr(
        "octop.modules.org_os.managed_runtime.resolve_organization_command", lambda: None
    )
    runtime = ManagedOrganizationRuntime(tmp_path)
    with caplog.at_level("WARNING"):
        await runtime.start()
    assert runtime.process is None
    assert runtime.task is None
    assert runtime.base_url == ""
    assert "zero-Node" in caplog.text


@pytest.mark.asyncio
async def test_desktop_missing_runtime_is_error_path_not_zero_node_skip(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("OCTOP_DESKTOP", "1")
    monkeypatch.setenv("FREEOS_ORG_INTEGRATED", "1")
    monkeypatch.setattr(
        "octop.modules.org_os.managed_runtime.resolve_organization_command", lambda: None
    )
    monkeypatch.setattr(
        "octop.modules.org_os.managed_runtime.ManagedOrganizationRuntime._recover_desktop_runtime",
        lambda self: False,
    )
    runtime = ManagedOrganizationRuntime(tmp_path)
    with caplog.at_level("ERROR"):
        await runtime.start()
    assert runtime.process is None
    assert runtime.task is None
    assert "managed Organization Node skipped" not in caplog.text
    assert "packaging/startup" in caplog.text

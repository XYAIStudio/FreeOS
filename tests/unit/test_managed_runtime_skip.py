"""Managed Node is transitional: missing runtime must not abort the host."""

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
    monkeypatch.setattr(
        "octop.modules.org_os.managed_runtime.find_sidecar_runtime", lambda: None
    )
    assert resolve_organization_command() is None


@pytest.mark.asyncio
async def test_managed_runtime_start_skips_without_node(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "octop.modules.org_os.managed_runtime.resolve_organization_command", lambda: None
    )
    runtime = ManagedOrganizationRuntime(tmp_path)
    await runtime.start()
    assert runtime.process is None
    assert runtime.task is None
    assert runtime.base_url == ""

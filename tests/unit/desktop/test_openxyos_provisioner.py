"""Shipped openXYOS provisioner is a real subprocess, not NSIS FileWrite glue."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
NSIS = REPO / "desktop" / "src" / "build" / "windows" / "nsis"
PROVISION_PS1 = NSIS / "provision-openxyos.ps1"
START_PS1 = NSIS / "start-sidecar.ps1"
PROVISION_CMD = NSIS / "provision-openxyos.cmd"
START_CMD = NSIS / "start-sidecar.cmd"


def test_provisioner_files_are_shipped() -> None:
    for path in (PROVISION_PS1, START_PS1, PROVISION_CMD, START_CMD):
        assert path.is_file(), path


def test_provisioner_extracts_with_tar_not_expand_archive() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    assert "tar.exe" in text
    assert "Expand-Archive" not in text
    assert "Expand-Archive" not in START_PS1.read_text(encoding="utf-8")
    assert "-xf" in text


def test_provisioner_normalizes_nested_and_flat_layout() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    assert "openxyos\\dist\\index.html" in text
    assert "dist\\index.html" in text
    assert "node\\node.exe" in text
    assert "Repair-OpenXYOSLayout" in text
    assert "Find-OpenXYOSBundleRoot" in text
    assert "org-sidecar" in text


def test_provisioner_starts_medium_integrity_and_requires_livez() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    start = START_PS1.read_text(encoding="utf-8")
    assert "Shell.Application" in text
    assert "IShellDispatch2" in text or "ShellExecute" in text
    assert "http://127.0.0.1:3780/api/health/livez" in text
    assert "Write-InstallReady" in text
    assert "exit 12" in text
    assert "exit 10" in text
    assert "re-invoking start" in text
    assert "WriteRegStr" not in text
    assert "schtasks.exe" not in text.lower()
    assert "Test-IsElevated" in start
    assert "refusing High-IL Node" in start
    assert "Start-Process -FilePath $node" in start


def test_provisioner_writes_marker_only_when_healthy() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    write_fn = text.index("function Write-InstallReady")
    first_write = text.index("if (Write-InstallReady $LiveDir) { exit 0 }")
    assert write_fn < first_write
    assert "Test-OpenXYOSLivez" in text
    assert ".install-ready" in text
    assert write_fn < text.index("status=healthy")


def test_wrappers_have_no_goto_labels() -> None:
    for path in (PROVISION_CMD, START_CMD):
        body = path.read_text(encoding="utf-8")
        assert "goto /" not in body.lower()
        assert "goto:" not in body.lower()
        assert not any(line.strip().lower().startswith("goto ") for line in body.splitlines())
        assert ":" not in {line.strip() for line in body.splitlines()} or all(
            not line.strip().endswith(":") or line.strip().startswith(":")
            for line in body.splitlines()
            if line.strip().endswith(":") and " " not in line.strip()
        )

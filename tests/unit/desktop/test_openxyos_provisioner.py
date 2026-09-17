"""Shipped openXYOS provisioner is a real subprocess, not NSIS FileWrite glue."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

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
    start = START_PS1.read_text(encoding="utf-8")
    assert "openxyos\\dist\\index.html" in text
    assert "dist\\index.html" in text
    assert "node\\node.exe" in text
    assert "Repair-OpenXYOSLayout" in text
    assert "Repair-OpenXYOSLayout" in start
    assert "backend-dist\\server.js" in text
    assert "Repair-OpenXYOSMigrations" in text
    assert "013_audit_bundle.sql" in text
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
    assert "UseShellExecute = $false" in start
    assert "EnvironmentVariables" in start
    assert "RedirectStandardError" in start
    assert "NoNewWindow" in start
    assert "UseNewEnvironment" not in start
    assert "start.log" in start
    assert "WaitForExit" in start
    assert "$env:CORS_ORIGIN" in start
    assert "Write-StartLogExcerpt" in text
    assert "Test-OpenXYOSNodeAlive" in text
    assert "Test-OpenXYOSPortListen" in text
    assert "exit 10" in text


def test_start_sidecar_does_not_assign_automatic_home() -> None:
    """Windows PowerShell $HOME / $home is read-only; assigning it is a no-op."""
    text = START_PS1.read_text(encoding="utf-8")
    assert "$freeosHome" in text
    assert "$env:FREEOS_HOME = $freeosHome" in text
    assert "$env:OCTOP_HOME = $freeosHome" in text
    assert "Join-Path $freeosHome 'org-os'" in text
    assert not re.search(r"(?i)\$home\s*=", text)
    assert not re.search(r"(?i)\$pid\s*=", text)


def test_start_sidecar_stops_stale_node_and_heals_layout() -> None:
    text = START_PS1.read_text(encoding="utf-8")
    assert "Repair-OpenXYOSLayout" in text
    assert "Stop-OpenXYOSNode" in text
    assert "start.pid" in text
    assert "openxyos\\dist\\index.html" in text
    assert "backend-dist\\server.js" in text
    assert "if (Test-Livez) { exit 0 }" not in text
    assert "day-old" in text or "stale" in text.lower()


def test_start_sidecar_cors_origin_is_parseorigins_safe() -> None:
    """openXYOS parseOrigins requires explicit http(s) origins, no '*'."""
    text = START_PS1.read_text(encoding="utf-8")
    match = re.search(r"\$env:CORS_ORIGIN\s*=\s*'([^']+)'", text)
    assert match, "start-sidecar.ps1 must set $env:CORS_ORIGIN"
    origins = [part.strip() for part in match.group(1).split(",") if part.strip()]
    assert origins
    assert "*" not in origins
    assert "http://127.0.0.1:3780" in origins
    assert "http://localhost:3780" in origins
    for origin in origins:
        parsed = urlparse(origin)
        assert parsed.scheme in {"http", "https"}, origin
        assert parsed.netloc, origin


def test_provisioner_fail_fast_when_node_dies() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    assert "start.log excerpt" in text
    assert "Node is not running and 3780 is not listening" in text
    # Dead Node during livez wait is exit 10, not a 90s exit 12.
    dead = text.index("Node is not running and 3780 is not listening")
    exit10 = text.index("exit 10", dead)
    exit12 = text.index("exit 12")
    assert exit10 < exit12
    assert "LivezTimeoutSec" in text


def test_provisioner_writes_marker_only_when_healthy() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    write_fn = text.index("function Write-InstallReady")
    complete_fn = text.index("function Complete-OpenXYOSSuccess")
    first_complete = text.index(
        "Complete-OpenXYOSSuccess", complete_fn + len("function Complete-OpenXYOSSuccess")
    )
    assert write_fn < complete_fn < first_complete
    assert "Test-OpenXYOSLivez" in text
    assert ".install-ready" in text
    assert write_fn < text.index("status=healthy")
    assert "if (Write-InstallReady $LiveDir) { exit 0 }" not in text


def test_provisioner_removes_staging_only_after_success() -> None:
    """Zip + openxyos-runtime folder go away only after .install-ready."""
    text = PROVISION_PS1.read_text(encoding="utf-8")
    clean_fn = text.index("function Remove-OpenXYOSStaging")
    complete_fn = text.index("function Complete-OpenXYOSSuccess")
    main = text.index("# --- main ---")
    assert clean_fn < complete_fn < main
    complete_body = text[complete_fn:main]
    assert complete_body.index("Write-InstallReady") < complete_body.index("Remove-OpenXYOSStaging")
    assert complete_body.index("Remove-OpenXYOSStaging") < complete_body.index("exit 0")
    assert "exit 13" in complete_body
    clean_body = text[clean_fn:complete_fn]
    assert "Join-Path $InstallDir 'openxyos-runtime'" in clean_body
    assert "Join-Path $liveParent 'openxyos-runtime'" in clean_body
    assert "openxyos-runtime" in clean_body
    assert "SilentlyContinue" in clean_body
    assert "Join-Path $InstallDir 'openxyos'" in clean_body
    assert "Skipping staging cleanup of protected path" in clean_body
    # Failure exits must not call cleanup (keep zip/folder for debug).
    for code in ("exit 2", "exit 3", "exit 5", "exit 6", "exit 7", "exit 10", "exit 12"):
        idx = text.index(code)
        window = text[max(0, idx - 120) : idx]
        assert "Remove-OpenXYOSStaging" not in window, code
        assert "Complete-OpenXYOSSuccess" not in window, code
    assert text.count("Complete-OpenXYOSSuccess") >= 5
    assert "Sealed backup:" not in text


def test_provisioner_stops_owned_node_before_extract() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    start = START_PS1.read_text(encoding="utf-8")
    stop_fn = text.index("function Stop-OpenXYOSNode")
    wrap_fn = text.index("function Stop-OpenXYOSLockedProcesses")
    extract_fn = text.index("function Invoke-TarExtract")
    main = text.index("# --- main ---")
    stop_call = text.index("Stop-OpenXYOSLockedProcesses", main)
    first_extract = text.index("Invoke-TarExtract", main)
    assert stop_fn < wrap_fn < extract_fn < main
    assert stop_call < first_extract
    node_body = text[stop_fn:wrap_fn]
    wrap_body = text[wrap_fn:extract_fn]
    assert "Stop-OpenXYOSNode" in start
    assert "Stop-OpenXYOSNode" in wrap_body
    assert "start.pid" in node_body
    assert "Name = 'node.exe'" in node_body
    assert "CommandLine" in node_body
    lock_body = text[
        text.index("function Get-OpenXYOSLockRoots") : text.index(
            "function Test-CommandLineMentionsRoot"
        )
    ]
    assert "Join-Path $InstallDir 'openxyos'" in lock_body
    assert "$LiveDir" in lock_body
    assert "Stopping FreeOS openXYOS process" in node_body
    assert "stop before extract" in wrap_body
    assert "Stop-Process -Name node" not in text
    assert "taskkill" not in node_body.lower()
    # Same owned-path rule as start-sidecar: live node.exe / command line, not every Node.
    assert "node\\node.exe" in node_body


def test_provisioner_logs_tar_stderr() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    body = text[text.index("function Invoke-TarExtract") : text.index("function Test-SamePath")]
    assert "2>&1" in body
    assert 'Write-ProvLog "tar:' in body or 'Write-ProvLog "tar:' in body
    assert "tar exit" in body
    assert (
        "LOCALAPPDATA"
        in text[
            text.index("function New-OpenXYOSExtractTemp") : text.index(
                "function Invoke-TarExtract"
            )
        ]
    )
    assert "openxyos-extract-" in body or "openxyos-extract-" in text


def test_provisioner_nonzero_tar_with_good_layout_is_not_exit_3() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    extract_body = text[
        text.index("function Invoke-TarExtract") : text.index("function Test-SamePath")
    ]
    assert "treating extract as success" in extract_body
    assert "Test-OpenXYOSLayout" in extract_body
    assert "Repair-OpenXYOSLayout" in extract_body
    assert "exit 3" not in extract_body
    main = text[text.index("# --- main ---") :]
    assert "will try backup heal" in main
    hard_fail = (
        "if (-not (Invoke-TarExtract -Tar $tar -Zip $ZipPath -Dest $LiveDir)) {\n"
        "        Write-ProvLog 'extract into live dir failed'\n"
        "        exit 3"
    )
    assert hard_fail not in text
    exit3 = text.index("exit 3")
    window = text[max(0, exit3 - 240) : exit3]
    assert "Test-OpenXYOSLayout" in window
    assert "extract into live dir failed" in window
    assert "Remove-OpenXYOSStaging" not in window


def test_provisioner_incomplete_layout_exits_3() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    main = text[text.index("# --- main ---") :]
    failed = main.index("extract into live dir failed")
    exit3 = main.index("exit 3", failed)
    assert "if (-not (Test-OpenXYOSLayout $LiveDir))" in main[max(0, failed - 160) : failed]
    heal = main.index("Healing live dir from")
    assert heal < failed < exit3
    assert "Complete-OpenXYOSSuccess" not in main[failed:exit3]


def test_provisioner_idempotent_requires_own_layout_not_stray_livez() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    assert "function Test-OpenXYOSOwnNode" in text
    assert "function Test-OpenXYOSOwnLivez" in text
    main = text[text.index("# --- main ---") :]
    idem = main.index("Already extracted and livez healthy (idempotent)")
    window = main[max(0, idem - 500) : idem]
    assert "Test-OpenXYOSLayout" in window
    assert "Test-OpenXYOSOwnLivez" in window
    assert ".install-ready" in window
    assert "layout incomplete; not treating as idempotent" in main
    assert "not our FreeOS openxyos node" in main
    # A healthy stray listener after extract must not write .install-ready.
    assert "if (Test-OpenXYOSOwnLivez)" in main
    assert "if (Test-OpenXYOSLivez)" not in main[main.index("Install-StartHelpers") :]


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

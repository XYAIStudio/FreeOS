"""Shipped openXYOS provisioner is a real subprocess, not NSIS FileWrite glue."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import pytest

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
    assert "ConvertTo-NsisOemText" in text
    assert "Write-ProvHost" in text
    assert "Test-OpenXYOSTransientConsoleLine" in text


def test_start_sidecar_does_not_assign_automatic_home() -> None:
    """Windows PowerShell $HOME / $home is read-only; assigning it is a no-op."""
    text = START_PS1.read_text(encoding="utf-8")
    assert "$freeosHome" in text
    assert "$env:FREEOS_HOME = $freeosHome" in text
    assert "$env:OCTOP_HOME = $freeosHome" in text
    assert "Join-Path $freeosHome 'org-os'" in text
    assert not re.search(r"(?i)\$home\s*=", text)
    assert not re.search(r"(?i)\$pid\s*=", text)


def resolve_openxyos_app_dir(root: Path) -> Path:
    """Mirror Resolve-OpenXYOSAppDir: prefer healed top-level over nested."""
    flat_fe = root / "dist" / "index.html"
    flat_be = root / "backend-dist" / "server.js"
    nested = root / "openxyos"
    if flat_fe.is_file() and flat_be.is_file():
        return root
    if (nested / "backend-dist" / "server.js").is_file() or (
        nested / "dist" / "index.html"
    ).is_file():
        return nested
    return root


def test_start_sidecar_stops_stale_node_and_heals_layout() -> None:
    text = START_PS1.read_text(encoding="utf-8")
    assert "Repair-OpenXYOSLayout" in text
    assert "Stop-OpenXYOSNode" in text
    assert "start.pid" in text
    assert "openxyos\\dist\\index.html" in text
    assert "backend-dist\\server.js" in text
    before_stop = text.split("Stop-OpenXYOSNode $live", 1)[0]
    assert "if (Test-Livez) { exit 0 }" not in before_stop
    assert "day-old" in text or "stale" in text.lower()


def test_layout_picker_prefers_top_level_when_both_exist(tmp_path: Path) -> None:
    live = tmp_path / "openxyos"
    nested = live / "openxyos"
    for folder in (live, nested):
        (folder / "dist").mkdir(parents=True)
        (folder / "backend-dist").mkdir(parents=True)
        (folder / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
        (folder / "backend-dist" / "server.js").write_text("/* compiled */", encoding="utf-8")
    assert resolve_openxyos_app_dir(live) == live
    (live / "backend-dist" / "server.js").unlink()
    assert resolve_openxyos_app_dir(live) == nested


def test_start_sidecar_prefers_top_level_app_dir() -> None:
    start = START_PS1.read_text(encoding="utf-8")
    text = PROVISION_PS1.read_text(encoding="utf-8")
    for body in (start, text):
        assert "function Resolve-OpenXYOSAppDir" in body
        assert "function Test-OpenXYOSAppReady" in body
        picker = body[
            body.index("function Resolve-OpenXYOSAppDir") : body.index(
                "function Repair-OpenXYOSLayout"
            )
        ]
        assert "Test-OpenXYOSAppReady $Root" in picker
        assert picker.index("Test-OpenXYOSAppReady $Root") < picker.index(
            "Test-OpenXYOSAppReady $nested"
        )
    assert (
        "Join-Path $live 'openxyos'" not in start.split("Resolve-OpenXYOSAppDir $live", 1)[1][:200]
    )
    assert "layout=$layout" in start
    assert "JWT_SECRET set=" in start
    assert "nested openxyos\\openxyos cwd crash" in start or "nested openxyos" in start
    assert "function Wait-OpenXYOSStartEvidence" in text
    assert "direct powershell fallback" in text
    assert "Node exited fail-fast" in text


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
    exit12 = text.rindex("exit 12")
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
    wait_fn = text.index("function Wait-OpenXYOSOwnedNodeGone")
    wrap_fn = text.index("function Stop-OpenXYOSLockedProcesses")
    extract_fn = text.index("function Invoke-TarExtract")
    main = text.index("# --- main ---")
    stop_call = text.index("Stop-OpenXYOSLockedProcesses", main)
    first_extract = text.index("Invoke-TarExtract", main)
    assert stop_fn < wait_fn < wrap_fn < extract_fn < main
    assert stop_call < first_extract
    node_body = text[stop_fn:wait_fn]
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
    assert "Wait-OpenXYOSOwnedNodeGone" in wrap_body
    assert "Test-OpenXYOSOwnNode" in text[wait_fn:wrap_fn]
    assert "retrying stop" in wrap_body
    assert "Stop-Process -Name node" not in text
    assert "taskkill" not in node_body.lower()
    # Same owned-path rule as start-sidecar: live node.exe / command line, not every Node.
    assert "node\\node.exe" in node_body


def test_provisioner_logs_tar_stderr() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    body = text[text.index("function Invoke-TarExtract") : text.index("function Test-SamePath")]
    assert "2>&1" in body
    assert 'Write-ProvLog -Quiet "tar:' in body
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
    assert "extract into live dir returned incomplete layout" in main
    assert "will try backup heal" not in main
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


def test_provisioner_keeps_node_console_out_of_nsis_detail() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    cmd = PROVISION_CMD.read_text(encoding="utf-8")
    excerpt = text[
        text.index("function Write-StartLogExcerpt") : text.index(
            "function Test-OpenXYOSPortListen"
        )
    ]
    assert "Write-ProvLog -Quiet" in excerpt
    assert "Write-Host" not in excerpt
    assert "not shown in NSIS" in excerpt
    tar_body = text[text.index("function Invoke-TarExtract") : text.index("function Test-SamePath")]
    assert 'Write-ProvLog -Quiet "tar:' in tar_body
    assert ">nul" in cmd
    assert "2>&1" in cmd


def test_provisioner_ignores_transient_auth_console_noise() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    helper = text[
        text.index("function Test-OpenXYOSTransientConsoleLine") : text.index(
            "function Test-OpenXYOSLayout"
        )
    ]
    assert "POST\\s+/api/auth" in helper
    assert "[seed]" in helper.replace("\\", "")
    assert "node still running pid=" in helper
    wait = text[
        text.index("function Wait-OpenXYOSLivez") : text.index("function Start-OpenXYOSUnelevated")
    ]
    assert "Test-OpenXYOSLivez" in wait
    assert "Test-OpenXYOSTransientConsoleLine" not in wait
    assert "-match" not in wait
    assert "startup noise" in wait


def test_provisioner_extracts_zip_once_into_livedir() -> None:
    """Runtime zip is extracted once into LocalAppData; INSTDIR stays stubs."""
    text = PROVISION_PS1.read_text(encoding="utf-8")
    main = text[text.index("# --- main ---") :]
    assert main.count("Invoke-TarExtract") == 1
    assert "Dest $LiveDir" in main
    assert "Dest $backup" not in main
    assert "backup extract" not in main
    extract_body = text[
        text.index("function Invoke-TarExtract") : text.index("function Test-SamePath")
    ]
    assert "& $Tar -xf" in extract_body
    assert extract_body.count("& $Tar -xf") == 1
    assert "single extract" in extract_body
    assert "Move-OpenXYOSTree" in extract_body
    assert "Remove-OpenXYOSNestedLeftover" in extract_body
    nsh = (NSIS / "wails_tools.nsh").read_text(encoding="utf-8")
    provision = nsh[
        nsh.index("!macro wails.provisionOpenXYOS") : nsh.index("!macro wails.openxyosFailDetail")
    ]
    assert provision.count('File "/oname=openxyos-runtime.zip"') == 1
    assert "ONCE" in nsh or "once" in nsh
    assert "README stubs" in nsh or "README stub" in nsh
    assert "Set-Content -LiteralPath (Join-Path $stubDir 'README.txt')" in main
    assert "not a runtime copy" in main


def test_provisioner_ready_gate_requires_livez_and_pid() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    assert "function Test-OpenXYOSInstallReady" in text
    assert "function Test-OpenXYOSPidAlive" in text
    complete = text[
        text.index("function Complete-OpenXYOSSuccess") : text.index("# --- main ---")
    ]
    assert "Test-OpenXYOSInstallReady" in complete
    assert complete.index("Test-OpenXYOSInstallReady") < complete.index("Write-InstallReady")
    assert "拒绝写入 .install-ready" in complete
    gate = text[
        text.index("function Test-OpenXYOSInstallReady") : text.index(
            "function Complete-OpenXYOSSuccess"
        )
    ]
    assert "Test-OpenXYOSLivez" in gate
    assert "Test-OpenXYOSPidAlive" in gate
    assert "Test-StartLogShowsFailFast" in gate
    start_fn = text[
        text.index("function Start-OpenXYOSUnelevated") : text.index("function Write-InstallReady")
    ]
    assert "Test-StartClaimUnreliable" in start_fn
    assert "改走直接启动" in start_fn
    assert "未写入 .install-ready" in text


def test_provisioner_removes_nested_leftover_after_heal() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    start = START_PS1.read_text(encoding="utf-8")
    for body in (text, start):
        assert "function Remove-OpenXYOSNestedLeftover" in body
        assert "leftover nested payload" in body or "Remove-OpenXYOSNestedLeftover $Root" in body
        repair = body[
            body.index("function Repair-OpenXYOSLayout") : body.index(
                "function Remove-OpenXYOSNestedLeftover"
            )
        ]
        assert "Remove-OpenXYOSNestedLeftover $Root" in repair
    assert "Removing leftover nested payload" in text


def test_start_sidecar_records_nonempty_fail_fast_reason() -> None:
    start = START_PS1.read_text(encoding="utf-8")
    assert "cmd.exe" in start
    assert "/c" in start
    assert '2>"' in start
    assert "function Write-OpenXYOSFailFastReason" in start
    assert "function Invoke-OpenXYOSCmdCapture" in start
    assert "redirect produced empty stdout/stderr; capturing via cmd /c" in start
    assert "still empty after cmd capture" in start
    assert "CrashSelfTest" in start
    assert "forced-crash-openxyos" in start
    assert "Start-Process -FilePath $node" in start
    assert "$env:CORS_ORIGIN" in start
    assert "JWT_SECRET set=" in start


@pytest.mark.skipif(
    os.name != "nt" or shutil.which("powershell") is None or shutil.which("node") is None,
    reason="forced-crash probe needs Windows powershell + node",
)
def test_start_sidecar_forced_crash_writes_reason(tmp_path: Path) -> None:
    """On Windows with node+powershell, -CrashSelfTest must leave a non-empty reason."""
    live = tmp_path / "openxyos"
    pwsh = shutil.which("powershell")
    node = shutil.which("node")
    assert pwsh and node
    (live / "node").mkdir(parents=True)
    shutil.copy(node, live / "node" / "node.exe")
    (live / "dist").mkdir()
    (live / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
    (live / "backend-dist").mkdir()
    (live / "backend-dist" / "server.js").write_text("/* unused */", encoding="utf-8")
    helper = live / "start-sidecar.ps1"
    helper.write_text(START_PS1.read_text(encoding="utf-8"), encoding="utf-8")
    completed = subprocess.run(
        [
            pwsh,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(helper),
            "-CrashSelfTest",
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    log = (live / "start.log").read_text(encoding="utf-8", errors="replace")
    err = ""
    if (live / "start.err.log").is_file():
        err = (live / "start.err.log").read_text(encoding="utf-8", errors="replace")
    blob = log + err
    assert "fail-fast" in blob or "forced-crash-openxyos" in blob
    assert blob.strip(), f"empty start logs, exit={completed.returncode}"


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

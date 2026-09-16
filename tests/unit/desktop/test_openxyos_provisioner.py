"""Independent openXYOS provisioner: success criteria and NSIS hand-off."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
WIN = REPO / "desktop" / "src" / "build" / "windows"
PROVISION = WIN / "openxyos-provision.ps1"
START = WIN / "start-sidecar.ps1"
NSH = WIN / "nsis" / "wails_tools.nsh"
NSI = WIN / "nsis" / "project.nsi"


# Documented success contract (must stay in sync with openxyos-provision.ps1).
SUCCESS_REQUIRES = (
    "runtime on disk (node\\node.exe + dist\\index.html)",
    "backend process started at medium integrity",
    "http://127.0.0.1:3780/api/health/livez returns HTTP < 500",
    ".install-ready written only after livez",
)

EXIT_CODES = {
    0: "success",
    2: "zip missing",
    3: "tar extract failed",
    5: "tar.exe missing",
    6: "node.exe missing",
    7: "dist\\index.html missing",
    10: "Node failed to start",
    12: "livez never became healthy",
}


def test_provisioner_files_are_shipped_not_generated() -> None:
    assert PROVISION.is_file()
    assert START.is_file()
    assert (WIN / "openxyos-provision.cmd").is_file()
    assert (WIN / "start-sidecar.cmd").is_file()
    nsh = NSH.read_text(encoding="utf-8")
    assert 'File "/oname=openxyos-provision.ps1"' in nsh
    assert 'File "/oname=start-sidecar.ps1"' in nsh
    assert "FileWrite" not in nsh[nsh.index("!macro wails.shipOpenXYOSPayload") :]


def test_provisioner_success_criteria_are_documented() -> None:
    text = PROVISION.read_text(encoding="utf-8")
    assert "Success (exit 0) requires ALL of:" in text
    assert ".install-ready written only after" in text
    assert "Do not write .install-ready" in text
    assert "treat a livez miss as" in text
    for code, label in EXIT_CODES.items():
        assert str(code) in text
        assert label.split()[0] in text or str(code) == "0"
    assert "Expand-Archive" in text  # mentioned only as forbidden
    assert "Expand-Archive is not used" in text
    assert "tar.exe" in text
    assert "http://127.0.0.1:3780/api/health/livez" in text
    assert "HKCU" in text or "FreeOS-openXYOS" in text


def test_provisioner_writes_ready_marker_only_after_livez() -> None:
    text = PROVISION.read_text(encoding="utf-8")
    ready_fn = text.index("function Install-ReadyMarker")
    ready_call = text.index("Install-ReadyMarker $Live")
    livez_wait = text.index("Wait-Livez")
    livez_ok = text.index("livez ok")
    assert ready_fn < livez_wait < livez_ok < ready_call
    fail_path = text[text.index("} catch {") :]
    assert "Remove-Item -LiteralPath $readyFile" in fail_path
    start = START.read_text(encoding="utf-8")
    assert ".install-ready" not in start or "does not write .install-ready" in start
    assert "Start-Process" in start
    assert "exit 6" in start
    assert "exit 7" in start


def test_provisioner_does_not_use_expand_archive() -> None:
    for path in (PROVISION, START):
        body = path.read_text(encoding="utf-8")
        assert "Expand-Archive" not in body or "not Expand-Archive" in body
        assert not any(
            line.strip().startswith("Expand-Archive") or "Expand-Archive " in line
            for line in body.splitlines()
            if "not Expand-Archive" not in line and "is not used" not in line
        )


def test_provisioner_distinguishes_start_failure_from_livez() -> None:
    text = PROVISION.read_text(encoding="utf-8")
    assert "not a livez/port failure" in text or "not a port-3780 problem" in text
    assert "$script:exitCode = 10" in text
    assert "$script:exitCode = 12" in text
    nsi = NSI.read_text(encoding="utf-8-sig")
    assert "不要只把原因归为「检查 3780 端口」" in nsi
    assert "do not treat this as a generic port-3780 check" in nsi


def test_start_sidecar_is_user_level_helper() -> None:
    text = START.read_text(encoding="utf-8")
    assert "WindowStyle Hidden" in text
    assert "FREEOS_INGEST_TOKEN" in text
    assert "backend-dist/server.js" in text
    assert "taskkill" not in text.lower()

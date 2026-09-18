"""NSIS detail list is system ANSI; provisioner logs stay UTF-8 on disk."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
NSIS = REPO / "desktop" / "src" / "build" / "windows" / "nsis"
PROVISION_PS1 = NSIS / "provision-openxyos.ps1"
PROVISION_CMD = NSIS / "provision-openxyos.cmd"
NSH = NSIS / "wails_tools.nsh"
NSI = NSIS / "project.nsi"


def nsis_oem_safe_text(text: str, oem: str = "gbk") -> str:
    """Mirror ConvertTo-NsisOemText: keep text if OEM-roundtrippable, else ASCII."""
    if not text:
        return ""
    try:
        roundtrip = text.encode(oem, errors="replace").decode(oem, errors="replace")
        if roundtrip == text:
            return text
    except LookupError:
        pass
    return "".join(ch for ch in text if ord(ch) < 128).strip()


def is_transient_openxyos_console_line(line: str) -> bool:
    """Mirror Test-OpenXYOSTransientConsoleLine (startup noise, not a fail)."""
    lowered = line.lower()
    if "post /api/auth" in lowered:
        return True
    if "[seed]" in lowered:
        return True
    if "node still running pid=" in lowered:
        return True
    if "websocket:" in lowered:
        return True
    return lowered.lstrip().startswith("server:") and "http" in lowered


def test_utf8_chinese_is_mojibake_when_nsis_reads_as_gbk() -> None:
    text = "正在重试 openXYOS 预配子进程"
    as_gbk = text.encode("utf-8").decode("gbk", errors="replace")
    assert as_gbk != text
    assert "\ufffd" in as_gbk or as_gbk.encode("gbk", errors="replace") != text.encode("gbk")


def test_oem_helper_keeps_gbk_chinese_and_strips_on_cp1252() -> None:
    chinese = "本机 openXYOS 已就绪"
    assert nsis_oem_safe_text(chinese, "gbk") == chinese
    stripped = nsis_oem_safe_text(chinese, "cp1252")
    assert "openXYOS" in stripped
    assert "本机" not in stripped
    assert nsis_oem_safe_text("exit code 12", "gbk") == "exit code 12"
    assert nsis_oem_safe_text("exit code 12", "cp1252") == "exit code 12"


def test_gbk_bytes_roundtrip_is_readable_on_chinese_windows() -> None:
    text = "完整日志：provision.log"
    encoded = text.encode("gbk")
    assert encoded.decode("gbk") == text
    assert encoded != text.encode("utf-8")


def test_transient_console_lines_are_not_fatal() -> None:
    assert is_transient_openxyos_console_line("[Error][25121468] POST /api/auth/login 401")
    assert is_transient_openxyos_console_line("[seed] Demo data is disabled. See docs.")
    assert is_transient_openxyos_console_line("node still running pid=53064")
    assert is_transient_openxyos_console_line("WebSocket: ws://localhost:3780/ws")
    assert is_transient_openxyos_console_line("Server: http://localhost:3780")
    assert not is_transient_openxyos_console_line("tar exit 1")
    assert not is_transient_openxyos_console_line("node\\node.exe missing after extract")


def test_provisioner_ships_oem_encoding_helpers() -> None:
    text = PROVISION_PS1.read_text(encoding="utf-8")
    assert "function Get-NsisOemEncoding" in text
    assert "function ConvertTo-NsisOemText" in text
    assert "function Write-ProvHost" in text
    assert "OpenStandardOutput" in text
    assert "[Console]::OutputEncoding.CodePage" in text
    assert "Nls\\CodePage" in text
    convert = text[
        text.index("function ConvertTo-NsisOemText") : text.index("function Write-ProvHost")
    ]
    assert "[int]$ch -lt 128" in convert
    host = text[text.index("function Write-ProvHost") : text.index("function Write-ProvLog")]
    assert "ConvertTo-NsisOemText" in host
    log = text[
        text.index("function Write-ProvLog") : text.index(
            "function Test-OpenXYOSTransientConsoleLine"
        )
    ]
    assert "[switch]$Quiet" in log
    assert "Write-ProvHost" in log
    assert "-Encoding UTF8" in log


def test_nsis_provision_does_not_exec_to_log() -> None:
    nsh = NSH.read_text(encoding="utf-8")
    provision = nsh[
        nsh.index("!macro wails.provisionOpenXYOS") : nsh.index("!macro wails.openxyosFailDetail")
    ]
    assert "nsExec::Exec $R4" not in provision
    assert "ExecToLog" not in provision
    assert "Abort" not in provision
    cmd = PROVISION_CMD.read_text(encoding="utf-8")
    assert ">nul" in cmd
    nsi = NSI.read_text(encoding="utf-8-sig")
    assert "OPENXYOS_OPTIONAL_SKIP" in nsi
    assert "Setup continues" in nsi

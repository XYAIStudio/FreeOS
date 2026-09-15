"""Windows NSIS uninstall must wipe $INSTDIR and keep the user profile home."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
NSI = REPO / "desktop" / "src" / "build" / "windows" / "nsis" / "project.nsi"
NSH = REPO / "desktop" / "src" / "build" / "windows" / "nsis" / "wails_tools.nsh"
DESKTOP_README = REPO / "desktop" / "README.md"


def _uninstall_section(text: str) -> str:
    start = text.index('Section "uninstall"')
    end = text.index("SectionEnd", start)
    return text[start:end]


def test_uninstall_asks_before_stopping_running_processes() -> None:
    nsi = NSI.read_text(encoding="utf-8")
    nsh = NSH.read_text(encoding="utf-8")

    assert "Function un.onInit" in nsi
    assert "!insertmacro wails.confirmRunningFreeOS" in nsi
    assert "MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2" in nsh
    assert "Abort" in nsh
    assert "LangString UN_FREEOS_RUNNING ${LANG_SIMPCHINESE}" in nsi
    assert "LangString UN_FREEOS_RUNNING ${LANG_ENGLISH}" in nsi
    assert "仍在运行" in nsi
    assert "still running" in nsi
    assert "%USERPROFILE%\\.freeos" in nsi

    # Detect belonging processes, then ask; never force-kill before the dialog.
    confirm = nsh[
        nsh.index("!macro wails.confirmRunningFreeOS") : nsh.index(
            "!macro wails.stopFreeOSProcesses"
        )
    ]
    assert "wails.detectFreeOSProcesses" in confirm
    assert "MessageBox" in confirm
    assert "Abort" in confirm
    assert "taskkill /F" not in confirm
    assert 'taskkill /T /IM "${PRODUCT_EXECUTABLE}"' in nsh
    assert 'taskkill /F /T /IM "${PRODUCT_EXECUTABLE}"' in nsh
    assert "CloseMainWindow" in nsh
    assert r"*\portable\*launch.py* run*" in nsh
    assert r"*\org-sidecar\*" in nsh


def test_uninstall_stops_processes_then_wipes_instdir() -> None:
    nsi = NSI.read_text(encoding="utf-8")
    nsh = NSH.read_text(encoding="utf-8")
    uninstall = _uninstall_section(nsi)

    assert "!insertmacro wails.wipeInstallDir" in uninstall
    assert "!insertmacro wails.confirmRunningFreeOS" in nsi

    # Unquoted RMDir /r $INSTDIR splits "C:\Program Files\FreeOS".
    assert "RMDir /r $INSTDIR" not in nsi
    assert "RMDir /r $INSTDIR" not in nsh
    assert 'RMDir /r "$INSTDIR"' in nsh
    assert 'SetOutPath "$TEMP"' in nsh


def test_uninstall_does_not_wipe_profile_homes() -> None:
    nsh = NSH.read_text(encoding="utf-8")
    assert r'StrCmp $INSTDIR "$PROFILE\.freeos" wailsWipeSkip' in nsh
    assert r'StrCmp $INSTDIR "$PROFILE\.octop" wailsWipeSkip' in nsh
    assert r"$PROFILE\.freeos" in nsh
    assert "FREEOS_HOME" in nsh
    assert r'IfFileExists "$INSTDIR\User Data"' in nsh
    assert r'IfFileExists "$INSTDIR\userdata"' in nsh
    assert ".freeos" not in _uninstall_section(NSI.read_text(encoding="utf-8"))


def test_uninstall_removes_shortcuts_and_program_cache() -> None:
    uninstall = _uninstall_section(NSI.read_text(encoding="utf-8"))
    assert 'Delete "$SMPROGRAMS\\${INFO_PRODUCTNAME}.lnk"' in uninstall
    assert 'Delete "$DESKTOP\\${INFO_PRODUCTNAME}.lnk"' in uninstall
    assert 'Delete "$SMSTARTUP\\${INFO_PRODUCTNAME}.lnk"' in uninstall
    assert r'RMDir /r "$AppData\${PRODUCT_EXECUTABLE}"' in uninstall
    assert "!insertmacro wails.deleteUninstaller" in uninstall


def test_desktop_readme_documents_uninstall_keep_vs_remove() -> None:
    text = DESKTOP_README.read_text(encoding="utf-8")
    assert "## Windows uninstall" in text
    assert "Program Files\\FreeOS" in text
    assert "%USERPROFILE%\\.freeos" in text
    assert "FREEOS_HOME" in text
    assert "User Data" in text
    assert "userdata" in text
    assert "asks" in text
    assert "Cancel" in text
    assert "Confirm" in text

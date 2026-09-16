"""Windows NSIS uninstall must wipe $INSTDIR and keep the user profile home."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
NSI = REPO / "desktop" / "src" / "build" / "windows" / "nsis" / "project.nsi"
NSH = REPO / "desktop" / "src" / "build" / "windows" / "nsis" / "wails_tools.nsh"
DESKTOP_README = REPO / "desktop" / "README.md"
ORG_PAGE = REPO / "dashboard" / "src" / "pages" / "Organization" / "index.tsx"


def _uninstall_section(text: str) -> str:
    start = text.index('Section "uninstall"')
    end = text.index("SectionEnd", start)
    return text[start:end]


def test_uninstall_asks_before_stopping_running_processes() -> None:
    nsi = NSI.read_text(encoding="utf-8-sig")
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
    nsi = NSI.read_text(encoding="utf-8-sig")
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
    assert ".freeos" not in _uninstall_section(NSI.read_text(encoding="utf-8-sig"))


def test_uninstall_removes_shortcuts_and_program_cache() -> None:
    uninstall = _uninstall_section(NSI.read_text(encoding="utf-8-sig"))
    assert 'Delete "$SMPROGRAMS\\${INFO_PRODUCTNAME}.lnk"' in uninstall
    assert 'Delete "$DESKTOP\\${INFO_PRODUCTNAME}.lnk"' in uninstall
    assert 'Delete "$SMSTARTUP\\${INFO_PRODUCTNAME}.lnk"' in uninstall
    assert r'RMDir /r "$AppData\${PRODUCT_EXECUTABLE}"' in uninstall
    assert r'RMDir /r "$R6\${INFO_PRODUCTNAME}"' in uninstall
    assert "!insertmacro wails.userLocalAppData" in uninstall
    assert "!insertmacro wails.deleteUninstaller" in uninstall


def test_finish_page_run_defaults_checked() -> None:
    nsi = NSI.read_text(encoding="utf-8-sig")
    assert '!define MUI_FINISHPAGE_RUN "$INSTDIR\\${PRODUCT_EXECUTABLE}"' in nsi
    assert "!define MUI_FINISHPAGE_RUN_FUNCTION LaunchFreeOS" in nsi
    assert "!define MUI_FINISHPAGE_RUN_TEXT" in nsi
    assert "LangString FINISH_RUN ${LANG_SIMPCHINESE}" in nsi
    assert "运行 FreeOS" in nsi
    assert "!define MUI_FINISHPAGE_RUN_NOTCHECKED" not in nsi
    launch = nsi[nsi.index("Function LaunchFreeOS") :]
    assert 'SetOutPath "$INSTDIR"' in launch
    # Finish-page launch must drop the installer admin token.
    assert "CoCreateInstance" in launch
    assert "IShellDispatch2" in launch or "A4C6892C-3BA9-11d2-9DEA-00C04FB16162" in launch
    assert r'"$WINDIR\explorer.exe"' in launch
    assert "Exec '\"$INSTDIR\\${PRODUCT_EXECUTABLE}\"'" not in launch


def test_shortcut_working_directory_is_instdir() -> None:
    nsi = NSI.read_text(encoding="utf-8-sig")
    install = nsi[nsi.index("Section\n") : nsi.index('Section "uninstall"')]
    create = install.index("CreateShortCut")
    pinned = install.rfind("SetOutPath", 0, create)
    assert pinned != -1
    window = install[pinned:create]
    assert "$INSTDIR" in window
    assert "pluginsdir" not in window


def test_nsis_chinese_source_is_utf8_with_bom() -> None:
    raw = NSI.read_bytes()
    assert raw.startswith(b"\xef\xbb\xbf"), "makensis treats BOM-less files as ACP (CP1252 on CI)"
    text = raw.decode("utf-8-sig")
    assert "运行 FreeOS" in text
    assert "检测到 FreeOS 仍在运行" in text
    mojibake = "运行".encode().decode("cp1252", errors="replace")
    assert mojibake not in text
    task = (REPO / "desktop" / "src" / "build" / "windows" / "Taskfile.yml").read_text(
        encoding="utf-8"
    )
    assert task.count("-INPUTCHARSET UTF8") >= 2


def test_packaged_windows_entry_is_freeos_exe() -> None:
    nsh = NSH.read_text(encoding="utf-8")
    assert 'File "/oname=${PRODUCT_EXECUTABLE}"' in nsh
    assert "${ARG_WAILS_AMD64_BINARY}" in nsh
    assert "${ARG_WAILS_ARM64_BINARY}" in nsh
    embed = (REPO / "desktop" / "src" / "embed_portable_embedded.go").read_text(encoding="utf-8")
    assert "bundled/portable.zip" in embed
    launch = (REPO / "desktop" / "portable" / "templates" / "launch.py").read_text(encoding="utf-8")
    assert "addsitedir" in launch or "site.addsitedir" in launch


def test_nsis_provisions_openxyos_runtime() -> None:
    nsi = NSI.read_text(encoding="utf-8-sig")
    nsh = NSH.read_text(encoding="utf-8")
    assert "!insertmacro wails.provisionOpenXYOS" in nsh
    assert 'File "/oname=openxyos-runtime.zip"' in nsh
    assert r"$INSTDIR\openxyos" in nsh
    assert r"$INSTDIR\openxyos-runtime" in nsh
    assert r"$R6\FreeOS\openxyos" in nsh
    assert "ReadEnvStr $R6 LOCALAPPDATA" in nsh
    assert "http://127.0.0.1:3780" in nsi
    assert "LangString OPENXYOS_WORKDIR ${LANG_SIMPCHINESE}" in nsi
    assert "创建 openXYOS 工作目录" in nsi
    assert "openXYOS 运行包" in nsi
    task = (REPO / "desktop" / "src" / "build" / "windows" / "Taskfile.yml").read_text(
        encoding="utf-8"
    )
    assert "stage:openxyos-runtime" in task
    assert "stage_openxyos_runtime.py" in task
    package = (REPO / "desktop" / "portable" / "package.sh").read_text(encoding="utf-8")
    assert "openXYOS frontend missing" in package


def _nsis_filewrite_argc(line: str) -> int:
    """Count FileWrite arguments the way makensis splits them (space/comma)."""
    rest = line.strip()
    prefix = "FileWrite"
    if not rest.startswith(prefix):
        return 0
    rest = rest[len(prefix) :].lstrip()
    args: list[str] = []
    i = 0
    while i < len(rest):
        ch = rest[i]
        if ch in " \t,":
            i += 1
            continue
        if ch in "\"'`":
            j = i + 1
            while j < len(rest) and rest[j] != ch:
                j += 1
            args.append(rest[i : j + 1])
            i = j + 1
            continue
        j = i
        while j < len(rest) and rest[j] not in " \t,":
            j += 1
        args.append(rest[i:j])
        i = j
    return len(args)


def test_nsis_filewrite_is_exactly_two_args() -> None:
    """A backtick next to '(' closes the string; $\\r$\\n becomes a third arg."""
    nsh = NSH.read_text(encoding="utf-8")
    for lineno, raw in enumerate(nsh.splitlines(), start=1):
        stripped = raw.strip()
        if not stripped.startswith("FileWrite"):
            continue
        argc = _nsis_filewrite_argc(stripped)
        assert argc == 2, f"wails_tools.nsh:{lineno}: FileWrite argc={argc}: {stripped}"
        assert "(`$" not in stripped and ")`$" not in stripped, stripped


def test_nsis_runs_openxyos_provisioner_subprocess() -> None:
    """Parent copies a real provisioner and nsExecs it; livez failure aborts."""
    nsi = NSI.read_text(encoding="utf-8-sig")
    nsh = NSH.read_text(encoding="utf-8")
    provision = nsh[
        nsh.index("!macro wails.provisionOpenXYOS") : nsh.index("!macro wails.openxyosFailDetail")
    ]
    assert "Expand-Archive" not in nsh
    assert "extract-openxyos.cmd" not in nsh
    assert "wait-openxyos.ps1" not in nsh
    assert "FileWrite" not in provision
    assert 'File "provision-openxyos.ps1"' in provision
    assert 'File "provision-openxyos.cmd"' in provision
    assert 'File "start-sidecar.ps1"' in provision
    assert "nsExec::ExecToLog $R4" in provision
    assert r"$INSTDIR\openxyos-runtime.zip" in provision
    assert r"$R6\FreeOS\openxyos" in provision
    assert "Pop $0" in provision
    assert "Abort" in provision
    assert ".install-ready" in provision
    assert "OPENXYOS_FAIL_START" in nsh
    assert "OPENXYOS_FAIL_LIVEZ" in nsh
    assert "start.log" in nsi
    assert "LangString OPENXYOS_PROVISION ${LANG_SIMPCHINESE}" in nsi
    assert "子进程" in nsi
    assert "OPENXYOS_PROBE_WARN" not in nsi
    assert "安装将继续" not in nsi
    assert "开机自启" not in nsi
    assert "PersistOpenXYOS" not in nsi
    assert "PersistOpenXYOS" not in nsh
    assert "Call PersistOpenXYOS" not in nsh
    assert "openxyos-runtime.zip missing" in nsh
    assert "!error" in nsh
    workflow = (REPO / ".github" / "workflows" / "octop-desktop.yml").read_text(encoding="utf-8")
    assert "org-sidecar/openxyos/dist/index.html" in workflow
    assert "org-sidecar/openxyos/backend/server.ts" in workflow


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
    assert "## Windows install finish" in text
    assert "运行 FreeOS" in text
    assert "%LOCALAPPDATA%\\FreeOS\\openxyos" in text
    assert "127.0.0.1:3780" in text
    assert "tar.exe" in text
    assert "README-only" in text
    assert "folder picker" in text
    assert "install-time" in text.lower() or "during Setup" in text or "安装期" in text


def _filewrite_payloads(block: str) -> list[str]:
    payloads: list[str] = []
    for raw in block.splitlines():
        stripped = raw.strip()
        if not stripped.startswith("FileWrite"):
            continue
        start = stripped.find("`")
        end = stripped.rfind("`")
        if start != -1 and end > start:
            payloads.append(stripped[start + 1 : end].replace("$\\r$\\n", "\n"))
    return payloads


def test_nsis_does_not_filewrite_goto_cmd_labels() -> None:
    """Provisioner is a shipped file; NSIS must not generate goto-label .cmd."""
    nsh = NSH.read_text(encoding="utf-8")
    nsis_dir = NSH.parent
    provision = nsh[
        nsh.index("!macro wails.provisionOpenXYOS") : nsh.index("!macro wails.openxyosFailDetail")
    ]
    assert not _filewrite_payloads(provision)
    assert "goto liveNodeOk" not in provision
    assert "extract-openxyos.cmd" not in provision
    for name in ("provision-openxyos.cmd", "start-sidecar.cmd"):
        cmd = (nsis_dir / name).read_text(encoding="utf-8")
        assert not any(line.strip().lower().startswith("goto ") for line in cmd.splitlines())
        for line in cmd.splitlines():
            token = line.strip()
            if token.endswith(":") and " " not in token and not token.startswith(":"):
                raise AssertionError(f"{name}: cmd label missing leading colon: {token!r}")


def test_nsis_does_not_register_openxyos_logon_autostart() -> None:
    nsi = NSI.read_text(encoding="utf-8-sig")
    nsh = NSH.read_text(encoding="utf-8")
    provision = nsh[
        nsh.index("!macro wails.provisionOpenXYOS") : nsh.index("!macro wails.writeUninstaller")
    ]
    assert "WriteRegStr HKCU" not in provision
    assert "schtasks.exe /Create" not in provision
    assert "schtasks.exe /Run" not in nsh
    assert "Function PersistOpenXYOS" not in nsi
    assert "开机自启" not in nsi
    uninstall = _uninstall_section(nsi)
    assert (
        'DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "FreeOS-openXYOS"'
        in uninstall
    )


def test_organization_embeds_local_openxyos_url() -> None:
    page = ORG_PAGE.read_text(encoding="utf-8")
    zh = (REPO / "dashboard" / "src" / "locales" / "zh.json").read_text(encoding="utf-8")
    assert "window.prompt" not in page
    assert "pickDesktopFolder" in page
    assert "canPickDesktopFolder" in page
    assert "resolveOpenxyosSourceDest" in page
    assert "browseSourceDest" in page
    assert "http://127.0.0.1:3780" in page
    assert "<iframe" in page
    assert "onClick={() => void startSidecar()}" not in page
    org = zh[zh.index('"organization"') : zh.index('"systemSettings"')]
    assert "启动边车" not in org
    assert "重试启动" not in org
    assert "正在打开本机 openXYOS" in org


def test_windows_folder_picker_emits_utf8_base64() -> None:
    source = (REPO / "desktop" / "src" / "folder_dialog.go").read_text(encoding="utf-8")
    assert "[System.Text.Encoding]::UTF8.GetBytes($d.SelectedPath)" in source
    assert "[Convert]::ToBase64String($bytes)" in source
    assert "decodeFolderPickerOutput" in source
    process = (REPO / "desktop" / "src" / "process.go").read_text(encoding="utf-8")
    assert "PYTHONUTF8" in process
    assert "utf-8" in process

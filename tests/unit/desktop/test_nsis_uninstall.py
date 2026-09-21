"""Windows NSIS uninstall must wipe $INSTDIR and keep the user profile home."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
NSI = REPO / "desktop" / "src" / "build" / "windows" / "nsis" / "project.nsi"
NSH = REPO / "desktop" / "src" / "build" / "windows" / "nsis" / "wails_tools.nsh"
DESKTOP_README = REPO / "desktop" / "README.md"
ORG_PAGE = REPO / "dashboard" / "src" / "pages" / "Organization" / "index.tsx"
ORG_ENTRY = REPO / "dashboard" / "src" / "pages" / "Organization" / "OrganizationEntry.tsx"
ORG_BROWSER = REPO / "dashboard" / "src" / "pages" / "Organization" / "OrgMiniBrowser.tsx"


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


def test_install_stops_running_freeos_and_invalidates_portable() -> None:
    nsi = NSI.read_text(encoding="utf-8-sig")
    nsh = NSH.read_text(encoding="utf-8")
    install = nsi[nsi.index("Section\n") : nsi.index('Section "uninstall"')]

    assert "!insertmacro wails.stopRunningFreeOSForInstall" in install
    assert "!insertmacro wails.writeInstallStamp" in install
    assert "!insertmacro wails.invalidateExtractedPortable" in install
    assert install.index("wails.stopRunningFreeOSForInstall") < install.index("wails.files")
    assert install.index("wails.files") < install.index("wails.writeInstallStamp")
    assert install.index("wails.writeInstallStamp") < install.index(
        "wails.invalidateExtractedPortable"
    )

    assert "LangString INSTALL_FREEOS_RUNNING ${LANG_SIMPCHINESE}" in nsi
    assert "LangString INSTALL_FREEOS_RUNNING ${LANG_ENGLISH}" in nsi
    assert r"%USERPROFILE%\.freeos\portable" in nsi
    assert "refresh" in nsi.lower() or "刷新" in nsi

    stop = nsh[
        nsh.index("!macro wails.stopRunningFreeOSForInstall") : nsh.index(
            "!macro wails.writeInstallStamp"
        )
    ]
    assert "wails.detectFreeOSProcesses" in stop
    assert "IfSilent" in stop
    assert "MessageBox" in stop
    assert "Abort" in stop
    assert "wails.stopFreeOSProcesses" in stop
    assert "UN_FREEOS_RUNNING" not in stop

    stamp = nsh[
        nsh.index("!macro wails.writeInstallStamp") : nsh.index(
            "!macro wails.invalidateExtractedPortable"
        )
    ]
    assert r"$INSTDIR\${INSTALL_STAMP_NAME}" in stamp
    assert "GetTickCount" in stamp
    assert "FREEOS_INSTALL_STAMP" in nsh

    invalidate = nsh[
        nsh.index("!macro wails.invalidateExtractedPortable") : nsh.index(
            "!macro wails.confirmRunningFreeOS"
        )
    ]
    assert "ReadEnvStr $R5 USERPROFILE" in invalidate
    assert r"$R5\.freeos\portable\FREEOS_STAMP" in invalidate
    assert r"$R5\.octop\portable\FREEOS_STAMP" in invalidate
    assert "FREEOS_HOME" in invalidate
    assert "OCTOP_HOME" in invalidate
    assert "octop.db" not in invalidate.lower() or "Do not delete octop.db" in invalidate
    assert "RMDir" not in invalidate
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
    assert "!insertmacro MUI_PAGE_FINISH" in nsi
    assert '!define MUI_FINISHPAGE_RUN "$INSTDIR\\${PRODUCT_EXECUTABLE}"' in nsi
    assert "!define MUI_FINISHPAGE_RUN_FUNCTION LaunchFreeOS" in nsi
    assert "!define MUI_FINISHPAGE_RUN_TEXT" in nsi
    assert "LangString FINISH_RUN ${LANG_SIMPCHINESE}" in nsi
    assert "运行 FreeOS" in nsi
    assert "!define MUI_FINISHPAGE_RUN_NOTCHECKED" not in nsi
    # Progress page must advance to Finish without an extra Next.
    assert "!define MUI_FINISHPAGE_NOAUTOCLOSE" not in nsi
    assert "AutoCloseWindow true" not in nsi
    assert "SetAutoClose true" not in nsi
    assert "Function .onInstSuccess" not in nsi
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
    assert "OPENXYOS_RUNTIME_ZIP_PRESENT" in nsh
    assert "ReadEnvStr $R6 LOCALAPPDATA" in nsh
    assert "LangString OPENXYOS_WORKDIR ${LANG_SIMPCHINESE}" in nsi
    assert "组织能力在 FreeOS 宿主内运行" in nsi
    assert "openXYOS 运行包" in nsi
    present_gate = nsh[
        nsh.index("!ifndef OPENXYOS_RUNTIME_ZIP") : nsh.index("!ifndef REQUEST_EXECUTION_LEVEL")
    ]
    assert "!if /FileExists" not in present_gate
    assert "!define OPENXYOS_RUNTIME_ZIP_PRESENT" not in present_gate
    task = (REPO / "desktop" / "src" / "build" / "windows" / "Taskfile.yml").read_text(
        encoding="utf-8"
    )
    assert "stage:openxyos-runtime" in task
    assert "maybe-stage:openxyos-runtime" in task
    assert "SHIP_OPENXYOS_RUNTIME" in task
    assert "stage_openxyos_runtime.py" in task
    package = (REPO / "desktop" / "portable" / "package.sh").read_text(encoding="utf-8")
    assert "openXYOS frontend missing" in package
    assert "SHIP_OPENXYOS_RUNTIME" in package


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
    """Setup copies an optional payload and never aborts on livez or a missing zip."""
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
    assert "nsExec::Exec $R4" not in provision
    assert "nsExec::ExecToLog $R4" not in provision
    assert "Abort" not in provision
    assert ".install-ready" not in provision
    assert "OPENXYOS_OPTIONAL_SKIP" in provision
    assert "OPENXYOS_OPTIONAL_ABSENT" in provision
    assert 'File "/oname=openxyos-runtime.zip"' in provision
    assert "OPENXYOS_RUNTIME_ZIP_PRESENT is set but" in provision
    create_dir = provision.index('CreateDirectory "$INSTDIR\\openxyos"')
    ifdef = provision.index("!ifdef OPENXYOS_RUNTIME_ZIP_PRESENT")
    absent = provision.index("OPENXYOS_OPTIONAL_ABSENT")
    assert ifdef < create_dir < absent
    assert "CreateDirectory" not in provision[absent:]
    assert "openxyos-runtime.zip missing" not in nsh
    assert "安装继续" in nsi
    assert "Setup continues" in nsi
    assert "开机自启" not in nsi
    assert "PersistOpenXYOS" not in nsi
    assert "PersistOpenXYOS" not in nsh
    assert "Call PersistOpenXYOS" not in nsh
    workflow = (REPO / ".github" / "workflows" / "octop-desktop.yml").read_text(encoding="utf-8")
    assert 'SKIP_ORG_SIDECAR: "0"' in workflow
    assert "SHIP_OPENXYOS_RUNTIME=1" in workflow
    assert "transitional" in workflow.lower()
    assert "org-sidecar/openxyos/dist/index.html" not in workflow
    assert "org-sidecar/openxyos/backend/server.ts" not in workflow


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
    assert "does **not** auto-launch" in text or "does not auto-launch" in text
    assert "portable.previous" in text
    assert "in place" in text
    assert "FREEOS_INSTALL_STAMP" in text
    assert "FREEOS_STAMP" in text
    assert "%USERPROFILE%\\.freeos\\portable" in text
    assert "%LOCALAPPDATA%\\FreeOS\\openxyos" in text
    assert "127.0.0.1:3780" in text
    assert "tar.exe" in text
    assert "README-only" in text
    assert "folder picker" in text
    assert "FREEOS_ORG_SIDECAR=1" in text
    assert "SHIP_OPENXYOS_RUNTIME=1" in text
    assert "in-host" in text.lower() or "in-host" in text
    assert "does not extract" in text.lower() or "does not" in text.lower()


def test_desktop_metadata_is_single_runtime() -> None:
    config = (REPO / "desktop" / "src" / "build" / "config.yml").read_text(encoding="utf-8")
    info = (REPO / "desktop" / "src" / "build" / "windows" / "info.json").read_text(
        encoding="utf-8"
    )
    assert "in-host organization" in config
    assert "FREEOS_ORG_SIDECAR=1" in config
    assert "openXYOS sidecar" not in config
    assert "Octop shell + openXYOS" not in config
    assert "Octop shell + openXYOS" not in info
    assert "in-host organization" in info


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
    assert not ORG_PAGE.exists()
    entry = ORG_ENTRY.read_text(encoding="utf-8")
    browser = ORG_BROWSER.read_text(encoding="utf-8")
    zh = (REPO / "dashboard" / "src" / "locales" / "zh.json").read_text(encoding="utf-8")
    assert 'data-testid="org-openxyos-frame"' in entry
    assert "/organization-app/dashboard?freeos_embed=1" in entry
    assert 'data-testid="org-native-workbench"' not in entry
    assert 'data-testid="org-assemble"' not in entry
    assert 'data-testid="org-pack"' not in entry
    assert 'data-testid="org-loop"' not in entry
    assert "打开原 App" not in entry
    assert "org-mini-browser" in browser
    org = zh[zh.index('"organization"') : zh.index('"systemSettings"')]
    assert "打开原 App（过渡）" not in org
    assert "启动边车" not in org
    assert "重试启动" not in org
    assert "宿主内组织已就绪" in org


def test_windows_folder_picker_emits_utf8_base64() -> None:
    source = (REPO / "desktop" / "src" / "folder_dialog.go").read_text(encoding="utf-8")
    assert "[System.Text.Encoding]::UTF8.GetBytes($d.SelectedPath)" in source
    assert "[Convert]::ToBase64String($bytes)" in source
    assert "decodeFolderPickerOutput" in source
    process = (REPO / "desktop" / "src" / "process.go").read_text(encoding="utf-8")
    assert "PYTHONUTF8" in process
    assert "utf-8" in process

Unicode true

# FreeOS desktop NSIS installer.
# Built by `wails3 task package` on a Windows runner:
#   makensis -INPUTCHARSET UTF8 -DARG_WAILS_AMD64_BINARY=..\..\..\bin\FreeOS.exe project.nsi
#   makensis -INPUTCHARSET UTF8 -DARG_WAILS_ARM64_BINARY=..\..\..\bin\FreeOS.exe project.nsi
#
# Unicode true makes a Unicode installer; it does NOT change how this .nsi is
# decoded. GitHub windows-latest is en-US (ACP = CP1252). Without a UTF-8 BOM
# and -INPUTCHARSET UTF8, LangString 运行 becomes the finish-page mojibake
# "è¿è¡Œ FreeOS". Keep this file UTF-8 with BOM.

!include "wails_tools.nsh"

SetCompressor /SOLID lzma

# The version information for this two must consist of 4 parts
VIProductVersion "${INFO_PRODUCTVERSION}.0"
VIFileVersion    "${INFO_PRODUCTVERSION}.0"

VIAddVersionKey "CompanyName"     "${INFO_COMPANYNAME}"
VIAddVersionKey "FileDescription" "${INFO_PRODUCTNAME} Installer"
VIAddVersionKey "ProductVersion"  "${INFO_PRODUCTVERSION}"
VIAddVersionKey "FileVersion"     "${INFO_PRODUCTVERSION}"
VIAddVersionKey "LegalCopyright"  "${INFO_COPYRIGHT}"
VIAddVersionKey "ProductName"     "${INFO_PRODUCTNAME}"

ManifestDPIAware true

!include "MUI.nsh"

!define MUI_ICON "..\icon.ico"
!define MUI_UNICON "..\icon.ico"
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_ABORTWARNING
# Checkbox is shown only when MUI_FINISHPAGE_RUN is set. Leave the
# "not checked" finish-page flag undefined so the box stays on.
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXECUTABLE}"
!define MUI_FINISHPAGE_RUN_TEXT "$(FINISH_RUN)"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchFreeOS

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_RESERVEFILE_LANGDLL

LangString FINISH_RUN ${LANG_SIMPCHINESE} "运行 FreeOS"
LangString FINISH_RUN ${LANG_ENGLISH} "Run FreeOS"
LangString OPENXYOS_COPY_ZIP ${LANG_SIMPCHINESE} "复制 openXYOS 密封运行包与独立预配置程序"
LangString OPENXYOS_COPY_ZIP ${LANG_ENGLISH} "Copy the sealed openXYOS runtime zip and the independent provisioner"
LangString OPENXYOS_PROVISION ${LANG_SIMPCHINESE} "正在启动独立的 openXYOS 预配置进程（解压、部署并启动前端/后端）"
LangString OPENXYOS_PROVISION ${LANG_ENGLISH} "Starting the independent openXYOS provision process (extract, deploy, start frontend/backend)"
LangString OPENXYOS_PROVISION_OK ${LANG_SIMPCHINESE} "openXYOS 预配置成功：本机运行环境已就绪，服务已启动，健康检查通过"
LangString OPENXYOS_PROVISION_OK ${LANG_ENGLISH} "openXYOS provision succeeded: runtime on disk, services up, health check passed"
LangString OPENXYOS_PROVISION_CODE ${LANG_SIMPCHINESE} "openXYOS 预配置退出码 "
LangString OPENXYOS_PROVISION_CODE ${LANG_ENGLISH} "openXYOS provisioner exit code "
LangString OPENXYOS_PROVISION_TIMEOUT ${LANG_SIMPCHINESE} "独立的 openXYOS 预配置进程没有返回退出码。请查看 %LOCALAPPDATA%\\FreeOS\\openxyos\\provision.log，或重新运行安装目录中的 openxyos-provision.ps1。"
LangString OPENXYOS_PROVISION_TIMEOUT ${LANG_ENGLISH} "The independent openXYOS provisioner did not return an exit code. See %LOCALAPPDATA%\\FreeOS\\openxyos\\provision.log, or re-run openxyos-provision.ps1 from the install folder."
LangString OPENXYOS_PROVISION_FAIL ${LANG_SIMPCHINESE} "openXYOS 预配置失败。这是独立预配置进程的失败，不是 FreeOS 外壳拷贝失败。请查看 %LOCALAPPDATA%\\FreeOS\\openxyos\\provision.log 里的阶段（extract / start / livez）并重试该进程；不要只把原因归为「检查 3780 端口」。"
LangString OPENXYOS_PROVISION_FAIL ${LANG_ENGLISH} "openXYOS provision failed. This is a failure of the independent provision process, not the FreeOS shell copy. Read the stage (extract / start / livez) in %LOCALAPPDATA%\\FreeOS\\openxyos\\provision.log and retry that process; do not treat this as a generic port-3780 check."
LangString OPENXYOS_AUTOSTART ${LANG_SIMPCHINESE} "预配置进程会登记本机 openXYOS 常驻启动（登录后自动拉起，无需「启动边车」）"
LangString OPENXYOS_AUTOSTART ${LANG_ENGLISH} "The provisioner registers persistent openXYOS auto-start (logon; no Start sidecar click)"
LangString UN_FREEOS_RUNNING ${LANG_SIMPCHINESE} "检测到 FreeOS 仍在运行（主程序、主机或组织侧车）。$\r$\n$\r$\n继续将结束这些进程，并删除安装目录中的程序文件。$\r$\n用户数据（%USERPROFILE%\.freeos）会保留。$\r$\n$\r$\n要继续卸载吗？"
LangString UN_FREEOS_RUNNING ${LANG_ENGLISH} "FreeOS is still running (shell, host, or organization sidecar).$\r$\n$\r$\nContinuing will stop those processes and remove program files from the install folder.$\r$\nUser data (%USERPROFILE%\.freeos) is kept.$\r$\n$\r$\nContinue uninstall?"

Name "${INFO_PRODUCTNAME}"
!ifndef INSTALLER_OUTFILE
    !define INSTALLER_OUTFILE "..\..\..\bin\${INFO_PROJECTNAME}-desktop-windows-${ARCH}-${INFO_PRODUCTVERSION}.exe"
!endif
OutFile "${INSTALLER_OUTFILE}"
!if "${WAILS_INSTALL_SCOPE}" == "user"
    InstallDir "$LOCALAPPDATA\Programs\${INFO_PRODUCTNAME}"
!else
    InstallDir "$PROGRAMFILES64\${INFO_PRODUCTNAME}"
!endif
ShowInstDetails show

Function .onInit
    IfSilent skipLang
    !insertmacro MUI_LANGDLL_DISPLAY
    skipLang:
    !insertmacro wails.checkArchitecture
FunctionEnd

Function un.onInit
    !insertmacro wails.confirmRunningFreeOS
FunctionEnd

Section
    !insertmacro wails.setShellContext

    !insertmacro wails.webview2runtime

    SetOutPath $INSTDIR

    !insertmacro wails.files

    # SetOutPath becomes the shortcut WorkingDirectory. Pin it again so
    # WebView2's plugin dir cannot leak into Start in:.
    SetOutPath "$INSTDIR"
    CreateShortCut "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}" "" "$INSTDIR\${PRODUCT_EXECUTABLE}" 0 SW_SHOWNORMAL
    CreateShortCut "$DESKTOP\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}" "" "$INSTDIR\${PRODUCT_EXECUTABLE}" 0 SW_SHOWNORMAL

    !insertmacro wails.associateFiles
    !insertmacro wails.associateCustomProtocols

    !insertmacro wails.writeUninstaller

    # FreeOS shell files + shortcuts are done. openXYOS is an independent
    # provision process: extract + start FE/BE + livez. Failure aborts Setup.
    !insertmacro wails.provisionOpenXYOS
SectionEnd

Section "uninstall"
    !insertmacro wails.setShellContext
    ; Processes were already confirmed + stopped in un.onInit when present.

    ; Program-owned WebView2 / Wails cache + install-time live openXYOS tree.
    ; Not FREEOS_HOME / OCTOP_HOME user data. $LOCALAPPDATA after SetShellVarContext
    ; all is ProgramData; also wipe the installing user's LocalAppData.
    !insertmacro wails.userLocalAppData
    RMDir /r "$AppData\${PRODUCT_EXECUTABLE}"
    RMDir /r "$LOCALAPPDATA\${PRODUCT_EXECUTABLE}.WebView2"
    RMDir /r "$LOCALAPPDATA\${INFO_PRODUCTNAME}"
    RMDir /r "$R6\${PRODUCT_EXECUTABLE}.WebView2"
    RMDir /r "$R6\${INFO_PRODUCTNAME}"

    Delete "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk"
    Delete "$DESKTOP\${INFO_PRODUCTNAME}.lnk"
    Delete "$SMSTARTUP\${INFO_PRODUCTNAME}.lnk"

    SetRegView 64
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${INFO_PRODUCTNAME}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${INFO_PROJECTNAME}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "FreeOS-openXYOS"
    nsExec::ExecToLog 'schtasks.exe /Delete /TN "FreeOS-openXYOS" /F'
    Pop $0
    nsExec::ExecToLog 'schtasks.exe /Delete /TN "FreeOS-openXYOS-provision" /F'
    Pop $0

    !insertmacro wails.unassociateFiles
    !insertmacro wails.unassociateCustomProtocols

    !insertmacro wails.deleteUninstaller
    !insertmacro wails.wipeInstallDir
SectionEnd

# Launch openxyos-provision.ps1 as the unelevated user. An admin
# CreateProcess would High-integrity ~/.freeos and Node; Organization
# would then look broken even if the shell copy succeeded.
Function LaunchOpenXYOSProvision
    !insertmacro wails.userLocalAppData
    Delete "$R6\FreeOS\openxyos\.provision-exit"
    Delete "$R6\FreeOS\openxyos\.provision-running"
    Delete "$R6\FreeOS\openxyos\.install-ready"
    Delete "$TEMP\FreeOS-openxyos-provision.exit"
    !if "${WAILS_INSTALL_SCOPE}" == "user"
        nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\openxyos-provision.ps1"'
        Pop $0
    !else
        System::Call "ole32::CoInitialize(i 0)"
        System::Call 'ole32::CoCreateInstance(g "{13709620-C279-11CE-A49E-444553540000}",i 0,i 1,g "{A4C6892C-3BA9-11d2-9DEA-00C04FB16162}",*i .r0) i .r1'
        ${If} $1 == 0
        ${AndIf} $0 != 0
            System::Call '$0->31(w "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe", w "-NoProfile -ExecutionPolicy Bypass -File $\"$INSTDIR\openxyos-provision.ps1\"", w "$INSTDIR", w "open", i 0)'
            System::Call "$0->2()"
        ${Else}
            nsExec::ExecToLog 'schtasks.exe /Create /TN "FreeOS-openXYOS-provision" /SC ONCE /ST 00:00 /RL LIMITED /F /TR "\"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe\" -NoProfile -ExecutionPolicy Bypass -File \"$INSTDIR\openxyos-provision.ps1\""'
            Pop $0
            nsExec::ExecToLog 'schtasks.exe /Run /TN "FreeOS-openXYOS-provision"'
            Pop $0
            Exec '"$WINDIR\explorer.exe" "$INSTDIR\openxyos-provision.cmd"'
        ${EndIf}
    !endif
FunctionEnd

# Poll the provisioner's sentinel. 0 + .install-ready is success.
# Any other outcome aborts Setup (do not soft-skip livez).
Function WaitOpenXYOSProvision
    !insertmacro wails.userLocalAppData
    StrCpy $R8 "0"
    oxProvWait:
        IfFileExists "$R6\FreeOS\openxyos\.provision-exit" oxProvReadLive
        IfFileExists "$TEMP\FreeOS-openxyos-provision.exit" oxProvReadTemp
        IntOp $R8 $R8 + 1
        IntCmp $R8 240 oxProvTimeout 0 oxProvTimeout
        IntCmp $R8 45 oxProvCheckLaunch oxProvSleep oxProvSleep
        oxProvCheckLaunch:
            IfFileExists "$R6\FreeOS\openxyos\.provision-running" oxProvSleep
            IfFileExists "$R6\FreeOS\openxyos\.provision-exit" oxProvReadLive
            IfFileExists "$TEMP\FreeOS-openxyos-provision.exit" oxProvReadTemp
            DetailPrint "$(OPENXYOS_PROVISION_TIMEOUT)"
            SetErrorLevel 68
            Goto oxProvFail
        oxProvSleep:
            Sleep 1000
            Goto oxProvWait
    oxProvReadLive:
        FileOpen $0 "$R6\FreeOS\openxyos\.provision-exit" r
        FileRead $0 $1
        FileClose $0
        Goto oxProvGotCode
    oxProvReadTemp:
        FileOpen $0 "$TEMP\FreeOS-openxyos-provision.exit" r
        FileRead $0 $1
        FileClose $0
    oxProvGotCode:
        ${TrimNewLines} $1 $1
        DetailPrint "$(OPENXYOS_PROVISION_CODE)$1"
        IntCmp $1 0 oxProvOk oxProvFailCode oxProvFailCode
    oxProvFailCode:
        ${If} $1 == 2
        ${OrIf} $1 == 3
        ${OrIf} $1 == 5
        ${OrIf} $1 == 6
        ${OrIf} $1 == 7
            SetErrorLevel 67
        ${Else}
            SetErrorLevel 68
        ${EndIf}
        Goto oxProvFail
    oxProvOk:
        IfFileExists "$R6\FreeOS\openxyos\.install-ready" oxProvReady
        DetailPrint "$(OPENXYOS_PROVISION_FAIL)"
        SetErrorLevel 68
        Goto oxProvFail
    oxProvReady:
        DetailPrint "$(OPENXYOS_PROVISION_OK)"
        Return
    oxProvTimeout:
        DetailPrint "$(OPENXYOS_PROVISION_TIMEOUT)"
        SetErrorLevel 68
    oxProvFail:
        DetailPrint "$(OPENXYOS_PROVISION_FAIL)"
        IfSilent oxProvSilent oxProvLoud
        oxProvSilent:
            Abort
        oxProvLoud:
            MessageBox MB_OK|MB_ICONSTOP "$(OPENXYOS_PROVISION_FAIL)"
            Abort
FunctionEnd

Function LaunchFreeOS
    SetOutPath "$INSTDIR"
    ; Installer is admin. Exec/CreateProcess inherits that token and the
    ; first run would write ~/.freeos + WebView2 as High integrity — a later
    ; unelevated shortcut click then does nothing. IShellDispatch2 runs as
    ; the explorer (medium IL) token. Working directory stays $INSTDIR.
    System::Call "ole32::CoInitialize(i 0)"
    System::Call 'ole32::CoCreateInstance(g "{13709620-C279-11CE-A49E-444553540000}",i 0,i 1,g "{A4C6892C-3BA9-11d2-9DEA-00C04FB16162}",*i .r0) i .r1'
    ${If} $1 == 0
    ${AndIf} $0 != 0
        System::Call '$0->31(w "$INSTDIR\${PRODUCT_EXECUTABLE}", w "", w "$INSTDIR", w "open", i 1)'
        System::Call "$0->2()"
    ${Else}
        Exec '"$WINDIR\explorer.exe" "$INSTDIR\${PRODUCT_EXECUTABLE}"'
    ${EndIf}
FunctionEnd

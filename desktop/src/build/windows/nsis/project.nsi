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
LangString OPENXYOS_WORKDIR ${LANG_SIMPCHINESE} "创建 openXYOS 工作目录（写入 %LOCALAPPDATA%\\FreeOS\\openxyos）"
LangString OPENXYOS_WORKDIR ${LANG_ENGLISH} "Create the openXYOS work directory (%LOCALAPPDATA%\\FreeOS\\openxyos)"
LangString OPENXYOS_COPY_ZIP ${LANG_SIMPCHINESE} "复制 openXYOS 运行包（前端+后端）与预配子进程"
LangString OPENXYOS_COPY_ZIP ${LANG_ENGLISH} "Copy the openXYOS runtime payload and provisioner subprocess"
LangString OPENXYOS_PROVISION ${LANG_SIMPCHINESE} "正在以子进程部署 openXYOS（解压、启动前后端、等待健康检查）"
LangString OPENXYOS_PROVISION ${LANG_ENGLISH} "Running the openXYOS provisioner subprocess (extract, start FE/BE, wait for health)"
LangString OPENXYOS_PROVISION_DETAIL ${LANG_SIMPCHINESE} "完整日志：%LOCALAPPDATA%\\FreeOS\\openxyos\\provision.log（UTF-8）；此处只显示步骤结果"
LangString OPENXYOS_PROVISION_DETAIL ${LANG_ENGLISH} "Full log: %LOCALAPPDATA%\\FreeOS\\openxyos\\provision.log (UTF-8); this list shows step results only"
LangString OPENXYOS_PROVISION_CODE ${LANG_SIMPCHINESE} "openXYOS 预配子进程退出码 "
LangString OPENXYOS_PROVISION_CODE ${LANG_ENGLISH} "openXYOS provisioner subprocess exit code "
LangString OPENXYOS_PROVISION_OK ${LANG_SIMPCHINESE} "本机 openXYOS 已就绪（http://127.0.0.1:3780 健康检查通过）"
LangString OPENXYOS_PROVISION_OK ${LANG_ENGLISH} "Local openXYOS is ready (http://127.0.0.1:3780 health check passed)"
LangString OPENXYOS_PROVISION_RETRY ${LANG_SIMPCHINESE} "正在重试 openXYOS 预配子进程"
LangString OPENXYOS_PROVISION_RETRY ${LANG_ENGLISH} "Retrying the openXYOS provisioner subprocess"
LangString OPENXYOS_PROVISION_FAIL ${LANG_SIMPCHINESE} "安装失败：openXYOS 预配未完成。"
LangString OPENXYOS_PROVISION_FAIL ${LANG_ENGLISH} "Setup failed: openXYOS provisioning did not finish."
LangString OPENXYOS_FAIL_ZIP ${LANG_SIMPCHINESE} "找不到 openXYOS 运行包（openxyos-runtime.zip）。请重新下载安装包。"
LangString OPENXYOS_FAIL_ZIP ${LANG_ENGLISH} "The openXYOS runtime zip (openxyos-runtime.zip) is missing. Download the installer again."
LangString OPENXYOS_FAIL_EXTRACT ${LANG_SIMPCHINESE} "用 tar.exe 解压 openXYOS 到本机工作目录失败。请查看 provision.log。"
LangString OPENXYOS_FAIL_EXTRACT ${LANG_ENGLISH} "tar.exe could not extract openXYOS into the live workdir. See provision.log."
LangString OPENXYOS_FAIL_TAR ${LANG_SIMPCHINESE} "系统缺少 tar.exe（Windows 10 自带）。无法解压运行包。"
LangString OPENXYOS_FAIL_TAR ${LANG_ENGLISH} "tar.exe is missing (shipped with Windows 10). Cannot extract the runtime."
LangString OPENXYOS_FAIL_NODE ${LANG_SIMPCHINESE} "解压后缺少 bundled Node（node\\node.exe）。安装包不完整。"
LangString OPENXYOS_FAIL_NODE ${LANG_ENGLISH} "Bundled Node (node\\node.exe) is missing after extract. The package is incomplete."
LangString OPENXYOS_FAIL_FE ${LANG_SIMPCHINESE} "解压后缺少前端（dist\\index.html）。安装包不完整。"
LangString OPENXYOS_FAIL_FE ${LANG_ENGLISH} "Frontend (dist\\index.html) is missing after extract. The package is incomplete."
LangString OPENXYOS_FAIL_START ${LANG_SIMPCHINESE} "未能以当前用户启动 openXYOS，或 Node 启动后立即退出。请查看 %LOCALAPPDATA%\\FreeOS\\openxyos\\start.log 与 provision.log。"
LangString OPENXYOS_FAIL_START ${LANG_ENGLISH} "Could not start openXYOS as the current user, or Node exited immediately. See %LOCALAPPDATA%\\FreeOS\\openxyos\\start.log and provision.log."
LangString OPENXYOS_FAIL_LIVEZ ${LANG_SIMPCHINESE} "openXYOS 已尝试启动，但健康检查未通过。请查看 %LOCALAPPDATA%\\FreeOS\\openxyos\\provision.log 中的启动记录，而不是先假设 3780 端口被占用。"
LangString OPENXYOS_FAIL_LIVEZ ${LANG_ENGLISH} "openXYOS was started but the health check did not pass. See %LOCALAPPDATA%\\FreeOS\\openxyos\\provision.log for the start record; do not assume port 3780 is the cause."
LangString OPENXYOS_FAIL_MARKER ${LANG_SIMPCHINESE} "健康检查已通过，但未能写入 .install-ready。"
LangString OPENXYOS_FAIL_MARKER ${LANG_ENGLISH} "Health check passed, but .install-ready could not be written."
LangString OPENXYOS_FAIL_UNKNOWN ${LANG_SIMPCHINESE} "openXYOS 预配子进程失败。请查看 provision.log 中的具体步骤（解压 / 启动 / 健康检查）。"
LangString OPENXYOS_FAIL_UNKNOWN ${LANG_ENGLISH} "The openXYOS provisioner subprocess failed. See provision.log for the extract / start / health-check step."
LangString OPENXYOS_FAIL_CODE ${LANG_SIMPCHINESE} "退出码 "
LangString OPENXYOS_FAIL_CODE ${LANG_ENGLISH} "Exit code "
LangString OPENXYOS_FAIL_LOG ${LANG_SIMPCHINESE} "详细日志：%LOCALAPPDATA%\\FreeOS\\openxyos\\start.log 与 provision.log"
LangString OPENXYOS_FAIL_LOG ${LANG_ENGLISH} "Logs: %LOCALAPPDATA%\\FreeOS\\openxyos\\start.log and provision.log"
LangString UN_FREEOS_RUNNING ${LANG_SIMPCHINESE} "检测到 FreeOS 仍在运行（主程序、主机或本机 openXYOS）。$\r$\n$\r$\n继续将结束这些进程，并删除安装目录中的程序文件。$\r$\n用户数据（%USERPROFILE%\.freeos）会保留。$\r$\n$\r$\n要继续卸载吗？"
LangString UN_FREEOS_RUNNING ${LANG_ENGLISH} "FreeOS is still running (shell, host, or local openXYOS).$\r$\n$\r$\nContinuing will stop those processes and remove program files from the install folder.$\r$\nUser data (%USERPROFILE%\.freeos) is kept.$\r$\n$\r$\nContinue uninstall?"

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
    ; Older installers registered logon autostart; this build does not.
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "FreeOS-openXYOS"
    nsExec::ExecToLog 'schtasks.exe /Delete /TN "FreeOS-openXYOS" /F'
    Pop $0

    !insertmacro wails.unassociateFiles
    !insertmacro wails.unassociateCustomProtocols

    !insertmacro wails.deleteUninstaller
    !insertmacro wails.wipeInstallDir
SectionEnd

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

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
LangString OPENXYOS_WORKDIR ${LANG_SIMPCHINESE} "创建 openXYOS 工作目录（写入 %LOCALAPPDATA%\\FreeOS\\openxyos，安装期完成部署）"
LangString OPENXYOS_WORKDIR ${LANG_ENGLISH} "Create the openXYOS work directory (%LOCALAPPDATA%\\FreeOS\\openxyos; deploy during Setup)"
LangString OPENXYOS_COPY_ZIP ${LANG_SIMPCHINESE} "复制 openXYOS 运行包（前端+后端）"
LangString OPENXYOS_COPY_ZIP ${LANG_ENGLISH} "Copy the openXYOS runtime payload (frontend + backend)"
LangString OPENXYOS_EXTRACT ${LANG_SIMPCHINESE} "解压 openXYOS 前端与后端到 %LOCALAPPDATA%\\FreeOS\\openxyos"
LangString OPENXYOS_EXTRACT ${LANG_ENGLISH} "Extract openXYOS frontend and backend into %LOCALAPPDATA%\\FreeOS\\openxyos"
LangString OPENXYOS_FE_OK ${LANG_SIMPCHINESE} "已就绪：%LOCALAPPDATA%\\FreeOS\\openxyos\\dist\\index.html"
LangString OPENXYOS_FE_OK ${LANG_ENGLISH} "Ready: %LOCALAPPDATA%\\FreeOS\\openxyos dist\\index.html"
LangString OPENXYOS_NODE_OK ${LANG_SIMPCHINESE} "已就绪：bundled Node（node.exe）"
LangString OPENXYOS_NODE_OK ${LANG_ENGLISH} "Ready: bundled Node (node.exe)"
LangString OPENXYOS_STAGED_OK ${LANG_SIMPCHINESE} "已从 openxyos-runtime 备份展开到本机工作目录"
LangString OPENXYOS_STAGED_OK ${LANG_ENGLISH} "Expanded the sealed runtime backup into the live workdir"
LangString OPENXYOS_EXTRACT_CODE ${LANG_SIMPCHINESE} "解压结束，退出码 "
LangString OPENXYOS_EXTRACT_CODE ${LANG_ENGLISH} "Extract finished, exit code "
LangString OPENXYOS_EXTRACT_FAIL ${LANG_SIMPCHINESE} "安装失败：未能把完整的 openXYOS 运行环境解压到 %LOCALAPPDATA%\\FreeOS\\openxyos（需要 node\\node.exe 与 dist\\index.html）。请重新下载安装包。"
LangString OPENXYOS_EXTRACT_FAIL ${LANG_ENGLISH} "Setup failed: could not extract a complete openXYOS runtime into %LOCALAPPDATA%\\FreeOS\\openxyos (need node\\node.exe and dist\\index.html). Download the installer again."
LangString OPENXYOS_PROBE ${LANG_SIMPCHINESE} "正在启动本机 openXYOS 并检查 http://127.0.0.1:3780/api/health/livez"
LangString OPENXYOS_PROBE ${LANG_ENGLISH} "Starting local openXYOS and checking http://127.0.0.1:3780/api/health/livez"
LangString OPENXYOS_PROBE_OK ${LANG_SIMPCHINESE} "openXYOS 已通过安装期健康检查，首次打开无需再解压"
LangString OPENXYOS_PROBE_OK ${LANG_ENGLISH} "openXYOS passed the install-time health check; first launch will not unpack"
LangString OPENXYOS_PROBE_FAIL ${LANG_SIMPCHINESE} "安装失败：已解压 openXYOS，但 http://127.0.0.1:3780/api/health/livez 未就绪。请检查 3780 端口占用后重试安装。"
LangString OPENXYOS_PROBE_FAIL ${LANG_ENGLISH} "Setup failed: openXYOS is on disk but http://127.0.0.1:3780/api/health/livez did not become ready. Free port 3780 and run Setup again."
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

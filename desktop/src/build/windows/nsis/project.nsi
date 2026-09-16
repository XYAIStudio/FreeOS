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
LangString OPENXYOS_WORKDIR ${LANG_SIMPCHINESE} "创建 openXYOS 工作目录（安装目录与 %LOCALAPPDATA%\\FreeOS\\openxyos）"
LangString OPENXYOS_WORKDIR ${LANG_ENGLISH} "Create the openXYOS work directory (install dir and %LOCALAPPDATA%\\FreeOS\\openxyos)"
LangString OPENXYOS_COPY_ZIP ${LANG_SIMPCHINESE} "复制 openXYOS 运行包（前端+后端）"
LangString OPENXYOS_COPY_ZIP ${LANG_ENGLISH} "Copy the openXYOS runtime payload (frontend + backend)"
LangString OPENXYOS_EXTRACT ${LANG_SIMPCHINESE} "解压 openXYOS 前端与后端到安装目录\\openxyos"
LangString OPENXYOS_EXTRACT ${LANG_ENGLISH} "Extract openXYOS frontend and backend into the install dir\\openxyos"
LangString OPENXYOS_FE_OK ${LANG_SIMPCHINESE} "已就绪：openxyos\\dist\\index.html"
LangString OPENXYOS_FE_OK ${LANG_ENGLISH} "Ready: openxyos\\dist\\index.html"
LangString OPENXYOS_FE_MISSING ${LANG_SIMPCHINESE} "警告：未找到 openXYOS 前端构建，首次启动将再试"
LangString OPENXYOS_FE_MISSING ${LANG_ENGLISH} "Warning: openXYOS frontend build missing; first launch will retry"
LangString OPENXYOS_NODE_OK ${LANG_SIMPCHINESE} "已就绪：bundled Node（node.exe）"
LangString OPENXYOS_NODE_OK ${LANG_ENGLISH} "Ready: bundled Node (node.exe)"
LangString OPENXYOS_NODE_MISSING ${LANG_SIMPCHINESE} "警告：未找到 bundled Node，首次启动将再试"
LangString OPENXYOS_NODE_MISSING ${LANG_ENGLISH} "Warning: bundled Node missing; first launch will retry"
LangString OPENXYOS_ZIP_MISSING ${LANG_SIMPCHINESE} "安装包未含独立 openXYOS zip；首次启动会从内置 portable 解压"
LangString OPENXYOS_ZIP_MISSING ${LANG_ENGLISH} "Installer has no separate openXYOS zip; first launch unpacks the bundled portable"
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

    ; Program-owned WebView2 / Wails cache — not FREEOS_HOME user data.
    RMDir /r "$AppData\${PRODUCT_EXECUTABLE}"
    RMDir /r "$LOCALAPPDATA\${PRODUCT_EXECUTABLE}.WebView2"
    RMDir /r "$LOCALAPPDATA\${INFO_PRODUCTNAME}"

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

Unicode true

# FreeOS desktop NSIS installer.
# Built by `wails3 task package` on a Windows runner:
#   makensis -DARG_WAILS_AMD64_BINARY=..\..\..\bin\FreeOS.exe project.nsi
#   makensis -DARG_WAILS_ARM64_BINARY=..\..\..\bin\FreeOS.exe project.nsi

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

    # SetOutPath becomes the shortcut working directory. Pin it again so
    # WebView2's plugin dir cannot leak into Start in:.
    SetOutPath $INSTDIR
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
    Exec '"$INSTDIR\${PRODUCT_EXECUTABLE}"'
FunctionEnd

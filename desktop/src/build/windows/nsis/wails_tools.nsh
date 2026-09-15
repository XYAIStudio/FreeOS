# Shared NSIS helpers for the FreeOS desktop installer.
# INFO_PRODUCTVERSION fallback for a local makensis without -D.
# Release packaging passes -DINFO_PRODUCTVERSION from pyproject.toml.

!include "x64.nsh"
!include "WinVer.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

!ifndef INFO_PROJECTNAME
    !define INFO_PROJECTNAME "FreeOS"
!endif
!ifndef INFO_COMPANYNAME
    !define INFO_COMPANYNAME "XYAI Studio"
!endif
!ifndef INFO_PRODUCTNAME
    !define INFO_PRODUCTNAME "FreeOS"
!endif
!ifndef INFO_PRODUCTVERSION
    !define INFO_PRODUCTVERSION "0.0.1"
!endif
!ifndef INFO_COPYRIGHT
    !define INFO_COPYRIGHT "(c) 2026, XYAI Studio"
!endif
!ifndef PRODUCT_EXECUTABLE
    !define PRODUCT_EXECUTABLE "${INFO_PROJECTNAME}.exe"
!endif
!ifndef UNINST_KEY_NAME
    !define UNINST_KEY_NAME "${INFO_COMPANYNAME}${INFO_PRODUCTNAME}"
!endif
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINST_KEY_NAME}"

!ifndef WAILS_INSTALL_SCOPE
    !define WAILS_INSTALL_SCOPE "machine"
!endif

!ifndef REQUEST_EXECUTION_LEVEL
    !if "${WAILS_INSTALL_SCOPE}" == "user"
        !define REQUEST_EXECUTION_LEVEL "user"
    !else
        !define REQUEST_EXECUTION_LEVEL "admin"
    !endif
!endif

RequestExecutionLevel "${REQUEST_EXECUTION_LEVEL}"

!ifdef ARG_WAILS_AMD64_BINARY
    !define SUPPORTS_AMD64
!endif

!ifdef ARG_WAILS_ARM64_BINARY
    !define SUPPORTS_ARM64
!endif

!ifdef SUPPORTS_AMD64
    !ifdef SUPPORTS_ARM64
        !define ARCH "amd64_arm64"
    !else
        !define ARCH "amd64"
    !endif
!else
    !ifdef SUPPORTS_ARM64
        !define ARCH "arm64"
    !else
        !error "Undefined ARCH, please provide ARG_WAILS_AMD64_BINARY or ARG_WAILS_ARM64_BINARY"
    !endif
!endif

!macro wails.checkArchitecture
    !ifndef WAILS_WIN10_REQUIRED
        !define WAILS_WIN10_REQUIRED "This product is only supported on Windows 10 (Server 2016) and later."
    !endif

    !ifndef WAILS_ARCHITECTURE_NOT_SUPPORTED
        !define WAILS_ARCHITECTURE_NOT_SUPPORTED "This product can't be installed on the current Windows architecture. Supports: ${ARCH}"
    !endif

    ${If} ${AtLeastWin10}
        !ifdef SUPPORTS_AMD64
            ${if} ${IsNativeAMD64}
                Goto ok
            ${EndIf}
        !endif

        !ifdef SUPPORTS_ARM64
            ${if} ${IsNativeARM64}
                Goto ok
            ${EndIf}
        !endif

        IfSilent silentArch notSilentArch
        silentArch:
            SetErrorLevel 65
            Abort
        notSilentArch:
            MessageBox MB_OK "${WAILS_ARCHITECTURE_NOT_SUPPORTED}"
            Quit
    ${else}
        IfSilent silentWin notSilentWin
        silentWin:
            SetErrorLevel 64
            Abort
        notSilentWin:
            MessageBox MB_OK "${WAILS_WIN10_REQUIRED}"
            Quit
    ${EndIf}

    ok:
!macroend

!macro wails.files
    !ifdef SUPPORTS_AMD64
        ${if} ${IsNativeAMD64}
            File "/oname=${PRODUCT_EXECUTABLE}" "${ARG_WAILS_AMD64_BINARY}"
        ${EndIf}
    !endif

    !ifdef SUPPORTS_ARM64
        ${if} ${IsNativeARM64}
            File "/oname=${PRODUCT_EXECUTABLE}" "${ARG_WAILS_ARM64_BINARY}"
        ${EndIf}
    !endif
!macroend

!macro wails.writeUninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"

    SetRegView 64
    !if "${WAILS_INSTALL_SCOPE}" == "user"
        WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${INFO_COMPANYNAME}"
        WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${INFO_PRODUCTNAME}"
        WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${INFO_PRODUCTVERSION}"
        WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXECUTABLE}"
        WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
        WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"

        ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
        IntFmt $0 "0x%08X" $0
        WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
    !else
        WriteRegStr HKLM "${UNINST_KEY}" "Publisher" "${INFO_COMPANYNAME}"
        WriteRegStr HKLM "${UNINST_KEY}" "DisplayName" "${INFO_PRODUCTNAME}"
        WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "${INFO_PRODUCTVERSION}"
        WriteRegStr HKLM "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXECUTABLE}"
        WriteRegStr HKLM "${UNINST_KEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
        WriteRegStr HKLM "${UNINST_KEY}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"

        ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
        IntFmt $0 "0x%08X" $0
        WriteRegDWORD HKLM "${UNINST_KEY}" "EstimatedSize" "$0"
    !endif
!macroend

!macro wails.deleteUninstaller
    Delete "$INSTDIR\uninstall.exe"

    SetRegView 64
    !if "${WAILS_INSTALL_SCOPE}" == "user"
        DeleteRegKey HKCU "${UNINST_KEY}"
    !else
        DeleteRegKey HKLM "${UNINST_KEY}"
    !endif
!macroend

!macro wails.setShellContext
    ${If} ${REQUEST_EXECUTION_LEVEL} == "admin"
        SetShellVarContext all
    ${else}
        SetShellVarContext current
    ${EndIf}
!macroend

# Install webview2 by launching the bootstrapper
# See https://docs.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#online-only-deployment
!macro wails.webview2runtime
    !ifndef WAILS_INSTALL_WEBVIEW_DETAILPRINT
        !define WAILS_INSTALL_WEBVIEW_DETAILPRINT "Installing: WebView2 Runtime"
    !endif

    SetRegView 64
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    ${If} $0 != ""
        Goto ok
    ${EndIf}

    ${If} ${REQUEST_EXECUTION_LEVEL} == "user"
        ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
        ${If} $0 != ""
            Goto ok
        ${EndIf}
    ${EndIf}

    SetDetailsPrint both
    DetailPrint "${WAILS_INSTALL_WEBVIEW_DETAILPRINT}"
    SetDetailsPrint listonly

    InitPluginsDir
    CreateDirectory "$pluginsdir\webview2bootstrapper"
    SetOutPath "$pluginsdir\webview2bootstrapper"
    File "MicrosoftEdgeWebview2Setup.exe"
    ExecWait '"$pluginsdir\webview2bootstrapper\MicrosoftEdgeWebview2Setup.exe" /silent /install'

    SetDetailsPrint both
    ok:
    !insertmacro wails.requireWebView2
!macroend

!macro wails.requireWebView2
    !ifndef WAILS_WEBVIEW2_REQUIRED
        !define WAILS_WEBVIEW2_REQUIRED "FreeOS needs the Microsoft WebView2 Runtime. Install it from https://go.microsoft.com/fwlink/p/?LinkId=2124703 and open FreeOS again."
    !endif
    SetRegView 64
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    ${If} $0 == ""
        ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    ${EndIf}
    ${If} $0 == ""
        ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    ${EndIf}
    ${If} $0 == ""
        IfSilent silentWebView2 notSilentWebView2
        silentWebView2:
            SetErrorLevel 66
            Abort
        notSilentWebView2:
            MessageBox MB_OK "${WAILS_WEBVIEW2_REQUIRED}"
            Abort
    ${EndIf}
!macroend

!macro wails.associateFiles
    ; No file associations
!macroend

!macro wails.unassociateFiles
    ; No file associations
!macroend

!macro wails.associateCustomProtocols
    ; No custom protocols
!macroend

!macro wails.unassociateCustomProtocols
    ; No custom protocols
!macroend

# Shared filter: desktop shell, anything under $INSTDIR, portable host
# (python + launch.py run), and org-sidecar node. $R7 is "1" when any match.
!macro wails.detectFreeOSProcesses
    StrCpy $R7 "0"
    nsExec::Exec 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$ErrorActionPreference=''SilentlyContinue''; $$n = @(Get-CimInstance Win32_Process | Where-Object { ($$_.Name -eq ''${PRODUCT_EXECUTABLE}'') -or ($$_.ExecutablePath -like ''$INSTDIR*'') -or ($$_.CommandLine -like ''*\portable\*launch.py* run*'') -or ($$_.ExecutablePath -like ''*\org-sidecar\*'') }).Count; if ($$n -gt 0) { exit 11 } else { exit 0 }"'
    Pop $0
    ${If} $0 == 11
        StrCpy $R7 "1"
    ${Else}
        nsExec::Exec 'cmd.exe /C tasklist /FI "IMAGENAME eq ${PRODUCT_EXECUTABLE}" | find /I "${PRODUCT_EXECUTABLE}"'
        Pop $0
        ${If} $0 == 0
            StrCpy $R7 "1"
        ${EndIf}
    ${EndIf}
!macroend

# If FreeOS is running: ask first (never kill on Cancel). Yes → close then
# force-stop, then uninstall continues. LangString UN_FREEOS_RUNNING is
# defined in project.nsi after MUI_LANGUAGE.
!macro wails.confirmRunningFreeOS
    !insertmacro wails.detectFreeOSProcesses
    ${If} $R7 == "1"
        MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "$(UN_FREEOS_RUNNING)" IDYES wailsConfirmKill
        Abort
        wailsConfirmKill:
        !insertmacro wails.stopFreeOSProcesses
    ${EndIf}
!macroend

# Close the shell / host / sidecar. Caller must have confirmed when they
# were running. Graceful CloseMainWindow / taskkill, then force leftovers.
!macro wails.stopFreeOSProcesses
    DetailPrint "Stopping FreeOS processes..."
    nsExec::ExecToLog 'taskkill /T /IM "${PRODUCT_EXECUTABLE}"'
    Pop $0
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$ErrorActionPreference=''SilentlyContinue''; $$sel = { ($$_.Name -eq ''${PRODUCT_EXECUTABLE}'') -or ($$_.ExecutablePath -like ''$INSTDIR*'') -or ($$_.CommandLine -like ''*\portable\*launch.py* run*'') -or ($$_.ExecutablePath -like ''*\org-sidecar\*'') }; Get-CimInstance Win32_Process | Where-Object $$sel | ForEach-Object { try { $$p = Get-Process -Id $$_.ProcessId; [void]$$p.CloseMainWindow() } catch {} }; Start-Sleep -Seconds 2; Get-CimInstance Win32_Process | Where-Object $$sel | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"'
    Pop $0
    nsExec::ExecToLog 'taskkill /F /T /IM "${PRODUCT_EXECUTABLE}"'
    Pop $0
    Sleep 1500
!macroend

# Recursively remove the install directory. User profile homes stay intact:
# %USERPROFILE%\.freeos, FREEOS_HOME / OCTOP_HOME, and legacy ~/.octop.
# Documented exceptions inside $INSTDIR: "User Data" and "userdata".
!macro wails.wipeInstallDir
    StrCmp $INSTDIR "" wailsWipeSkip
    StrCmp $INSTDIR "$PROFILE" wailsWipeSkip
    StrCmp $INSTDIR "$PROFILE\.freeos" wailsWipeSkip
    StrCmp $INSTDIR "$PROFILE\.octop" wailsWipeSkip
    StrCmp $INSTDIR "$WINDIR" wailsWipeSkip
    StrCmp $INSTDIR "$SYSDIR" wailsWipeSkip
    StrCmp $INSTDIR "$PROGRAMFILES" wailsWipeSkip
    StrCmp $INSTDIR "$PROGRAMFILES64" wailsWipeSkip

    ; RMDir cannot remove the current working directory.
    SetOutPath "$TEMP"
    RMDir /r "$TEMP\FreeOS-keep-UserData"
    RMDir /r "$TEMP\FreeOS-keep-userdata"

    StrCpy $R8 ""
    StrCpy $R9 ""
    IfFileExists "$INSTDIR\User Data" 0 +3
        Rename "$INSTDIR\User Data" "$TEMP\FreeOS-keep-UserData"
        StrCpy $R8 "1"
    IfFileExists "$INSTDIR\userdata" 0 +3
        Rename "$INSTDIR\userdata" "$TEMP\FreeOS-keep-userdata"
        StrCpy $R9 "1"

    RMDir /r "$INSTDIR"

    Delete /REBOOTOK "$INSTDIR\${PRODUCT_EXECUTABLE}"
    Delete /REBOOTOK "$INSTDIR\uninstall.exe"

    ${If} $R8 == "1"
    ${OrIf} $R9 == "1"
        CreateDirectory "$INSTDIR"
        ${If} $R8 == "1"
            Rename "$TEMP\FreeOS-keep-UserData" "$INSTDIR\User Data"
        ${EndIf}
        ${If} $R9 == "1"
            Rename "$TEMP\FreeOS-keep-userdata" "$INSTDIR\userdata"
        ${EndIf}
    ${Else}
        IfFileExists "$INSTDIR\*.*" 0 wailsWipeSkip
            Exec '"$SYSDIR\cmd.exe" /C ping 127.0.0.1 -n 3 -w 1000 > nul & rmdir /s /q "$INSTDIR"'
    ${EndIf}
    wailsWipeSkip:
!macroend

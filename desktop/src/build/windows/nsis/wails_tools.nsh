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

# Prebuilt FE+BE zip must exist when makensis runs (CI: stage:openxyos-runtime).
# A README-only $INSTDIR\openxyos is not a shippable installer.
!ifndef OPENXYOS_RUNTIME_ZIP
    !define OPENXYOS_RUNTIME_ZIP "..\openxyos-runtime.zip"
!endif
!if /FileExists "${OPENXYOS_RUNTIME_ZIP}"
    !define OPENXYOS_RUNTIME_ZIP_PRESENT
!else
    !error "openxyos-runtime.zip missing at desktop/src/build/windows/openxyos-runtime.zip; run stage:openxyos-runtime before makensis"
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
    !insertmacro wails.provisionOpenXYOS
!macroend

# Resolve the installing user's LocalAppData. After SetShellVarContext all,
# NSIS $LOCALAPPDATA is ProgramData — not the path FreeOS reads at runtime
# (LOCALAPPDATA env of the unelevated user). ReadEnvStr keeps the original
# profile so an elevated install can write the live tree the app will use.
!macro wails.userLocalAppData
    ReadEnvStr $R6 LOCALAPPDATA
    ${If} $R6 == ""
        StrCpy $R6 "$PROFILE\AppData\Local"
    ${EndIf}
!macroend

# Ship the prebuilt openXYOS FE+BE and expand it during Setup into the
# writable live root (%LOCALAPPDATA%\FreeOS\openxyos). Program Files is
# read-only for a later unelevated FreeOS.exe, so the admin installer
# writes LocalAppData now — first app start must not copy/unpack.
#
# $INSTDIR\openxyos and $INSTDIR\openxyos-runtime stay as sealed backups
# (heal other Windows users / portable). Do NOT unzip via PowerShell with
# NSIS ''$INSTDIR'' quoting: "Program Files" splits the command.
# Write a .cmd (paths expanded at install time) and use Windows 10+ tar.exe.
!macro wails.provisionOpenXYOS
    !insertmacro wails.userLocalAppData
    SetDetailsPrint both
    DetailPrint "$(OPENXYOS_WORKDIR)"
    CreateDirectory "$INSTDIR\openxyos"
    CreateDirectory "$INSTDIR\openxyos-runtime"
    CreateDirectory "$R6\FreeOS\openxyos"
    DetailPrint "$(OPENXYOS_COPY_ZIP)"
    File "/oname=openxyos-runtime.zip" "${OPENXYOS_RUNTIME_ZIP}"
    DetailPrint "$(OPENXYOS_EXTRACT)"
    InitPluginsDir
    FileOpen $0 "$PLUGINSDIR\extract-openxyos.cmd" w
    FileWrite $0 `@echo off$\r$\n`
    FileWrite $0 `setlocal EnableExtensions$\r$\n`
    FileWrite $0 `set "TAR=$SYSDIR\tar.exe"$\r$\n`
    FileWrite $0 `set "LIVE=$R6\FreeOS\openxyos"$\r$\n`
    FileWrite $0 `set "ZIP=$INSTDIR\openxyos-runtime.zip"$\r$\n`
    FileWrite $0 `if not exist "%ZIP%" exit /b 2$\r$\n`
    FileWrite $0 `if not exist "%TAR%" exit /b 5$\r$\n`
    FileWrite $0 `if not exist "%LIVE%" mkdir "%LIVE%"$\r$\n`
    FileWrite $0 `if not exist "$INSTDIR\openxyos-runtime" mkdir "$INSTDIR\openxyos-runtime"$\r$\n`
    FileWrite $0 `if not exist "$INSTDIR\openxyos" mkdir "$INSTDIR\openxyos"$\r$\n`
    FileWrite $0 `"%TAR%" -xf "%ZIP%" -C "%LIVE%"$\r$\n`
    FileWrite $0 `if errorlevel 1 exit /b 3$\r$\n`
    FileWrite $0 `"%TAR%" -xf "%ZIP%" -C "$INSTDIR\openxyos-runtime"$\r$\n`
    FileWrite $0 `if errorlevel 1 exit /b 4$\r$\n`
    FileWrite $0 `"%TAR%" -xf "%ZIP%" -C "$INSTDIR\openxyos"$\r$\n`
    FileWrite $0 `if errorlevel 1 exit /b 8$\r$\n`
    FileWrite $0 `if exist "%LIVE%\node\node.exe" goto liveNodeOk$\r$\n`
    FileWrite $0 `if exist "$INSTDIR\openxyos-runtime\node\node.exe" xcopy /E /I /Y "$INSTDIR\openxyos-runtime\*" "%LIVE%\" >nul$\r$\n`
    # cmd.exe labels require a leading colon. "liveNodeOk:" is not a goto target.
    FileWrite $0 `:liveNodeOk$\r$\n`
    FileWrite $0 `if not exist "%LIVE%\node\node.exe" exit /b 6$\r$\n`
    FileWrite $0 `if not exist "%LIVE%\openxyos\dist\index.html" if not exist "%LIVE%\dist\index.html" exit /b 7$\r$\n`
    FileWrite $0 `if defined USERNAME icacls "$R6\FreeOS" /grant "%USERNAME%:(OI)(CI)M" /T /C /Q >nul 2>&1$\r$\n`
    FileWrite $0 `exit /b 0$\r$\n`
    FileClose $0
    nsExec::ExecToLog '"$PLUGINSDIR\extract-openxyos.cmd"'
    Pop $0
    DetailPrint "$(OPENXYOS_EXTRACT_CODE)$0"
    !insertmacro wails.requireOpenXYOSLayout
    FileOpen $0 "$R6\FreeOS\openxyos\README.txt" w
    FileWrite $0 "FreeOS local openXYOS environment$\r$\n"
    FileWrite $0 "Live workdir (writable): $R6\FreeOS\openxyos$\r$\n"
    FileWrite $0 "Install backup: $INSTDIR\openxyos$\r$\n"
    FileWrite $0 "Sealed backup: $INSTDIR\openxyos-runtime$\r$\n"
    FileWrite $0 "URL: http://127.0.0.1:3780$\r$\n"
    FileClose $0
    FileOpen $0 "$INSTDIR\openxyos\README.txt" w
    FileWrite $0 "FreeOS local openXYOS environment$\r$\n"
    FileWrite $0 "Live workdir: $R6\FreeOS\openxyos$\r$\n"
    FileWrite $0 "This folder is a backup. FreeOS starts the live tree.$\r$\n"
    FileWrite $0 "URL: http://127.0.0.1:3780$\r$\n"
    FileClose $0
    !insertmacro wails.writeOpenXYOSAutostart
    Call PersistOpenXYOS
    # Stamp after layout + autostart, before livez wait. Probe must not Abort
    # when node/dist exist; keep this write reachable on a slow sidecar.
    FileOpen $0 "$R6\FreeOS\openxyos\.install-ready" w
    FileWrite $0 "live=$R6\FreeOS\openxyos$\r$\n"
    FileWrite $0 "url=http://127.0.0.1:3780/api/health/livez$\r$\n"
    FileWrite $0 "autostart=hkcu-run:FreeOS-openXYOS$\r$\n"
    FileClose $0
    !insertmacro wails.probeOpenXYOS
    SetDetailsPrint listonly
!macroend

# Live root is %LOCALAPPDATA%\FreeOS\openxyos ($R6). Missing node.exe or
# dist\index.html aborts setup — never finish with a README-only tree.
!macro wails.requireOpenXYOSLayout
    IfFileExists "$R6\FreeOS\openxyos\node\node.exe" 0 openxyosTryStaged
    IfFileExists "$R6\FreeOS\openxyos\openxyos\dist\index.html" openxyosLiveOk openxyosTryFlat
    openxyosTryFlat:
    IfFileExists "$R6\FreeOS\openxyos\dist\index.html" openxyosLiveOk openxyosTryStaged
    openxyosLiveOk:
        DetailPrint "$(OPENXYOS_FE_OK)"
        DetailPrint "$(OPENXYOS_NODE_OK)"
        Goto openxyosLayoutDone
    openxyosTryStaged:
    IfFileExists "$INSTDIR\openxyos-runtime\node\node.exe" 0 openxyosTryInstHeal
    IfFileExists "$INSTDIR\openxyos-runtime\openxyos\dist\index.html" 0 openxyosTryStagedFlat
        Goto openxyosCopyStaged
    openxyosTryStagedFlat:
    IfFileExists "$INSTDIR\openxyos-runtime\dist\index.html" 0 openxyosTryInstHeal
    openxyosCopyStaged:
        DetailPrint "$(OPENXYOS_STAGED_OK)"
        nsExec::ExecToLog '"$SYSDIR\cmd.exe" /C xcopy /E /I /Y "$INSTDIR\openxyos-runtime\*" "$R6\FreeOS\openxyos\"'
        Pop $0
        IfFileExists "$R6\FreeOS\openxyos\node\node.exe" 0 openxyosTryInstHeal
        IfFileExists "$R6\FreeOS\openxyos\openxyos\dist\index.html" openxyosLiveOk openxyosTryFlatAfterCopy
        openxyosTryFlatAfterCopy:
        IfFileExists "$R6\FreeOS\openxyos\dist\index.html" openxyosLiveOk openxyosTryInstHeal
    openxyosTryInstHeal:
    IfFileExists "$INSTDIR\openxyos\node\node.exe" 0 openxyosLayoutFail
        nsExec::ExecToLog '"$SYSDIR\cmd.exe" /C xcopy /E /I /Y "$INSTDIR\openxyos\*" "$R6\FreeOS\openxyos\"'
        Pop $0
        IfFileExists "$R6\FreeOS\openxyos\node\node.exe" 0 openxyosLayoutFail
        IfFileExists "$R6\FreeOS\openxyos\openxyos\dist\index.html" openxyosLiveOk openxyosTryFlatAfterInst
        openxyosTryFlatAfterInst:
        IfFileExists "$R6\FreeOS\openxyos\dist\index.html" openxyosLiveOk openxyosLayoutFail
    openxyosLayoutFail:
        DetailPrint "$(OPENXYOS_EXTRACT_FAIL)"
        IfSilent openxyosSilentFail openxyosLoudFail
        openxyosSilentFail:
            SetErrorLevel 67
            Abort
        openxyosLoudFail:
            MessageBox MB_OK|MB_ICONSTOP "$(OPENXYOS_EXTRACT_FAIL)"
            SetErrorLevel 67
            Abort
    openxyosLayoutDone:
!macroend

# User-level start helper for the live LocalAppData tree. The elevated
# installer must not spawn Node itself: that would stamp ~/.freeos as High
# integrity and #29 then taskkill'd the probe, leaving Organization offline.
# PersistOpenXYOS (project.nsi) registers HKCU Run and launches this script
# via IShellDispatch2 (medium IL). Probe only waits for livez — no kill.
!macro wails.writeOpenXYOSAutostart
    DetailPrint "$(OPENXYOS_AUTOSTART)"
    FileOpen $0 "$R6\FreeOS\openxyos\start-sidecar.cmd" w
    FileWrite $0 `@echo off$\r$\n`
    FileWrite $0 `setlocal EnableExtensions$\r$\n`
    FileWrite $0 `powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0start-sidecar.ps1"$\r$\n`
    FileClose $0
    FileOpen $0 "$R6\FreeOS\openxyos\start-sidecar.ps1" w
    FileWrite $0 `$$ErrorActionPreference = 'Continue'$\r$\n`
    FileWrite $0 `$$live = Split-Path -Parent $$MyInvocation.MyCommand.Path$\r$\n`
    FileWrite $0 `$$node = Join-Path $$live 'node\node.exe'$\r$\n`
    FileWrite $0 `$$app = Join-Path $$live 'openxyos'$\r$\n`
    FileWrite $0 `if (-not (Test-Path -LiteralPath (Join-Path $$app 'dist\index.html'))) { if (Test-Path -LiteralPath (Join-Path $$live 'dist\index.html')) { $$app = $$live } }$\r$\n`
    FileWrite $0 `$$livez = 'http://127.0.0.1:3780/api/health/livez'$\r$\n`
    FileWrite $0 `function Test-Livez { try { $$r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $$livez; return ($$r.StatusCode -lt 500) } catch { return $$false } }$\r$\n`
    FileWrite $0 `if (Test-Livez) { exit 0 }$\r$\n`
    FileWrite $0 `if (-not (Test-Path -LiteralPath $$node)) { exit 6 }$\r$\n`
    FileWrite $0 `$$home = $$env:FREEOS_HOME$\r$\n`
    FileWrite $0 `if (-not $$home) { $$home = Join-Path $$env:USERPROFILE '.freeos' }$\r$\n`
    FileWrite $0 `$$data = Join-Path $$home 'org-os'$\r$\n`
    FileWrite $0 `New-Item -ItemType Directory -Force -Path $$data | Out-Null$\r$\n`
    FileWrite $0 `$$secretFile = Join-Path $$data 'sidecar.env'$\r$\n`
    FileWrite $0 `$$jwt = ''$\r$\n`
    FileWrite $0 `$$cookie = ''$\r$\n`
    FileWrite $0 `$$ingest = ''$\r$\n`
    FileWrite $0 `if (Test-Path -LiteralPath $$secretFile) { foreach ($$line in Get-Content -LiteralPath $$secretFile) { if ($$line -match '^JWT_SECRET=(.+)$$') { $$jwt = $$Matches[1] }; if ($$line -match '^COOKIE_SECRET=(.+)$$') { $$cookie = $$Matches[1] }; if ($$line -match '^FREEOS_INGEST_TOKEN=(.+)$$') { $$ingest = $$Matches[1] } } }$\r$\n`
    FileWrite $0 `if (-not $$jwt) { $$jwt = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }$\r$\n`
    FileWrite $0 `if (-not $$cookie) { $$cookie = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }$\r$\n`
    FileWrite $0 `if (-not $$ingest) { $$ingest = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }$\r$\n`
    FileWrite $0 `"JWT_SECRET=$$jwt" | Set-Content -LiteralPath $$secretFile -Encoding ASCII$\r$\n`
    FileWrite $0 `"COOKIE_SECRET=$$cookie" | Add-Content -LiteralPath $$secretFile -Encoding ASCII$\r$\n`
    FileWrite $0 `"FREEOS_INGEST_TOKEN=$$ingest" | Add-Content -LiteralPath $$secretFile -Encoding ASCII$\r$\n`
    FileWrite $0 `$$env:NODE_ENV = 'production'$\r$\n`
    FileWrite $0 `$$env:PORT = '3780'$\r$\n`
    FileWrite $0 `$$env:DB_DIALECT = 'sqlite'$\r$\n`
    FileWrite $0 `$$env:DATABASE_PATH = Join-Path $$data 'xiongyuan.db'$\r$\n`
    FileWrite $0 `$$env:AIR_GAP_MODE = 'true'$\r$\n`
    FileWrite $0 `$$env:SEED_DEMO_DATA = 'false'$\r$\n`
    FileWrite $0 `$$env:ALLOW_PUBLIC_REGISTRATION = 'false'$\r$\n`
    FileWrite $0 `$$env:JWT_SECRET = $$jwt$\r$\n`
    FileWrite $0 `$$env:COOKIE_SECRET = $$cookie$\r$\n`
    FileWrite $0 `$$env:FREEOS_INGEST_TOKEN = $$ingest$\r$\n`
    FileWrite $0 `$$env:CORS_ORIGIN = 'http://127.0.0.1:8088,http://localhost:8088,http://127.0.0.1:18900,http://localhost:18900'$\r$\n`
    FileWrite $0 `$$env:FREEOS_HOME = $$home$\r$\n`
    FileWrite $0 `$$env:OCTOP_HOME = $$home$\r$\n`
    FileWrite $0 `$$env:FREEOS_ORG_SIDECAR_PORT = '3780'$\r$\n`
    FileWrite $0 `$$compiled = Join-Path $$app 'backend-dist\server.js'$\r$\n`
    FileWrite $0 `if (Test-Path -LiteralPath $$compiled) { $$argv = @('backend-dist/server.js') } else { $$argv = @('--import'; 'tsx'; 'backend/server.ts') }$\r$\n`
    FileWrite $0 `Start-Process -FilePath $$node -ArgumentList $$argv -WorkingDirectory $$app -WindowStyle Hidden$\r$\n`
    FileWrite $0 `exit 0$\r$\n`
    FileClose $0
!macroend

# Wait for the user-level sidecar PersistOpenXYOS launched. Do not spawn
# Node as admin and do not kill the probe process — that was the #29 gap.
# livez timeout is a warning only: node + dist already passed
# requireOpenXYOSLayout, and HKCU Run / the LIMITED task stay registered.
!macro wails.probeOpenXYOS
    DetailPrint "$(OPENXYOS_PROBE)"
    FileOpen $0 "$PLUGINSDIR\wait-openxyos.ps1" w
    FileWrite $0 `$$livez = 'http://127.0.0.1:3780/api/health/livez'$\r$\n`
    FileWrite $0 `function Test-Livez { try { $$r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $$livez; return ($$r.StatusCode -lt 500) } catch { return $$false } }$\r$\n`
    FileWrite $0 `for ($$i = 0; $$i -lt 90; $$i++) { if (Test-Livez) { exit 0 }; if ($$i -eq 30) { schtasks.exe /Run /TN "FreeOS-openXYOS" | Out-Null }; Start-Sleep -Seconds 1 }$\r$\n`
    FileWrite $0 `exit 12$\r$\n`
    FileClose $0
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\wait-openxyos.ps1"'
    Pop $0
    DetailPrint "$(OPENXYOS_EXTRACT_CODE)$0"
    IntCmp $0 0 openxyosProbeOk openxyosProbeWarn openxyosProbeWarn
    openxyosProbeWarn:
        DetailPrint "$(OPENXYOS_PROBE_WARN)"
        IfSilent openxyosProbeDone openxyosProbeNote
        openxyosProbeNote:
            MessageBox MB_OK|MB_ICONINFORMATION "$(OPENXYOS_PROBE_WARN)"
            Goto openxyosProbeDone
    openxyosProbeOk:
        DetailPrint "$(OPENXYOS_PROBE_OK)"
    openxyosProbeDone:
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
    nsExec::Exec 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$ErrorActionPreference=''SilentlyContinue''; $$n = @(Get-CimInstance Win32_Process | Where-Object { ($$_.Name -eq ''${PRODUCT_EXECUTABLE}'') -or ($$_.ExecutablePath -like ''$INSTDIR*'') -or ($$_.CommandLine -like ''*\portable\*launch.py* run*'') -or ($$_.ExecutablePath -like ''*\org-sidecar\*'') -or ($$_.ExecutablePath -like ''*\FreeOS\openxyos\*'') }).Count; if ($$n -gt 0) { exit 11 } else { exit 0 }"'
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
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$ErrorActionPreference=''SilentlyContinue''; $$sel = { ($$_.Name -eq ''${PRODUCT_EXECUTABLE}'') -or ($$_.ExecutablePath -like ''$INSTDIR*'') -or ($$_.CommandLine -like ''*\portable\*launch.py* run*'') -or ($$_.ExecutablePath -like ''*\org-sidecar\*'') -or ($$_.ExecutablePath -like ''*\FreeOS\openxyos\*'') }; Get-CimInstance Win32_Process | Where-Object $$sel | ForEach-Object { try { $$p = Get-Process -Id $$_.ProcessId; [void]$$p.CloseMainWindow() } catch {} }; Start-Sleep -Seconds 2; Get-CimInstance Win32_Process | Where-Object $$sel | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"'
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

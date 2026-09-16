# Independent openXYOS provisioner for the FreeOS Windows installer.
#
# Setup copies this script next to openxyos-runtime.zip and launches it as a
# separate unelevated (medium IL) process. It is the same shape as installing
# openXYOS alone: extract the payload, start FE+BE, wait until healthy.
# NSIS does not generate extract/start/wait scripts and does not FileWrite
# cmd.exe goto labels.
#
# Success (exit 0) requires ALL of:
#   1. runtime on disk (node\node.exe + dist\index.html)
#   2. backend process started at medium integrity
#   3. http://127.0.0.1:3780/api/health/livez returns HTTP < 500
#   4. .install-ready written only after (3)
#   5. HKCU Run / ONLOGON task registered
#
# Failure is a real provision failure. Do not write .install-ready. Do not
# treat a livez miss as "shell OK".
#
# Exit codes (ASCII line in .provision-exit and %TEMP%\FreeOS-openxyos-provision.exit):
#   0   success
#   2   zip missing
#   3   tar extract failed
#   5   tar.exe missing
#   6   node.exe missing after extract
#   7   dist\index.html missing after extract
#   10  Node failed to start
#   12  process started but livez never became healthy
#   15  live directory not writable

[CmdletBinding()]
param(
    [string]$Zip = '',
    [string]$Live = '',
    [int]$LivezTimeoutSec = 90
)

$ErrorActionPreference = 'Stop'
$script:exitCode = 15
$script:stage = 'init'

function Get-ScriptDir {
    if ($PSScriptRoot) { return $PSScriptRoot }
    return (Split-Path -Parent $MyInvocation.MyCommand.Path)
}

$scriptDir = Get-ScriptDir
if (-not $Zip) { $Zip = Join-Path $scriptDir 'openxyos-runtime.zip' }
if (-not $Live) {
    $base = $env:LOCALAPPDATA
    if (-not $base) { $base = Join-Path $env:USERPROFILE 'AppData\Local' }
    $Live = Join-Path (Join-Path $base 'FreeOS') 'openxyos'
}

$logFile = $null
$readyFile = Join-Path $Live '.install-ready'
$runningFile = Join-Path $Live '.provision-running'
$exitFile = Join-Path $Live '.provision-exit'
$stageFile = Join-Path $Live '.provision-stage'
$altExitFile = Join-Path $env:TEMP 'FreeOS-openxyos-provision.exit'
$livez = 'http://127.0.0.1:3780/api/health/livez'
$tar = Join-Path $env:SystemRoot 'System32\tar.exe'

function Write-ExitMarker {
    param([int]$Code)
    $text = [string]$Code
    foreach ($path in @($exitFile, $altExitFile)) {
        try {
            $dir = Split-Path -Parent $path
            if ($dir -and -not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Force -Path $dir | Out-Null
            }
            [System.IO.File]::WriteAllText($path, $text)
        } catch {
        }
    }
}

function Write-Log {
    param([string]$Message)
    $line = '[{0}] [{1}] {2}' -f (Get-Date -Format 'o'), $script:stage, $Message
    Write-Host $line
    if ($logFile) {
        try { Add-Content -LiteralPath $logFile -Value $line -Encoding ASCII } catch {}
    }
}

function Set-Stage {
    param([string]$Name)
    $script:stage = $Name
    if ($stageFile) {
        try { Set-Content -LiteralPath $stageFile -Value $Name -Encoding ASCII } catch {}
    }
}

function Test-Livez {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $livez
        return ($r.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Resolve-AppDir {
    param([string]$Root)
    $nested = Join-Path $Root 'openxyos'
    if (Test-Path -LiteralPath (Join-Path $nested 'dist\index.html')) { return $nested }
    if (Test-Path -LiteralPath (Join-Path $Root 'dist\index.html')) { return $Root }
    return $nested
}

function Test-Layout {
    param([string]$Root)
    $node = Join-Path $Root 'node\node.exe'
    if (-not (Test-Path -LiteralPath $node)) { return $false }
    $app = Resolve-AppDir $Root
    return (Test-Path -LiteralPath (Join-Path $app 'dist\index.html'))
}

function Repair-Layout {
    param([string]$Root)
    if (Test-Layout $Root) { return }
    $nodeDirect = Join-Path $Root 'node\node.exe'
    if (Test-Path -LiteralPath $nodeDirect) { return }
    Get-ChildItem -LiteralPath $Root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $candidate = $_.FullName
        if (Test-Path -LiteralPath (Join-Path $candidate 'node\node.exe')) {
            Get-ChildItem -LiteralPath $candidate | ForEach-Object {
                $dest = Join-Path $Root $_.Name
                if (Test-Path -LiteralPath $dest) { return }
                Move-Item -LiteralPath $_.FullName -Destination $dest -Force
            }
        }
    }
}

function Copy-StartHelpers {
    param([string]$Root)
    $srcPs1 = Join-Path $scriptDir 'start-sidecar.ps1'
    $destPs1 = Join-Path $Root 'start-sidecar.ps1'
    if (Test-Path -LiteralPath $srcPs1) {
        Copy-Item -LiteralPath $srcPs1 -Destination $destPs1 -Force
    }
    $srcCmd = Join-Path $scriptDir 'start-sidecar.cmd'
    $destCmd = Join-Path $Root 'start-sidecar.cmd'
    if (Test-Path -LiteralPath $srcCmd) {
        Copy-Item -LiteralPath $srcCmd -Destination $destCmd -Force
    } else {
        Set-Content -LiteralPath $destCmd -Value "@echo off`r`npowershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"%~dp0start-sidecar.ps1`"`r`n" -Encoding ASCII
    }
}

function Register-Autostart {
    param([string]$Root)
    $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $helper = Join-Path $Root 'start-sidecar.ps1'
    $cmd = '"{0}" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{1}"' -f $ps, $helper
    $runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    if (-not (Test-Path -LiteralPath $runKey)) {
        New-Item -Path $runKey -Force | Out-Null
    }
    Set-ItemProperty -Path $runKey -Name 'FreeOS-openXYOS' -Value $cmd
    $tr = '"{0}" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{1}"' -f $ps, $helper
    & schtasks.exe /Create /TN 'FreeOS-openXYOS' /SC ONLOGON /RL LIMITED /F /TR $tr | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Log "schtasks ONLOGON returned $LASTEXITCODE (HKCU Run is registered)"
    }
}

function Install-ReadyMarker {
    param([string]$Root)
    $lines = @(
        "live=$Root"
        "url=$livez"
        'autostart=hkcu-run:FreeOS-openXYOS'
        'provisioner=openxyos-provision.ps1'
        'status=healthy'
    )
    Set-Content -LiteralPath (Join-Path $Root '.install-ready') -Value $lines -Encoding ASCII
}

function Start-SidecarHelper {
    param([string]$Root)
    $helper = Join-Path $Root 'start-sidecar.ps1'
    if (-not (Test-Path -LiteralPath $helper)) {
        throw "start-sidecar.ps1 missing under $Root"
    }
    $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $p = Start-Process -FilePath $ps -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $helper) -Wait -PassThru -WindowStyle Hidden
    return $p.ExitCode
}

function Wait-Livez {
    param([int]$Seconds)
    for ($i = 0; $i -lt $Seconds; $i++) {
        if (Test-Livez) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Write-Readme {
    param([string]$Root)
    $body = @(
        'FreeOS local openXYOS environment'
        "Live workdir (writable): $Root"
        'Sealed payload: openxyos-runtime.zip next to the installer copy of this script'
        "URL: $livez"
        'Provisioned by openxyos-provision.ps1 (independent of the FreeOS shell copy).'
    )
    Set-Content -LiteralPath (Join-Path $Root 'README.txt') -Value $body -Encoding ASCII
}

try {
    New-Item -ItemType Directory -Force -Path $Live | Out-Null
    $logFile = Join-Path $Live 'provision.log'
    Set-Content -LiteralPath $runningFile -Value '1' -Encoding ASCII
    if (Test-Path -LiteralPath $readyFile) {
        Remove-Item -LiteralPath $readyFile -Force
    }
    Write-ExitMarker -Code 15
    Set-Stage 'layout'
    Write-Log "live=$Live zip=$Zip"

    if (Test-Layout $Live) {
        Write-Log 'runtime already on disk; skipping extract'
    } else {
        Set-Stage 'extract'
        if (-not (Test-Path -LiteralPath $Zip)) {
            Write-Log "sealed zip missing: $Zip"
            $script:exitCode = 2
            throw "zip missing"
        }
        if (-not (Test-Path -LiteralPath $tar)) {
            Write-Log "tar.exe missing: $tar (Windows 10+ required; Expand-Archive is not used)"
            $script:exitCode = 5
            throw "tar.exe missing"
        }
        Write-Log "extracting with $tar (not Expand-Archive)"
        & $tar -xf $Zip -C $Live
        if ($LASTEXITCODE -ne 0) {
            Write-Log "tar.exe exit $LASTEXITCODE"
            $script:exitCode = 3
            throw "extract failed"
        }
        Repair-Layout $Live
        if (-not (Test-Path -LiteralPath (Join-Path $Live 'node\node.exe'))) {
            Write-Log 'node\node.exe missing after extract (start never reached; not a port-3780 problem)'
            $script:exitCode = 6
            throw "node missing"
        }
        if (-not (Test-Layout $Live)) {
            Write-Log 'dist\index.html missing after extract (start never reached; not a port-3780 problem)'
            $script:exitCode = 7
            throw "frontend missing"
        }
        Write-Log 'runtime layout ok'
    }

    Set-Stage 'helpers'
    Copy-StartHelpers $Live
    Write-Readme $Live

    Set-Stage 'autostart'
    try {
        Register-Autostart $Live
        Write-Log 'registered HKCU Run FreeOS-openXYOS and ONLOGON task'
    } catch {
        Write-Log "autostart registration failed: $($_.Exception.Message)"
        throw
    }

    Set-Stage 'start'
    if (Test-Livez) {
        Write-Log 'livez already healthy'
    } else {
        $startCode = Start-SidecarHelper $Live
        if ($startCode -eq 6) {
            Write-Log 'start-sidecar: node.exe missing (not a livez/port failure)'
            $script:exitCode = 6
            throw "node missing at start"
        }
        if ($startCode -eq 7) {
            Write-Log 'start-sidecar: dist\index.html missing (not a livez/port failure)'
            $script:exitCode = 7
            throw "frontend missing at start"
        }
        if ($startCode -ne 0) {
            Write-Log "start-sidecar failed with exit $startCode (backend did not start; do not blame port 3780 first)"
            $script:exitCode = 10
            throw "start failed"
        }
        Write-Log "started Node; waiting up to ${LivezTimeoutSec}s for $livez"
        Set-Stage 'livez'
        if (-not (Wait-Livez -Seconds $LivezTimeoutSec)) {
            Write-Log 'retry start once after livez miss'
            $null = Start-SidecarHelper $Live
            if (-not (Wait-Livez -Seconds 30)) {
                Write-Log "backend start was attempted but $livez never became healthy; see this log"
                $script:exitCode = 12
                throw "livez timeout"
            }
        }
        Write-Log 'livez ok'
    }

    Set-Stage 'ready'
    Install-ReadyMarker $Live
    $script:exitCode = 0
    Write-Log 'provision succeeded (runtime + services + livez + .install-ready)'
} catch {
    Write-Log ("provision failed: " + $_.Exception.Message)
    if ($script:exitCode -eq 0) { $script:exitCode = 1 }
    if (Test-Path -LiteralPath $readyFile) {
        Remove-Item -LiteralPath $readyFile -Force -ErrorAction SilentlyContinue
    }
} finally {
    Set-Stage 'done'
    Write-ExitMarker -Code $script:exitCode
    if (Test-Path -LiteralPath $runningFile) {
        Remove-Item -LiteralPath $runningFile -Force -ErrorAction SilentlyContinue
    }
    exit $script:exitCode
}

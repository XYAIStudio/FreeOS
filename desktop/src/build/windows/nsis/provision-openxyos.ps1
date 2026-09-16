# Install-time openXYOS provisioner (child process of the FreeOS NSIS Setup).
# Extract + normalize + start once at medium IL + wait livez + write .install-ready.
# Exit 0 only when http://127.0.0.1:3780/api/health/livez is healthy.
# Does NOT register HKCU Run / scheduled-task logon autostart.
#
# Exit codes (NSIS maps these to localized MessageBox text):
#   0  healthy (.install-ready written)
#   2  zip missing
#   3  tar extract into live dir failed
#   5  tar.exe missing
#   6  node\node.exe missing after extract/heal
#   7  dist\index.html missing after extract/heal
#  10  could not start FE/BE (unelevated launch failed)
#  12  livez timeout after start (+ one automatic start retry)
#  13  livez ok but .install-ready could not be written

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ZipPath,
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$LiveDir,
    [int]$LivezTimeoutSec = 90,
    [int]$RetryTimeoutSec = 60
)

$ErrorActionPreference = 'Continue'
$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:LogPath = Join-Path $LiveDir 'provision.log'

function Write-ProvLog {
    param([string]$Message)
    $line = '{0} {1}' -f (Get-Date -Format o), $Message
    Write-Host $line
    try {
        $dir = Split-Path -Parent $script:LogPath
        if ($dir -and -not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        Add-Content -LiteralPath $script:LogPath -Value $line -Encoding UTF8
    } catch {
    }
}

function Test-OpenXYOSLayout {
    param([string]$Root)
    $node = Join-Path $Root 'node\node.exe'
    if (-not (Test-Path -LiteralPath $node)) { return $false }
    $nested = Join-Path $Root 'openxyos\dist\index.html'
    $flat = Join-Path $Root 'dist\index.html'
    return (Test-Path -LiteralPath $nested) -or (Test-Path -LiteralPath $flat)
}

function Copy-OpenXYOSTree {
    param([string]$Src, [string]$Dest)
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    $xcopy = Join-Path $env:SystemRoot 'System32\xcopy.exe'
    & $xcopy /E /I /Y "$Src\*" "$Dest\" | Out-Null
}

function Find-OpenXYOSBundleRoot {
    param([string]$Root)
    if (Test-OpenXYOSLayout $Root) { return $Root }
    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($name in @('openxyos', 'org-sidecar')) {
        $candidates.Add((Join-Path $Root $name))
    }
    if (Test-Path -LiteralPath $Root) {
        Get-ChildItem -LiteralPath $Root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $candidates.Add($_.FullName)
            $candidates.Add((Join-Path $_.FullName 'org-sidecar'))
            $candidates.Add((Join-Path $_.FullName 'openxyos'))
        }
    }
    foreach ($cand in $candidates) {
        if (Test-OpenXYOSLayout $cand) { return $cand }
    }
    return $null
}

function Repair-OpenXYOSLayout {
    param([string]$Root)
    if (Test-OpenXYOSLayout $Root) { return $true }
    $found = Find-OpenXYOSBundleRoot $Root
    if (-not $found) { return $false }
    $fullFound = [IO.Path]::GetFullPath($found)
    $fullRoot = [IO.Path]::GetFullPath($Root)
    if ($fullFound -eq $fullRoot) { return $true }
    Write-ProvLog "Normalizing nested layout $found -> $Root"
    Copy-OpenXYOSTree $found $Root
    return (Test-OpenXYOSLayout $Root)
}

function Test-OpenXYOSLivez {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:3780/api/health/livez'
        return ($r.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Wait-OpenXYOSLivez {
    param([int]$Seconds)
    for ($i = 0; $i -lt $Seconds; $i++) {
        if (Test-OpenXYOSLivez) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-OpenXYOSUnelevated {
    param([string]$Dir)
    $helper = Join-Path $Dir 'start-sidecar.ps1'
    if (-not (Test-Path -LiteralPath $helper)) {
        Write-ProvLog "start helper missing: $helper"
        return $false
    }
    $pwsh = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$helper`""
    try {
        $shell = New-Object -ComObject Shell.Application
        $shell.ShellExecute($pwsh, $arg, $Dir, 'open', 0)
        Write-ProvLog 'Started FE/BE via Shell.Application (IShellDispatch2 / medium IL)'
        return $true
    } catch {
        Write-ProvLog "Shell.Application failed: $($_.Exception.Message)"
    }
    $cmd = Join-Path $Dir 'start-sidecar.cmd'
    $explorer = Join-Path $env:WINDIR 'explorer.exe'
    if ((Test-Path -LiteralPath $cmd) -and (Test-Path -LiteralPath $explorer)) {
        try {
            Start-Process -FilePath $explorer -ArgumentList "`"$cmd`""
            Write-ProvLog 'Started FE/BE via explorer.exe (medium IL fallback)'
            return $true
        } catch {
            Write-ProvLog "explorer fallback failed: $($_.Exception.Message)"
        }
    }
    return $false
}

function Write-InstallReady {
    param([string]$Dir)
    $marker = Join-Path $Dir '.install-ready'
    $body = @(
        "live=$Dir"
        'url=http://127.0.0.1:3780/api/health/livez'
        'status=healthy'
    ) -join "`n"
    try {
        Set-Content -LiteralPath $marker -Value $body -Encoding ASCII
        Write-ProvLog "Wrote $marker"
        return $true
    } catch {
        Write-ProvLog "Failed to write .install-ready: $($_.Exception.Message)"
        return $false
    }
}

function Install-StartHelpers {
    param([string]$Dir)
    foreach ($name in @('start-sidecar.ps1', 'start-sidecar.cmd')) {
        $src = Join-Path $script:ScriptDir $name
        if (-not (Test-Path -LiteralPath $src)) {
            $src = Join-Path $InstallDir $name
        }
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination (Join-Path $Dir $name) -Force
        }
    }
}

function Invoke-TarExtract {
    param([string]$Tar, [string]$Zip, [string]$Dest)
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    Write-ProvLog "tar -xf $Zip -C $Dest"
    & $Tar -xf $Zip -C $Dest
    return ($LASTEXITCODE -eq 0)
}

# --- main ---
New-Item -ItemType Directory -Force -Path $LiveDir | Out-Null
Write-ProvLog "provision-openxyos start zip=$ZipPath install=$InstallDir live=$LiveDir"

$marker = Join-Path $LiveDir '.install-ready'
if ((Test-OpenXYOSLayout $LiveDir) -and (Test-OpenXYOSLivez)) {
    Write-ProvLog 'Already extracted and livez healthy (idempotent)'
    if (Write-InstallReady $LiveDir) { exit 0 }
    exit 13
}
if (Test-Path -LiteralPath $marker) {
    Write-ProvLog 'Removing stale .install-ready (livez not healthy)'
    Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath $ZipPath)) {
    Write-ProvLog "zip missing: $ZipPath"
    exit 2
}
$tar = Join-Path $env:SystemRoot 'System32\tar.exe'
if (-not (Test-Path -LiteralPath $tar)) {
    Write-ProvLog 'tar.exe missing'
    exit 5
}

if (-not (Test-OpenXYOSLayout $LiveDir)) {
    if (-not (Invoke-TarExtract -Tar $tar -Zip $ZipPath -Dest $LiveDir)) {
        Write-ProvLog 'extract into live dir failed'
        exit 3
    }
    $null = Repair-OpenXYOSLayout $LiveDir
}

$backupRuntime = Join-Path $InstallDir 'openxyos-runtime'
$backupOpen = Join-Path $InstallDir 'openxyos'
foreach ($backup in @($backupRuntime, $backupOpen)) {
    if (-not (Test-OpenXYOSLayout $backup)) {
        if (Invoke-TarExtract -Tar $tar -Zip $ZipPath -Dest $backup) {
            $null = Repair-OpenXYOSLayout $backup
        } else {
            Write-ProvLog "backup extract skipped/failed: $backup"
        }
    }
}

if (-not (Test-OpenXYOSLayout $LiveDir)) {
    foreach ($backup in @($backupRuntime, $backupOpen)) {
        if (Test-OpenXYOSLayout $backup) {
            Write-ProvLog "Healing live dir from $backup"
            Copy-OpenXYOSTree $backup $LiveDir
            break
        }
    }
    $null = Repair-OpenXYOSLayout $LiveDir
}

if (-not (Test-Path -LiteralPath (Join-Path $LiveDir 'node\node.exe'))) {
    Write-ProvLog 'node\node.exe missing after extract/heal'
    exit 6
}
$nestedFe = Join-Path $LiveDir 'openxyos\dist\index.html'
$flatFe = Join-Path $LiveDir 'dist\index.html'
if (-not ((Test-Path -LiteralPath $nestedFe) -or (Test-Path -LiteralPath $flatFe))) {
    Write-ProvLog 'dist\index.html missing after extract/heal'
    exit 7
}

$readme = @(
    'FreeOS local openXYOS environment'
    "Live workdir (writable): $LiveDir"
    "Install backup: $backupOpen"
    "Sealed backup: $backupRuntime"
    'URL: http://127.0.0.1:3780'
) -join "`r`n"
Set-Content -LiteralPath (Join-Path $LiveDir 'README.txt') -Value $readme -Encoding ASCII
try {
    Set-Content -LiteralPath (Join-Path $backupOpen 'README.txt') -Value $readme -Encoding ASCII
} catch {
}

if ($env:USERNAME) {
    $grantRoot = Split-Path -Parent $LiveDir
    $null = & icacls.exe $grantRoot /grant "${env:USERNAME}:(OI)(CI)M" /T /C /Q 2>&1
}

Install-StartHelpers $LiveDir

if (Test-OpenXYOSLivez) {
    Write-ProvLog 'livez already healthy after extract'
    if (Write-InstallReady $LiveDir) { exit 0 }
    exit 13
}

if (-not (Start-OpenXYOSUnelevated $LiveDir)) {
    Write-ProvLog 'failed to launch FE/BE at medium integrity'
    exit 10
}

if (Wait-OpenXYOSLivez $LivezTimeoutSec) {
    if (Write-InstallReady $LiveDir) { exit 0 }
    exit 13
}

Write-ProvLog "livez not ready after ${LivezTimeoutSec}s; re-invoking start once"
if (-not (Start-OpenXYOSUnelevated $LiveDir)) {
    Write-ProvLog 'retry start failed'
    exit 10
}
if (Wait-OpenXYOSLivez $RetryTimeoutSec) {
    if (Write-InstallReady $LiveDir) { exit 0 }
    exit 13
}

Write-ProvLog 'livez timeout after start retry — see this log (not assumed to be port 3780 in use)'
exit 12

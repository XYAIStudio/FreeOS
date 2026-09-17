# Install-time openXYOS provisioner (child process of the FreeOS NSIS Setup).
# Extract + normalize + start once at medium IL + wait livez + write .install-ready.
# Exit 0 only when http://127.0.0.1:3780/api/health/livez is healthy.
# On success, deletes $InstallDir\openxyos-runtime (folder + archive) and a
# sibling openxyos-runtime under the live parent. Never deletes $LiveDir or
# $InstallDir\openxyos. Failed runs leave staging in place for debugging.
# Does NOT register HKCU Run / scheduled-task logon autostart.
#
# Exit codes (NSIS maps these to localized MessageBox text):
#   0  healthy (.install-ready written; openxyos-runtime staging removed)
#   2  zip missing
#   3  tar extract into live dir failed
#   5  tar.exe missing
#   6  node\node.exe missing after extract/heal
#   7  dist\index.html missing after extract/heal
#  10  could not start FE/BE, or Node died before livez (see start.log)
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

function Get-OpenXYOSAppDirs {
    param([string]$Root)
    return @(
        (Join-Path $Root 'openxyos'),
        $Root
    )
}

function Test-OpenXYOSCompiledSql {
    param([string]$Root)
    $need = @(
        '013_audit_bundle.sql',
        '014_cluster_nodes.sql',
        '015_tenant_industry_packages.sql',
        '016_tenant_module_settings.sql'
    )
    foreach ($app in (Get-OpenXYOSAppDirs $Root)) {
        $compiled = Join-Path $app 'backend-dist\server.js'
        if (-not (Test-Path -LiteralPath $compiled)) { continue }
        $dest = Join-Path $app 'backend-dist\migrations'
        foreach ($name in $need) {
            if (-not (Test-Path -LiteralPath (Join-Path $dest $name))) { return $false }
        }
        return $true
    }
    return $true
}

function Repair-OpenXYOSMigrations {
    param([string]$Root)
    $need = @(
        '013_audit_bundle.sql',
        '014_cluster_nodes.sql',
        '015_tenant_industry_packages.sql',
        '016_tenant_module_settings.sql'
    )
    foreach ($app in (Get-OpenXYOSAppDirs $Root)) {
        $compiled = Join-Path $app 'backend-dist\server.js'
        if (-not (Test-Path -LiteralPath $compiled)) { continue }
        $dest = Join-Path $app 'backend-dist\migrations'
        $src = Join-Path $app 'backend\migrations'
        $missing = $false
        foreach ($name in $need) {
            if (-not (Test-Path -LiteralPath (Join-Path $dest $name))) { $missing = $true; break }
        }
        if (-not $missing) { continue }
        if (Test-Path -LiteralPath $src) {
            Write-ProvLog "Copying $src -> $dest (compiled server needs runtime SQL)"
            New-Item -ItemType Directory -Force -Path $dest | Out-Null
            Copy-Item -Path (Join-Path $src '*') -Destination $dest -Force
        }
    }
}

function Test-OpenXYOSLivez {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:3780/api/health/livez'
        return ($r.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Get-StartLogExcerpt {
    $paths = @(
        (Join-Path $LiveDir 'start.log'),
        (Join-Path $LiveDir 'start.err.log'),
        (Join-Path $LiveDir 'start.out.log')
    )
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($p in $paths) {
        if (Test-Path -LiteralPath $p) {
            Get-Content -LiteralPath $p -Tail 40 -ErrorAction SilentlyContinue | ForEach-Object {
                $lines.Add($_)
            }
        }
    }
    if ($lines.Count -eq 0) { return '' }
    return ($lines | Select-Object -Last 40) -join "`n"
}

function Write-StartLogExcerpt {
    $excerpt = Get-StartLogExcerpt
    if (-not $excerpt) {
        Write-ProvLog 'start.log empty or missing (Node produced no stdout/stderr)'
        return
    }
    Write-ProvLog '--- start.log excerpt ---'
    foreach ($line in ($excerpt -split "`n")) {
        Write-ProvLog $line
    }
    Write-ProvLog '--- end start.log ---'
}

function Test-OpenXYOSPortListen {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect('127.0.0.1', 3780, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(300, $false)
        if (-not $ok) {
            $client.Close()
            return $false
        }
        $client.EndConnect($iar)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

function Test-OpenXYOSNodeAlive {
    $pidFile = Join-Path $LiveDir 'start.pid'
    if (Test-Path -LiteralPath $pidFile) {
        $raw = (Get-Content -LiteralPath $pidFile -Raw -ErrorAction SilentlyContinue)
        $nid = 0
        if ($null -ne $raw -and [int]::TryParse($raw.Trim(), [ref]$nid) -and $nid -gt 0) {
            $p = Get-Process -Id $nid -ErrorAction SilentlyContinue
            if ($p -and -not $p.HasExited) { return $true }
        }
    }
    $nodes = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodes) { return $true }
    return $false
}

function Wait-OpenXYOSLivez {
    param([int]$Seconds)
    for ($i = 0; $i -lt $Seconds; $i++) {
        if (Test-OpenXYOSLivez) { return $true }
        if ($i -ge 8 -and -not (Test-OpenXYOSLivez) -and -not (Test-OpenXYOSPortListen) -and -not (Test-OpenXYOSNodeAlive)) {
            Write-ProvLog 'Node is not running and 3780 is not listening during livez wait'
            Write-StartLogExcerpt
            exit 10
        }
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

function Test-SamePath {
    param([string]$Left, [string]$Right)
    if (-not $Left -or -not $Right) { return $false }
    try {
        $a = [IO.Path]::GetFullPath($Left)
        $b = [IO.Path]::GetFullPath($Right)
    } catch {
        return $false
    }
    return $a.Equals($b, [StringComparison]::OrdinalIgnoreCase)
}

function Test-PathUnderRoot {
    param([string]$Path, [string]$Root)
    if (-not $Path -or -not $Root) { return $false }
    try {
        $full = [IO.Path]::GetFullPath($Path)
        $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    } catch {
        return $false
    }
    if ($full.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    $prefix = $rootFull + [IO.Path]::DirectorySeparatorChar
    return $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
}

function Remove-OpenXYOSStaging {
    $keepLive = $LiveDir
    $keepInstall = Join-Path $InstallDir 'openxyos'
    $stageDirs = New-Object System.Collections.Generic.List[string]
    $stageDirs.Add((Join-Path $InstallDir 'openxyos-runtime'))
    $liveParent = ''
    if ($LiveDir) {
        $liveParent = Split-Path -Parent $LiveDir
        if ($liveParent) {
            $stageDirs.Add((Join-Path $liveParent 'openxyos-runtime'))
        }
    }
    foreach ($dir in $stageDirs) {
        if (-not (Test-Path -LiteralPath $dir)) { continue }
        if ((Test-SamePath $dir $keepLive) -or (Test-SamePath $dir $keepInstall)) {
            Write-ProvLog "Skipping staging cleanup of protected path $dir"
            continue
        }
        Write-ProvLog "Removing staging directory $dir"
        Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
    }
    $archiveRoots = New-Object System.Collections.Generic.List[string]
    if ($InstallDir) { $archiveRoots.Add($InstallDir) }
    if ($liveParent) { $archiveRoots.Add($liveParent) }
    foreach ($root in $archiveRoots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        Get-ChildItem -LiteralPath $root -File -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Name -notmatch '(?i)^openxyos-runtime(\.(zip|7z|tgz|tar|tar\.gz))?$') { return }
            Write-ProvLog "Removing staging archive $($_.FullName)"
            Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
        }
    }
    if ($ZipPath -and (Test-Path -LiteralPath $ZipPath)) {
        $zipIsStaging = (Test-PathUnderRoot $ZipPath $InstallDir) -or (
            $liveParent -and (Test-PathUnderRoot $ZipPath $liveParent)
        )
        if ($zipIsStaging) {
            Write-ProvLog "Removing staging zip $ZipPath"
            Remove-Item -LiteralPath $ZipPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Complete-OpenXYOSSuccess {
    if (-not (Write-InstallReady $LiveDir)) {
        exit 13
    }
    Remove-OpenXYOSStaging
    exit 0
}

# --- main ---
New-Item -ItemType Directory -Force -Path $LiveDir | Out-Null
Write-ProvLog "provision-openxyos start zip=$ZipPath install=$InstallDir live=$LiveDir"

$marker = Join-Path $LiveDir '.install-ready'
if ((Test-OpenXYOSLayout $LiveDir) -and (Test-OpenXYOSLivez)) {
    Write-ProvLog 'Already extracted and livez healthy (idempotent)'
    Complete-OpenXYOSSuccess
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

# Live dir may already look complete (node + dist) from a prior install that
# shipped backend-dist/server.js without migrations. Heal SQL in place so
# initDatabase does not ENOENT on 013_audit_bundle.sql.
Repair-OpenXYOSMigrations $LiveDir
if (-not (Test-OpenXYOSCompiledSql $LiveDir)) {
    foreach ($backup in @($backupRuntime, $backupOpen)) {
        Repair-OpenXYOSMigrations $backup
        foreach ($app in (Get-OpenXYOSAppDirs $backup)) {
            $src = Join-Path $app 'backend-dist\migrations'
            if (-not (Test-Path -LiteralPath $src)) { continue }
            foreach ($liveApp in (Get-OpenXYOSAppDirs $LiveDir)) {
                $compiled = Join-Path $liveApp 'backend-dist\server.js'
                if (-not (Test-Path -LiteralPath $compiled)) { continue }
                $dest = Join-Path $liveApp 'backend-dist\migrations'
                Write-ProvLog "Healing runtime SQL $src -> $dest"
                New-Item -ItemType Directory -Force -Path $dest | Out-Null
                Copy-Item -Path (Join-Path $src '*') -Destination $dest -Force
            }
        }
    }
}

$readme = @(
    'FreeOS local openXYOS environment'
    "Live workdir (writable): $LiveDir"
    "Install copy: $backupOpen"
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
    Complete-OpenXYOSSuccess
}

if (-not (Start-OpenXYOSUnelevated $LiveDir)) {
    Write-ProvLog 'failed to launch FE/BE at medium integrity'
    Write-StartLogExcerpt
    exit 10
}

if (Wait-OpenXYOSLivez $LivezTimeoutSec) {
    Complete-OpenXYOSSuccess
}

Write-ProvLog "livez not ready after ${LivezTimeoutSec}s; re-invoking start once"
if (-not (Start-OpenXYOSUnelevated $LiveDir)) {
    Write-ProvLog 'retry start failed'
    Write-StartLogExcerpt
    exit 10
}
if (Wait-OpenXYOSLivez $RetryTimeoutSec) {
    Complete-OpenXYOSSuccess
}

Write-ProvLog 'livez timeout after start retry — see this log and start.log (not assumed to be port 3780 in use)'
Write-StartLogExcerpt
exit 12

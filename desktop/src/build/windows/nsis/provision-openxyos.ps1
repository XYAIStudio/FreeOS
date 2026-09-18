# Install-time openXYOS provisioner (child process of the FreeOS NSIS Setup).
# Stop owned FreeOS openXYOS Node (start.pid / live+install paths only),
# extract the runtime zip ONCE (staging under LocalAppData, then one move
# into $LiveDir). Do not also extract full copies into $InstallDir\openxyos
# or $InstallDir\openxyos-runtime — those stay README stubs only.
# Heal nested openxyos\openxyos into a canonical top-level tree and delete
# the leftover nested payload. Start once at medium IL, wait livez, write
# .install-ready only when livez is healthy AND start.pid is still alive.
# Exit 0 only when http://127.0.0.1:3780/api/health/livez is healthy.
# Full logs stay UTF-8 in %LOCALAPPDATA%\FreeOS\openxyos\provision.log and
# start.log. Host/NSIS detail gets OEM-safe (ACP/GBK) short status only —
# never raw Node console (seed / auth POST / WebSocket). Transient
# [Error] POST /api/auth lines are not a provision failure when livez is up.
# On success, deletes $InstallDir\openxyos-runtime (folder + archive) and a
# sibling openxyos-runtime under the live parent. Never deletes $LiveDir or
# $InstallDir\openxyos. Failed runs leave staging in place for debugging.
# Does NOT register HKCU Run / scheduled-task logon autostart.
#
# Exit codes (NSIS maps these to localized MessageBox text):
#   0  healthy (.install-ready written; openxyos-runtime staging removed)
#   2  zip missing
#   3  live layout still incomplete after extract+heal
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

# NSIS ExecToLog / cmd.exe treat child stdout as the system ANSI code page
# (CP936/GBK on Chinese Windows). PowerShell 5.1 Write-Host is UTF-16/UTF-8,
# so Chinese Node lines become mojibake. Emit ACP bytes for the console;
# keep the on-disk log UTF-8.
function Get-NsisOemEncoding {
    $cp = 0
    try {
        $cp = [Console]::OutputEncoding.CodePage
    } catch {
        $cp = 0
    }
    if ($cp -le 0) {
        try {
            $cp = [int](Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Nls\CodePage' -Name ACP).ACP
        } catch {
            $cp = 0
        }
    }
    if ($cp -le 0) {
        return [System.Text.Encoding]::Default
    }
    try {
        return [System.Text.Encoding]::GetEncoding($cp)
    } catch {
        return [System.Text.Encoding]::Default
    }
}

function ConvertTo-NsisOemText {
    param([string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return '' }
    $oem = Get-NsisOemEncoding
    $roundtrip = $oem.GetString($oem.GetBytes($Text))
    if ($roundtrip -eq $Text) { return $Text }
    $chars = New-Object System.Text.StringBuilder
    foreach ($ch in $Text.ToCharArray()) {
        if ([int]$ch -lt 128) { [void]$chars.Append($ch) }
    }
    return $chars.ToString().Trim()
}

function Write-ProvHost {
    param([string]$Message)
    if ([string]::IsNullOrEmpty($Message)) { return }
    $safe = ConvertTo-NsisOemText $Message
    if ([string]::IsNullOrEmpty($safe)) { return }
    try {
        $oem = Get-NsisOemEncoding
        $payload = $oem.GetBytes($safe + [Environment]::NewLine)
        $stdout = [Console]::OpenStandardOutput()
        $stdout.Write($payload, 0, $payload.Length)
    } catch {
        Write-Host $safe
    }
}

function Write-ProvLog {
    param(
        [string]$Message,
        [switch]$Quiet
    )
    $line = '{0} {1}' -f (Get-Date -Format o), $Message
    if (-not $Quiet) {
        Write-ProvHost $Message
    }
    try {
        $dir = Split-Path -Parent $script:LogPath
        if ($dir -and -not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        Add-Content -LiteralPath $script:LogPath -Value $line -Encoding UTF8
    } catch {
    }
}

function Test-OpenXYOSTransientConsoleLine {
    param([string]$Line)
    if ([string]::IsNullOrEmpty($Line)) { return $false }
    if ($Line -match '(?i)POST\s+/api/auth') { return $true }
    if ($Line -match '(?i)\[seed\]') { return $true }
    if ($Line -match '(?i)node still running pid=') { return $true }
    if ($Line -match '(?i)WebSocket:') { return $true }
    if ($Line -match '(?i)Server:\s+https?://') { return $true }
    return $false
}

function Test-OpenXYOSLayout {
    param([string]$Root)
    $node = Join-Path $Root 'node\node.exe'
    if (-not (Test-Path -LiteralPath $node)) { return $false }
    $nested = Join-Path $Root 'openxyos\dist\index.html'
    $flat = Join-Path $Root 'dist\index.html'
    return (Test-Path -LiteralPath $nested) -or (Test-Path -LiteralPath $flat)
}

function Test-OpenXYOSAppReady {
    param([string]$Root)
    if (-not $Root) { return $false }
    $fe = Join-Path $Root 'dist\index.html'
    $be = Join-Path $Root 'backend-dist\server.js'
    return (Test-Path -LiteralPath $fe) -and (Test-Path -LiteralPath $be)
}

# Prefer the healed live root. Nested openxyos\openxyos cwd makes Node
# exit immediately with empty stdout/stderr (livez then times out).
function Resolve-OpenXYOSAppDir {
    param([string]$Root)
    if (Test-OpenXYOSAppReady $Root) { return $Root }
    $nested = Join-Path $Root 'openxyos'
    if (Test-OpenXYOSAppReady $nested) { return $nested }
    $nestedFe = Join-Path $nested 'dist\index.html'
    if (Test-Path -LiteralPath $nestedFe) { return $nested }
    return $Root
}

function Copy-OpenXYOSTree {
    param([string]$Src, [string]$Dest)
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    $xcopy = Join-Path $env:SystemRoot 'System32\xcopy.exe'
    if (Test-Path -LiteralPath $xcopy) {
        & $xcopy /E /I /Y "$Src\*" "$Dest\" | Out-Null
        return
    }
    Copy-Item -Path (Join-Path $Src '*') -Destination $Dest -Recurse -Force
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
    $nestedFe = Join-Path $Root 'openxyos\dist\index.html'
    $flatFe = Join-Path $Root 'dist\index.html'
    $nestedBe = Join-Path $Root 'openxyos\backend-dist\server.js'
    $flatBe = Join-Path $Root 'backend-dist\server.js'
    if ((Test-Path -LiteralPath $nestedFe) -and -not (Test-Path -LiteralPath $flatFe)) {
        Write-ProvLog "Normalizing nested layout $nestedFe -> $Root"
        Copy-OpenXYOSTree (Join-Path $Root 'openxyos') $Root
    } elseif ((Test-Path -LiteralPath $nestedBe) -and -not (Test-Path -LiteralPath $flatBe)) {
        Write-ProvLog "Normalizing nested backend $nestedBe -> $Root"
        Copy-OpenXYOSTree (Join-Path $Root 'openxyos') $Root
    }
    if (Test-OpenXYOSLayout $Root) {
        Remove-OpenXYOSNestedLeftover $Root
        return $true
    }
    $found = Find-OpenXYOSBundleRoot $Root
    if (-not $found) { return $false }
    $fullFound = [IO.Path]::GetFullPath($found)
    $fullRoot = [IO.Path]::GetFullPath($Root)
    if ($fullFound -eq $fullRoot) {
        Remove-OpenXYOSNestedLeftover $Root
        return $true
    }
    Write-ProvLog "Normalizing nested layout $found -> $Root"
    Copy-OpenXYOSTree $found $Root
    $ok = Test-OpenXYOSLayout $Root
    if ($ok) { Remove-OpenXYOSNestedLeftover $Root }
    return $ok
}

# After flatten, leftover openxyos\openxyos still confuses cwd. Drop it
# only when the top-level tree already has dist + backend-dist.
function Remove-OpenXYOSNestedLeftover {
    param([string]$Root)
    if (-not (Test-OpenXYOSAppReady $Root)) { return }
    $nested = Join-Path $Root 'openxyos'
    if (-not (Test-Path -LiteralPath $nested)) { return }
    $nestedFe = Join-Path $nested 'dist\index.html'
    $nestedBe = Join-Path $nested 'backend-dist\server.js'
    if (-not ((Test-Path -LiteralPath $nestedFe) -or (Test-Path -LiteralPath $nestedBe))) {
        return
    }
    Write-ProvLog "Removing leftover nested payload $nested"
    Remove-Item -LiteralPath $nested -Recurse -Force -ErrorAction SilentlyContinue
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
    param([switch]$LogError)
    $url = 'http://127.0.0.1:3780/api/health/livez'
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $url
        return ($r.StatusCode -lt 500)
    } catch {
        if ($LogError) {
            $detail = $_.Exception.Message
            try {
                if ($_.Exception.Response) {
                    $detail = '{0} HTTP {1}' -f $url, [int]$_.Exception.Response.StatusCode
                }
            } catch {
            }
            Write-ProvLog "livez probe failed: $detail"
        }
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
        Write-ProvLog -Quiet 'start.log empty or missing (Node produced no stdout/stderr)'
        return
    }
    Write-ProvLog -Quiet '--- start.log excerpt (UTF-8 file only; not shown in NSIS) ---'
    foreach ($line in ($excerpt -split "`n")) {
        Write-ProvLog -Quiet $line
    }
    Write-ProvLog -Quiet '--- end start.log ---'
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

function Read-OpenXYOSPidFile {
    param([string]$Dir)
    $pidFile = Join-Path $Dir 'start.pid'
    if (-not (Test-Path -LiteralPath $pidFile)) { return 0 }
    $raw = (Get-Content -LiteralPath $pidFile -Raw -ErrorAction SilentlyContinue)
    $nid = 0
    if ($null -ne $raw -and [int]::TryParse($raw.Trim(), [ref]$nid) -and $nid -gt 0) {
        return $nid
    }
    return 0
}

function Test-OpenXYOSPidAlive {
    $nid = Read-OpenXYOSPidFile $LiveDir
    if ($nid -le 0) { return $false }
    $p = Get-Process -Id $nid -ErrorAction SilentlyContinue
    return ($p -and -not $p.HasExited)
}

function Test-OpenXYOSNodeAlive {
    if (Test-OpenXYOSPidAlive) { return $true }
    return (Test-OpenXYOSOwnNode)
}

function Get-StartLogStamp {
    $p = Join-Path $LiveDir 'start.log'
    if (-not (Test-Path -LiteralPath $p)) { return $null }
    return (Get-Item -LiteralPath $p).LastWriteTimeUtc
}

function Test-StartLogShowsFailFast {
    $p = Join-Path $LiveDir 'start.log'
    if (-not (Test-Path -LiteralPath $p)) { return $false }
    $text = Get-Content -LiteralPath $p -Raw -ErrorAction SilentlyContinue
    if (-not $text) { return $false }
    return ($text -match 'node exited .+ \(fail-fast\)')
}

function Test-StartLogsEmpty {
    $out = Join-Path $LiveDir 'start.out.log'
    $err = Join-Path $LiveDir 'start.err.log'
    $outEmpty = (-not (Test-Path -LiteralPath $out)) -or ((Get-Item -LiteralPath $out).Length -eq 0)
    $errEmpty = (-not (Test-Path -LiteralPath $err)) -or ((Get-Item -LiteralPath $err).Length -eq 0)
    return ($outEmpty -and $errEmpty)
}

function Test-StartClaimUnreliable {
    if (Test-StartLogShowsFailFast) { return $true }
    if (Test-StartLogsEmpty -and -not (Test-OpenXYOSPidAlive) -and -not (Test-OpenXYOSLivez)) {
        return $true
    }
    if (Test-OpenXYOSLivez -and (Test-OpenXYOSPidAlive -or (Test-OpenXYOSOwnNode))) {
        return $false
    }
    if (Test-OpenXYOSPidAlive) { return $false }
    return $true
}

function Wait-OpenXYOSStartEvidence {
    param($BeforeUtc, [int]$Seconds = 12)
    # Do not treat a mere start.log rewrite (JWT/layout banner) as success.
    # That races Shell.Application "started" against a process that then
    # fail-fasts with empty stdout/stderr.
    for ($i = 0; $i -lt $Seconds; $i++) {
        if (Test-OpenXYOSOwnLivez -and (Test-OpenXYOSPidAlive)) { return $true }
        if (Test-StartLogShowsFailFast) { return $true }
        if (Test-OpenXYOSPidAlive) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Wait-OpenXYOSLivez {
    param([int]$Seconds)
    # Success is livez only. Transient Node console (auth probe, seed banner,
    # websocket status) is startup noise — not a provision failure.
    for ($i = 0; $i -lt $Seconds; $i++) {
        if (Test-OpenXYOSOwnLivez -and (Test-OpenXYOSPidAlive -or (Test-OpenXYOSOwnNode))) { return $true }
        if (Test-StartLogShowsFailFast) {
            Write-ProvLog 'Node exited fail-fast during livez wait (see start.log cwd)'
            Write-StartLogExcerpt
            exit 10
        }
        if ($i -ge 8 -and -not (Test-OpenXYOSLivez) -and -not (Test-OpenXYOSPortListen) -and -not (Test-OpenXYOSNodeAlive)) {
            Write-ProvLog 'Node is not running and 3780 is not listening during livez wait'
            $null = Test-OpenXYOSLivez -LogError
            Write-StartLogExcerpt
            exit 10
        }
        Start-Sleep -Seconds 1
    }
    $null = Test-OpenXYOSLivez -LogError
    return $false
}

function Start-OpenXYOSUnelevated {
    param([string]$Dir)
    $helper = Join-Path $Dir 'start-sidecar.ps1'
    if (-not (Test-Path -LiteralPath $helper)) {
        Write-ProvLog "start helper missing: $helper"
        return $false
    }
    $app = Resolve-OpenXYOSAppDir $Dir
    Write-ProvLog "start cwd=$app (live=$Dir)"
    $pwsh = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$helper`""
    $before = Get-StartLogStamp
    try {
        $shell = New-Object -ComObject Shell.Application
        $shell.ShellExecute($pwsh, $arg, $Dir, 'open', 0)
        Write-ProvLog 'Started FE/BE via Shell.Application (IShellDispatch2 / medium IL)'
        if (Wait-OpenXYOSStartEvidence $before 12) {
            if (Test-StartClaimUnreliable) {
                Write-ProvLog 'Shell.Application 声称已启动，但 start.log 显示 fail-fast 或日志为空；改走直接启动'
            } else {
                return $true
            }
        } else {
            Write-ProvLog 'Shell.Application produced no fresh start.pid/livez'
        }
    } catch {
        Write-ProvLog "Shell.Application failed: $($_.Exception.Message)"
    }
    $cmd = Join-Path $Dir 'start-sidecar.cmd'
    $explorer = Join-Path $env:WINDIR 'explorer.exe'
    if ((Test-Path -LiteralPath $cmd) -and (Test-Path -LiteralPath $explorer)) {
        $before = Get-StartLogStamp
        try {
            Start-Process -FilePath $explorer -ArgumentList "`"$cmd`""
            Write-ProvLog 'Started FE/BE via explorer.exe (medium IL fallback)'
            if (Wait-OpenXYOSStartEvidence $before 12) {
                if (Test-StartClaimUnreliable) {
                    Write-ProvLog 'explorer 声称已启动，但 start.log 显示 fail-fast 或日志为空；改走直接启动'
                } else {
                    return $true
                }
            } else {
                Write-ProvLog 'explorer fallback produced no fresh start.pid/livez'
            }
        } catch {
            Write-ProvLog "explorer fallback failed: $($_.Exception.Message)"
        }
    }
    $before = Get-StartLogStamp
    try {
        Start-Process -FilePath $pwsh -ArgumentList $arg -WorkingDirectory $Dir -WindowStyle Hidden
        Write-ProvLog 'Started FE/BE via Start-Process (direct powershell fallback)'
        if (Wait-OpenXYOSStartEvidence $before 12) {
            if (Test-StartClaimUnreliable) {
                Write-ProvLog '直接启动后 Node fail-fast 或日志为空'
                return $false
            }
            return $true
        }
        Write-ProvLog 'direct Start-Process produced no fresh start.pid/livez'
    } catch {
        Write-ProvLog "direct Start-Process failed: $($_.Exception.Message)"
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

function Get-OpenXYOSLockRoots {
    $roots = New-Object System.Collections.Generic.List[string]
    if ($LiveDir) { $roots.Add($LiveDir) }
    if ($InstallDir) { $roots.Add((Join-Path $InstallDir 'openxyos')) }
    return $roots
}

function Test-CommandLineMentionsRoot {
    param([string]$CommandLine, [string]$Root)
    if (-not $CommandLine -or -not $Root) { return $false }
    try {
        $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    } catch {
        return $false
    }
    $normCmd = $CommandLine.Replace('/', '\').ToLowerInvariant()
    $normRoot = $rootFull.Replace('/', '\').ToLowerInvariant()
    return $normCmd.Contains($normRoot)
}

function Test-OpenXYOSOwnedPath {
    param([string]$Path)
    if (-not $Path) { return $false }
    foreach ($root in (Get-OpenXYOSLockRoots)) {
        if (Test-PathUnderRoot $Path $root) { return $true }
    }
    return $false
}

function Test-OpenXYOSOwnedCommandLine {
    param([string]$CommandLine)
    if (-not $CommandLine) { return $false }
    foreach ($root in (Get-OpenXYOSLockRoots)) {
        if (Test-CommandLineMentionsRoot $CommandLine $root) { return $true }
    }
    return $false
}

function Test-OpenXYOSOwnNode {
    foreach ($root in (Get-OpenXYOSLockRoots)) {
        $nid = Read-OpenXYOSPidFile $root
        if ($nid -le 0) { continue }
        $p = Get-Process -Id $nid -ErrorAction SilentlyContinue
        if (-not $p -or $p.HasExited) { continue }
        $exe = $null
        try { $exe = $p.Path } catch { }
        $name = ''
        try { $name = $p.ProcessName } catch { }
        if ($exe -and -not (Test-OpenXYOSOwnedPath $exe)) { continue }
        if ($name -and $name -ne 'node') { continue }
        return $true
    }
    $nodes = Get-Process -Name node -ErrorAction SilentlyContinue
    foreach ($p in @($nodes)) {
        $exe = $null
        try { $exe = $p.Path } catch { }
        if ($exe -and (Test-OpenXYOSOwnedPath $exe)) { return $true }
    }
    try {
        $cimNodes = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue)
        foreach ($row in $cimNodes) {
            if ((Test-OpenXYOSOwnedPath $row.ExecutablePath) -or (Test-OpenXYOSOwnedCommandLine $row.CommandLine)) {
                return $true
            }
        }
    } catch {
    }
    return $false
}

function Test-OpenXYOSOwnLivez {
    if (-not (Test-OpenXYOSLivez)) { return $false }
    return (Test-OpenXYOSOwnNode)
}

function Stop-OpenXYOSNode {
    param([string]$Root)
    if (-not $Root) { return }
    $pidFile = Join-Path $Root 'start.pid'
    if (Test-Path -LiteralPath $pidFile) {
        $nid = Read-OpenXYOSPidFile $Root
        if ($nid -gt 0) {
            Write-ProvLog "Stopping FreeOS openXYOS process pid=$nid ($Root)"
            Stop-Process -Id $nid -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }
    $nodeExe = Join-Path $Root 'node\node.exe'
    $want = ''
    if (Test-Path -LiteralPath $nodeExe) {
        try { $want = [IO.Path]::GetFullPath($nodeExe) } catch { $want = $nodeExe }
    }
    $fullRoot = ''
    try { $fullRoot = [IO.Path]::GetFullPath($Root) } catch { $fullRoot = $Root }
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            if ($want -and $_.ExecutablePath) {
                try {
                    return ([IO.Path]::GetFullPath($_.ExecutablePath) -eq $want)
                } catch {
                }
            }
            if ($fullRoot -and $_.CommandLine) {
                return ($_.CommandLine -like "*$fullRoot*")
            }
            return $false
        } |
        ForEach-Object {
            Write-ProvLog "Stopping FreeOS openXYOS process pid=$($_.ProcessId) ($Root)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
}

function Wait-OpenXYOSOwnedNodeGone {
    param([int]$TimeoutMs = 8000)
    $deadline = [datetime]::UtcNow.AddMilliseconds($TimeoutMs)
    do {
        if (-not (Test-OpenXYOSOwnNode)) { return $true }
        Start-Sleep -Milliseconds 250
    } while ([datetime]::UtcNow -lt $deadline)
    return (-not (Test-OpenXYOSOwnNode))
}

function Stop-OpenXYOSLockedProcesses {
    Write-ProvLog 'Stopping FreeOS openXYOS processes before extract'
    $any = $false
    foreach ($root in (Get-OpenXYOSLockRoots)) {
        if (-not $root) { continue }
        $any = $true
        Stop-OpenXYOSNode $root
    }
    if (-not $any) {
        Write-ProvLog 'No FreeOS openXYOS lock roots to stop before extract'
        return
    }
    if (Wait-OpenXYOSOwnedNodeGone) {
        Write-ProvLog 'FreeOS openXYOS processes stopped before extract'
        return
    }
    Write-ProvLog 'Owned FreeOS openXYOS node still running after stop; retrying stop'
    foreach ($root in (Get-OpenXYOSLockRoots)) {
        if (-not $root) { continue }
        Stop-OpenXYOSNode $root
    }
    if (-not (Wait-OpenXYOSOwnedNodeGone 5000)) {
        Write-ProvLog 'Owned node still present after second stop (extract may fail if files are locked)'
    }
}

function Clear-OpenXYOSPayload {
    param([string]$Root)
    foreach ($name in @('node', 'openxyos', 'org-sidecar', 'dist', 'backend', 'backend-dist')) {
        $p = Join-Path $Root $name
        if (-not (Test-Path -LiteralPath $p)) { continue }
        Write-ProvLog "Clearing stale payload $p"
        Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function New-OpenXYOSExtractTemp {
    $base = ''
    if ($env:LOCALAPPDATA) {
        $base = Join-Path $env:LOCALAPPDATA 'FreeOS'
    }
    if (-not $base) {
        $base = Split-Path -Parent $LiveDir
    }
    if (-not $base) {
        $base = $env:TEMP
    }
    $dir = Join-Path $base ('openxyos-extract-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    return $dir
}

function Invoke-TarExtract {
    param([string]$Tar, [string]$Zip, [string]$Dest)
    $extractDir = New-OpenXYOSExtractTemp
    Write-ProvLog "tar -xf $Zip -C $extractDir (staging, dest=$Dest)"
    $output = & $Tar -xf $Zip -C $extractDir 2>&1
    $code = $LASTEXITCODE
    if ($null -eq $code) { $code = 0 }
    foreach ($row in @($output)) {
        $text = "$row"
        if ($text) { Write-ProvLog -Quiet "tar: $text" }
    }
    if ($code -ne 0) {
        Write-ProvLog "tar exit $code"
    }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    $null = Repair-OpenXYOSLayout $extractDir
    Remove-OpenXYOSNestedLeftover $extractDir
    $tempOk = Test-OpenXYOSLayout $extractDir
    if ($tempOk) {
        Clear-OpenXYOSPayload $Dest
        Write-ProvLog "moving staging $extractDir -> $Dest (single extract)"
        if (-not (Move-OpenXYOSTree $extractDir $Dest)) {
            Write-ProvLog "move failed; copying staging into $Dest"
            Copy-OpenXYOSTree $extractDir $Dest
        }
    } elseif (Test-Path -LiteralPath $extractDir) {
        Write-ProvLog "temp extract layout incomplete; merging into $Dest"
        Copy-OpenXYOSTree $extractDir $Dest
    }
    $null = Repair-OpenXYOSLayout $Dest
    Remove-OpenXYOSNestedLeftover $Dest
    $ok = Test-OpenXYOSLayout $Dest
    if ($ok -and $code -ne 0) {
        Write-ProvLog "tar returned $code but layout is complete; treating extract as success"
    }
    if (-not $ok) {
        Write-ProvLog "extract layout incomplete after tar exit $code"
    }
    Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    return $ok
}

function Move-OpenXYOSTree {
    param([string]$Src, [string]$Dest)
    if (-not (Test-Path -LiteralPath $Src)) { return $false }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    try {
        Get-ChildItem -LiteralPath $Src -Force -ErrorAction Stop | ForEach-Object {
            $target = Join-Path $Dest $_.Name
            if (Test-Path -LiteralPath $target) {
                Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
            }
            Move-Item -LiteralPath $_.FullName -Destination $target -Force -ErrorAction Stop
        }
        return $true
    } catch {
        Write-ProvLog "Move-OpenXYOSTree failed: $($_.Exception.Message)"
        return $false
    }
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

function Test-OpenXYOSInstallReady {
    if (-not (Test-OpenXYOSLivez)) { return $false }
    if (Test-StartLogShowsFailFast -and -not (Test-OpenXYOSPidAlive) -and -not (Test-OpenXYOSOwnNode)) {
        return $false
    }
    if (Test-OpenXYOSPidAlive) { return $true }
    return (Test-OpenXYOSOwnNode)
}

function Complete-OpenXYOSSuccess {
    if (-not (Test-OpenXYOSInstallReady)) {
        Write-ProvLog '拒绝写入 .install-ready：livez 未通过或 start.pid 进程已退出。请查看 start.log。'
        Write-StartLogExcerpt
        exit 10
    }
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
$layoutReady = Test-OpenXYOSLayout $LiveDir
$ownLivez = Test-OpenXYOSOwnLivez
if ($layoutReady -and (Test-Path -LiteralPath $marker) -and $ownLivez) {
    Write-ProvLog 'Already extracted and livez healthy (idempotent)'
    Complete-OpenXYOSSuccess
}
if ((Test-OpenXYOSLivez) -and -not $layoutReady) {
    Write-ProvLog 'livez healthy but layout incomplete; not treating as idempotent'
}
if ($layoutReady -and (Test-OpenXYOSLivez) -and -not $ownLivez) {
    Write-ProvLog 'livez is up but not our FreeOS openxyos node; continuing provision'
}
if (Test-Path -LiteralPath $marker) {
    Write-ProvLog 'Removing stale .install-ready (livez not healthy or layout incomplete)'
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

Stop-OpenXYOSLockedProcesses

if (-not (Invoke-TarExtract -Tar $tar -Zip $ZipPath -Dest $LiveDir)) {
    Write-ProvLog 'extract into live dir returned incomplete layout'
}

$backupRuntime = Join-Path $InstallDir 'openxyos-runtime'
$backupOpen = Join-Path $InstallDir 'openxyos'
# Single zip extract only (into $LiveDir). $INSTDIR copies stay README stubs
# unless a leftover full tree from a previous install can heal the live dir.
if (-not (Test-OpenXYOSLayout $LiveDir)) {
    foreach ($backup in @($backupRuntime, $backupOpen)) {
        if (Test-OpenXYOSLayout $backup) {
            Write-ProvLog "Healing live dir from leftover $backup (no zip extract)"
            Copy-OpenXYOSTree $backup $LiveDir
            break
        }
    }
    $null = Repair-OpenXYOSLayout $LiveDir
    Remove-OpenXYOSNestedLeftover $LiveDir
}

if (-not (Test-OpenXYOSLayout $LiveDir)) {
    Write-ProvLog 'extract into live dir failed'
    exit 3
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
    'Install dir copies are README stubs only (runtime lives in LocalAppData).'
    'URL: http://127.0.0.1:3780'
) -join "`r`n"
Set-Content -LiteralPath (Join-Path $LiveDir 'README.txt') -Value $readme -Encoding ASCII
$stub = @(
    'FreeOS openXYOS install stub (not a runtime copy).'
    "Live workdir: $LiveDir"
    'URL: http://127.0.0.1:3780'
) -join "`r`n"
foreach ($stubDir in @($backupOpen, $backupRuntime)) {
    try {
        New-Item -ItemType Directory -Force -Path $stubDir | Out-Null
        Set-Content -LiteralPath (Join-Path $stubDir 'README.txt') -Value $stub -Encoding ASCII
    } catch {
    }
}

if ($env:USERNAME) {
    $grantRoot = Split-Path -Parent $LiveDir
    $null = & icacls.exe $grantRoot /grant "${env:USERNAME}:(OI)(CI)M" /T /C /Q 2>&1
}

Install-StartHelpers $LiveDir
$appDir = Resolve-OpenXYOSAppDir $LiveDir
Write-ProvLog "canonical openXYOS cwd=$appDir (prefer top-level when backend-dist+dist exist)"

if (Test-OpenXYOSOwnLivez) {
    Write-ProvLog 'livez already healthy after extract'
    Complete-OpenXYOSSuccess
}

if (-not (Start-OpenXYOSUnelevated $LiveDir)) {
    Write-ProvLog '无法启动 openXYOS：Node 已退出且未留下可用日志。未写入 .install-ready。请查看 start.log 与 provision.log。'
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

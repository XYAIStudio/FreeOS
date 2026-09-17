# Internal helper: start local openXYOS (FE+BE) at medium integrity.
# Used by the install-time provisioner and by FreeOS launch / Organization.
# Always stop a previous live-dir Node first so a day-old process cannot
# keep a stale CORS_ORIGIN (missing http://127.0.0.1:3780) and blank the iframe.
# Never start Node while this process is elevated (High IL).
$ErrorActionPreference = 'Continue'
$live = Split-Path -Parent $MyInvocation.MyCommand.Path
$livez = 'http://127.0.0.1:3780/api/health/livez'

function Test-Livez {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $livez
        return ($r.StatusCode -lt 500)
    } catch {
        return $false
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
        Copy-OpenXYOSTree (Join-Path $Root 'openxyos') $Root
    } elseif ((Test-Path -LiteralPath $nestedBe) -and -not (Test-Path -LiteralPath $flatBe)) {
        Copy-OpenXYOSTree (Join-Path $Root 'openxyos') $Root
    }
    if (Test-OpenXYOSLayout $Root) { return $true }
    $found = Find-OpenXYOSBundleRoot $Root
    if (-not $found) { return $false }
    $fullFound = [IO.Path]::GetFullPath($found)
    $fullRoot = [IO.Path]::GetFullPath($Root)
    if ($fullFound -eq $fullRoot) { return $true }
    Copy-OpenXYOSTree $found $Root
    return (Test-OpenXYOSLayout $Root)
}

function Stop-OpenXYOSNode {
    param([string]$Root)
    $pidFile = Join-Path $Root 'start.pid'
    if (Test-Path -LiteralPath $pidFile) {
        $raw = (Get-Content -LiteralPath $pidFile -Raw -ErrorAction SilentlyContinue)
        $nid = 0
        if ($null -ne $raw -and [int]::TryParse($raw.Trim(), [ref]$nid) -and $nid -gt 0) {
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
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
}

$null = Repair-OpenXYOSLayout $live
Stop-OpenXYOSNode $live
for ($i = 0; $i -lt 8; $i++) {
    if (-not (Test-Livez)) { break }
    Start-Sleep -Milliseconds 250
}

function Test-IsElevated {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (Test-IsElevated) {
    $pwsh = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    try {
        $shell = New-Object -ComObject Shell.Application
        $shell.ShellExecute($pwsh, $arg, $live, 'open', 0)
        exit 0
    } catch {
        Write-Error "cannot unelevate start-sidecar.ps1; refusing High-IL Node"
        exit 10
    }
}

$node = Join-Path $live 'node\node.exe'
$app = Join-Path $live 'openxyos'
if (-not (Test-Path -LiteralPath (Join-Path $app 'dist\index.html'))) {
    if (Test-Path -LiteralPath (Join-Path $live 'dist\index.html')) {
        $app = $live
    }
}
if (-not (Test-Path -LiteralPath $node)) { exit 6 }

# $HOME / $home is a read-only automatic variable in Windows PowerShell.
# Assigning it throws SessionStateUnauthorizedAccessException; with
# $ErrorActionPreference = Continue the script keeps going and $home stays
# the user profile root, so SQLite lands at %USERPROFILE%\org-os\...
$freeosHome = $env:FREEOS_HOME
if (-not $freeosHome) { $freeosHome = Join-Path $env:USERPROFILE '.freeos' }
$data = Join-Path $freeosHome 'org-os'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$secretFile = Join-Path $data 'sidecar.env'
$jwt = ''
$cookie = ''
$ingest = ''
if (Test-Path -LiteralPath $secretFile) {
    foreach ($line in Get-Content -LiteralPath $secretFile) {
        if ($line -match '^JWT_SECRET=(.+)$') { $jwt = $Matches[1] }
        if ($line -match '^COOKIE_SECRET=(.+)$') { $cookie = $Matches[1] }
        if ($line -match '^FREEOS_INGEST_TOKEN=(.+)$') { $ingest = $Matches[1] }
    }
}
if (-not $jwt) { $jwt = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }
if (-not $cookie) { $cookie = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }
if (-not $ingest) { $ingest = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }
@(
    "JWT_SECRET=$jwt"
    "COOKIE_SECRET=$cookie"
    "FREEOS_INGEST_TOKEN=$ingest"
) | Set-Content -LiteralPath $secretFile -Encoding ASCII

$env:NODE_ENV = 'production'
$env:PORT = '3780'
$env:DB_DIALECT = 'sqlite'
$env:DATABASE_PATH = Join-Path $data 'xiongyuan.db'
$env:AIR_GAP_MODE = 'true'
$env:SEED_DEMO_DATA = 'false'
$env:ALLOW_PUBLIC_REGISTRATION = 'false'
$env:JWT_SECRET = $jwt
$env:COOKIE_SECRET = $cookie
$env:FREEOS_INGEST_TOKEN = $ingest
# Include the sidecar's own origin. Login POSTs from the embedded page at
# http://127.0.0.1:3780 send that Origin; omitting it made cors() throw and
# the UI showed the generic 服务器内部错误 message.
$env:CORS_ORIGIN = 'http://127.0.0.1:8088,http://localhost:8088,http://127.0.0.1:18900,http://localhost:18900,http://127.0.0.1:3780,http://localhost:3780,http://[::1]:3780'
$env:FREEOS_HOME = $freeosHome
$env:OCTOP_HOME = $freeosHome
$env:FREEOS_ORG_SIDECAR_PORT = '3780'
$compiled = Join-Path $app 'backend-dist\server.js'
if (Test-Path -LiteralPath $compiled) {
    $argv = @('backend-dist/server.js')
} else {
    $argv = @('--import', 'tsx', 'backend/server.ts')
}

# PS 5.1 Start-Process defaults to UseShellExecute=$true and does NOT pass
# $env:CORS_ORIGIN / NODE_ENV into Node. Production parseOrigins then throws
# and Node exits immediately (nothing listens on 3780).
# Launch with ProcessStartInfo.UseShellExecute = $false and copy env onto
# EnvironmentVariables. Start-Process -FilePath $node with Redirect*/-NoNewWindow
# is the file-log path (those switches also force UseShellExecute=$false).
$startLog = Join-Path $live 'start.log'
$startOut = Join-Path $live 'start.out.log'
$startErr = Join-Path $live 'start.err.log'
$pidFile = Join-Path $live 'start.pid'
@(
    '{0} launching node={1}' -f (Get-Date -Format o), $node
    "cwd=$app"
    "argv=$($argv -join ' ')"
    "NODE_ENV=$($env:NODE_ENV)"
    "PORT=$($env:PORT)"
    "CORS_ORIGIN=$($env:CORS_ORIGIN)"
    "DB_DIALECT=$($env:DB_DIALECT)"
    "DATABASE_PATH=$($env:DATABASE_PATH)"
    "FREEOS_HOME=$($env:FREEOS_HOME)"
    "AIR_GAP_MODE=$($env:AIR_GAP_MODE)"
) | Set-Content -LiteralPath $startLog -Encoding UTF8
foreach ($old in @($startOut, $startErr)) {
    if (Test-Path -LiteralPath $old) {
        Remove-Item -LiteralPath $old -Force -ErrorAction SilentlyContinue
    }
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.FileName = $node
$psi.WorkingDirectory = $app
$quoted = foreach ($a in $argv) {
    if ($a -match '[\s"]') { '"{0}"' -f ($a -replace '"', '\"') } else { $a }
}
$psi.Arguments = [string]::Join(' ', $quoted)
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
foreach ($name in @(
        'NODE_ENV', 'PORT', 'DB_DIALECT', 'DATABASE_PATH', 'AIR_GAP_MODE',
        'SEED_DEMO_DATA', 'ALLOW_PUBLIC_REGISTRATION', 'JWT_SECRET', 'COOKIE_SECRET',
        'FREEOS_INGEST_TOKEN', 'CORS_ORIGIN', 'FREEOS_HOME', 'OCTOP_HOME',
        'FREEOS_ORG_SIDECAR_PORT'
    )) {
    $val = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ($null -ne $val -and $val -ne '') {
        $psi.EnvironmentVariables[$name] = $val
    }
}

function Merge-NodeLogs {
    foreach ($f in @($startOut, $startErr)) {
        if (Test-Path -LiteralPath $f) {
            Add-Content -LiteralPath $startLog -Value ('--- {0} ---' -f (Split-Path -Leaf $f)) -Encoding UTF8
            Get-Content -LiteralPath $f -ErrorAction SilentlyContinue |
                Add-Content -LiteralPath $startLog -Encoding UTF8
        }
    }
}

# Redirect* + -NoNewWindow => UseShellExecute=$false, so $env:* is inherited.
# File redirects keep stdout/stderr after this helper exits.
$proc = $null
$usedPsi = $false
try {
    $proc = Start-Process -FilePath $node -ArgumentList $argv -WorkingDirectory $app `
        -NoNewWindow `
        -RedirectStandardOutput $startOut `
        -RedirectStandardError $startErr `
        -PassThru
} catch {
    Add-Content -LiteralPath $startLog -Value "Start-Process failed: $($_.Exception.Message)" -Encoding UTF8
}

if (-not $proc) {
    try {
        $proc = [System.Diagnostics.Process]::Start($psi)
        $usedPsi = $true
    } catch {
        Add-Content -LiteralPath $startLog -Value "ProcessStartInfo start failed: $($_.Exception.Message)" -Encoding UTF8
        exit 10
    }
}

if (-not $proc) {
    Add-Content -LiteralPath $startLog -Value 'Node process was not created' -Encoding UTF8
    exit 10
}

$proc.Id | Set-Content -LiteralPath $pidFile -Encoding ASCII

# Fast crash (missing CORS_ORIGIN, module, etc.) must not look like a 90s livez timeout.
if ($proc.WaitForExit(5000)) {
    Merge-NodeLogs
    if ($usedPsi) {
        try {
            $tailOut = $proc.StandardOutput.ReadToEnd()
            $tailErr = $proc.StandardError.ReadToEnd()
            if ($tailOut) { Add-Content -LiteralPath $startLog -Value $tailOut -Encoding UTF8 }
            if ($tailErr) { Add-Content -LiteralPath $startLog -Value $tailErr -Encoding UTF8 }
        } catch {
        }
    }
    Add-Content -LiteralPath $startLog -Value "node exited $($proc.ExitCode) (fail-fast)" -Encoding UTF8
    exit 10
}
Merge-NodeLogs
Add-Content -LiteralPath $startLog -Value "node still running pid=$($proc.Id)" -Encoding UTF8
exit 0

# User-level openXYOS start helper (medium integrity).
# Copied to %LOCALAPPDATA%\FreeOS\openxyos by openxyos-provision.ps1.
# HKCU Run / the ONLOGON task invoke this file. It starts Node and returns;
# it does not write .install-ready (that is the provisioner's job after livez).
#
# Exit codes:
#   0  already healthy, or Node was started
#   6  bundled node.exe missing
#   7  dist\index.html missing

$ErrorActionPreference = 'Continue'
$live = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Join-Path $live 'node\node.exe'
$app = Join-Path $live 'openxyos'
$nestedFe = Join-Path $app 'dist\index.html'
$flatFe = Join-Path $live 'dist\index.html'
if (-not (Test-Path -LiteralPath $nestedFe)) {
    if (Test-Path -LiteralPath $flatFe) {
        $app = $live
    }
}
$livez = 'http://127.0.0.1:3780/api/health/livez'

function Test-Livez {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $livez
        return ($r.StatusCode -lt 500)
    } catch {
        return $false
    }
}

if (Test-Livez) {
    exit 0
}
if (-not (Test-Path -LiteralPath $node)) {
    Write-Error "start-sidecar: bundled Node missing at $node"
    exit 6
}
$fe = Join-Path $app 'dist\index.html'
if (-not (Test-Path -LiteralPath $fe)) {
    Write-Error "start-sidecar: frontend missing at $fe"
    exit 7
}

$home = $env:FREEOS_HOME
if (-not $home) {
    $home = Join-Path $env:USERPROFILE '.freeos'
}
$data = Join-Path $home 'org-os'
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
$env:CORS_ORIGIN = 'http://127.0.0.1:8088,http://localhost:8088,http://127.0.0.1:18900,http://localhost:18900'
$env:FREEOS_HOME = $home
$env:OCTOP_HOME = $home
$env:FREEOS_ORG_SIDECAR_PORT = '3780'
$env:FREEOS_OPENXYOS_HOME = $live

$compiled = Join-Path $app 'backend-dist\server.js'
if (Test-Path -LiteralPath $compiled) {
    $argv = @('backend-dist/server.js')
} else {
    $argv = @('--import', 'tsx', 'backend/server.ts')
}

try {
    Start-Process -FilePath $node -ArgumentList $argv -WorkingDirectory $app -WindowStyle Hidden
} catch {
    Write-Error "start-sidecar: failed to start Node: $($_.Exception.Message)"
    exit 10
}
exit 0

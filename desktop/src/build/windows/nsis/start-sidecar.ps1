# Internal helper: start local openXYOS (FE+BE) at medium integrity.
# Used by the install-time provisioner and by explorers that open this file.
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

if (Test-Livez) { exit 0 }

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

$home = $env:FREEOS_HOME
if (-not $home) { $home = Join-Path $env:USERPROFILE '.freeos' }
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
$compiled = Join-Path $app 'backend-dist\server.js'
if (Test-Path -LiteralPath $compiled) {
    $argv = @('backend-dist/server.js')
} else {
    $argv = @('--import', 'tsx', 'backend/server.ts')
}
Start-Process -FilePath $node -ArgumentList $argv -WorkingDirectory $app -WindowStyle Hidden
exit 0

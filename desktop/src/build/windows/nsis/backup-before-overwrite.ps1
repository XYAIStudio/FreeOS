# Pre-install backup for an NSIS overwrite. Fresh installs (no database and no
# config) exit 0. An existing home must produce a full archive plus sha256
# before Setup copies files; otherwise this script exits non-zero and Setup aborts.
# Not executed by the Linux CI runner. The NSIS section calls it before wails.files.
$ErrorActionPreference = "Stop"

function Resolve-FreeOSHome {
    if ($env:FREEOS_HOME) { return $env:FREEOS_HOME }
    if ($env:OCTOP_HOME) { return $env:OCTOP_HOME }
    $freeos = Join-Path $env:USERPROFILE ".freeos"
    $legacy = Join-Path $env:USERPROFILE ".octop"
    if (Test-Path $freeos) { return $freeos }
    if (Test-Path $legacy) { return $legacy }
    return $freeos
}

$home = Resolve-FreeOSHome
$db = Join-Path $home "octop.db"
$config = Join-Path $home "config.json"
if (-not (Test-Path $db) -and -not (Test-Path $config)) { exit 0 }

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$backupDir = Join-Path $home "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$out = Join-Path $backupDir "pre-upgrade-nsis-$stamp.tar.gz"

$candidates = @(
    (Join-Path $home "venv\Scripts\octop.exe"),
    (Join-Path $home "portable\runtime\python.exe")
)
$octop = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $octop) { Write-Error "Upgrade aborted: backup CLI missing"; exit 2 }

if ($octop.EndsWith("python.exe")) {
    $launch = Join-Path $home "portable\launch.py"
    if (-not (Test-Path $launch)) { Write-Error "Upgrade aborted: launch.py missing"; exit 2 }
    & $octop $launch backup create --home $home --include-chats -o $out
} else {
    & $octop backup create --home $home --include-chats -o $out
}
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $out)) { Write-Error "Upgrade aborted: backup failed"; exit 1 }
$hash = (Get-FileHash -Algorithm SHA256 -Path $out).Hash.ToLower()
$leaf = Split-Path -Leaf $out
Set-Content -Encoding ascii -Path "$out.sha256" -Value "$hash  $leaf"
exit 0

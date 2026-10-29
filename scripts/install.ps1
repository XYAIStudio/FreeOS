# FreeOS Installer for Windows (PowerShell)
# Usage: irm <url>/install.ps1 | iex
#    or: .\install.ps1 [-Version X.Y.Z] [-FromSource] [-SourceDir DIR] [-Extras "browser"]
#
# New installs use ~/.freeos. An existing ~/.octop is kept when ~/.freeos
# does not exist yet (same order as PathLayout.from_env).

& {
param(
    [string]$Version   = "",
    [switch]$FromSource,
    [switch]$FromPyPI,
    [string]$SourceDir = "",
    [string]$Extras    = "",
    [string]$UvPath    = "",
    [switch]$Help
)

$ErrorActionPreference = "Stop"

function Resolve-FreeOSHome {
    if ($env:FREEOS_HOME) { return $env:FREEOS_HOME }
    if ($env:OCTOP_HOME) { return $env:OCTOP_HOME }
    $freeos = Join-Path $HOME ".freeos"
    $legacy = Join-Path $HOME ".octop"
    if (Test-Path $freeos) { return $freeos }
    foreach ($flag in @($env:OCTOP_DESKTOP, $env:FREEOS_DESKTOP)) {
        if ($flag -match '^(1|true|yes|on)$') { return $freeos }
    }
    if (Test-Path $legacy) { return $legacy }
    return $freeos
}

$OctopHome     = Resolve-FreeOSHome
$OctopVenv     = Join-Path $OctopHome "venv"
$OctopBin      = Join-Path $OctopHome "bin"
$PythonVersion = "3.12"
$OctopRepo     = if ($env:OCTOP_REPO) { $env:OCTOP_REPO } else { "https://github.com/XYAIStudio/FreeOS.git" }

function Write-Info { param([string]$Message) Write-Host "[freeos] " -ForegroundColor Green  -NoNewline; Write-Host $Message }
function Write-Warn { param([string]$Message) Write-Host "[freeos] " -ForegroundColor Yellow -NoNewline; Write-Host $Message }
function Stop-WithError { param([string]$Message) Write-Host "[freeos] ERROR: $Message" -ForegroundColor Red; exit 1 }

if ($FromSource -and $FromPyPI) { Stop-WithError "Choose only one of -FromSource or -FromPyPI." }
if (-not $FromPyPI) { $FromSource = $true }

if ($Help) {
    @"
FreeOS Installer for Windows

Usage: .\install.ps1 [OPTIONS]

Options:
  -Version <VER>        Install a specific version (e.g. 0.1.0)
  -FromSource           Install from source (requires git, or use -SourceDir)
  -FromPyPI             Install upstream Octop from PyPI (does not include FreeOS changes)
  -SourceDir <DIR>      Local source directory (used with -FromSource)
  -Extras <EXTRAS>      Extra optional components (e.g. desktop, browser)
  -UvPath <PATH>        Path to a pre-installed uv.exe
  -Help                 Show this help

Note: Playwright Chromium is not downloaded by default. Pass -Extras browser
to install it, or install later from the dashboard. If a system Chrome already
exists, that download is skipped even with -Extras browser.

Environment:
  FREEOS_HOME           Installation directory (preferred)
  OCTOP_HOME            Legacy installation directory override
                        New installs use ~/.freeos. An existing ~/.octop is
                        kept when ~/.freeos does not exist yet.
  OCTOP_REPO            Git clone URL for -FromSource without -SourceDir
"@
    exit 0
}

Write-Host "[freeos] Installing FreeOS into $OctopHome" -ForegroundColor Green

$policy = Get-ExecutionPolicy
if ($policy -eq "Restricted") {
    Write-Info "Execution policy is 'Restricted', setting RemoteSigned for current user..."
    try {
        Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    } catch {
        Stop-WithError "PowerShell execution policy blocks scripts. Run: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser"
    }
}

function Invoke-UvFromGitHub {
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "aarch64" } else { "x86_64" }
    $url  = "https://github.com/astral-sh/uv/releases/latest/download/uv-$arch-pc-windows-msvc.zip"
    $dest = Join-Path $env:LOCALAPPDATA "uv"
    $zip  = Join-Path $env:TEMP "uv-gh-$([System.IO.Path]::GetRandomFileName()).zip"

    Write-Info "Downloading uv ($arch) from GitHub Releases..."
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

    if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
    Expand-Archive -Force -Path $zip -DestinationPath $dest
    Remove-Item $zip -ErrorAction SilentlyContinue

    $uvExe = Join-Path $dest "uv.exe"
    if (-not (Test-Path $uvExe)) { throw "uv.exe not found after extraction" }
    $env:PATH = "$dest;$env:PATH"
    Write-Info "uv installed from GitHub: $uvExe"
}

function Ensure-Uv {
    if ($UvPath) {
        if (-not (Test-Path $UvPath)) { Stop-WithError "Specified uv not found: $UvPath" }
        $env:PATH = "$(Split-Path $UvPath -Parent);$env:PATH"
        Write-Info "uv found: $UvPath"
        return
    }
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        Write-Info "uv found: $((Get-Command uv).Source)"
        return
    }
    foreach ($candidate in @(
        (Join-Path $HOME ".local\bin\uv.exe"),
        (Join-Path $HOME ".cargo\bin\uv.exe"),
        (Join-Path $env:LOCALAPPDATA "uv\uv.exe")
    )) {
        if (Test-Path $candidate) {
            $env:PATH = "$(Split-Path $candidate -Parent);$env:PATH"
            Write-Info "uv found: $candidate"
            return
        }
    }

    Write-Info "Installing uv..."
    $astralOk = $false
    try {
        $installScript = Invoke-RestMethod https://astral.sh/uv/install.ps1 -TimeoutSec 15
        Invoke-Expression $installScript
        $astralOk = $true
    } catch {
        Write-Warn "astral.sh unreachable, falling back to GitHub Releases..."
    }

    if ($astralOk) {
        foreach ($p in @(
            (Join-Path $HOME ".local\bin"),
            (Join-Path $HOME ".cargo\bin"),
            (Join-Path $env:LOCALAPPDATA "uv")
        )) {
            if ((Test-Path $p) -and ($env:PATH -notlike "*$p*")) {
                $env:PATH = "$p;$env:PATH"
            }
        }
        if (Get-Command uv -ErrorAction SilentlyContinue) { return }
    }

    try { Invoke-UvFromGitHub } catch {
        Stop-WithError "Failed to install uv: $_"
    }
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        Stop-WithError "Failed to install uv. See https://docs.astral.sh/uv/"
    }
}

Ensure-Uv

if (Test-Path $OctopVenv) {
    Write-Info "Existing environment found, upgrading..."
    $existingCli = Join-Path $OctopVenv "Scripts\octop.exe"
    $hasData = (Test-Path (Join-Path $OctopHome "octop.db")) -or (Test-Path (Join-Path $OctopHome "config.json"))
    if ((Test-Path $existingCli) -and $hasData) {
        $backupDir = Join-Path $OctopHome "backups"
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        $stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
        $backupOut = Join-Path $backupDir "pre-upgrade-$stamp.tar.gz"
        Write-Info "Full backup before upgrade: $backupOut"
        & $existingCli backup create --home $OctopHome --include-chats -o $backupOut
        if ($LASTEXITCODE -ne 0) { Stop-WithError "Upgrade aborted: backup failed" }
        $hash = (Get-FileHash -Algorithm SHA256 -Path $backupOut).Hash.ToLower()
        $leaf = Split-Path -Leaf $backupOut
        Set-Content -Encoding ascii -Path "$backupOut.sha256" -Value "$hash  $leaf"
        Write-Info "Backup sha256 written to $backupOut.sha256"
    }
} else {
    Write-Info "Creating Python $PythonVersion environment..."
}

uv venv $OctopVenv --python $PythonVersion --quiet --clear
if ($LASTEXITCODE -ne 0) { Stop-WithError "Failed to create virtual environment" }

$VenvPython = Join-Path $OctopVenv "Scripts\python.exe"
if (-not (Test-Path $VenvPython)) { Stop-WithError "Failed to create virtual environment" }
$pyVersion = & $VenvPython --version 2>&1
Write-Info "Python environment ready ($pyVersion)"

# TEMP: mcp 2.x breaks langchain-mcp-adapters; pin until published octop pulls harness-agent>=0.9.18.
function Pin-McpCompat {
    Write-Info "Pinning mcp<2 (langchain-mcp-adapters compat; temporary)..."
    uv pip install "mcp>=1.27.1,<2" --python $VenvPython --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Failed to pin mcp; install verification may fail"
    }
}

function Test-Install {
    Write-Info "Verifying installation..."
    & $VenvPython -c "from octop.infra.agents.manager import AgentManager" 2>$null
    if ($LASTEXITCODE -ne 0) { Stop-WithError "Install verification failed: core import error" }
    Write-Info "Install verification passed"
}

$ExtrasSuffix = "[browser]"
if ($Extras) {
    $parts = @("browser")
    foreach ($p in ($Extras -split ",")) {
        $t = $p.Trim()
        if (-not $t -or $t -eq "browser" -or $t -eq "channels-feishu") { continue }
        $parts += $t
    }
    $ExtrasSuffix = "[" + ($parts -join ",") + "]"
}
$script:ConsoleAvailable = $false

function Prepare-Console {
    param([string]$RepoDir)
    $consoleDest = Join-Path $RepoDir "src\octop\dashboard"
    if (Test-Path (Join-Path $consoleDest "index.html")) {
        $script:ConsoleAvailable = $true
        return
    }
    $packageJson = Join-Path $RepoDir "dashboard\package.json"
    if (-not (Test-Path $packageJson)) {
        Write-Warn "dashboard source not found - web UI won't be available."
        return
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Warn "npm not found - skipping dashboard build."
        return
    }
    Write-Info "Building dashboard (npm ci && npm run build)..."
    Push-Location (Join-Path $RepoDir "dashboard")
    try {
        npm ci
        if ($LASTEXITCODE -ne 0) { return }
        npm run build
        if (Test-Path (Join-Path $consoleDest "index.html")) {
            $script:ConsoleAvailable = $true
            Write-Info "Dashboard built successfully"
        }
    } finally {
        Pop-Location
    }
}

$VenvOctop = Join-Path $OctopVenv "Scripts\octop.exe"

if ($FromSource) {
    if ($SourceDir) {
        $SourceDir = (Resolve-Path $SourceDir).Path
        Write-Info "Installing from local source: $SourceDir"
        Prepare-Console $SourceDir
        uv pip install "${SourceDir}${ExtrasSuffix}" --python $VenvPython
    } else {
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
            Stop-WithError "git required for -FromSource. Install from https://git-scm.com/"
        }
        $cloneDir = Join-Path $env:TEMP "octop-install-$(Get-Random)"
        try {
        if ($Version) {
            git clone --depth 1 --branch "v$Version" $OctopRepo $cloneDir
        } else {
            git clone --depth 1 $OctopRepo $cloneDir
        }
            Prepare-Console $cloneDir
            uv pip install "${cloneDir}${ExtrasSuffix}" --python $VenvPython
        } finally {
            if (Test-Path $cloneDir) { Remove-Item $cloneDir -Recurse -Force -ErrorAction SilentlyContinue }
        }
    }
} else {
    # PEP 508: extras must sit between name and version specifier
    # (octop[browser]==x.y.z); octop==x.y.z[browser] is an invalid requirement.
    $package = if ($Version) { "octop${ExtrasSuffix}==$Version" } else { "octop${ExtrasSuffix}" }
    Write-Info "Installing ${package} from PyPI..."
    $installArgs = @("--python", $VenvPython, "--quiet")
    if ($Version -match '(dev|a|b|rc)') { $installArgs += "--prerelease=explicit" }
    uv pip install "${package}" @installArgs
}

Pin-McpCompat
Test-Install

if (-not (Test-Path $VenvOctop)) { Stop-WithError "Installation failed: octop CLI not found in venv" }
Write-Info "FreeOS installed successfully"

if (-not $script:ConsoleAvailable) {
    $check = & $VenvPython -c "import importlib.resources, octop; p=importlib.resources.files('octop')/'dashboard'/'index.html'; print('yes' if p.is_file() else 'no')" 2>&1
    if ($check -eq "yes") { $script:ConsoleAvailable = $true }
}

function Find-SystemChrome {
    # Prefer harness-browser's detector (same path used at runtime)
    try {
        $p = & $VenvPython -c "from harness_browser.cdp.launcher import find_chrome; p=find_chrome(); print(p or '', end='')" 2>$null
        if ($p) { return $p }
    } catch { }
    # Common commands
    foreach ($c in @("chrome", "google-chrome", "google-chrome-stable", "chromium", "chromium-browser")) {
        $cmd = Get-Command $c -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    # Well-known GUI install paths
    foreach ($p in @(
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:ProgramFiles "Chromium\Application\chrome.exe")
    )) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

$wantPlaywrightChromium = $false
if ($Extras) {
    foreach ($p in ($Extras -split ",")) {
        if ($p.Trim() -eq "browser") { $wantPlaywrightChromium = $true }
    }
}
if (-not $wantPlaywrightChromium) {
    Write-Info "Skipping Playwright Chromium download."
    Write-Info "For remote-browser automation, re-run with -Extras browser, use the dashboard, or:"
    Write-Info "  $VenvPython -m playwright install chromium"
} else {
    $systemChrome = Find-SystemChrome
    if ($systemChrome) {
        Write-Info "Found system Chrome/Chromium: $systemChrome"
        Write-Info "Using system browser; skipping Playwright Chromium download."
        Write-Info "To use Playwright's bundled Chromium instead, run: $VenvPython -m playwright install chromium"
    } else {
        Write-Info "Installing Playwright Chromium browser..."
        & $VenvPython -m playwright install chromium 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Playwright Chromium installed"
        } else {
            Write-Warn "Playwright install failed. Run later: $VenvPython -m playwright install chromium"
        }
    }
}

New-Item -ItemType Directory -Path $OctopBin -Force | Out-Null

$wrapperPs1 = Join-Path $OctopBin "octop.ps1"
@'
$ErrorActionPreference = "Stop"
function Resolve-FreeOSHome {
    if ($env:FREEOS_HOME) { return $env:FREEOS_HOME }
    if ($env:OCTOP_HOME) { return $env:OCTOP_HOME }
    $freeos = Join-Path $HOME ".freeos"
    $legacy = Join-Path $HOME ".octop"
    if (Test-Path $freeos) { return $freeos }
    foreach ($flag in @($env:OCTOP_DESKTOP, $env:FREEOS_DESKTOP)) {
        if ($flag -match '^(1|true|yes|on)$') { return $freeos }
    }
    if (Test-Path $legacy) { return $legacy }
    return $freeos
}
$OctopHome = Resolve-FreeOSHome
$RealBin = Join-Path $OctopHome "venv\Scripts\octop.exe"
if (-not (Test-Path $RealBin)) {
    Write-Error "FreeOS environment not found at $OctopHome\venv"
    exit 1
}
& $RealBin @args
'@ | Set-Content -Path $wrapperPs1 -Encoding UTF8

$cmdWrapper = Join-Path $OctopBin "octop.cmd"
@'
@echo off
if defined FREEOS_HOME (
  set "OCTOP_HOME=%FREEOS_HOME%"
) else if defined OCTOP_HOME (
  rem keep the legacy override
) else if exist "%USERPROFILE%\.freeos" (
  set "OCTOP_HOME=%USERPROFILE%\.freeos"
) else if exist "%USERPROFILE%\.octop" (
  set "OCTOP_HOME=%USERPROFILE%\.octop"
) else (
  set "OCTOP_HOME=%USERPROFILE%\.freeos"
)
set "REAL_BIN=%OCTOP_HOME%\venv\Scripts\octop.exe"
if not exist "%REAL_BIN%" (
    echo Error: FreeOS environment not found at %OCTOP_HOME%\venv >&2
    exit /b 1
)
"%REAL_BIN%" %*
'@ | Set-Content -Path $cmdWrapper -Encoding UTF8

Write-Info "Wrappers created in $OctopBin"

$targetPath = $OctopBin
$registryPath = "HKCU:\Environment"
$pathSavedForNewSessions = $false
try {
    $currentUserPath = (Get-ItemProperty -Path $registryPath -Name Path -ErrorAction SilentlyContinue).Path
    if (-not $currentUserPath) { $currentUserPath = "" }
    $pathArray = $currentUserPath -split ';' | ForEach-Object { $_.Trim() }
    if ($pathArray -notcontains $targetPath) {
        $newUserPath = if ($currentUserPath) { "$targetPath;$currentUserPath" } else { $targetPath }
        Set-ItemProperty -Path $registryPath -Name Path -Value $newUserPath
        $pathSavedForNewSessions = $true
        Write-Info "Added $targetPath to User PATH"
    } else {
        Write-Info "$targetPath already in User PATH"
    }
} catch {
    Write-Warn "Could not update PATH automatically. Add manually: $targetPath"
}
if ($env:Path -notlike "*$targetPath*") {
    $env:Path = "$targetPath;$env:Path"
}

Write-Host ""
Write-Host "FreeOS installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Install location:  $OctopHome"
Write-Host "  Python:            $pyVersion"
if ($script:ConsoleAvailable) {
    Write-Host "  Web UI:            available" -ForegroundColor Green
} else {
    Write-Host "  Web UI:            not available" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "If 'octop' is not found in this session, run:"
Write-Host "  `$env:Path = `"$targetPath;`$env:Path`"" -ForegroundColor White
if ($pathSavedForNewSessions) {
    Write-Host "(Saved to User PATH; new terminals pick it up automatically.)"
}
Write-Host ""
Write-Host "Then run:"
Write-Host "  octop init" -ForegroundColor White
Write-Host "  octop run" -ForegroundColor White
Write-Host "  octop service start" -ForegroundColor White
Write-Host "  http://127.0.0.1:8088" -ForegroundColor White

} @args

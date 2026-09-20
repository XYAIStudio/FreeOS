#!/usr/bin/env bash
# Bundle a Node runtime + built openXYOS into a green portable staging tree
# so the desktop installer can start the organization sidecar on a clean machine
# (no system Node required).
#
# Usage:
#   bash desktop/portable/bundle-org-sidecar.sh <plat> <staging-dir>
#
# Layout written under <staging-dir>/org-sidecar/:
#   node/          official Node.js runtime for <plat>
#   openxyos/      built frontend (dist/) + backend TS + pruned node_modules
#   start-sidecar.sh / start-sidecar.bat
#   VERSION.txt
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=desktop/portable/_common.sh
source "${REPO_ROOT}/desktop/portable/_common.sh"

NODE_VERSION="${NODE_VERSION:-20.19.5}"
NODE_BASE_URL="${NODE_BASE_URL:-https://nodejs.org/dist/v${NODE_VERSION}}"

node_archive_name() {
  case "$1" in
    windows-amd64) echo "node-v${NODE_VERSION}-win-x64.zip" ;;
    windows-arm64) echo "node-v${NODE_VERSION}-win-arm64.zip" ;;
    linux-amd64) echo "node-v${NODE_VERSION}-linux-x64.tar.xz" ;;
    linux-arm64) echo "node-v${NODE_VERSION}-linux-arm64.tar.xz" ;;
    darwin-amd64) echo "node-v${NODE_VERSION}-darwin-x64.tar.gz" ;;
    darwin-arm64) echo "node-v${NODE_VERSION}-darwin-arm64.tar.gz" ;;
    *)
      echo "unknown platform: $1" >&2
      return 1
      ;;
  esac
}

node_extract_dir() {
  case "$1" in
    windows-amd64) echo "node-v${NODE_VERSION}-win-x64" ;;
    windows-arm64) echo "node-v${NODE_VERSION}-win-arm64" ;;
    linux-amd64) echo "node-v${NODE_VERSION}-linux-x64" ;;
    linux-arm64) echo "node-v${NODE_VERSION}-linux-arm64" ;;
    darwin-amd64) echo "node-v${NODE_VERSION}-darwin-x64" ;;
    darwin-arm64) echo "node-v${NODE_VERSION}-darwin-arm64" ;;
    *) return 1 ;;
  esac
}

download_node() {
  local plat="$1"
  local archive dest url
  archive="$(node_archive_name "$plat")"
  dest="${GREEN_CACHE}/node/${archive}"
  mkdir -p "$(dirname "$dest")"
  if [[ -f "$dest" && -s "$dest" ]]; then
    echo "[org-sidecar] reusing ${dest}" >&2
    echo "$dest"
    return 0
  fi
  url="${NODE_BASE_URL}/${archive}"
  echo "[org-sidecar] downloading ${url}" >&2
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 4 --retry-delay 2 -o "${dest}.partial" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "${dest}.partial" "$url"
  else
    echo "[org-sidecar] need curl or wget to download Node" >&2
    exit 1
  fi
  mv "${dest}.partial" "$dest"
  echo "$dest"
}

extract_node() {
  local archive="$1"
  local dest="$2"
  rm -rf "$dest"
  mkdir -p "$dest"
  case "$archive" in
    *.zip)
      if command -v unzip >/dev/null 2>&1; then
        unzip -q "$archive" -d "$dest"
      else
        py=""
        if command -v python3 >/dev/null 2>&1; then
          py=python3
        elif command -v python >/dev/null 2>&1; then
          py=python
        fi
        if [[ -z "$py" ]]; then
          echo "[org-sidecar] need unzip or python to extract Node zip" >&2
          exit 1
        fi
        "$py" -c "import shutil,sys; shutil.unpack_archive(sys.argv[1], sys.argv[2])" \
          "$archive" "$dest"
      fi
      ;;
    *.tar.xz|*.tar.gz)
      tar -xf "$archive" -C "$dest"
      ;;
    *)
      echo "[org-sidecar] unsupported Node archive: ${archive}" >&2
      exit 1
      ;;
  esac
}

build_openxyos() {
  local work="$1"
  local src="${REPO_ROOT}/modules/openxyos"
  if [[ ! -f "${src}/package.json" ]]; then
    echo "[org-sidecar] openXYOS missing at ${src}" >&2
    exit 1
  fi
  if ! command -v npm >/dev/null 2>&1; then
    echo "[org-sidecar] npm is required to build openXYOS (Node ${NODE_VERSION}+)" >&2
    exit 1
  fi
  echo "[org-sidecar] assembling openXYOS build tree → ${work}" >&2
  rm -rf "$work"
  mkdir -p "$work"
  # Copy sources only; install + build happen in the work tree.
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude node_modules --exclude dist --exclude .git --exclude .github \
      --exclude backups --exclude dist-backup-20260626 --exclude V0.5 \
      --include '.env.example' --exclude '.env' --exclude '.env.*' \
      "${src}/" "${work}/"
  else
    python3 - "$src" "$work" <<'PY'
import shutil, sys
from pathlib import Path
src, dest = Path(sys.argv[1]), Path(sys.argv[2])
skip = {"node_modules", "dist", ".git", ".github", "backups", "dist-backup-20260626", "V0.5"}
for item in src.iterdir():
    if item.name in skip:
        continue
    if item.name == ".env" or (item.name.startswith(".env.") and item.name != ".env.example"):
        continue
    target = dest / item.name
    if item.is_dir():
        shutil.copytree(item, target, ignore=shutil.ignore_patterns(*skip))
    else:
        shutil.copy2(item, target)
PY
  fi
  (
    cd "$work"
    echo "[org-sidecar] npm ci" >&2
    npm ci --no-audit --no-fund
    echo "[org-sidecar] npm run build:freeos" >&2
    npm run build:freeos
    echo "[org-sidecar] prune to production + tsx (sidecar starts via node --import tsx)" >&2
    npm prune --omit=dev --no-audit --no-fund
    npm install tsx@4.19.2 --omit=dev --no-audit --no-fund --no-package-lock
    if command -v npx >/dev/null 2>&1; then
      echo "[org-sidecar] compile backend to backend-dist (skip tsx cold start)" >&2
      npx --yes esbuild backend/server.ts --bundle --platform=node --packages=external \
        --outfile=backend-dist/server.js || echo "[org-sidecar] esbuild compile skipped" >&2
    fi
    # server.js reads SQL via path.join(__dirname, "migrations/…") — that is
    # backend-dist/migrations after esbuild, not backend/migrations.
    if [[ -f backend-dist/server.js && -d backend/migrations ]]; then
      echo "[org-sidecar] copy backend/migrations → backend-dist/migrations" >&2
      mkdir -p backend-dist/migrations
      cp -a backend/migrations/. backend-dist/migrations/
    fi
  )
  if [[ ! -f "${work}/dist/index.html" ]]; then
    echo "[org-sidecar] vite build did not produce dist/index.html" >&2
    exit 1
  fi
}

write_sidecar_launchers() {
  local dest="$1"
  cat > "${dest}/start-sidecar.sh" <<'EOF'
#!/usr/bin/env bash
# Start the bundled openXYOS sidecar (no system Node required).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -x "${ROOT}/node/bin/node" ]]; then
  NODE="${ROOT}/node/bin/node"
elif [[ -f "${ROOT}/node/node.exe" ]]; then
  NODE="${ROOT}/node/node.exe"
else
  echo "start-sidecar: bundled Node missing under ${ROOT}/node" >&2
  exit 1
fi
APP="${ROOT}/openxyos"
HOME_DIR="${FREEOS_HOME:-${OCTOP_HOME:-${HOME}/.freeos}}"
DATA_DIR="${FREEOS_ORG_DATA:-${HOME_DIR}/org-os}"
PORT="${FREEOS_ORG_SIDECAR_PORT:-3780}"
mkdir -p "${DATA_DIR}"
if [[ -f "${DATA_DIR}/sidecar.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${DATA_DIR}/sidecar.env"
  set +a
fi
if [[ -z "${JWT_SECRET:-}" || -z "${COOKIE_SECRET:-}" ]]; then
  JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(32))')}"
  COOKIE_SECRET="${COOKIE_SECRET:-$(openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(32))')}"
  umask 077
  cat > "${DATA_DIR}/sidecar.env" <<ENV
JWT_SECRET=${JWT_SECRET}
COOKIE_SECRET=${COOKIE_SECRET}
ENV
fi
export NODE_ENV=production
export PORT
export DB_DIALECT=sqlite
export DATABASE_PATH="${DATA_DIR}/xiongyuan.db"
export AIR_GAP_MODE=true
export ALLOW_PUBLIC_REGISTRATION="${ALLOW_PUBLIC_REGISTRATION:-false}"
export SEED_DEMO_DATA="${SEED_DEMO_DATA:-false}"
export JWT_SECRET COOKIE_SECRET
export CORS_ORIGIN="${CORS_ORIGIN:-http://127.0.0.1:8088,http://localhost:8088,http://127.0.0.1:18900,http://localhost:18900}"
cd "${APP}"
exec "${NODE}" --import tsx backend/server.ts
EOF
  chmod +x "${dest}/start-sidecar.sh"

  cat > "${dest}/start-sidecar.bat" <<'EOF'
@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "NODE=%ROOT%\node\node.exe"
if not exist "%NODE%" (
  echo start-sidecar.bat: bundled Node missing at %NODE%
  exit /b 1
)
set "APP=%ROOT%\openxyos"
if not defined FREEOS_HOME if defined OCTOP_HOME set "FREEOS_HOME=%OCTOP_HOME%"
if not defined FREEOS_HOME set "FREEOS_HOME=%USERPROFILE%\.freeos"
if not defined FREEOS_ORG_DATA set "FREEOS_ORG_DATA=%FREEOS_HOME%\org-os"
if not defined FREEOS_ORG_SIDECAR_PORT set "FREEOS_ORG_SIDECAR_PORT=3780"
if not exist "%FREEOS_ORG_DATA%" mkdir "%FREEOS_ORG_DATA%"
if exist "%FREEOS_ORG_DATA%\sidecar.env" for /f "usebackq tokens=1,* delims==" %%A in ("%FREEOS_ORG_DATA%\sidecar.env") do set "%%A=%%B"
if not defined JWT_SECRET (
  for /f %%I in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set "JWT_SECRET=%%I"
)
if not defined COOKIE_SECRET (
  for /f %%I in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set "COOKIE_SECRET=%%I"
)
> "%FREEOS_ORG_DATA%\sidecar.env" echo JWT_SECRET=%JWT_SECRET%
>> "%FREEOS_ORG_DATA%\sidecar.env" echo COOKIE_SECRET=%COOKIE_SECRET%
set "NODE_ENV=production"
set "PORT=%FREEOS_ORG_SIDECAR_PORT%"
set "DB_DIALECT=sqlite"
set "DATABASE_PATH=%FREEOS_ORG_DATA%\xiongyuan.db"
set "AIR_GAP_MODE=true"
if not defined ALLOW_PUBLIC_REGISTRATION set "ALLOW_PUBLIC_REGISTRATION=false"
if not defined SEED_DEMO_DATA set "SEED_DEMO_DATA=false"
if not defined CORS_ORIGIN set "CORS_ORIGIN=http://127.0.0.1:8088,http://localhost:8088,http://127.0.0.1:18900,http://localhost:18900"
cd /d "%APP%"
"%NODE%" --import tsx backend/server.ts
exit /b %ERRORLEVEL%
EOF
}

copy_openxyos_runtime() {
  local work="$1"
  local dest="$2"
  rm -rf "$dest"
  mkdir -p "$dest"
  for part in backend dist node_modules package.json backend-dist; do
    if [[ ! -e "${work}/${part}" ]]; then
      if [[ "$part" == "backend-dist" ]]; then
        echo "[org-sidecar] optional ${part} missing — sidecar will use tsx" >&2
        continue
      fi
      echo "[org-sidecar] missing ${work}/${part}" >&2
      exit 1
    fi
    if [[ -d "${work}/${part}" ]]; then
      cp -a "${work}/${part}" "${dest}/${part}"
    else
      cp -a "${work}/${part}" "${dest}/${part}"
    fi
  done
  # tsx resolve + package scripts; lockfile optional.
  if [[ -f "${work}/package-lock.json" ]]; then
    cp -a "${work}/package-lock.json" "${dest}/package-lock.json"
  fi
  # Heal: compiled server must see SQL next to server.js even if the
  # build-tree copy above was skipped (cached backend-dist, etc.).
  if [[ -f "${dest}/backend-dist/server.js" && -d "${dest}/backend/migrations" ]]; then
    mkdir -p "${dest}/backend-dist/migrations"
    cp -a "${dest}/backend/migrations/." "${dest}/backend-dist/migrations/"
  fi
  if [[ ! -f "${dest}/dist/assets/xyai-mascot.webp" ]]; then
    echo "[org-sidecar] missing ${dest}/dist/assets/xyai-mascot.webp" >&2
    exit 1
  fi
}

main() {
  local plat="${1:-}"
  local staging="${2:-}"
  if [[ -z "$plat" || -z "$staging" ]]; then
    echo "usage: bundle-org-sidecar.sh <plat> <staging-dir>" >&2
    exit 2
  fi
  if ! is_known_plat "$plat"; then
    echo "unknown platform: ${plat}" >&2
    exit 2
  fi
  if [[ "${SKIP_ORG_SIDECAR:-0}" == "1" ]]; then
    echo "[org-sidecar] SKIP_ORG_SIDECAR=1 — not bundling openXYOS" >&2
    return 0
  fi

  local dest="${staging}/org-sidecar"
  mkdir -p "$dest"

  local archive extracted inner
  archive="$(download_node "$plat")"
  extracted="${GREEN_CACHE}/node/extract-${plat}"
  extract_node "$archive" "$extracted"
  inner="${extracted}/$(node_extract_dir "$plat")"
  if [[ ! -d "$inner" ]]; then
    echo "[org-sidecar] Node extract missing ${inner}" >&2
    exit 1
  fi
  rm -rf "${dest}/node"
  cp -a "$inner" "${dest}/node"
  if [[ "$plat" == windows-* ]]; then
    if [[ ! -f "${dest}/node/node.exe" ]]; then
      echo "[org-sidecar] node.exe missing after extract" >&2
      exit 1
    fi
  elif [[ ! -x "${dest}/node/bin/node" ]]; then
    echo "[org-sidecar] bin/node missing after extract" >&2
    exit 1
  fi

  local work="${GREEN_CACHE}/openxyos-${plat}"
  build_openxyos "$work"
  copy_openxyos_runtime "$work" "${dest}/openxyos"
  write_sidecar_launchers "$dest"

  {
    echo "platform=${plat}"
    echo "node=${NODE_VERSION}"
    echo "openxyos_bundled=1"
    sed -n 's/^version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/freeos_version=\1/p' \
      "${REPO_ROOT}/pyproject.toml" | head -1
  } > "${dest}/VERSION.txt"

  echo "[org-sidecar] bundled → ${dest}" >&2
}

main "${1:-}" "${2:-}"

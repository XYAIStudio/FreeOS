#!/usr/bin/env bash
# Start the vendored openXYOS sidecar for the FreeOS organization module.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${ROOT}/modules/openxyos"
PORT="${FREEOS_ORG_SIDECAR_PORT:-3780}"
DATA_DIR="${FREEOS_ORG_DATA:-${FREEOS_HOME:-${HOME}/.freeos}/org-os}"

if [[ ! -d "${APP}" ]]; then
  echo "openXYOS tree missing at ${APP}" >&2
  exit 1
fi

mkdir -p "${DATA_DIR}"
cd "${APP}"

if [[ ! -f .env ]]; then
  umask 077
  cat > .env <<EOF
NODE_ENV=development
PORT=${PORT}
CORS_ORIGIN=http://127.0.0.1:18900,http://localhost:18900,http://127.0.0.1:5173,http://localhost:5173
JWT_SECRET=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
COOKIE_SECRET=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
AIR_GAP_MODE=true
DB_DIALECT=sqlite
ALLOW_PUBLIC_REGISTRATION=false
SEED_DEMO_DATA=false
EOF
  echo "Wrote ${APP}/.env (local secrets; do not commit)."
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

export PORT
echo "openXYOS sidecar → http://127.0.0.1:${PORT}"
echo "Enable it in FreeOS:  freeos org enable   or dashboard /organization"
exec npm run start

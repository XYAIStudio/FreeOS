#!/usr/bin/env bash
# FreeOS green portable launcher (macOS / Linux).
# Usage:
#   ./start.sh
#   ./start.sh --home /path/to/data
#   ./start.sh --home ./data --host 0.0.0.0 --port 8088
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export FREEOS_HOME="${FREEOS_HOME:-${OCTOP_HOME:-${ROOT}/data}}"
export OCTOP_HOME="${FREEOS_HOME}"

HOST="127.0.0.1"
PORT="8088"
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --home)
      [[ $# -ge 2 ]] || { echo "start.sh: --home requires a path" >&2; exit 1; }
      FREEOS_HOME="$2"
      OCTOP_HOME="$2"
      shift 2
      ;;
    --host)
      [[ $# -ge 2 ]] || { echo "start.sh: --host requires a value" >&2; exit 1; }
      HOST="$2"
      shift 2
      ;;
    --port)
      [[ $# -ge 2 ]] || { echo "start.sh: --port requires a value" >&2; exit 1; }
      PORT="$2"
      shift 2
      ;;
    -h|--help)
      cat <<EOF
FreeOS green portable launcher

Usage: ./start.sh [--home DIR] [--host HOST] [--port PORT] [freeos run args...]

Defaults:
  FREEOS_HOME / --home   ${ROOT}/data
  --host                 127.0.0.1
  --port                 8088

Environment:
  FREEOS_HOME            User data directory (overridden by --home)
  OCTOP_HOME             Legacy alias; set to the same path
EOF
      exit 0
      ;;
    *)
      EXTRA+=("$1")
      shift
      ;;
  esac
done

export FREEOS_HOME OCTOP_HOME
export FREEOS_ORG_ENABLE="${FREEOS_ORG_ENABLE:-1}"
export FREEOS_ORG_SIDECAR_URL="${FREEOS_ORG_SIDECAR_URL:-http://127.0.0.1:3780}"
export OPENXYOS_BASE_URL="${OPENXYOS_BASE_URL:-${FREEOS_ORG_SIDECAR_URL}}"
mkdir -p "$FREEOS_HOME"

PY=""
if [[ -x "${ROOT}/runtime/bin/python3" ]]; then
  PY="${ROOT}/runtime/bin/python3"
elif [[ -x "${ROOT}/runtime/bin/python" ]]; then
  PY="${ROOT}/runtime/bin/python"
else
  echo "start.sh: portable Python not found under ${ROOT}/runtime" >&2
  exit 1
fi

# launch.py adds packages/ via site.addsitedir (honours .pth / pywin32).
export PYTHONNOUSERSITE=1
export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8
unset PYTHONPATH || true

if [[ -x "${ROOT}/org-sidecar/start-sidecar.sh" ]]; then
  echo "[freeos] organization sidecar → ${FREEOS_ORG_SIDECAR_URL}"
  "${ROOT}/org-sidecar/start-sidecar.sh" &
fi

echo "[freeos] home=${FREEOS_HOME}"
echo "[freeos] http://${HOST}:${PORT}"
if [[ ${#EXTRA[@]} -gt 0 ]]; then
  exec "$PY" "${ROOT}/launch.py" run --host "$HOST" --port "$PORT" "${EXTRA[@]}"
else
  exec "$PY" "${ROOT}/launch.py" run --host "$HOST" --port "$PORT"
fi

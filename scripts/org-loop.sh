#!/usr/bin/env bash
# Prove the finished FreeOS self-growth loop (fixtures when openXYOS is down).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
uv run freeos org loop run "$@"

#!/usr/bin/env bash
# Assemble a relocatable green portable zip for one platform.
#
# Prerequisites:
#   bash desktop/portable/bootstrap-runtime.sh <plat>
#   make build-frontend   # recommended (dashboard inside wheel)
#
# Usage:
#   bash desktop/portable/package.sh                # host platform (online install)
#   bash desktop/portable/package.sh darwin-arm64
#   OCTOP_GREEN_OFFLINE=1 bash desktop/portable/package.sh   # require local wheels
#
# Layout of each zip:
#   FreeOS-<plat>/
#     runtime/     portable CPython
#     packages/    site-packages (uv --target, relocatable)
#     org-sidecar/ managed Node + complete openXYOS organization runtime
#     start.sh / start.bat
#     README.txt
#
# Public filename is FreeOS-portable-<plat>-<version>.zip (see portable_zip_basename).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=desktop/portable/_common.sh
source "${REPO_ROOT}/desktop/portable/_common.sh"

TEMPLATES="${REPO_ROOT}/desktop/portable/templates"
require_uv

build_octop_wheel() {
  local wheel_dir="$1"
  mkdir -p "$wheel_dir"
  # Drop previous local octop wheels so we pick the fresh build.
  find "$wheel_dir" -maxdepth 1 -type f -name 'octop-*.whl' -delete 2>/dev/null || true
  if [[ ! -f "${REPO_ROOT}/src/octop/dashboard/index.html" ]]; then
    echo "[package] dashboard not built (src/octop/dashboard/index.html missing)." >&2
    echo "  Run: make build-frontend" >&2
    exit 1
  fi
  if ! grep -q 'xyai-mark.png' "${REPO_ROOT}/src/octop/dashboard/index.html"; then
    echo "[package] dashboard boot splash is missing xyai-mark.png — refuse to ship Octop-branded UI." >&2
    exit 1
  fi
  echo "[package] building octop wheel → ${wheel_dir}" >&2
  uv build --wheel --out-dir "$wheel_dir" "$REPO_ROOT" >&2
  local whl
  whl="$(ls -1 "${wheel_dir}"/octop-*.whl 2>/dev/null | sort | tail -1 || true)"
  if [[ -z "$whl" ]]; then
    echo "[package] failed to build octop-*.whl" >&2
    exit 1
  fi
  # stdout: wheel path only (captured by caller)
  echo "$whl"
}

wheel_cache_usable() {
  local wheel_dir="$1"
  local count
  count="$(find "$wheel_dir" -maxdepth 1 -type f -name '*.whl' 2>/dev/null | wc -l | tr -d ' ')"
  # Need octop + a reasonable set of deps.
  [[ "${count:-0}" -ge 10 ]]
}

# Copy pywin32 DLLs beside portable python.exe so ``import pywintypes`` works.
fix_windows_pywin32() {
  local staging="$1"
  local dll_src="${staging}/packages/pywin32_system32"
  local runtime="${staging}/runtime"
  if [[ ! -d "$dll_src" ]]; then
    echo "[package] pywin32_system32 missing under packages/ — was pywin32 installed?" >&2
    return 1
  fi
  local f
  local copied=0
  for f in "$dll_src"/pywintypes*.dll "$dll_src"/pythoncom*.dll; do
    [[ -f "$f" ]] || continue
    cp -f "$f" "$runtime/"
    copied=$((copied + 1))
  done
  if [[ "$copied" -eq 0 ]]; then
    echo "[package] no pywintypes/pythoncom DLLs found in ${dll_src}" >&2
    return 1
  fi
  echo "[package] copied ${copied} pywin32 DLL(s) → runtime/"
  return 0
}

assemble_one() {
  local plat="$1"
  local runtime="${GREEN_RUNTIMES}/${plat}"
  local wheel_dir="${GREEN_WHEELS}/${plat}"
  local staging="${GREEN_RELEASE}/$(portable_staging_name "$plat")"
  local zip_path="${GREEN_RELEASE}/$(portable_zip_basename "$plat")"
  local pyplat

  if ! pyplat="$(uv_platform "$plat")"; then
    echo "unknown platform: $plat" >&2
    exit 1
  fi

  if [[ ! -d "$runtime" ]]; then
    echo "[package] missing runtime ${runtime}" >&2
    echo "  Run: bash desktop/portable/bootstrap-runtime.sh ${plat}" >&2
    exit 1
  fi

  mkdir -p "$wheel_dir" "$GREEN_RELEASE" "$GREEN_ROOT"
  local octop_whl
  octop_whl="$(build_octop_wheel "$wheel_dir")"

  local req_file="${GREEN_ROOT}/requirements-${plat}.txt"
  echo "[package] ${plat}: exporting frozen deps → ${req_file}" >&2
  uv export --project "$REPO_ROOT" --frozen --no-dev --no-emit-project --no-hashes -o "$req_file" >/dev/null

  # Platform-specific pins / exclusions (see write_green_overrides in _common.sh).
  local override_file=""
  override_file="$(write_green_overrides "$plat" || true)"
  if [[ -n "$override_file" ]]; then
    echo "[package] ${plat}: using overrides → ${override_file}" >&2
    cat "$override_file" >&2 || true
  fi

  echo "[package] ${plat}: staging → ${staging}"
  rm -rf "$staging"
  mkdir -p "${staging}/packages"
  cp -a "$runtime" "${staging}/runtime"

  local common_args=(
    --target "${staging}/packages"
    --python-platform "$pyplat"
    --python-version 3.12
    # Never compile cryptography from sdist: on Intel macOS that links
    # Homebrew OpenSSL and breaks portable zips on machines without brew.
    --only-binary cryptography
  )
  if [[ -n "$override_file" ]]; then
    common_args+=( --overrides "$override_file" )
  fi
  local offline_args=()
  local host
  host="$(host_plat)"
  echo "[package] ${plat}: host=${host} RUNNER_ARCH=${RUNNER_ARCH:-} GREEN_HOST_PLAT=${GREEN_HOST_PLAT:-}" >&2

  # Last-resort correction: packaging windows-arm64 while shell looks amd64, but
  # Actions/toolcache clearly provides ARM64 (matches the failing CI symptom).
  if [[ "$plat" == "windows-arm64" && "$host" == "windows-amd64" ]]; then
    local py_arch=""
    py_arch="$(python_machine_arch 2>/dev/null || true)"
    if [[ "${RUNNER_ARCH:-}" == "ARM64" || "$py_arch" == "arm64" ]]; then
      echo "[package] ${plat}: overriding host windows-amd64 → windows-arm64 (RUNNER_ARCH=${RUNNER_ARCH:-} python=${py_arch:-unknown})" >&2
      host=windows-arm64
    fi
  fi

  # uv pip resolves against the host interpreter. macOS /usr/bin/python3 is
  # often Xcode 3.9, which cannot satisfy octop's requires-python >=3.12.
  if [[ "$plat" == "$host" ]]; then
    local install_python
    install_python="$(runtime_python "${staging}/runtime")"
    if [[ ! -x "$install_python" && ! -f "$install_python" ]]; then
      echo "[package] portable python missing: ${install_python}" >&2
      exit 1
    fi
    echo "[package] ${plat}: resolving with ${install_python}" >&2
    common_args+=( --python "$install_python" )
  else
    uv python install 3.12 >/dev/null
    echo "[package] ${plat}: resolving with uv-managed CPython 3.12" >&2
    common_args+=( --python 3.12 )
  fi

  # Cross-platform: refuse compiling sdists on the host (wrong ABI). Prefer
  # binary wheels only; for Linux use desktop/portable/package-linux-docker.sh.
  if [[ "$plat" != "$host" ]]; then
    common_args+=( --only-binary ":all:" )
    echo "[package] ${plat}: cross-assemble from ${host} (binary wheels only)" >&2
  fi

  if [[ "${OCTOP_GREEN_OFFLINE:-0}" == "1" ]]; then
    if ! wheel_cache_usable "$wheel_dir"; then
      echo "[package] OCTOP_GREEN_OFFLINE=1 but wheels cache incomplete: ${wheel_dir}" >&2
      echo "  Run: bash desktop/portable/vendor-wheels.sh ${plat}" >&2
      exit 1
    fi
    echo "[package] ${plat}: offline install from ${wheel_dir}"
    offline_args+=( --no-index --find-links "$wheel_dir" )
  elif wheel_cache_usable "$wheel_dir"; then
    echo "[package] ${plat}: install preferring local wheels (+ PyPI fallback)"
    offline_args+=( --find-links "$wheel_dir" )
  else
    echo "[package] ${plat}: online install from locked requirements"
  fi

  # Install locked deps first, then the local octop wheel without re-resolving deps.
  # bash 3.2 + set -u: empty array expansion is unbound — branch explicitly.
  set +e
  if [[ ${#offline_args[@]} -gt 0 ]]; then
    uv pip install "${common_args[@]}" "${offline_args[@]}" -r "$req_file"
    status=$?
    if [[ $status -eq 0 ]]; then
      uv pip install "${common_args[@]}" "${offline_args[@]}" --no-deps "$octop_whl"
      status=$?
    fi
  else
    uv pip install "${common_args[@]}" -r "$req_file"
    status=$?
    if [[ $status -eq 0 ]]; then
      uv pip install "${common_args[@]}" --no-deps "$octop_whl"
      status=$?
    fi
  fi
  # Windows markers: ensure pywin32 landed (mcp needs pywintypes).
  if [[ $status -eq 0 && "$plat" == windows-* ]]; then
    if [[ ! -d "${staging}/packages/pywin32_system32" ]]; then
      echo "[package] ${plat}: pywin32 missing — installing explicitly" >&2
      if [[ ${#offline_args[@]} -gt 0 ]]; then
        uv pip install "${common_args[@]}" "${offline_args[@]}" pywin32
      else
        uv pip install "${common_args[@]}" pywin32
      fi
      status=$?
    fi
  fi
  set -e
  if [[ $status -ne 0 ]]; then
    echo "[package] install failed for ${plat} (exit ${status})" >&2
    if [[ "$plat" != "$host" && "$plat" == linux-* ]]; then
      echo "  Tip: build Linux zips in Docker:" >&2
      echo "    bash desktop/portable/package-linux-docker.sh ${plat}" >&2
    elif [[ "$plat" != "$host" && "$plat" == windows-* ]]; then
      echo "  Tip: build Windows zips on a Windows host (or CI):" >&2
      echo "    make -f desktop/portable/Makefile green GREEN_PLAT=${plat}" >&2
    fi
    exit "$status"
  fi

  cp "${TEMPLATES}/start.sh" "${staging}/start.sh"
  cp "${TEMPLATES}/start.bat" "${staging}/start.bat"
  cp "${TEMPLATES}/launch.py" "${staging}/launch.py"
  cp "${TEMPLATES}/README.txt" "${staging}/README.txt"
  chmod +x "${staging}/start.sh"

  # Default is **zero-Node** (uv run / Docker / source / Phase-5 installer).
  # Desktop CI sets SHIP_OPENXYOS_RUNTIME=1 for the transitional iframe bridge.
  # Explicit SKIP_ORG_SIDECAR=0 still ships the sidecar even if the ship flag
  # is unset. Do not treat SHIP_OPENXYOS_RUNTIME=1 as the permanent product.
  if [[ "${SHIP_OPENXYOS_RUNTIME:-0}" == "0" ]]; then
    SKIP_ORG_SIDECAR="${SKIP_ORG_SIDECAR:-1}"
  else
    SKIP_ORG_SIDECAR="${SKIP_ORG_SIDECAR:-0}"
  fi
  export SKIP_ORG_SIDECAR
  echo "[package] ${plat}: org sidecar (SKIP_ORG_SIDECAR=${SKIP_ORG_SIDECAR})" >&2
  bash "${REPO_ROOT}/desktop/portable/bundle-org-sidecar.sh" "$plat" "$staging"
  if [[ "${SKIP_ORG_SIDECAR}" != "1" ]]; then
    if [[ ! -f "${staging}/org-sidecar/openxyos/dist/index.html" ]]; then
      echo "[package] ERROR: openXYOS frontend missing under ${staging}/org-sidecar/openxyos/dist" >&2
      exit 1
    fi
    if [[ "$plat" == windows-* && ! -f "${staging}/org-sidecar/node/node.exe" ]]; then
      echo "[package] ERROR: bundled Node missing under ${staging}/org-sidecar/node" >&2
      exit 1
    fi
    if [[ "$plat" != windows-* && ! -x "${staging}/org-sidecar/node/bin/node" ]]; then
      echo "[package] ERROR: bundled Node missing under ${staging}/org-sidecar/node/bin" >&2
      exit 1
    fi
    echo "[package] ${plat}: writing openxyos-runtime zip" >&2
    python3 "${REPO_ROOT}/desktop/src/build/stage_openxyos_runtime.py" \
      "${staging}/org-sidecar" \
      "${GREEN_RELEASE}/openxyos-runtime-${plat}-$(octop_version).zip" \
      || python "${REPO_ROOT}/desktop/src/build/stage_openxyos_runtime.py" \
        "${staging}/org-sidecar" \
        "${GREEN_RELEASE}/openxyos-runtime-${plat}-$(octop_version).zip"
  fi

  # Windows: pywin32 DLLs must be findable next to python.exe (or on PATH).
  # --target installs leave them under packages/pywin32_system32 only.
  if [[ "$plat" == windows-* ]]; then
    fix_windows_pywin32 "$staging" || {
      echo "[package] WARNING: pywin32 DLL fix failed — Windows runtime may miss pywintypes" >&2
    }
  fi

  # macOS: reject Homebrew-linked native extensions before zipping.
  verify_no_homebrew_dylibs "${staging}/packages" "$plat"

  {
    echo "platform=${plat}"
    echo "python=${PBS_PY}"
    echo "pbs_tag=${PBS_TAG}"
    sed -n 's/^version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/octop_version=\1/p' \
      "${REPO_ROOT}/pyproject.toml" | head -1
    if [[ -d "${staging}/org-sidecar/openxyos" ]]; then
      echo "org_sidecar=1"
    fi
  } > "${staging}/VERSION.txt"

  # Same semver (0.0.1) rebuilds must still replace leftover Octop / stale
  # dashboards. The desktop host compares this stamp, not the product version.
  stamp="${GITHUB_SHA:-}"
  if [[ -z "$stamp" ]]; then
    stamp="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
  fi
  stamp="${stamp:-local}-$(date -u +%Y%m%d%H%M%S)"
  printf '%s\n' "$stamp" > "${staging}/FREEOS_STAMP"

  echo "[package] ${plat}: scanning staging for secrets / user home data" >&2
  py_scan=""
  if command -v python3 >/dev/null 2>&1; then
    py_scan=python3
  elif command -v python >/dev/null 2>&1; then
    py_scan=python
  fi
  if [[ -z "$py_scan" ]]; then
    echo "[package] need python to scan packaged secrets" >&2
    exit 1
  fi
  "$py_scan" "${REPO_ROOT}/desktop/portable/scan_packaged_secrets.py" "$staging"

  rm -f "$zip_path"
  echo "[package] ${plat}: zipping → ${zip_path}"
  local zip_name zip_stem
  zip_name="$(basename "$zip_path")"
  zip_stem="${zip_name%.zip}"
  (
    cd "$GREEN_RELEASE"
    if command -v zip >/dev/null 2>&1; then
      zip -qry "$zip_name" "$(portable_staging_name "$plat")"
    else
      # Windows runners often have `python` but not `python3` / `zip`.
      py=""
      if command -v python3 >/dev/null 2>&1; then
        py=python3
      elif command -v python >/dev/null 2>&1; then
        py=python
      fi
      if [[ -z "$py" ]]; then
        echo "[package] need zip or python to create archive" >&2
        exit 1
      fi
      "$py" -c "import shutil; shutil.make_archive('${zip_stem}', 'zip', '.', '$(portable_staging_name "$plat")')"
    fi
  )
  echo "[package] wrote ${zip_path}"
}

main() {
  local plat="${1:-}"
  if [[ -z "$plat" ]]; then
    plat="$(host_plat)"
  fi
  if ! is_known_plat "$plat"; then
    echo "unknown platform: $plat (known: ${ALL_PLATS[*]})" >&2
    exit 1
  fi
  assemble_one "$plat"
}

main "${1:-}"

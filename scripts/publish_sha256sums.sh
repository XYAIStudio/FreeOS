#!/usr/bin/env bash
# Upload SHA256SUMS for the desktop installers, portable zips, wheels, and
# sdists on a GitHub Release. Local directories are overlaid on assets already
# attached, so Release and Desktop Package can each refresh the same file.
#
#   bash scripts/publish_sha256sums.sh v0.1.0rc1 dist
#   bash scripts/publish_sha256sums.sh v0.1.0rc1 release-assets
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: publish_sha256sums.sh <vTAG> [extra_dir ...]" >&2
  exit 2
fi

tag="$1"
shift
if [[ "$tag" != v* ]]; then
  echo "tag must start with v: $tag" >&2
  exit 2
fi

repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

EXTRAS=("$@")

download_pattern_if_present() {
  local pattern="$1"
  local name saw=0
  for name in "${ASSET_NAMES[@]}"; do
    # shellcheck disable=SC2254
    if [[ "$name" == $pattern ]]; then
      saw=1
      break
    fi
  done
  if [[ "$saw" -eq 1 ]]; then
    gh release download "$tag" --repo "$repo" --pattern "$pattern" --dir "$stage" --skip-existing
  fi
}

stage_assets() {
  local extra f base
  rm -rf "$stage"
  mkdir -p "$stage"
  shopt -s nullglob
  for extra in "${EXTRAS[@]}"; do
    if [[ -d "$extra" ]]; then
      for f in "$extra"/*; do
        [[ -f "$f" ]] || continue
        base="$(basename "$f")"
        [[ "$base" == "SHA256SUMS" ]] && continue
        if [[ ! -e "$stage/$base" ]]; then
          cp "$f" "$stage/$base"
        fi
      done
    fi
  done
  ASSET_NAMES=()
  if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
    local listed
    listed="$(gh release view "$tag" --repo "$repo" --json assets --jq '.assets[].name')"
    if [[ -n "$listed" ]]; then
      mapfile -t ASSET_NAMES <<<"$listed"
    fi
    download_pattern_if_present 'freeos-*'
    download_pattern_if_present 'FreeOS-*'
  fi
  rm -f "$stage/SHA256SUMS"
}

refresh_if_release_grew() {
  local listed status
  listed="$(gh release view "$tag" --repo "$repo" --json assets --jq '.assets[].name')"
  set +e
  printf '%s\n' "$listed" | python3 "$script_dir/write_sha256sums.py" --missing-from "$stage/SHA256SUMS"
  status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then
    return 0
  fi
  if [[ "$status" -ne 3 ]]; then
    exit "$status"
  fi
  echo "Release gained artifacts after the first hash; rewriting SHA256SUMS"
  stage_assets
  python3 "$script_dir/write_sha256sums.py" "$stage"
  gh release upload "$tag" "$stage/SHA256SUMS" --clobber --repo "$repo"
}

stage_assets
python3 "$script_dir/write_sha256sums.py" "$stage"
gh release upload "$tag" "$stage/SHA256SUMS" --clobber --repo "$repo"
refresh_if_release_grew

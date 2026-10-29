"""The shipped organization tree must not contain the demo seed module."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ORG = REPO / "modules" / "openxyos"
BUNDLE = REPO / "desktop" / "portable" / "bundle-org-sidecar.sh"

SKIP_DIRS = {
    "node_modules",
    "dist",
    ".git",
    ".github",
    "backups",
    "dist-backup-20260626",
    "V0.5",
    ".freeos",
    ".octop",
}
SEED_MARKERS = (
    "openxyos-demo-2026",
    "ensureLocalBootstrap",
    "demo@demo.com",
    "user@demo.com",
)
# Cleanup and the UI-tenant denylist name the accounts they must not prefer.
# They do not insert demo rows.
ALLOW = {
    ORG / "backend" / "upgrade-cleanup.ts",
    ORG / "backend" / "routes" / "freeos-bridge.ts",
}


def _shipped_files() -> list[Path]:
    files: list[Path] = []
    for path in ORG.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(ORG)
        if any(part in SKIP_DIRS for part in relative.parts):
            continue
        if relative.parts[:2] == ("backend", "dev"):
            continue
        if relative.parts[:1] == ("scripts",) and path.name.startswith("test-"):
            continue
        files.append(path)
    return files


def test_bundle_script_excludes_demo_seed() -> None:
    text = BUNDLE.read_text(encoding="utf-8")
    assert "--exclude backend/dev" in text
    assert "scripts/test-*" in text
    assert 'dropped.add("dev")' in text


def test_release_tree_has_no_demo_seed_strings() -> None:
    hits: list[str] = []
    for path in _shipped_files():
        if path.suffix not in {".ts", ".tsx", ".js", ".mjs", ".sh", ".json", ".ps1"}:
            continue
        if path in ALLOW:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for marker in SEED_MARKERS:
            if marker in text:
                hits.append(f"{path.relative_to(REPO)}: {marker}")
    assert hits == []

"""``freeos org export-standalone`` — commercializable openXYOS source pack."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from octop.modules.org_os.contract import SHARED_ORG_UI_MODULES
from octop.modules.org_os.export_inventory import ExportMode, build_export_manifest

_ORG_UI_IGNORE = (
    "*.test.ts",
    "*.test.tsx",
    "*.spec.ts",
    "*.spec.tsx",
    "__snapshots__",
    ".DS_Store",
)

_SKIP_DIR_NAMES = {
    "node_modules",
    "oh_modules",
    "dist",
    "build",
    "coverage",
    ".git",
    ".idea",
    ".vscode",
    ".hvigor",
    ".tmp",
    "tmp",
    "artifacts",
    "reports",
    "uploads",
    "__pycache__",
}
_SKIP_FILES = {".DS_Store", "Thumbs.db", ".env"}
_SKIP_SUFFIXES = (
    ".db",
    ".sqlite",
    ".sqlite3",
    ".log",
    ".pyc",
    ".zip",
    ".tar",
    ".tgz",
    ".bak",
    ".pem",
    ".key",
    ".p12",
    ".pfx",
)

_SLICE_FILES = (
    "README.md",
    "LICENSE",
    "package.json",
    "vite.config.ts",
    "Dockerfile",
    "docker-compose.yml",
    "nginx.conf.template",
    "server/proxy.mjs",
    "src/App.tsx",
    "src/modules.json",
    "src/org-ui/index.ts",
    "src/org-ui/bridges/localJwt.ts",
    "src/auth/LoginPage.tsx",
    "src/shell/CoveragePage.tsx",
)


def _repo_root() -> Path:
    here = Path(__file__).resolve()
    packaged = here.parents[4]
    if _looks_like_checkout(packaged):
        return packaged
    cwd = Path.cwd()
    if _looks_like_checkout(cwd):
        return cwd
    raise FileNotFoundError(
        "freeos org export-standalone needs a FreeOS source checkout "
        "(dashboard/src/org-ui, scripts/org-export/template, modules/openxyos). "
        "Installed wheels without those trees cannot generate the package."
    )


def _looks_like_checkout(root: Path) -> bool:
    return (
        (root / "dashboard" / "src" / "org-ui").is_dir()
        and (root / "scripts" / "org-export" / "template").is_dir()
        and (root / "modules" / "openxyos" / "frontend" / "src" / "App.tsx").is_file()
    )


def _ignore_openxyos(directory: str, names: list[str]) -> set[str]:
    del directory
    skipped: set[str] = set()
    for name in names:
        if name in _SKIP_DIR_NAMES or name in _SKIP_FILES:
            skipped.add(name)
            continue
        if name.startswith(".env") and name != ".env.example":
            skipped.add(name)
            continue
        if name.endswith(_SKIP_SUFFIXES):
            skipped.add(name)
    return skipped


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _write_slice(root: Path, dest: Path, manifest: dict[str, Any]) -> None:
    template = root / "scripts" / "org-export" / "template"
    org_ui = root / "dashboard" / "src" / "org-ui"
    shutil.copytree(template, dest, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".DS_Store"))
    shutil.copytree(
        org_ui,
        dest / "src" / "org-ui",
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(*_ORG_UI_IGNORE),
    )
    _write_json(dest / "src" / "modules.json", manifest)
    _write_json(dest / "modules.json", manifest)


def _write_openxyos_tree(root: Path, dest: Path) -> None:
    source = root / "modules" / "openxyos"
    shutil.copytree(
        source,
        dest,
        dirs_exist_ok=True,
        ignore=_ignore_openxyos,
    )


def _copy_pack_overlay(root: Path, dest: Path) -> None:
    overlay = root / "scripts" / "org-export" / "pack"
    if not overlay.is_dir():
        return
    shutil.copytree(
        overlay,
        dest,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(".DS_Store"),
    )


def write_standalone_scaffold(
    out_dir: Path,
    *,
    mode: ExportMode = "full",
) -> dict[str, Any]:
    dest = Path(out_dir)
    dest.mkdir(parents=True, exist_ok=True)
    root = _repo_root()
    manifest = build_export_manifest(root, mode=mode)
    if mode == "slice":
        _write_slice(root, dest, manifest)
        files = list(_SLICE_FILES)
        layout = {"slice": ".", "manifest": "src/modules.json"}
        api = (
            "proxies /api to FREEOS_UPSTREAM (interim slice); "
            "use --mode full for the self-contained openXYOS source tree"
        )
    else:
        _write_openxyos_tree(root, dest / "openxyos")
        _write_slice(root, dest / "slice", manifest)
        _copy_pack_overlay(root, dest)
        _write_json(dest / "modules.json", manifest)
        files = [
            "README.md",
            "README.zh-CN.md",
            "NOTICE",
            "modules.json",
            "openxyos/package.json",
            "openxyos/LICENSE",
            "openxyos/frontend/src/App.tsx",
            "openxyos/backend/server.ts",
            "slice/README.md",
            "slice/package.json",
            "slice/src/App.tsx",
            "slice/src/modules.json",
            "slice/src/org-ui/index.ts",
            "slice/src/org-ui/bridges/localJwt.ts",
            "slice/src/shell/CoveragePage.tsx",
        ]
        layout = {
            "openxyos": "openxyos/",
            "slice": "slice/",
            "manifest": "modules.json",
        }
        api = (
            "full tree is self-contained Node+Vite in openxyos/; "
            "slice proxies /api to FREEOS_UPSTREAM (interim host bridge)"
        )
    return {
        "out_dir": str(dest),
        "mode": mode,
        "layout": layout,
        "modules": list(SHARED_ORG_UI_MODULES),
        "files": files,
        "licenses": dict(manifest["licenses"]),
        "omissions": [item["id"] for item in manifest["omissions"]],
        "auth": "standalone local JWT (openxyos.standalone.jwt)",
        "api": api,
        "todo": manifest["todo"],
    }

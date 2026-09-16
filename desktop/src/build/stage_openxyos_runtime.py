#!/usr/bin/env python3
"""Build openxyos-runtime.zip from a green portable zip or staging tree.

The Windows NSIS installer copies this zip into $INSTDIR and expands it to
$INSTDIR\\openxyos so the finish log shows FE+BE, not only FreeOS.exe.
"""

from __future__ import annotations

import argparse
import shutil
import sys
import zipfile
from pathlib import Path

REQUIRED = (
    Path("node"),
    Path("openxyos") / "backend" / "server.ts",
    Path("openxyos") / "dist" / "index.html",
)


def layout_ready(root: Path) -> bool:
    """True when *root* is a complete sidecar tree, not README-only."""
    node_ok = (root / "node" / "node.exe").is_file() or (root / "node" / "bin" / "node").is_file()
    fe_ok = (root / "openxyos" / "dist" / "index.html").is_file() or (
        root / "dist" / "index.html"
    ).is_file()
    be_ok = (root / "openxyos" / "backend" / "server.ts").is_file() or (
        root / "backend" / "server.ts"
    ).is_file()
    return node_ok and fe_ok and be_ok


def verify_runtime_zip(path: Path) -> None:
    """Fail if the zip would install as README-only (missing node or dist)."""
    with zipfile.ZipFile(path) as zf:
        names = {name.replace("\\", "/").lstrip("./") for name in zf.namelist()}
    node_ok = "node/node.exe" in names or "node/bin/node" in names
    fe_ok = "openxyos/dist/index.html" in names or "dist/index.html" in names
    be_ok = "openxyos/backend/server.ts" in names or "backend/server.ts" in names
    if not (node_ok and fe_ok and be_ok):
        raise SystemExit(f"incomplete openxyos-runtime.zip (need node + dist/index.html): {path}")


def _bundle_root(extracted: Path) -> Path | None:
    direct = extracted
    if _ready(direct):
        return direct
    nested = extracted / "org-sidecar"
    if _ready(nested):
        return nested
    for child in extracted.iterdir():
        if not child.is_dir():
            continue
        if _ready(child):
            return child
        inner = child / "org-sidecar"
        if _ready(inner):
            return inner
    return None


def _ready(root: Path) -> bool:
    return all((root / part).exists() for part in REQUIRED)


def _extract_source(source: Path, work: Path) -> Path:
    if source.is_dir():
        return source
    dest = work / "unpacked"
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    with zipfile.ZipFile(source) as zf:
        zf.extractall(dest)
    return dest


def stage(source: Path, dest_zip: Path) -> Path:
    work = dest_zip.parent / ".openxyos-runtime-work"
    work.mkdir(parents=True, exist_ok=True)
    extracted = _extract_source(source, work)
    root = _bundle_root(extracted)
    if root is None:
        raise SystemExit(f"openXYOS sidecar (node + FE + BE) not found in {source}")
    dest_zip.parent.mkdir(parents=True, exist_ok=True)
    if dest_zip.exists():
        dest_zip.unlink()
    with zipfile.ZipFile(dest_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(root.rglob("*")):
            if path.is_dir():
                continue
            rel = path.relative_to(root).as_posix()
            zf.write(path, rel)
    verify_runtime_zip(dest_zip)
    readme = dest_zip.with_name("openxyos-README.txt")
    readme.write_text(
        "FreeOS openXYOS runtime\n"
        "Install dir: <install>\\openxyos  (FE+BE, read-only)\n"
        "Work dir:    %LOCALAPPDATA%\\FreeOS\\openxyos  or  %USERPROFILE%\\.freeos\\openxyos\n"
        "URL:         http://127.0.0.1:3780\n",
        encoding="utf-8",
    )
    if work.exists() and source.is_file():
        shutil.rmtree(work, ignore_errors=True)
    return dest_zip


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="portable zip or org-sidecar staging directory")
    parser.add_argument("dest", help="output openxyos-runtime.zip")
    args = parser.parse_args()
    dest = stage(Path(args.source), Path(args.dest))
    print(dest)
    return 0


if __name__ == "__main__":
    sys.exit(main())

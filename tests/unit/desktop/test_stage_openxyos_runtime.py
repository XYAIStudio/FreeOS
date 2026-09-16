from __future__ import annotations

import importlib.util
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
_SPEC = importlib.util.spec_from_file_location(
    "stage_openxyos_runtime",
    REPO / "desktop" / "src" / "build" / "stage_openxyos_runtime.py",
)
assert _SPEC and _SPEC.loader
stage_mod = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(stage_mod)


def _write_bundle(root: Path) -> None:
    node = root / "node"
    node.mkdir(parents=True)
    (node / "node.exe").write_text("node", encoding="utf-8")
    app = root / "openxyos"
    (app / "backend").mkdir(parents=True)
    (app / "backend" / "server.ts").write_text("// server", encoding="utf-8")
    (app / "dist").mkdir()
    (app / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")


def test_stage_openxyos_runtime_from_sidecar_dir(tmp_path: Path) -> None:
    src = tmp_path / "org-sidecar"
    _write_bundle(src)
    dest = tmp_path / "openxyos-runtime.zip"
    stage_mod.stage(src, dest)
    assert dest.is_file()
    with zipfile.ZipFile(dest) as zf:
        names = set(zf.namelist())
    assert "openxyos/dist/index.html" in names
    assert "node/node.exe" in names
    assert "openxyos/backend/server.ts" in names

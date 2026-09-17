from __future__ import annotations

import importlib.util
import re
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

DB_TS = REPO / "modules" / "openxyos" / "backend" / "db.ts"


def _write_bundle(root: Path, *, compiled: bool = False, with_sql: bool = False) -> Path:
    node = root / "node"
    node.mkdir(parents=True)
    (node / "node.exe").write_text("node", encoding="utf-8")
    app = root / "openxyos"
    (app / "backend").mkdir(parents=True)
    (app / "backend" / "server.ts").write_text("// server", encoding="utf-8")
    (app / "dist").mkdir()
    (app / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
    if compiled:
        compiled_dir = app / "backend-dist"
        compiled_dir.mkdir(parents=True)
        (compiled_dir / "server.js").write_text("/* compiled */", encoding="utf-8")
    if with_sql:
        migrations = app / "backend" / "migrations"
        migrations.mkdir(parents=True, exist_ok=True)
        for name in stage_mod.REQUIRED_RUNTIME_SQL:
            (migrations / name).write_text(f"-- {name}\n", encoding="utf-8")
        (migrations / "001_add_pending_reviews.sql").write_text("-- extra\n", encoding="utf-8")
    return app


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
    stage_mod.verify_runtime_zip(dest)
    assert stage_mod.layout_ready(src)


def test_readme_only_layout_cannot_ship(tmp_path: Path) -> None:
    stub = tmp_path / "openxyos"
    stub.mkdir()
    (stub / "README.txt").write_text("FreeOS local openXYOS environment\n", encoding="utf-8")
    assert stage_mod.layout_ready(stub) is False
    empty_zip = tmp_path / "openxyos-runtime.zip"
    with zipfile.ZipFile(empty_zip, "w") as zf:
        zf.writestr("README.txt", "stub")
    try:
        stage_mod.verify_runtime_zip(empty_zip)
    except SystemExit as exc:
        assert "incomplete" in str(exc)
    else:
        raise AssertionError("README-only zip must not verify")


def test_bundle_script_copies_migrations_next_to_compiled_server() -> None:
    text = (REPO / "desktop" / "portable" / "bundle-org-sidecar.sh").read_text(encoding="utf-8")
    assert "backend-dist/migrations" in text
    assert "copy backend/migrations" in text


def test_source_tree_has_runtime_sql() -> None:
    migrations = REPO / "modules" / "openxyos" / "backend" / "migrations"
    for name in stage_mod.REQUIRED_RUNTIME_SQL:
        assert (migrations / name).is_file(), name


def test_required_runtime_sql_matches_db_ts() -> None:
    """Keep the staged SQL list in sync with initDatabase() readFileSync paths."""
    text = DB_TS.read_text(encoding="utf-8")
    found = set(re.findall(r'migrations/([0-9]{3}_[a-z0-9_]+\.sql)"', text))
    assert found == set(stage_mod.REQUIRED_RUNTIME_SQL)


def test_stage_copies_backend_migrations_next_to_compiled_server(tmp_path: Path) -> None:
    src = tmp_path / "org-sidecar"
    _write_bundle(src, compiled=True, with_sql=True)
    dest = tmp_path / "openxyos-runtime.zip"
    stage_mod.stage(src, dest)
    with zipfile.ZipFile(dest) as zf:
        names = set(zf.namelist())
    for name in stage_mod.REQUIRED_RUNTIME_SQL:
        assert f"openxyos/backend-dist/migrations/{name}" in names
    assert "openxyos/backend-dist/migrations/001_add_pending_reviews.sql" in names
    assert "openxyos/backend-dist/server.js" in names
    stage_mod.verify_runtime_zip(dest)


def test_stage_fails_when_compiled_server_has_no_sql(tmp_path: Path) -> None:
    src = tmp_path / "org-sidecar"
    _write_bundle(src, compiled=True, with_sql=False)
    dest = tmp_path / "openxyos-runtime.zip"
    try:
        stage_mod.stage(src, dest)
    except SystemExit as exc:
        assert "013_audit_bundle.sql" in str(exc)
    else:
        raise AssertionError("compiled server without SQL must not stage")


def test_verify_rejects_compiled_zip_missing_migrations(tmp_path: Path) -> None:
    incomplete = tmp_path / "openxyos-runtime.zip"
    with zipfile.ZipFile(incomplete, "w") as zf:
        zf.writestr("node/node.exe", "node")
        zf.writestr("openxyos/dist/index.html", "<html></html>")
        zf.writestr("openxyos/backend/server.ts", "// server")
        zf.writestr("openxyos/backend-dist/server.js", "/* compiled */")
    try:
        stage_mod.verify_runtime_zip(incomplete)
    except SystemExit as exc:
        assert "migrations" in str(exc)
        assert "013_audit_bundle.sql" in str(exc)
    else:
        raise AssertionError("compiled zip without migrations must not verify")

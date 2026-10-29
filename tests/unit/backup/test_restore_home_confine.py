"""Restore must not write agent workspaces outside ``--home``."""

from __future__ import annotations

import hashlib
import io
import json
import sqlite3
import tarfile
from pathlib import Path

from octop.config import DatabaseConfig
from octop.infra.backup.system_archive import create_system_backup, restore_system_backup
from octop.infra.db.migrate import run_migrations
from octop.infra.db.pool import SqlitePool
from octop.infra.db.repos.agents import AgentRepo
from octop.infra.utils.paths import PathLayout


def _fingerprint(path: Path) -> tuple[str, int]:
    stat = path.stat()
    return hashlib.sha256(path.read_bytes()).hexdigest(), stat.st_mtime_ns


def _repack(archive: Path, edits: dict[str, bytes]) -> None:
    members: dict[str, bytes] = {}
    with tarfile.open(archive, mode="r:gz") as tf:
        for member in tf.getmembers():
            if not member.isfile():
                continue
            extracted = tf.extractfile(member)
            assert extracted is not None
            members[member.name] = extracted.read()
    members.update(edits)
    with tarfile.open(archive, mode="w:gz") as tf:
        for name, blob in members.items():
            info = tarfile.TarInfo(name=name)
            info.size = len(blob)
            tf.addfile(info, io.BytesIO(blob))


def test_restore_home_does_not_overwrite_live_absolute_workspace(tmp_path: Path) -> None:
    source = PathLayout(tmp_path / "old-home")
    source.root.mkdir()
    live = source.root / "agents" / "main"
    live.mkdir(parents=True)
    soul = live / "SOUL.md"
    soul.write_text("archived\n", encoding="utf-8")
    pool = SqlitePool(source.db)
    run_migrations(pool)
    with pool.connect() as conn:
        conn.execute(
            "INSERT INTO users(username, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
            ("admin", "hash", "admin", 1),
        )
    repo = AgentRepo(pool)
    repo.create(
        agent_id="main",
        user_id=1,
        name="Main",
        config_json=json.dumps(
            {
                "workspace_dir": str(live.resolve()),
                "backend": {
                    "type": "local_shell",
                    "root_dir": str(source.root.resolve()),
                    "virtual_mode": True,
                },
            }
        ),
    )
    archive = tmp_path / "backup.tar.gz"
    create_system_backup(
        paths=source,
        agent_rows=[repo.get("main")],
        pool=pool,
        db_config=DatabaseConfig(),
        dest=archive,
        include_workspaces=True,
        include_config=False,
    )
    pool.close()

    with tarfile.open(archive, mode="r:gz") as tf:
        raw_db = tf.extractfile("db/octop.db")
        assert raw_db is not None
        db_bytes = raw_db.read()
    # Check the packed database records a home-relative workspace path.
    disk = tmp_path / "snap.db"
    disk.write_bytes(db_bytes)
    recorded = sqlite3.connect(disk).execute("SELECT config_json FROM agents").fetchone()
    assert recorded is not None
    recorded_cfg = json.loads(recorded[0])
    assert recorded_cfg["workspace_dir"] == "agents/main"
    assert not Path(recorded_cfg["workspace_dir"]).is_absolute()

    # Old archives stored the absolute path. Put that back and restore elsewhere.
    old = json.dumps(
        {
            "workspace_dir": str(live.resolve()),
            "backend": {
                "type": "local_shell",
                "root_dir": str(source.root.resolve()),
                "virtual_mode": True,
            },
        }
    )
    conn = sqlite3.connect(disk)
    conn.execute("UPDATE agents SET config_json = ?", (old,))
    conn.commit()
    conn.close()
    _repack(archive, {"db/octop.db": disk.read_bytes()})

    soul.write_text("live-do-not-touch\n", encoding="utf-8")
    before = _fingerprint(soul)

    target = PathLayout(tmp_path / "new-home")
    target.root.mkdir()
    target_pool = SqlitePool(target.db)
    run_migrations(target_pool)
    restore_system_backup(
        archive,
        paths=target,
        pool=target_pool,
        db_config=DatabaseConfig(),
        restore_config=False,
    )
    assert _fingerprint(soul) == before
    assert (target.root / "agents" / "main" / "SOUL.md").read_text(encoding="utf-8") == "archived\n"
    restored = json.loads(AgentRepo(target_pool).get("main").config_json or "{}")
    assert Path(restored["workspace_dir"]).resolve().is_relative_to(target.root.resolve())
    target_pool.close()

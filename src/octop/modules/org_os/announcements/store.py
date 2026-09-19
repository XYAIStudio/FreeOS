"""SQLite announcements store under ``{FREEOS_HOME}/org/`` (not sidecar SQL.js)."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ANNOUNCEMENT_TYPES = ("notice", "policy", "news", "emergency")
ANNOUNCEMENT_PRIORITIES = ("low", "normal", "important", "urgent")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'notice',
    priority TEXT NOT NULL DEFAULT 'normal',
    is_pinned INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    created_by INTEGER NOT NULL,
    creator_name TEXT,
    published_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_announcements_tenant
    ON announcements (tenant_id, deleted_at, is_pinned, published_at);
CREATE TABLE IF NOT EXISTS announcement_reads (
    announcement_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at TEXT NOT NULL,
    PRIMARY KEY (announcement_id, user_id)
);
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_type(value: str | None) -> str:
    raw = (value or "notice").strip().lower()
    return raw if raw in ANNOUNCEMENT_TYPES else "notice"


def normalize_priority(value: str | None) -> str:
    raw = (value or "normal").strip().lower()
    return raw if raw in ANNOUNCEMENT_PRIORITIES else "normal"


def _as_pinned(value: Any) -> int:
    if value in (True, 1, "1", "true", "True"):
        return 1
    return 0


class AnnouncementStore:
    """Tenant-scoped announcements + per-user reads in one org SQLite file."""

    def __init__(self, home: Path) -> None:
        self.home = home
        self.path = home / "org" / "announcements.sqlite"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.executescript(_SCHEMA)

    def create(
        self,
        *,
        tenant_id: str,
        title: str,
        content: str,
        created_by: int,
        creator_name: str,
        type: str = "notice",
        priority: str = "normal",
        is_pinned: Any = 0,
        expires_at: str | None = None,
    ) -> dict[str, Any]:
        now = utc_now()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO announcements (
                    tenant_id, title, content, type, priority, is_pinned,
                    expires_at, created_by, creator_name, published_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tenant_id,
                    title,
                    content,
                    normalize_type(type),
                    normalize_priority(priority),
                    _as_pinned(is_pinned),
                    expires_at or None,
                    created_by,
                    creator_name,
                    now,
                    now,
                ),
            )
            row_id = int(cur.lastrowid)
        row = self.get(row_id, tenant_id=tenant_id)
        assert row is not None
        return row

    def get(self, announcement_id: int, *, tenant_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM announcements
                WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
                """,
                (announcement_id, tenant_id),
            ).fetchone()
        return dict(row) if row is not None else None

    def list(
        self,
        *,
        tenant_id: str,
        user_id: int,
        page: int = 1,
        limit: int = 20,
        type: str = "all",
        search: str = "",
        total_users: int = 1,
    ) -> dict[str, Any]:
        page = max(1, page)
        limit = min(max(1, limit), 50)
        offset = (page - 1) * limit
        where = ["tenant_id = ?", "deleted_at IS NULL"]
        params: list[Any] = [tenant_id]
        if type and type != "all":
            where.append("type = ?")
            params.append(normalize_type(type))
        if search.strip():
            like = f"%{search.strip()}%"
            where.append("(title LIKE ? OR content LIKE ?)")
            params.extend([like, like])
        clause = " AND ".join(where)
        with self._connect() as conn:
            total = int(
                conn.execute(
                    f"SELECT COUNT(*) FROM announcements WHERE {clause}",
                    params,
                ).fetchone()[0]
            )
            rows = conn.execute(
                f"""
                SELECT * FROM announcements
                WHERE {clause}
                ORDER BY is_pinned DESC, published_at DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                [*params, limit, offset],
            ).fetchall()
            ids = [int(r["id"]) for r in rows]
            reads = self._read_set(conn, user_id, ids)
            counts = self._read_counts(conn, ids)
        users = max(1, total_users)
        items = [
            self._decorate(dict(row), reads=reads, counts=counts, total_users=users)
            for row in rows
        ]
        return {"list": items, "total": total, "page": page, "limit": limit}

    def pinned(self, *, tenant_id: str, limit: int = 5) -> list[dict[str, Any]]:
        now = utc_now()
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM announcements
                WHERE tenant_id = ? AND deleted_at IS NULL AND is_pinned = 1
                  AND (expires_at IS NULL OR expires_at > ?)
                ORDER BY published_at DESC
                LIMIT ?
                """,
                (tenant_id, now, limit),
            ).fetchall()
        return [dict(row) for row in rows]

    def unread_count(self, *, tenant_id: str, user_id: int) -> int:
        with self._connect() as conn:
            raw = conn.execute(
                """
                SELECT COUNT(*) FROM announcements a
                WHERE a.tenant_id = ? AND a.deleted_at IS NULL
                  AND a.id NOT IN (
                    SELECT announcement_id FROM announcement_reads WHERE user_id = ?
                  )
                """,
                (tenant_id, user_id),
            ).fetchone()[0]
        return int(raw)

    def mark_read(self, announcement_id: int, *, user_id: int) -> None:
        now = utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id, read_at)
                VALUES (?, ?, ?)
                """,
                (announcement_id, user_id, now),
            )

    def mark_all_read(self, *, tenant_id: str, user_id: int) -> int:
        now = utc_now()
        with self._connect() as conn:
            unread = conn.execute(
                """
                SELECT a.id FROM announcements a
                WHERE a.tenant_id = ? AND a.deleted_at IS NULL
                  AND a.id NOT IN (
                    SELECT announcement_id FROM announcement_reads WHERE user_id = ?
                  )
                """,
                (tenant_id, user_id),
            ).fetchall()
            for row in unread:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id, read_at)
                    VALUES (?, ?, ?)
                    """,
                    (int(row["id"]), user_id, now),
                )
        return len(unread)

    def update(
        self,
        announcement_id: int,
        *,
        tenant_id: str,
        title: str,
        content: str,
        type: str,
        priority: str,
        is_pinned: Any,
        expires_at: str | None,
    ) -> dict[str, Any] | None:
        existing = self.get(announcement_id, tenant_id=tenant_id)
        if existing is None:
            return None
        now = utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE announcements
                SET title = ?, content = ?, type = ?, priority = ?,
                    is_pinned = ?, expires_at = ?, updated_at = ?
                WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
                """,
                (
                    title,
                    content,
                    normalize_type(type),
                    normalize_priority(priority),
                    _as_pinned(is_pinned),
                    expires_at or None,
                    now,
                    announcement_id,
                    tenant_id,
                ),
            )
        return self.get(announcement_id, tenant_id=tenant_id)

    def soft_delete(self, announcement_id: int, *, tenant_id: str) -> bool:
        existing = self.get(announcement_id, tenant_id=tenant_id)
        if existing is None:
            return False
        now = utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE announcements SET deleted_at = ?
                WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
                """,
                (now, announcement_id, tenant_id),
            )
        return True

    def toggle_pin(self, announcement_id: int, *, tenant_id: str) -> dict[str, Any] | None:
        existing = self.get(announcement_id, tenant_id=tenant_id)
        if existing is None:
            return None
        new_pin = 0 if int(existing.get("is_pinned") or 0) else 1
        now = utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE announcements SET is_pinned = ?, updated_at = ?
                WHERE id = ? AND tenant_id = ?
                """,
                (new_pin, now, announcement_id, tenant_id),
            )
        return {"is_pinned": new_pin == 1}

    def decorate(
        self,
        row: dict[str, Any],
        *,
        user_id: int,
        total_users: int,
    ) -> dict[str, Any]:
        with self._connect() as conn:
            announcement_id = int(row["id"])
            reads = self._read_set(conn, user_id, [announcement_id])
            counts = self._read_counts(conn, [announcement_id])
        return self._decorate(
            row,
            reads=reads,
            counts=counts,
            total_users=max(1, total_users),
        )

    def _read_set(
        self, conn: sqlite3.Connection, user_id: int, ids: list[int]
    ) -> set[int]:
        if not ids:
            return set()
        placeholders = ",".join("?" for _ in ids)
        rows = conn.execute(
            f"""
            SELECT announcement_id FROM announcement_reads
            WHERE user_id = ? AND announcement_id IN ({placeholders})
            """,
            [user_id, *ids],
        ).fetchall()
        return {int(r["announcement_id"]) for r in rows}

    def _read_counts(self, conn: sqlite3.Connection, ids: list[int]) -> dict[int, int]:
        if not ids:
            return {}
        placeholders = ",".join("?" for _ in ids)
        rows = conn.execute(
            f"""
            SELECT announcement_id, COUNT(*) AS count
            FROM announcement_reads
            WHERE announcement_id IN ({placeholders})
            GROUP BY announcement_id
            """,
            ids,
        ).fetchall()
        return {int(r["announcement_id"]): int(r["count"]) for r in rows}

    def _decorate(
        self,
        row: dict[str, Any],
        *,
        reads: set[int],
        counts: dict[int, int],
        total_users: int,
    ) -> dict[str, Any]:
        announcement_id = int(row["id"])
        read_count = counts.get(announcement_id, 0)
        users = max(1, total_users)
        out = dict(row)
        out["is_read"] = announcement_id in reads
        out["read_count"] = read_count
        out["total_users"] = users
        out["read_percent"] = int(round((read_count / users) * 100))
        out["is_pinned"] = int(out.get("is_pinned") or 0)
        return out

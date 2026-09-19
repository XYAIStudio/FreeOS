"""SQLite organization tasks under ``{FREEOS_HOME}/org/`` (not sidecar SQL.js).

This is **not** Octop cron (scheduled agent prompts) and **not** project/chat
tasks. Organization work items live here so the Tasks org-ui page can run
in-process without a Node sidecar.
"""

from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

TASK_STATUSES = ("todo", "in_progress", "review", "done")
TASK_PRIORITIES = ("low", "medium", "high", "critical")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigned_to INTEGER,
    assignee_name TEXT,
    created_by INTEGER NOT NULL,
    creator_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant
    ON tasks (tenant_id, status, priority, created_at, id);
CREATE TABLE IF NOT EXISTS task_subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    tenant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_task
    ON task_subtasks (tenant_id, task_id, sort_order, id);
CREATE TABLE IF NOT EXISTS task_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id INTEGER,
    user_name TEXT,
    content TEXT NOT NULL,
    comment_type TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task
    ON task_comments (tenant_id, task_id, created_at, id);
"""


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_status(value: str | None) -> str:
    raw = (value or "todo").strip().lower()
    return raw if raw in TASK_STATUSES else "todo"


def normalize_priority(value: str | None) -> str:
    raw = (value or "medium").strip().lower()
    return raw if raw in TASK_PRIORITIES else "medium"


class TaskStore:
    """Tenant-scoped organization tasks + subtasks + comments."""

    def __init__(self, home: Path) -> None:
        self.home = home
        self.path = home / "org" / "tasks.sqlite"
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
        created_by: int,
        creator_name: str,
        description: str = "",
        priority: str = "medium",
        assigned_to: int | None = None,
        assignee_name: str | None = None,
    ) -> dict[str, Any]:
        now = utc_now()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO tasks (
                    tenant_id, title, description, status, priority,
                    assigned_to, assignee_name, created_by, creator_name,
                    created_at
                ) VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?)
                """,
                (
                    tenant_id,
                    title,
                    description,
                    normalize_priority(priority),
                    assigned_to,
                    assignee_name,
                    created_by,
                    creator_name,
                    now,
                ),
            )
            row_id = int(cur.lastrowid or 0)
        row = self.get(row_id, tenant_id=tenant_id)
        assert row is not None
        return row

    def get(self, task_id: int, *, tenant_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM tasks WHERE id = ? AND tenant_id = ?",
                (task_id, tenant_id),
            ).fetchone()
            if row is None:
                return None
            return self._decorate(conn, dict(row), include_children=True)

    def list(
        self,
        *,
        tenant_id: str,
        status: str = "all",
        priority: str = "",
        assigned_to: int | None = None,
        search: str = "",
    ) -> list[dict[str, Any]]:
        where = ["tenant_id = ?"]
        params: list[Any] = [tenant_id]
        if status and status != "all":
            where.append("status = ?")
            params.append(normalize_status(status))
        if priority:
            where.append("priority = ?")
            params.append(normalize_priority(priority))
        if assigned_to is not None:
            where.append("assigned_to = ?")
            params.append(assigned_to)
        if search.strip():
            like = f"%{search.strip()}%"
            where.append("(title LIKE ? OR description LIKE ?)")
            params.extend([like, like])
        clause = " AND ".join(where)
        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM tasks
                WHERE {clause}
                ORDER BY created_at DESC, id DESC
                """,
                params,
            ).fetchall()
            return [self._decorate(conn, dict(row), include_children=False) for row in rows]

    def stats(self, *, tenant_id: str) -> dict[str, int]:
        counts: dict[str, int] = dict.fromkeys(TASK_STATUSES, 0)
        counts["total"] = 0
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT status, COUNT(*) AS count FROM tasks WHERE tenant_id = ? GROUP BY status",
                (tenant_id,),
            ).fetchall()
        for row in rows:
            status = str(row["status"])
            n = int(row["count"])
            if status in counts:
                counts[status] = n
            counts["total"] += n
        return counts

    def update(
        self,
        task_id: int,
        *,
        tenant_id: str,
        title: str | None = None,
        description: str | None = None,
        priority: str | None = None,
        assigned_to: Any = ...,
        assignee_name: Any = ...,
    ) -> dict[str, Any] | None:
        existing = self.get(task_id, tenant_id=tenant_id)
        if existing is None:
            return None
        fields: list[str] = []
        params: list[Any] = []
        if title is not None:
            fields.append("title = ?")
            params.append(title)
        if description is not None:
            fields.append("description = ?")
            params.append(description)
        if priority is not None:
            fields.append("priority = ?")
            params.append(normalize_priority(priority))
        if assigned_to is not ...:
            fields.append("assigned_to = ?")
            params.append(assigned_to)
        if assignee_name is not ...:
            fields.append("assignee_name = ?")
            params.append(assignee_name)
        if not fields:
            return existing
        fields.append("updated_at = ?")
        params.append(utc_now())
        params.extend([task_id, tenant_id])
        with self._connect() as conn:
            conn.execute(
                f"UPDATE tasks SET {', '.join(fields)} WHERE id = ? AND tenant_id = ?",
                params,
            )
        return self.get(task_id, tenant_id=tenant_id)

    def transition(self, task_id: int, *, tenant_id: str, to: str) -> dict[str, Any] | None:
        if to not in TASK_STATUSES:
            raise ValueError("invalid status")
        existing = self.get(task_id, tenant_id=tenant_id)
        if existing is None:
            return None
        with self._connect() as conn:
            conn.execute(
                "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
                (to, utc_now(), task_id, tenant_id),
            )
        return self.get(task_id, tenant_id=tenant_id)

    def delete(self, task_id: int, *, tenant_id: str) -> bool:
        existing = self.get(task_id, tenant_id=tenant_id)
        if existing is None:
            return False
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM task_comments WHERE task_id = ? AND tenant_id = ?",
                (task_id, tenant_id),
            )
            conn.execute(
                "DELETE FROM task_subtasks WHERE task_id = ? AND tenant_id = ?",
                (task_id, tenant_id),
            )
            conn.execute(
                "DELETE FROM tasks WHERE id = ? AND tenant_id = ?",
                (task_id, tenant_id),
            )
        return True

    def add_subtask(self, task_id: int, *, tenant_id: str, title: str) -> dict[str, Any] | None:
        if self.get(task_id, tenant_id=tenant_id) is None:
            return None
        with self._connect() as conn:
            raw = conn.execute(
                "SELECT MAX(sort_order) AS m FROM task_subtasks WHERE task_id = ? AND tenant_id = ?",
                (task_id, tenant_id),
            ).fetchone()
            order = int(raw["m"] or 0) + 1
            cur = conn.execute(
                """
                INSERT INTO task_subtasks (task_id, tenant_id, title, sort_order)
                VALUES (?, ?, ?, ?)
                """,
                (task_id, tenant_id, title, order),
            )
            row_id = int(cur.lastrowid or 0)
            row = conn.execute(
                "SELECT * FROM task_subtasks WHERE id = ? AND tenant_id = ?",
                (row_id, tenant_id),
            ).fetchone()
        return self._subtask(dict(row)) if row is not None else None

    def update_subtask(
        self,
        task_id: int,
        subtask_id: int,
        *,
        tenant_id: str,
        title: str | None = None,
        completed: bool | int | None = None,
    ) -> dict[str, Any] | None:
        if self.get(task_id, tenant_id=tenant_id) is None:
            return None
        fields: list[str] = []
        params: list[Any] = []
        if title is not None:
            fields.append("title = ?")
            params.append(title)
        if completed is not None:
            fields.append("completed = ?")
            params.append(1 if completed else 0)
        if not fields:
            return None
        params.extend([subtask_id, task_id, tenant_id])
        with self._connect() as conn:
            conn.execute(
                f"""
                UPDATE task_subtasks SET {", ".join(fields)}
                WHERE id = ? AND task_id = ? AND tenant_id = ?
                """,
                params,
            )
            row = conn.execute(
                "SELECT * FROM task_subtasks WHERE id = ? AND task_id = ? AND tenant_id = ?",
                (subtask_id, task_id, tenant_id),
            ).fetchone()
        return self._subtask(dict(row)) if row is not None else None

    def delete_subtask(self, task_id: int, subtask_id: int, *, tenant_id: str) -> bool:
        if self.get(task_id, tenant_id=tenant_id) is None:
            return False
        with self._connect() as conn:
            cur = conn.execute(
                "DELETE FROM task_subtasks WHERE id = ? AND task_id = ? AND tenant_id = ?",
                (subtask_id, task_id, tenant_id),
            )
            return cur.rowcount > 0

    def add_comment(
        self,
        task_id: int,
        *,
        tenant_id: str,
        content: str,
        user_id: int,
        user_name: str,
    ) -> dict[str, Any] | None:
        if self.get(task_id, tenant_id=tenant_id) is None:
            return None
        now = utc_now()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO task_comments (
                    task_id, tenant_id, user_id, user_name, content, comment_type, created_at
                ) VALUES (?, ?, ?, ?, ?, 'user', ?)
                """,
                (task_id, tenant_id, user_id, user_name, content, now),
            )
            row_id = int(cur.lastrowid or 0)
            row = conn.execute(
                "SELECT * FROM task_comments WHERE id = ? AND tenant_id = ?",
                (row_id, tenant_id),
            ).fetchone()
        return self._comment(dict(row)) if row is not None else None

    def _decorate(
        self,
        conn: sqlite3.Connection,
        row: dict[str, Any],
        *,
        include_children: bool,
    ) -> dict[str, Any]:
        task_id = int(row["id"])
        tenant_id = str(row["tenant_id"])
        sub_rows = conn.execute(
            """
            SELECT id, completed FROM task_subtasks
            WHERE task_id = ? AND tenant_id = ?
            """,
            (task_id, tenant_id),
        ).fetchall()
        comment_count = int(
            conn.execute(
                "SELECT COUNT(*) FROM task_comments WHERE task_id = ? AND tenant_id = ?",
                (task_id, tenant_id),
            ).fetchone()[0]
        )
        out = dict(row)
        out["id"] = task_id
        out["subtask_count"] = len(sub_rows)
        out["subtask_done"] = sum(1 for item in sub_rows if int(item["completed"] or 0))
        out["comment_count"] = comment_count
        if include_children:
            out["subtasks"] = [
                self._subtask(dict(item))
                for item in conn.execute(
                    """
                    SELECT * FROM task_subtasks
                    WHERE task_id = ? AND tenant_id = ?
                    ORDER BY sort_order, id
                    """,
                    (task_id, tenant_id),
                ).fetchall()
            ]
            out["comments"] = [
                self._comment(dict(item))
                for item in conn.execute(
                    """
                    SELECT * FROM task_comments
                    WHERE task_id = ? AND tenant_id = ?
                    ORDER BY created_at, id
                    """,
                    (task_id, tenant_id),
                ).fetchall()
            ]
        return out

    def _subtask(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": int(row["id"]),
            "task_id": int(row["task_id"]),
            "title": row["title"],
            "completed": int(row["completed"] or 0),
            "sort_order": int(row["sort_order"] or 0),
        }

    def _comment(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": int(row["id"]),
            "task_id": int(row["task_id"]),
            "user_id": row.get("user_id"),
            "user_name": row.get("user_name") or "",
            "content": row["content"],
            "comment_type": row.get("comment_type") or "user",
            "created_at": row.get("created_at") or "",
        }

"""SQLite organization reflections under ``{FREEOS_HOME}/org/``.

This is **not** sidecar SQL.js and **not** a second skill/knowledge runtime.
Reflections are organizational lessons (success, failure, plans) so the
Reflections org-ui page can run in-process without a Node sidecar.
"""

from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REFLECTION_TYPES = (
    "task_completion",
    "error_learning",
    "knowledge_capture",
    "improvement",
)

_TEXT_FIELDS = (
    "success_factors",
    "failure_reasons",
    "knowledge_gaps",
    "improvement_plans",
    "extracted_skills",
    "learned_knowledge",
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    employee_id INTEGER NOT NULL DEFAULT 0,
    task_id INTEGER,
    reflection_type TEXT NOT NULL DEFAULT 'task_completion',
    success_factors TEXT,
    failure_reasons TEXT,
    knowledge_gaps TEXT,
    improvement_plans TEXT,
    extracted_skills TEXT,
    learned_knowledge TEXT,
    importance_score INTEGER NOT NULL DEFAULT 50,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reflections_tenant
    ON reflections (tenant_id, reflection_type, importance_score, created_at, id);
"""


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_type(value: str | None) -> str:
    raw = (value or "task_completion").strip().lower()
    return raw if raw in REFLECTION_TYPES else "task_completion"


def normalize_importance(value: int | None) -> int:
    try:
        score = int(value if value is not None else 50)
    except (TypeError, ValueError):
        return 50
    return max(0, min(100, score))


def has_content(data: dict[str, Any]) -> bool:
    return any(str(data.get(field) or "").strip() for field in _TEXT_FIELDS)


class ReflectionStore:
    """Tenant-scoped organization reflections."""

    def __init__(self, home: Path) -> None:
        self.home = home
        self.path = home / "org" / "reflections.sqlite"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.executescript(_SCHEMA)

    def create(
        self,
        *,
        tenant_id: str,
        employee_id: int = 0,
        task_id: int | None = None,
        reflection_type: str = "task_completion",
        success_factors: str | None = None,
        failure_reasons: str | None = None,
        knowledge_gaps: str | None = None,
        improvement_plans: str | None = None,
        extracted_skills: str | None = None,
        learned_knowledge: str | None = None,
        importance_score: int = 50,
    ) -> dict[str, Any]:
        now = utc_now()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO reflections (
                    tenant_id, employee_id, task_id, reflection_type,
                    success_factors, failure_reasons, knowledge_gaps,
                    improvement_plans, extracted_skills, learned_knowledge,
                    importance_score, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tenant_id,
                    int(employee_id or 0),
                    task_id,
                    normalize_type(reflection_type),
                    _blank_to_none(success_factors),
                    _blank_to_none(failure_reasons),
                    _blank_to_none(knowledge_gaps),
                    _blank_to_none(improvement_plans),
                    _blank_to_none(extracted_skills),
                    _blank_to_none(learned_knowledge),
                    normalize_importance(importance_score),
                    now,
                ),
            )
            row_id = int(cur.lastrowid or 0)
        row = self.get(row_id, tenant_id=tenant_id)
        assert row is not None
        return row

    def get(self, reflection_id: int, *, tenant_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM reflections WHERE id = ? AND tenant_id = ?",
                (reflection_id, tenant_id),
            ).fetchone()
        return self._row(dict(row)) if row is not None else None

    def list(
        self,
        *,
        tenant_id: str,
        employee_id: int | None = None,
        reflection_type: str = "",
        search: str = "",
    ) -> list[dict[str, Any]]:
        where = ["tenant_id = ?"]
        params: list[Any] = [tenant_id]
        if employee_id is not None:
            where.append("employee_id = ?")
            params.append(employee_id)
        if reflection_type and reflection_type != "all":
            where.append("reflection_type = ?")
            params.append(normalize_type(reflection_type))
        if search.strip():
            like = f"%{search.strip()}%"
            where.append("(" + " OR ".join(f"{field} LIKE ?" for field in _TEXT_FIELDS) + ")")
            params.extend([like] * len(_TEXT_FIELDS))
        clause = " AND ".join(where)
        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM reflections
                WHERE {clause}
                ORDER BY importance_score DESC, created_at DESC, id DESC
                """,
                params,
            ).fetchall()
        return [self._row(dict(row)) for row in rows]

    def stats(self, *, tenant_id: str) -> dict[str, int]:
        counts: dict[str, int] = dict.fromkeys(REFLECTION_TYPES, 0)
        counts["total"] = 0
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT reflection_type, COUNT(*) AS count
                FROM reflections WHERE tenant_id = ?
                GROUP BY reflection_type
                """,
                (tenant_id,),
            ).fetchall()
        for row in rows:
            kind = str(row["reflection_type"])
            n = int(row["count"])
            if kind in counts:
                counts[kind] = n
            counts["total"] += n
        return counts

    def delete(self, reflection_id: int, *, tenant_id: str) -> bool:
        existing = self.get(reflection_id, tenant_id=tenant_id)
        if existing is None:
            return False
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM reflections WHERE id = ? AND tenant_id = ?",
                (reflection_id, tenant_id),
            )
        return True

    def _row(self, row: dict[str, Any]) -> dict[str, Any]:
        out = dict(row)
        out["id"] = int(row["id"])
        out["employee_id"] = int(row.get("employee_id") or 0)
        raw_task = row.get("task_id")
        out["task_id"] = (
            int(raw_task) if isinstance(raw_task, int | str) and raw_task != "" else None
        )
        out["importance_score"] = int(row.get("importance_score") or 0)
        return out


def _blank_to_none(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None

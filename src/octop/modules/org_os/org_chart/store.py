"""SQLite org tree under ``{FREEOS_HOME}/org/`` (not sidecar SQL.js)."""

from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

EMPLOYEE_TYPES = ("human", "ai")
EMPLOYEE_STATUSES = ("active", "inactive")
FUNCTION_TYPES = (
    "functional",
    "regional",
    "branch",
    "project",
    "site_lab",
    "dispatched",
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    department_code TEXT,
    function_type TEXT NOT NULL DEFAULT 'functional',
    level INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (parent_id) REFERENCES departments(id)
);
CREATE INDEX IF NOT EXISTS idx_departments_tenant
    ON departments (tenant_id, parent_id, sort_order, id);
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    department_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    employee_type TEXT NOT NULL DEFAULT 'human',
    agent_type TEXT,
    skills TEXT NOT NULL DEFAULT '',
    avatar_emoji TEXT NOT NULL DEFAULT '👤',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);
CREATE INDEX IF NOT EXISTS idx_employees_tenant
    ON employees (tenant_id, department_id, status, id);
"""


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_employee_type(value: str | None) -> str:
    raw = (value or "human").strip().lower()
    return raw if raw in EMPLOYEE_TYPES else "human"


def normalize_status(value: str | None) -> str:
    raw = (value or "active").strip().lower()
    return raw if raw in EMPLOYEE_STATUSES else "active"


def normalize_function_type(value: str | None) -> str:
    raw = (value or "functional").strip().lower()
    return raw if raw in FUNCTION_TYPES else "functional"


class OrgChartStore:
    """Tenant-scoped departments + directory employees for the org chart."""

    def __init__(self, home: Path) -> None:
        self.home = home
        self.path = home / "org" / "org_chart.sqlite"
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

    def create_department(
        self,
        *,
        tenant_id: str,
        name: str,
        parent_id: int | None = None,
        sort_order: int = 0,
        description: str = "",
        department_code: str | None = None,
        function_type: str = "functional",
        level: int = 1,
    ) -> dict[str, Any]:
        parent = self._resolve_parent(tenant_id, parent_id)
        now = utc_now()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO departments (
                    tenant_id, name, parent_id, sort_order, description,
                    department_code, function_type, level, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tenant_id,
                    name,
                    parent,
                    int(sort_order or 0),
                    description or "",
                    department_code or None,
                    normalize_function_type(function_type),
                    int(level or 1),
                    now,
                ),
            )
            row_id = int(cur.lastrowid or 0)
        row = self.get_department(row_id, tenant_id=tenant_id)
        assert row is not None
        return row

    def get_department(self, department_id: int, *, tenant_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM departments WHERE id = ? AND tenant_id = ?",
                (department_id, tenant_id),
            ).fetchone()
        return dict(row) if row is not None else None

    def list_departments(self, *, tenant_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM departments
                WHERE tenant_id = ?
                ORDER BY sort_order, id
                """,
                (tenant_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def update_department(
        self,
        department_id: int,
        *,
        tenant_id: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        existing = self.get_department(department_id, tenant_id=tenant_id)
        if existing is None:
            return None
        updates: list[str] = []
        params: list[Any] = []
        if "name" in fields and fields["name"] is not None:
            updates.append("name = ?")
            params.append(str(fields["name"]))
        if "parent_id" in fields:
            parent = self._resolve_parent(tenant_id, fields["parent_id"])
            if parent == department_id:
                raise ValueError("cycle")
            if parent is not None and self._is_descendant(tenant_id, department_id, parent):
                raise ValueError("cycle")
            updates.append("parent_id = ?")
            params.append(parent)
        if "sort_order" in fields and fields["sort_order"] is not None:
            updates.append("sort_order = ?")
            params.append(int(fields["sort_order"]))
        if "description" in fields and fields["description"] is not None:
            updates.append("description = ?")
            params.append(str(fields["description"]))
        if "department_code" in fields:
            updates.append("department_code = ?")
            params.append(fields["department_code"] or None)
        if "function_type" in fields and fields["function_type"] is not None:
            updates.append("function_type = ?")
            params.append(normalize_function_type(str(fields["function_type"])))
        if "level" in fields and fields["level"] is not None:
            updates.append("level = ?")
            params.append(int(fields["level"]))
        if not updates:
            return existing
        updates.append("updated_at = ?")
        params.append(utc_now())
        params.extend([department_id, tenant_id])
        with self._connect() as conn:
            conn.execute(
                f"UPDATE departments SET {', '.join(updates)} WHERE id = ? AND tenant_id = ?",
                params,
            )
        return self.get_department(department_id, tenant_id=tenant_id)

    def delete_department(self, department_id: int, *, tenant_id: str) -> str | None:
        existing = self.get_department(department_id, tenant_id=tenant_id)
        if existing is None:
            return "missing"
        with self._connect() as conn:
            emp_count = int(
                conn.execute(
                    """
                    SELECT COUNT(*) FROM employees
                    WHERE department_id = ? AND tenant_id = ? AND status = 'active'
                    """,
                    (department_id, tenant_id),
                ).fetchone()[0]
            )
            if emp_count > 0:
                return "has_employees"
            child_count = int(
                conn.execute(
                    """
                    SELECT COUNT(*) FROM departments
                    WHERE parent_id = ? AND tenant_id = ?
                    """,
                    (department_id, tenant_id),
                ).fetchone()[0]
            )
            if child_count > 0:
                return "has_children"
            conn.execute(
                """
                DELETE FROM employees
                WHERE department_id = ? AND tenant_id = ? AND status != 'active'
                """,
                (department_id, tenant_id),
            )
            conn.execute(
                "DELETE FROM departments WHERE id = ? AND tenant_id = ?",
                (department_id, tenant_id),
            )
        return None

    def create_employee(
        self,
        *,
        tenant_id: str,
        name: str,
        department_id: int,
        role: str = "",
        description: str = "",
        employee_type: str = "human",
        agent_type: str | None = None,
        skills: str = "",
        avatar_emoji: str = "👤",
        status: str = "active",
    ) -> dict[str, Any]:
        dept = self.get_department(department_id, tenant_id=tenant_id)
        if dept is None:
            raise KeyError("department")
        now = utc_now()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO employees (
                    tenant_id, department_id, name, role, description,
                    employee_type, agent_type, skills, avatar_emoji, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tenant_id,
                    department_id,
                    name,
                    role or "",
                    description or "",
                    normalize_employee_type(employee_type),
                    agent_type or None,
                    skills or "",
                    avatar_emoji or "👤",
                    normalize_status(status),
                    now,
                ),
            )
            row_id = int(cur.lastrowid or 0)
        row = self.get_employee(row_id, tenant_id=tenant_id)
        assert row is not None
        return row

    def get_employee(self, employee_id: int, *, tenant_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT e.*, d.name AS department_name
                FROM employees e
                LEFT JOIN departments d ON d.id = e.department_id
                WHERE e.id = ? AND e.tenant_id = ?
                """,
                (employee_id, tenant_id),
            ).fetchone()
        if row is None:
            return None
        return self._decorate_employee(dict(row))

    def list_employees(
        self,
        *,
        tenant_id: str,
        status: str = "active",
        employee_type: str | None = None,
        department_id: int | None = None,
        search: str = "",
    ) -> list[dict[str, Any]]:
        where = ["e.tenant_id = ?"]
        params: list[Any] = [tenant_id]
        if status and status != "all":
            where.append("e.status = ?")
            params.append(normalize_status(status))
        if employee_type:
            where.append("e.employee_type = ?")
            params.append(normalize_employee_type(employee_type))
        if department_id is not None:
            where.append("e.department_id = ?")
            params.append(int(department_id))
        needle = (search or "").strip()
        if needle:
            like = f"%{needle}%"
            where.append("(e.name LIKE ? OR e.role LIKE ? OR e.skills LIKE ?)")
            params.extend([like, like, like])
        clause = " AND ".join(where)
        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT e.*, d.name AS department_name
                FROM employees e
                LEFT JOIN departments d ON d.id = e.department_id
                WHERE {clause}
                ORDER BY e.id
                """,
                params,
            ).fetchall()
        return [self._decorate_employee(dict(row)) for row in rows]

    def employee_stats(self, *, tenant_id: str) -> dict[str, Any]:
        employees = self.list_employees(tenant_id=tenant_id, status="active")
        by_department: dict[str, int] = {}
        by_role: dict[str, int] = {}
        ai = 0
        human = 0
        for emp in employees:
            if str(emp.get("employee_type") or "") == "ai":
                ai += 1
            else:
                human += 1
            dept = str(emp.get("department_name") or "")
            by_department[dept] = by_department.get(dept, 0) + 1
            role = str(emp.get("role") or "").strip()
            if role:
                by_role[role] = by_role.get(role, 0) + 1
        return {
            "total": len(employees),
            "ai": ai,
            "human": human,
            "byDepartment": [
                {"department": name, "count": count} for name, count in by_department.items()
            ],
            "byRole": [
                {"role": name, "count": count}
                for name, count in sorted(by_role.items(), key=lambda item: (-item[1], item[0]))
            ][:10],
        }

    def update_employee(
        self,
        employee_id: int,
        *,
        tenant_id: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        existing = self.get_employee(employee_id, tenant_id=tenant_id)
        if existing is None:
            return None
        updates: list[str] = []
        params: list[Any] = []
        if "name" in fields and fields["name"] is not None:
            updates.append("name = ?")
            params.append(str(fields["name"]))
        if "role" in fields and fields["role"] is not None:
            updates.append("role = ?")
            params.append(str(fields["role"]))
        if "description" in fields and fields["description"] is not None:
            updates.append("description = ?")
            params.append(str(fields["description"]))
        if "skills" in fields and fields["skills"] is not None:
            updates.append("skills = ?")
            params.append(str(fields["skills"]))
        if "agent_type" in fields:
            updates.append("agent_type = ?")
            params.append(fields["agent_type"] or None)
        if "department_id" in fields and fields["department_id"] is not None:
            dept = self.get_department(int(fields["department_id"]), tenant_id=tenant_id)
            if dept is None:
                raise KeyError("department")
            updates.append("department_id = ?")
            params.append(int(fields["department_id"]))
        if "employee_type" in fields and fields["employee_type"] is not None:
            updates.append("employee_type = ?")
            params.append(normalize_employee_type(str(fields["employee_type"])))
        if "avatar_emoji" in fields and fields["avatar_emoji"] is not None:
            updates.append("avatar_emoji = ?")
            params.append(str(fields["avatar_emoji"]))
        if "status" in fields and fields["status"] is not None:
            updates.append("status = ?")
            params.append(normalize_status(str(fields["status"])))
        if not updates:
            return existing
        updates.append("updated_at = ?")
        params.append(utc_now())
        params.extend([employee_id, tenant_id])
        with self._connect() as conn:
            conn.execute(
                f"UPDATE employees SET {', '.join(updates)} WHERE id = ? AND tenant_id = ?",
                params,
            )
        return self.get_employee(employee_id, tenant_id=tenant_id)

    def deactivate_employee(self, employee_id: int, *, tenant_id: str) -> bool:
        existing = self.get_employee(employee_id, tenant_id=tenant_id)
        if existing is None:
            return False
        now = utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE employees SET status = 'inactive', updated_at = ?
                WHERE id = ? AND tenant_id = ?
                """,
                (now, employee_id, tenant_id),
            )
        return True

    def tree(self, *, tenant_id: str) -> list[dict[str, Any]]:
        departments = self.list_departments(tenant_id=tenant_id)
        employees = self.list_employees(tenant_id=tenant_id, status="active")
        dept_map: dict[int, dict[str, Any]] = {}
        roots: list[dict[str, Any]] = []
        for dept in departments:
            node = dict(dept)
            node["children"] = []
            node["employees"] = []
            dept_map[int(dept["id"])] = node
        for dept in departments:
            node = dept_map[int(dept["id"])]
            parent_id = dept.get("parent_id")
            if parent_id and int(parent_id) in dept_map:
                dept_map[int(parent_id)]["children"].append(node)
            else:
                roots.append(node)
        for emp in employees:
            home = dept_map.get(int(emp["department_id"]))
            if home is not None:
                home["employees"].append(emp)
        return roots

    def _resolve_parent(self, tenant_id: str, parent_id: Any) -> int | None:
        if parent_id in (None, "", 0, "0"):
            return None
        parent = self.get_department(int(parent_id), tenant_id=tenant_id)
        if parent is None:
            raise KeyError("parent")
        return int(parent["id"])

    def _is_descendant(self, tenant_id: str, ancestor_id: int, candidate_id: int) -> bool:
        departments = self.list_departments(tenant_id=tenant_id)
        children: dict[int, list[int]] = {}
        for dept in departments:
            parent = dept.get("parent_id")
            if parent:
                children.setdefault(int(parent), []).append(int(dept["id"]))
        stack = list(children.get(ancestor_id, []))
        seen: set[int] = set()
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            if current == candidate_id:
                return True
            seen.add(current)
            stack.extend(children.get(current, []))
        return False

    def _decorate_employee(self, row: dict[str, Any]) -> dict[str, Any]:
        out = dict(row)
        out["is_online"] = str(out.get("employee_type") or "") == "ai"
        return out

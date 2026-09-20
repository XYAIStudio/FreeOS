"""SQLite org tree under ``{FREEOS_HOME}/org/`` (not sidecar SQL.js)."""

from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

EMPLOYEE_TYPES = ("human", "ai")
EMPLOYEE_STATUSES = ("active", "inactive")
TALENT_TYPES = ("human", "ai")
TALENT_STATUSES = ("available", "recruited", "archived")
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
CREATE TABLE IF NOT EXISTS talent_pool (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    talent_type TEXT NOT NULL DEFAULT 'ai',
    skills TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'host',
    status TEXT NOT NULL DEFAULT 'available',
    agent_type TEXT,
    slug TEXT,
    avatar_emoji TEXT NOT NULL DEFAULT '👤',
    category TEXT NOT NULL DEFAULT '',
    employee_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_talent_tenant
    ON talent_pool (tenant_id, status, id);
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


def normalize_talent_type(value: str | None) -> str:
    raw = (value or "ai").strip().lower()
    if raw in {"agent", "colleague", "digital"}:
        return "ai"
    return raw if raw in TALENT_TYPES else "ai"


def normalize_talent_status(value: str | None) -> str:
    raw = (value or "available").strip().lower()
    if raw in {"active", "internal", "market"}:
        return "available"
    if raw in {"hired", "onboard"}:
        return "recruited"
    return raw if raw in TALENT_STATUSES else "available"


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

    def ensure_inbox_department(self, *, tenant_id: str) -> dict[str, Any]:
        existing = self.list_departments(tenant_id=tenant_id)
        if existing:
            return existing[0]
        return self.create_department(tenant_id=tenant_id, name="Organization")

    def upsert_directory_employee(
        self,
        *,
        tenant_id: str,
        name: str,
        role: str = "",
        description: str = "",
        employee_type: str = "human",
        agent_type: str | None = None,
        skills: str = "",
        avatar_emoji: str = "👤",
        status: str = "active",
        department_id: int | None = None,
    ) -> tuple[dict[str, Any], str]:
        needle = name.strip()
        listed = self.list_employees(tenant_id=tenant_id, status="all")
        match = next((row for row in listed if str(row.get("name") or "") == needle), None)
        dept_id = department_id
        if dept_id is None:
            dept_id = int(self.ensure_inbox_department(tenant_id=tenant_id)["id"])
        if match is None:
            created = self.create_employee(
                tenant_id=tenant_id,
                name=needle,
                department_id=dept_id,
                role=role,
                description=description,
                employee_type=employee_type,
                agent_type=agent_type,
                skills=skills,
                avatar_emoji=avatar_emoji,
                status=status,
            )
            return created, "created"
        updated = self.update_employee(
            int(match["id"]),
            tenant_id=tenant_id,
            fields={
                "role": role or match.get("role") or "",
                "description": description or match.get("description") or "",
                "employee_type": employee_type,
                "agent_type": agent_type,
                "skills": skills if skills else match.get("skills") or "",
                "avatar_emoji": avatar_emoji or match.get("avatar_emoji") or "👤",
                "status": status,
                "department_id": dept_id,
            },
        )
        assert updated is not None
        return updated, "updated"

    def create_talent(
        self,
        *,
        tenant_id: str,
        name: str,
        talent_type: str = "ai",
        skills: str = "",
        description: str = "",
        source: str = "host",
        status: str = "available",
        agent_type: str | None = None,
        slug: str | None = None,
        avatar_emoji: str = "👤",
        category: str = "",
        employee_id: int | None = None,
    ) -> dict[str, Any]:
        now = utc_now()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO talent_pool (
                    tenant_id, name, talent_type, skills, description, source,
                    status, agent_type, slug, avatar_emoji, category, employee_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tenant_id,
                    name,
                    normalize_talent_type(talent_type),
                    skills or "",
                    description or "",
                    source or "host",
                    normalize_talent_status(status),
                    agent_type or None,
                    slug or None,
                    avatar_emoji or "👤",
                    category or "",
                    employee_id,
                    now,
                ),
            )
            row_id = int(cur.lastrowid or 0)
        row = self.get_talent(row_id, tenant_id=tenant_id)
        assert row is not None
        return row

    def get_talent(self, talent_id: int, *, tenant_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM talent_pool WHERE id = ? AND tenant_id = ?",
                (talent_id, tenant_id),
            ).fetchone()
        return dict(row) if row is not None else None

    def list_talent(
        self,
        *,
        tenant_id: str,
        status: str = "available",
        talent_type: str | None = None,
        search: str = "",
    ) -> list[dict[str, Any]]:
        where = ["tenant_id = ?"]
        params: list[Any] = [tenant_id]
        if status and status != "all":
            where.append("status = ?")
            params.append(normalize_talent_status(status))
        if talent_type:
            where.append("talent_type = ?")
            params.append(normalize_talent_type(talent_type))
        needle = (search or "").strip()
        if needle:
            like = f"%{needle}%"
            where.append("(name LIKE ? OR skills LIKE ? OR description LIKE ?)")
            params.extend([like, like, like])
        clause = " AND ".join(where)
        with self._connect() as conn:
            rows = conn.execute(
                f"SELECT * FROM talent_pool WHERE {clause} ORDER BY id",
                params,
            ).fetchall()
        return [dict(row) for row in rows]

    def talent_stats(self, *, tenant_id: str) -> dict[str, Any]:
        rows = self.list_talent(tenant_id=tenant_id, status="available")
        ai = sum(1 for row in rows if str(row.get("talent_type") or "") == "ai")
        human = len(rows) - ai
        by_category: dict[str, int] = {}
        for row in rows:
            category = str(row.get("category") or "").strip() or "uncategorized"
            by_category[category] = by_category.get(category, 0) + 1
        return {
            "total": len(rows),
            "ai": ai,
            "human": human,
            "byCategory": [
                {"category": name, "count": count} for name, count in by_category.items()
            ],
        }

    def update_talent(
        self,
        talent_id: int,
        *,
        tenant_id: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        existing = self.get_talent(talent_id, tenant_id=tenant_id)
        if existing is None:
            return None
        updates: list[str] = []
        params: list[Any] = []
        if "name" in fields and fields["name"] is not None:
            updates.append("name = ?")
            params.append(str(fields["name"]))
        if "skills" in fields and fields["skills"] is not None:
            updates.append("skills = ?")
            params.append(str(fields["skills"]))
        if "description" in fields and fields["description"] is not None:
            updates.append("description = ?")
            params.append(str(fields["description"]))
        if "source" in fields and fields["source"] is not None:
            updates.append("source = ?")
            params.append(str(fields["source"]))
        if "agent_type" in fields:
            updates.append("agent_type = ?")
            params.append(fields["agent_type"] or None)
        if "slug" in fields:
            updates.append("slug = ?")
            params.append(fields["slug"] or None)
        if "avatar_emoji" in fields and fields["avatar_emoji"] is not None:
            updates.append("avatar_emoji = ?")
            params.append(str(fields["avatar_emoji"]))
        if "category" in fields and fields["category"] is not None:
            updates.append("category = ?")
            params.append(str(fields["category"]))
        if "talent_type" in fields and fields["talent_type"] is not None:
            updates.append("talent_type = ?")
            params.append(normalize_talent_type(str(fields["talent_type"])))
        if "status" in fields and fields["status"] is not None:
            updates.append("status = ?")
            params.append(normalize_talent_status(str(fields["status"])))
        if "employee_id" in fields:
            updates.append("employee_id = ?")
            params.append(fields["employee_id"])
        if not updates:
            return existing
        updates.append("updated_at = ?")
        params.append(utc_now())
        params.extend([talent_id, tenant_id])
        with self._connect() as conn:
            conn.execute(
                f"UPDATE talent_pool SET {', '.join(updates)} WHERE id = ? AND tenant_id = ?",
                params,
            )
        return self.get_talent(talent_id, tenant_id=tenant_id)

    def upsert_talent(
        self,
        *,
        tenant_id: str,
        name: str,
        talent_type: str = "ai",
        skills: str = "",
        description: str = "",
        source: str = "host",
        status: str = "available",
        agent_type: str | None = None,
        slug: str | None = None,
        avatar_emoji: str = "👤",
        category: str = "",
    ) -> tuple[dict[str, Any], str]:
        listed = self.list_talent(tenant_id=tenant_id, status="all")
        match = None
        slug_key = (slug or "").strip()
        needle = name.strip()
        if slug_key:
            match = next((row for row in listed if str(row.get("slug") or "") == slug_key), None)
        if match is None:
            match = next((row for row in listed if str(row.get("name") or "") == needle), None)
        if match is None:
            created = self.create_talent(
                tenant_id=tenant_id,
                name=needle,
                talent_type=talent_type,
                skills=skills,
                description=description,
                source=source,
                status=status,
                agent_type=agent_type,
                slug=slug_key or None,
                avatar_emoji=avatar_emoji,
                category=category,
            )
            return created, "created"
        updated = self.update_talent(
            int(match["id"]),
            tenant_id=tenant_id,
            fields={
                "name": needle,
                "talent_type": talent_type,
                "skills": skills or match.get("skills") or "",
                "description": description or match.get("description") or "",
                "source": source or match.get("source") or "host",
                "status": status,
                "agent_type": agent_type or match.get("agent_type"),
                "slug": slug_key or match.get("slug"),
                "avatar_emoji": avatar_emoji or match.get("avatar_emoji") or "👤",
                "category": category or match.get("category") or "",
            },
        )
        assert updated is not None
        return updated, "updated"

    def recruit_talent(
        self,
        talent_id: int,
        *,
        tenant_id: str,
        department_id: int | None = None,
    ) -> dict[str, Any]:
        talent = self.get_talent(talent_id, tenant_id=tenant_id)
        if talent is None:
            raise KeyError("talent")
        existing_id = talent.get("employee_id")
        if existing_id:
            employee = self.get_employee(int(existing_id), tenant_id=tenant_id)
            if employee is not None:
                if str(talent.get("status") or "") != "recruited":
                    talent = (
                        self.update_talent(
                            talent_id, tenant_id=tenant_id, fields={"status": "recruited"}
                        )
                        or talent
                    )
                return {"talent": talent, "employee": employee, "created": False}
        if department_id is not None:
            dept = self.get_department(int(department_id), tenant_id=tenant_id)
            if dept is None:
                raise KeyError("department")
            dept_id = int(dept["id"])
        else:
            dept_id = int(self.ensure_inbox_department(tenant_id=tenant_id)["id"])
        employee, _action = self.upsert_directory_employee(
            tenant_id=tenant_id,
            name=str(talent.get("name") or ""),
            role=str(talent.get("category") or talent.get("agent_type") or ""),
            description=str(talent.get("description") or ""),
            employee_type="ai" if str(talent.get("talent_type") or "") == "ai" else "human",
            agent_type=talent.get("agent_type"),
            skills=str(talent.get("skills") or ""),
            avatar_emoji=str(talent.get("avatar_emoji") or "👤"),
            status="active",
            department_id=dept_id,
        )
        talent = self.update_talent(
            talent_id,
            tenant_id=tenant_id,
            fields={"status": "recruited", "employee_id": int(employee["id"])},
        )
        assert talent is not None
        return {"talent": talent, "employee": employee, "created": True}

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

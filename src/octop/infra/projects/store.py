"""File-backed user projects (conversations + tasks + optional work dir)."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from octop.infra.db.repos._base import now_ts
from octop.infra.utils.host_dirs import assert_safe_host_path
from octop.infra.utils.paths import PathLayout
from octop.infra.utils.ulid import new_ulid

_FILE = "projects.json"


@dataclass
class ProjectRecord:
    id: str
    name: str
    work_dir: str
    owner_user_id: int
    conversation_ids: list[str] = field(default_factory=list)
    task_ids: list[str] = field(default_factory=list)
    created_at: int = 0
    updated_at: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _path(home: Path | None = None) -> Path:
    root = Path(home) if home is not None else PathLayout.from_env().root
    root.mkdir(parents=True, exist_ok=True)
    return root / _FILE


def _load(home: Path | None = None) -> list[ProjectRecord]:
    path = _path(home)
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    rows = raw.get("projects") if isinstance(raw, dict) else raw
    if not isinstance(rows, list):
        return []
    out: list[ProjectRecord] = []
    for item in rows:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        out.append(
            ProjectRecord(
                id=str(item["id"]),
                name=str(item.get("name") or ""),
                work_dir=str(item.get("work_dir") or ""),
                owner_user_id=int(item.get("owner_user_id") or 0),
                conversation_ids=[str(x) for x in item.get("conversation_ids") or [] if x],
                task_ids=[str(x) for x in item.get("task_ids") or [] if x],
                created_at=int(item.get("created_at") or 0),
                updated_at=int(item.get("updated_at") or 0),
            )
        )
    return out


def _save(rows: list[ProjectRecord], home: Path | None = None) -> None:
    path = _path(home)
    path.write_text(
        json.dumps({"projects": [row.to_dict() for row in rows]}, indent=2, ensure_ascii=False)
        + "\n",
        encoding="utf-8",
    )


def list_projects(owner_user_id: int, home: Path | None = None) -> list[ProjectRecord]:
    return [row for row in _load(home) if int(row.owner_user_id) == int(owner_user_id)]


def get_project(
    project_id: str, owner_user_id: int, home: Path | None = None
) -> ProjectRecord | None:
    for row in list_projects(owner_user_id, home):
        if row.id == project_id:
            return row
    return None


def create_project(
    *,
    owner_user_id: int,
    name: str,
    work_dir: str = "",
    home: Path | None = None,
) -> ProjectRecord:
    title = name.strip()
    if not title:
        raise ValueError("name required")
    dest = work_dir.strip()
    if dest:
        assert_safe_host_path(dest)
    now = now_ts()
    row = ProjectRecord(
        id=new_ulid(),
        name=title,
        work_dir=dest,
        owner_user_id=int(owner_user_id),
        created_at=now,
        updated_at=now,
    )
    rows = _load(home)
    rows.append(row)
    _save(rows, home)
    return row


def update_project(
    project_id: str,
    owner_user_id: int,
    *,
    name: str | None = None,
    work_dir: str | None = None,
    conversation_ids: list[str] | None = None,
    task_ids: list[str] | None = None,
    home: Path | None = None,
) -> ProjectRecord:
    rows = _load(home)
    found: ProjectRecord | None = None
    for row in rows:
        if row.id == project_id and int(row.owner_user_id) == int(owner_user_id):
            found = row
            break
    if found is None:
        raise LookupError(project_id)
    if name is not None:
        title = name.strip()
        if not title:
            raise ValueError("name required")
        found.name = title
    if work_dir is not None:
        dest = work_dir.strip()
        if dest:
            assert_safe_host_path(dest)
        found.work_dir = dest
    if conversation_ids is not None:
        found.conversation_ids = [str(x) for x in conversation_ids if x]
    if task_ids is not None:
        found.task_ids = [str(x) for x in task_ids if x]
    found.updated_at = now_ts()
    _save(rows, home)
    return found


def delete_project(project_id: str, owner_user_id: int, home: Path | None = None) -> None:
    rows = _load(home)
    next_rows = [
        row
        for row in rows
        if not (row.id == project_id and int(row.owner_user_id) == int(owner_user_id))
    ]
    if len(next_rows) == len(rows):
        raise LookupError(project_id)
    _save(next_rows, home)


def add_link(
    project_id: str,
    owner_user_id: int,
    *,
    kind: str,
    ref_id: str,
    home: Path | None = None,
) -> ProjectRecord:
    row = get_project(project_id, owner_user_id, home)
    if row is None:
        raise LookupError(project_id)
    ref = ref_id.strip()
    if not ref:
        raise ValueError("ref_id required")
    if kind == "conversation":
        ids = list(row.conversation_ids)
        if ref not in ids:
            ids.append(ref)
        return update_project(project_id, owner_user_id, conversation_ids=ids, home=home)
    if kind == "task":
        ids = list(row.task_ids)
        if ref not in ids:
            ids.append(ref)
        return update_project(project_id, owner_user_id, task_ids=ids, home=home)
    raise ValueError(f"unknown kind: {kind}")

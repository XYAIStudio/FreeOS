"""Persist colleague lifecycle under the FreeOS home (not sidecar SQL.js)."""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

LIFECYCLE_STATES = (
    "draft",
    "market",
    "recruit",
    "shadow",
    "active",
    "offboard",
)


@dataclass
class ColleagueRecord:
    slug: str
    tenant_id: str
    name: str
    lifecycle: str
    workspace: str
    created_at: float
    updated_at: float
    history: list[dict[str, Any]] = field(default_factory=list)
    read_only: bool = False
    cron_enabled: bool = False
    credentials_revoked: bool = False
    memory_archived: str = ""
    openxyos_talent_status: str = ""
    openxyos_employment_category: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ColleagueRecord:
        return cls(
            slug=str(data.get("slug") or ""),
            tenant_id=str(data.get("tenant_id") or ""),
            name=str(data.get("name") or ""),
            lifecycle=str(data.get("lifecycle") or "draft"),
            workspace=str(data.get("workspace") or ""),
            created_at=float(data.get("created_at") or time.time()),
            updated_at=float(data.get("updated_at") or time.time()),
            history=list(data.get("history") or []),
            read_only=bool(data.get("read_only")),
            cron_enabled=bool(data.get("cron_enabled")),
            credentials_revoked=bool(data.get("credentials_revoked")),
            memory_archived=str(data.get("memory_archived") or ""),
            openxyos_talent_status=str(data.get("openxyos_talent_status") or ""),
            openxyos_employment_category=str(data.get("openxyos_employment_category") or ""),
        )


class LifecycleStore:
    def __init__(self, home: Path, tenant_id: str) -> None:
        self.home = home
        self.tenant_id = tenant_id or "default"
        self.path = home / "tenants" / self.tenant_id / "employees" / "registry.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _load(self) -> dict[str, Any]:
        if not self.path.is_file():
            return {"tenant_id": self.tenant_id, "colleagues": {}}
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {"tenant_id": self.tenant_id, "colleagues": {}}
        if not isinstance(raw, dict):
            return {"tenant_id": self.tenant_id, "colleagues": {}}
        colleagues = raw.get("colleagues")
        if not isinstance(colleagues, dict):
            raw["colleagues"] = {}
        return raw

    def _save(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    def upsert(self, record: ColleagueRecord) -> ColleagueRecord:
        data = self._load()
        data["colleagues"][record.slug] = record.to_dict()
        self._save(data)
        record_path = Path(record.workspace) / "lifecycle.json" if record.workspace else None
        if record_path is not None:
            record_path.parent.mkdir(parents=True, exist_ok=True)
            record_path.write_text(json.dumps(record.to_dict(), indent=2) + "\n", encoding="utf-8")
        return record

    def get(self, slug: str) -> ColleagueRecord | None:
        data = self._load()
        raw = data["colleagues"].get(slug)
        if not isinstance(raw, dict):
            return None
        return ColleagueRecord.from_dict(raw)

    def list(self) -> list[ColleagueRecord]:
        data = self._load()
        rows = [
            ColleagueRecord.from_dict(item)
            for item in data["colleagues"].values()
            if isinstance(item, dict)
        ]
        rows.sort(key=lambda item: item.updated_at, reverse=True)
        return rows

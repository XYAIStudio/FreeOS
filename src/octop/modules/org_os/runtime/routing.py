"""Session / chat routing table for produced digital colleagues.

Maps colleague slugs and display names onto FreeOS ``agent_id`` values so
dashboard chat and IM can address a spawned employee without a second runtime.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


def routing_path(home: Path, tenant_id: str) -> Path:
    return home / "tenants" / (tenant_id or "default") / "routing.json"


@dataclass
class RouteEntry:
    slug: str
    agent_id: str
    name: str
    tenant_id: str
    workspace: str
    lifecycle: str = "draft"
    updated_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RouteEntry:
        return cls(
            slug=str(data.get("slug") or ""),
            agent_id=str(data.get("agent_id") or ""),
            name=str(data.get("name") or ""),
            tenant_id=str(data.get("tenant_id") or ""),
            workspace=str(data.get("workspace") or ""),
            lifecycle=str(data.get("lifecycle") or "draft"),
            updated_at=float(data.get("updated_at") or 0.0),
        )


class ColleagueRouter:
    def __init__(self, home: Path, tenant_id: str) -> None:
        self.home = home
        self.tenant_id = tenant_id or "default"
        self.path = routing_path(home, self.tenant_id)

    def _load(self) -> dict[str, Any]:
        if not self.path.is_file():
            return {"tenant_id": self.tenant_id, "routes": {}}
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {"tenant_id": self.tenant_id, "routes": {}}
        if not isinstance(raw, dict):
            return {"tenant_id": self.tenant_id, "routes": {}}
        if not isinstance(raw.get("routes"), dict):
            raw["routes"] = {}
        return raw

    def _save(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    def upsert(self, entry: RouteEntry) -> RouteEntry:
        data = self._load()
        entry.updated_at = entry.updated_at or time.time()
        data["routes"][entry.slug] = entry.to_dict()
        self._save(data)
        return entry

    def get(self, slug: str) -> RouteEntry | None:
        raw = self._load()["routes"].get(slug)
        return RouteEntry.from_dict(raw) if isinstance(raw, dict) else None

    def list(self) -> list[RouteEntry]:
        rows = [
            RouteEntry.from_dict(item)
            for item in self._load()["routes"].values()
            if isinstance(item, dict)
        ]
        rows.sort(key=lambda item: item.updated_at, reverse=True)
        return rows

    def resolve(self, query: str) -> RouteEntry | None:
        q = (query or "").strip()
        if not q:
            return None
        ql = q.lower().lstrip("@")
        for entry in self.list():
            if entry.slug == ql or entry.agent_id == q or entry.agent_id.lower() == ql:
                return entry
            if entry.name.lower() == ql:
                return entry
        partial = [item for item in self.list() if ql in item.slug or ql in item.name.lower()]
        return partial[0] if len(partial) == 1 else None


def resolve_routed_agent(home: Path, query: str, *, tenant_id: str = "") -> str:
    """Return an agent_id for a colleague slug/name, searching one or all tenants."""
    tenants_root = home / "tenants"
    tenant_ids = [tenant_id] if tenant_id else []
    if not tenant_ids and tenants_root.is_dir():
        tenant_ids = [path.name for path in tenants_root.iterdir() if path.is_dir()]
    if not tenant_ids:
        tenant_ids = ["default"]
    for tid in tenant_ids:
        entry = ColleagueRouter(home, tid).resolve(query)
        if entry is not None and entry.agent_id:
            return entry.agent_id
    return ""

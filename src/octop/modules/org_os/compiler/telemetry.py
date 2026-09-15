"""Reverse path: runtime capability digest → openXYOS HR/employee profile."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import urlparse

import httpx


class OpenXyosStatus(TypedDict):
    talent: str | None
    employee: str | None
    employment_category: str | None


# Maps FreeOS lifecycle → openXYOS talent_pool.status / employees.employment_category
OPENXYOS_STATUS_MAP: dict[str, OpenXyosStatus] = {
    "draft": {"talent": "draft", "employee": None, "employment_category": None},
    "market": {"talent": "available", "employee": None, "employment_category": None},
    "recruit": {"talent": "recruited", "employee": "active", "employment_category": "reserve"},
    "shadow": {"talent": "recruited", "employee": "active", "employment_category": "probation"},
    "active": {"talent": "recruited", "employee": "active", "employment_category": "staff"},
    "offboard": {"talent": "archived", "employee": "inactive", "employment_category": "offboarded"},
}


@dataclass
class CapabilityDigest:
    slug: str
    name: str
    tenant_id: str
    lifecycle: str
    capabilities: list[str]
    skill_count: int
    cron_count: int
    knowledge_count: int
    workspace: str
    notes: list[str] = field(default_factory=list)

    def to_openxyos_profile(self) -> dict[str, Any]:
        mapping = OPENXYOS_STATUS_MAP.get(self.lifecycle, OPENXYOS_STATUS_MAP["draft"])
        return {
            "name": self.name,
            "agent_type": f"freeos-{self.slug}",
            "employee_type": "ai",
            "skills": ", ".join(self.capabilities),
            "capabilities": list(self.capabilities),
            "status": mapping["employee"] or "active",
            "employment_category": mapping["employment_category"],
            "talent_status": mapping["talent"],
            "description": (
                f"FreeOS runtime colleague `{self.slug}` "
                f"(lifecycle={self.lifecycle}, skills={self.skill_count})."
            ),
            "provider": "FreeOS",
            "integration_type": "agent-blueprint-v1",
            "tenant_id": self.tenant_id,
        }

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["openxyos_profile"] = self.to_openxyos_profile()
        return data


def export_capability_digest(workspace: Path, *, lifecycle: str = "draft") -> CapabilityDigest:
    blueprint_path = workspace / "blueprint.json"
    raw = json.loads(blueprint_path.read_text(encoding="utf-8")) if blueprint_path.is_file() else {}
    skills_root = workspace / "skills"
    skill_count = len(list(skills_root.glob("*/SKILL.md"))) if skills_root.is_dir() else 0
    knowledge_root = workspace / "knowledge"
    knowledge_count = len(list(knowledge_root.glob("*.md"))) if knowledge_root.is_dir() else 0
    cron_path = workspace / "cron.json"
    cron_count = 0
    if cron_path.is_file():
        try:
            jobs = json.loads(cron_path.read_text(encoding="utf-8"))
            cron_count = len(jobs) if isinstance(jobs, list) else 0
        except json.JSONDecodeError:
            cron_count = 0
    return CapabilityDigest(
        slug=str(raw.get("slug") or workspace.name),
        name=str(raw.get("name") or workspace.name),
        tenant_id=str(raw.get("tenant_id") or ""),
        lifecycle=lifecycle,
        capabilities=list(raw.get("capabilities") or []),
        skill_count=skill_count,
        cron_count=cron_count,
        knowledge_count=knowledge_count,
        workspace=str(workspace),
        notes=[
            "Sidecar SQL.js is not the database of record; this digest is written locally first.",
            "POST to /api/employees when the sidecar session is available.",
        ],
    )


class OpenXyosHrClient:
    """Optional sidecar writer. Always persists a local draft; HTTP is best-effort."""

    def __init__(self, sidecar_url: str = "", *, timeout: float = 2.0) -> None:
        self.sidecar_url = (sidecar_url or "").rstrip("/")
        self.timeout = timeout

    def upsert_employee_profile(
        self, digest: CapabilityDigest, *, draft_dir: Path | None = None
    ) -> dict[str, Any]:
        payload = digest.to_openxyos_profile()
        result: dict[str, Any] = {
            "ok": False,
            "sidecar_reached": False,
            "payload": payload,
            "draft": "",
        }
        if draft_dir is not None:
            draft_dir.mkdir(parents=True, exist_ok=True)
            path = draft_dir / f"{digest.slug}.openxyos-hr.json"
            path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
            result["draft"] = str(path)
        parsed = urlparse(self.sidecar_url) if self.sidecar_url else None
        if parsed is None or parsed.scheme not in {"http", "https"} or not parsed.netloc:
            result["reason"] = "sidecar url unset; local draft only"
            return result
        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                response = client.post(f"{self.sidecar_url}/api/employees", json=payload)
        except httpx.HTTPError:
            result["reason"] = "sidecar unreachable; local draft only"
            return result
        result["sidecar_reached"] = True
        result["ok"] = response.status_code < 400
        result["status_code"] = response.status_code
        return result

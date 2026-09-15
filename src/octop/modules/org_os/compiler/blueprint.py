"""Parse ``openxyos.agent-blueprint.v1`` (see openXYOS agent-studio generate)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

BLUEPRINT_SCHEMA = "openxyos.agent-blueprint.v1"
_SLUG_RE = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class JobDuty:
    name: str
    schedule: str
    prompt: str

    def to_dict(self) -> dict[str, str]:
        return {"name": self.name, "schedule": self.schedule, "prompt": self.prompt}


@dataclass(frozen=True)
class BlueprintReference:
    name: str
    excerpt: str
    file_type: str = ""
    scan: str = ""

    def to_dict(self) -> dict[str, str]:
        return {
            "name": self.name,
            "excerpt": self.excerpt,
            "type": self.file_type,
            "scan": self.scan,
        }


@dataclass(frozen=True)
class AgentBlueprint:
    schema: str
    name: str
    positioning: str
    industry: str
    capabilities: list[str]
    experience: str = ""
    references: list[BlueprintReference] = field(default_factory=list)
    ima_url: str = ""
    ima_status: str = ""
    high_risk_requires_human_review: bool = True
    external_write_disabled: bool = True
    lifecycle: str = "talent_market"
    job_duties: list[JobDuty] = field(default_factory=list)
    creator_user_id: str = ""
    tenant_id: str = ""
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def slug(self) -> str:
        ascii_name = _SLUG_RE.sub("-", self.name.lower()).strip("-")
        return ascii_name or "digital-colleague"

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema": self.schema,
            "name": self.name,
            "slug": self.slug,
            "positioning": self.positioning,
            "industry": self.industry,
            "capabilities": list(self.capabilities),
            "experience": self.experience,
            "references": [item.to_dict() for item in self.references],
            "ima": {"url": self.ima_url, "status": self.ima_status} if self.ima_url else None,
            "governance": {
                "high_risk_requires_human_review": self.high_risk_requires_human_review,
                "external_write_disabled": self.external_write_disabled,
            },
            "lifecycle": self.lifecycle,
            "job_duties": [item.to_dict() for item in self.job_duties],
            "tenant_id": self.tenant_id,
        }


def parse_blueprint(data: dict[str, Any] | str | Path, *, tenant_id: str = "") -> AgentBlueprint:
    if isinstance(data, Path):
        payload = json.loads(data.read_text(encoding="utf-8"))
    elif isinstance(data, str):
        payload = json.loads(data)
    else:
        payload = data
    if not isinstance(payload, dict):
        raise ValueError("blueprint must be a JSON object")
    schema = str(payload.get("schema") or "")
    if schema and schema != BLUEPRINT_SCHEMA:
        raise ValueError(f"unsupported blueprint schema: {schema}")
    name = str(payload.get("name") or "").strip()
    positioning = str(payload.get("positioning") or "").strip()
    raw_caps = payload.get("capabilities") or []
    if not isinstance(raw_caps, list):
        raise ValueError("capabilities must be a list")
    capabilities = [str(item).strip() for item in raw_caps if str(item).strip()]
    if not name or not positioning:
        raise ValueError("blueprint requires name and positioning")
    if not capabilities:
        raise ValueError("blueprint requires at least one capability")

    refs: list[BlueprintReference] = []
    for item in payload.get("references") or []:
        if not isinstance(item, dict):
            continue
        excerpt = str(item.get("excerpt") or item.get("extracted_text") or "")
        refs.append(
            BlueprintReference(
                name=str(item.get("name") or item.get("original_name") or "reference"),
                excerpt=excerpt[:6000],
                file_type=str(item.get("type") or item.get("file_type") or ""),
                scan=str(item.get("scan") or item.get("scan_status") or ""),
            )
        )

    ima = payload.get("ima") if isinstance(payload.get("ima"), dict) else {}
    gov = payload.get("governance") if isinstance(payload.get("governance"), dict) else {}
    duties: list[JobDuty] = []
    for item in payload.get("job_duties") or payload.get("duties") or []:
        if not isinstance(item, dict):
            continue
        duty_name = str(item.get("name") or "").strip()
        schedule = str(item.get("schedule") or item.get("cron") or "").strip()
        prompt = str(item.get("prompt") or item.get("description") or "").strip()
        if duty_name and schedule and prompt:
            duties.append(JobDuty(name=duty_name, schedule=schedule, prompt=prompt))

    return AgentBlueprint(
        schema=schema or BLUEPRINT_SCHEMA,
        name=name,
        positioning=positioning,
        industry=str(payload.get("industry") or "professional-services").strip(),
        capabilities=capabilities,
        experience=str(payload.get("experience") or ""),
        references=refs,
        ima_url=str(ima.get("url") or payload.get("ima_url") or ""),
        ima_status=str(ima.get("status") or ""),
        high_risk_requires_human_review=bool(gov.get("high_risk_requires_human_review", True)),
        external_write_disabled=bool(gov.get("external_write_disabled", True)),
        lifecycle=str(payload.get("lifecycle") or "talent_market"),
        job_duties=duties,
        creator_user_id=str(payload.get("creator_user_id") or ""),
        tenant_id=tenant_id or str(payload.get("tenant_id") or ""),
        raw=dict(payload),
    )

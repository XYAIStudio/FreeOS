"""Land asset-pack employees/talent onto the host org chart (no Node)."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.lifecycle.transitions import already_at_or_beyond, register_compiled
from octop.modules.org_os.org_chart.store import OrgChartStore


def _skills_text(raw: Any) -> str:
    if isinstance(raw, list):
        return ", ".join(str(part).strip() for part in raw if str(part).strip())
    return str(raw or "").strip()


def _safe_slug(raw: str, fallback: str = "colleague") -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in raw.strip().lower())
    cleaned = cleaned.strip("-")[:64]
    return cleaned or fallback


def _item_name(item: dict[str, Any]) -> str:
    return str(item.get("name") or item.get("slug") or "").strip()


def _item_slug(item: dict[str, Any], name: str) -> str:
    return _safe_slug(str(item.get("slug") or name))


def _employee_type(item: dict[str, Any], *, default: str = "human") -> str:
    raw = str(item.get("employee_type") or item.get("talent_type") or default).strip().lower()
    if raw in {"ai", "agent", "colleague", "digital"}:
        return "ai"
    if raw == "human":
        return "human"
    return default


@dataclass
class HostIngestReceipt:
    employees: dict[str, int] = field(default_factory=lambda: {"created": 0, "updated": 0})
    talent: dict[str, int] = field(default_factory=lambda: {"created": 0, "updated": 0})
    colleagues: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "employees": dict(self.employees),
            "talent": dict(self.talent),
            "colleagues": list(self.colleagues),
            "notes": list(self.notes),
        }


def land_host_org_surfaces(
    home: Path,
    *,
    tenant_id: str,
    employees: list[dict[str, Any]],
    talent: list[dict[str, Any]],
) -> HostIngestReceipt:
    """Write directory employees + talent market rows the native org-ui can list."""
    tid = tenant_id or "default"
    store = OrgChartStore(home)
    life = LifecycleStore(home, tid)
    receipt = HostIngestReceipt()
    if employees or talent:
        store.ensure_inbox_department(tenant_id=tid)

    for item in employees:
        name = _item_name(item)
        if not name:
            continue
        slug = _item_slug(item, name)
        _row, action = store.upsert_directory_employee(
            tenant_id=tid,
            name=name,
            role=str(item.get("role") or item.get("agent_type") or ""),
            description=str(item.get("description") or ""),
            employee_type=_employee_type(item, default="ai" if item.get("agent_type") else "human"),
            agent_type=item.get("agent_type"),
            skills=_skills_text(item.get("skills") or item.get("capabilities")),
            avatar_emoji=str(item.get("avatar_emoji") or "👤"),
            status="inactive" if str(item.get("status") or "").lower() == "inactive" else "active",
        )
        receipt.employees[action] += 1
        _touch_lifecycle(home, life, slug=slug, name=name, desired="active")
        receipt.colleagues.append(slug)

    for item in talent:
        name = _item_name(item)
        if not name:
            continue
        slug = _item_slug(item, name)
        archived = str(item.get("status") or item.get("talent_status") or "").lower() == "archived"
        status = "archived" if archived else "available"
        _row, action = store.upsert_talent(
            tenant_id=tid,
            name=name,
            talent_type=_employee_type(item, default="ai"),
            skills=_skills_text(item.get("skills") or item.get("capabilities")),
            description=str(item.get("description") or ""),
            source=str(item.get("source") or "freeos.asset-pack.v1"),
            status=status,
            agent_type=item.get("agent_type"),
            slug=slug,
            avatar_emoji=str(item.get("avatar_emoji") or "👤"),
            category=str(item.get("category") or item.get("role") or ""),
        )
        receipt.talent[action] += 1
        if not archived:
            _touch_lifecycle(home, life, slug=slug, name=name, desired="market")
            if slug not in receipt.colleagues:
                receipt.colleagues.append(slug)

    receipt.notes.append("Host directory and talent market updated without Node.")
    return receipt


def recruit_host_talent(
    home: Path,
    *,
    tenant_id: str,
    talent_id: int,
    department_id: int | None = None,
) -> dict[str, Any]:
    """Recruit a host talent row into the directory + lifecycle registry."""
    tid = tenant_id or "default"
    store = OrgChartStore(home)
    landed = store.recruit_talent(talent_id, tenant_id=tid, department_id=department_id)
    talent = landed["talent"]
    name = str(talent.get("name") or "")
    slug = _safe_slug(str(talent.get("slug") or name))
    _touch_lifecycle(home, LifecycleStore(home, tid), slug=slug, name=name, desired="recruit")
    landed["colleague_slug"] = slug
    return landed


def _touch_lifecycle(
    home: Path,
    store: LifecycleStore,
    *,
    slug: str,
    name: str,
    desired: str,
) -> None:
    existing = store.get(slug)
    if existing is not None and already_at_or_beyond(existing.lifecycle, desired):
        return
    workspace = Path(existing.workspace) if existing and existing.workspace else (
        home / "tenants" / store.tenant_id / "employees" / slug
    )
    workspace.mkdir(parents=True, exist_ok=True)
    register_compiled(store, slug=slug, name=name, workspace=workspace, lifecycle=desired)

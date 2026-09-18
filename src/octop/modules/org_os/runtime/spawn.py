"""Register a compiled colleague as a real FreeOS chat agent."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from octop.infra.utils.ulid import new_short_id
from octop.modules.org_os.lifecycle.store import ColleagueRecord, LifecycleStore
from octop.modules.org_os.runtime.memory import sync_colleague_memory
from octop.modules.org_os.runtime.routing import ColleagueRouter, RouteEntry

logger = logging.getLogger(__name__)


def agents_registry_path(home: Path) -> Path:
    return home / "org-agents" / "registry.json"


@dataclass
class SpawnedAgent:
    agent_id: str
    slug: str
    name: str
    tenant_id: str
    workspace: str
    system_prompt: str
    skill_package_id: str = ""
    skill_count: int = 0
    persisted_to_db: bool = False
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _agent_id_for(slug: str, existing: str = "") -> str:
    if existing:
        return existing
    cleaned = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in slug.lower())
    candidate = f"org-{cleaned}".strip("-")
    if len(candidate) < 3:
        candidate = f"org-{new_short_id(6).lower()}"
    return candidate[:64]


def _system_prompt(workspace: Path, name: str) -> str:
    soul = workspace / "SOUL.md"
    if soul.is_file():
        return soul.read_text(encoding="utf-8")
    return f"You are {name}, a FreeOS digital colleague. Follow workspace MEMORY.md."


def _write_file_registry(home: Path, spawned: SpawnedAgent) -> Path:
    path = agents_registry_path(home)
    path.parent.mkdir(parents=True, exist_ok=True)
    data: dict[str, Any] = {"agents": {}}
    if path.is_file():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and isinstance(raw.get("agents"), dict):
                data = raw
        except json.JSONDecodeError:
            pass
    data["agents"][spawned.agent_id] = spawned.to_dict()
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    per_agent = path.parent / f"{spawned.agent_id}.json"
    per_agent.write_text(json.dumps(spawned.to_dict(), indent=2) + "\n", encoding="utf-8")
    return path


def _copy_skills_to_packages(home: Path, agent_id: str, workspace: Path) -> tuple[str, int]:
    skills_root = workspace / "skills"
    if not skills_root.is_dir():
        return "", 0
    package_id = (agent_id if agent_id.startswith("org-") else f"org-{agent_id}")[:64]
    dest = home / "skill-packages" / package_id / "skills"
    dest.mkdir(parents=True, exist_ok=True)
    count = 0
    for skill_dir in sorted(path for path in skills_root.iterdir() if path.is_dir()):
        if not (skill_dir / "SKILL.md").is_file():
            continue
        target = dest / skill_dir.name
        target.mkdir(parents=True, exist_ok=True)
        (target / "SKILL.md").write_bytes((skill_dir / "SKILL.md").read_bytes())
        count += 1
    # Also expose catalog org-* skills so the colleague can call the BFF.
    org_skills = home / "org-skills"
    if org_skills.is_dir():
        for skill_dir in sorted(path for path in org_skills.iterdir() if path.is_dir()):
            if not (skill_dir / "SKILL.md").is_file():
                continue
            target = dest / skill_dir.name
            target.mkdir(parents=True, exist_ok=True)
            (target / "SKILL.md").write_bytes((skill_dir / "SKILL.md").read_bytes())
            count += 1
    return package_id if count else "", count


def _resolve_owner_user_id(services: Any, owner_user_id: int | None) -> int | None:
    if owner_user_id is not None and int(owner_user_id) > 0:
        return int(owner_user_id)
    try:
        users = services.user_repo.list(include_disabled=False)
    except Exception:
        return None
    for row in users:
        if str(getattr(row, "role", "") or "") == "admin":
            return int(row.id)
    if users:
        return int(users[0].id)
    return None


def _persist_agent_row(
    home: Path, spawned: SpawnedAgent, *, owner_user_id: int | None = None
) -> bool:
    """Insert/update the host agents table so the colleague appears in FreeOS chat."""
    try:
        from octop.cli.support.db import open_cli_services
        from octop.infra.agents.profile import dump_skill_package_ids
    except Exception as exc:  # pragma: no cover - import graph
        logger.debug("agent DB helpers unavailable: %s", exc)
        return False
    config = {
        "workspace_dir": spawned.workspace,
        "org": {
            "colleague_slug": spawned.slug,
            "tenant_id": spawned.tenant_id,
            "kind": "freeos.digital-colleague",
        },
        "skills": {"extra_dirs": [str(Path(spawned.workspace) / "skills")]},
    }
    try:
        with open_cli_services(home) as services:
            repo = services.agent_repo
            existing = repo.get(spawned.agent_id)
            owner_id = _resolve_owner_user_id(services, owner_user_id)
            skill_ids = (
                dump_skill_package_ids([spawned.skill_package_id])
                if spawned.skill_package_id
                else None
            )
            if existing is None:
                repo.create(
                    agent_id=spawned.agent_id,
                    user_id=owner_id,
                    name=spawned.name,
                    description=f"FreeOS digital colleague `{spawned.slug}`",
                    system_prompt=spawned.system_prompt,
                    config_json=json.dumps(config, ensure_ascii=False),
                    template_name="org-colleague",
                    skill_package_ids=skill_ids,
                    welcome_message=f"{spawned.name} is on duty. High-risk tools stay gated.",
                )
                try:
                    repo.set_shared(spawned.agent_id, True)
                except Exception:
                    logger.debug("set_shared skipped", exc_info=True)
            else:
                repo.update_config(
                    spawned.agent_id,
                    config_json=json.dumps(config, ensure_ascii=False),
                    system_prompt=spawned.system_prompt,
                    skill_package_ids=skill_ids,
                )
                if existing.user_id is None and owner_id is not None:
                    repo.assign_owner_if_missing(spawned.agent_id, owner_id)
            if spawned.skill_package_id and hasattr(services, "skill_package_repo"):
                pkg_repo = services.skill_package_repo
                if pkg_repo.get(spawned.skill_package_id) is None:
                    try:
                        pkg_repo.create(
                            id=spawned.skill_package_id,
                            name=f"{spawned.name} skills",
                            description=f"Skills compiled for colleague {spawned.slug}",
                            created_by="org-loop",
                        )
                    except Exception:
                        logger.debug("skill package create skipped", exc_info=True)
    except Exception:
        logger.info(
            "could not persist colleague into octop.db; file registry remains", exc_info=True
        )
        return False
    return True


def spawn_colleague_agent(
    home: Path,
    record: ColleagueRecord,
    *,
    agent_id: str = "",
    owner_user_id: int | None = None,
) -> SpawnedAgent:
    """Create a FreeOS agent from a compiled colleague workspace.

    Always writes the org-agents registry + routing table. When ``octop.db``
    can be opened, also inserts an ``agents`` row so the host chat list sees
    the employee.
    """
    workspace = Path(record.workspace)
    package_id, skill_count = _copy_skills_to_packages(home, _agent_id_for(record.slug), workspace)
    spawned = SpawnedAgent(
        agent_id=_agent_id_for(record.slug, agent_id or record.agent_id),
        slug=record.slug,
        name=record.name or record.slug,
        tenant_id=record.tenant_id,
        workspace=str(workspace),
        system_prompt=_system_prompt(workspace, record.name or record.slug),
        skill_package_id=package_id,
        skill_count=skill_count,
        notes=["Registered for FreeOS chat. Governance middleware gates high-risk tools."],
    )
    persisted = _persist_agent_row(home, spawned, owner_user_id=owner_user_id)
    spawned.persisted_to_db = persisted
    if persisted:
        spawned.notes.append("Inserted into FreeOS agents table (octop.db).")
    else:
        spawned.notes.append("File registry written; host DB insert deferred until init.")

    _write_file_registry(home, spawned)
    (workspace / "agent.json").write_text(
        json.dumps(spawned.to_dict(), indent=2) + "\n", encoding="utf-8"
    )
    record.agent_id = spawned.agent_id
    LifecycleStore(home, record.tenant_id).upsert(record)
    ColleagueRouter(home, record.tenant_id).upsert(
        RouteEntry(
            slug=record.slug,
            agent_id=spawned.agent_id,
            name=record.name,
            tenant_id=record.tenant_id,
            workspace=str(workspace),
            lifecycle=record.lifecycle,
        )
    )
    sync_colleague_memory(record, home)
    return spawned


def list_spawned_agents(home: Path) -> list[SpawnedAgent]:
    path = agents_registry_path(home)
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    agents = raw.get("agents") if isinstance(raw, dict) else {}
    if not isinstance(agents, dict):
        return []
    rows: list[SpawnedAgent] = []
    for item in agents.values():
        if not isinstance(item, dict):
            continue
        rows.append(
            SpawnedAgent(
                agent_id=str(item.get("agent_id") or ""),
                slug=str(item.get("slug") or ""),
                name=str(item.get("name") or ""),
                tenant_id=str(item.get("tenant_id") or ""),
                workspace=str(item.get("workspace") or ""),
                system_prompt=str(item.get("system_prompt") or ""),
                skill_package_id=str(item.get("skill_package_id") or ""),
                skill_count=int(item.get("skill_count") or 0),
                persisted_to_db=bool(item.get("persisted_to_db")),
                notes=list(item.get("notes") or []),
            )
        )
    return rows

"""Org memory hooks: colleague MEMORY/knowledge feed the tenant knowledge plane."""

from __future__ import annotations

import shutil
from pathlib import Path

from octop.modules.org_os.lifecycle.store import ColleagueRecord


def org_knowledge_root(home: Path, tenant_id: str) -> Path:
    return home / "tenants" / (tenant_id or "default") / "org-knowledge"


def live_memory_dir(home: Path, tenant_id: str, slug: str) -> Path:
    return org_knowledge_root(home, tenant_id) / "live" / slug


def sync_colleague_memory(record: ColleagueRecord, home: Path) -> Path:
    """Copy workspace MEMORY + knowledge into the tenant org-knowledge live tree."""
    dest = live_memory_dir(home, record.tenant_id, record.slug)
    dest.mkdir(parents=True, exist_ok=True)
    workspace = Path(record.workspace)
    memory = workspace / "MEMORY.md"
    if memory.is_file():
        shutil.copy2(memory, dest / "MEMORY.md")
    else:
        (dest / "MEMORY.md").write_text(f"# {record.name}\n", encoding="utf-8")
    knowledge = workspace / "knowledge"
    knowledge_dest = dest / "knowledge"
    if knowledge.is_dir():
        if knowledge_dest.exists():
            shutil.rmtree(knowledge_dest)
        shutil.copytree(knowledge, knowledge_dest)
    soul = workspace / "SOUL.md"
    if soul.is_file():
        shutil.copy2(soul, dest / "SOUL.md")
    index = dest / "INDEX.md"
    index.write_text(
        f"# {record.name}\n\n"
        f"- slug: `{record.slug}`\n"
        f"- lifecycle: `{record.lifecycle}`\n"
        f"- workspace: `{record.workspace}`\n"
        f"- agent_id: `{getattr(record, 'agent_id', '')}`\n"
        "\nLive org memory used by FreeOS chat routing for this colleague.\n",
        encoding="utf-8",
    )
    return dest

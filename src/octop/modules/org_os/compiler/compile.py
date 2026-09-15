"""Compile a blueprint into a tenant-scoped FreeOS agent workspace."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.modules.org_os.compiler.blueprint import AgentBlueprint, parse_blueprint

_CAP_SLUG_TRANS = str.maketrans({" ": "-", "/": "-", "_": "-"})


@dataclass
class CompiledEmployee:
    slug: str
    tenant_id: str
    workspace: Path
    soul: Path
    memory: Path
    env_file: Path
    cron_file: Path
    blueprint_file: Path
    knowledge_files: list[Path] = field(default_factory=list)
    skill_files: list[Path] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "tenant_id": self.tenant_id,
            "workspace": str(self.workspace),
            "soul": str(self.soul),
            "memory": str(self.memory),
            "env_file": str(self.env_file),
            "cron_file": str(self.cron_file),
            "blueprint_file": str(self.blueprint_file),
            "knowledge_files": [str(path) for path in self.knowledge_files],
            "skill_files": [str(path) for path in self.skill_files],
        }


def _cap_slug(name: str) -> str:
    raw = name.lower().translate(_CAP_SLUG_TRANS)
    cleaned = "".join(ch if ch.isalnum() or ch == "-" else "-" for ch in raw)
    return cleaned.strip("-")[:48] or "capability"


def _render_soul(blueprint: AgentBlueprint) -> str:
    caps = "\n".join(f"- {item}" for item in blueprint.capabilities)
    lines = [
        f"# {blueprint.name}",
        "",
        blueprint.positioning,
        "",
        f"**Industry:** {blueprint.industry}",
        "",
        "## Capabilities",
        "",
        caps,
        "",
        "## Governance (must follow)",
        "",
        "You run on the FreeOS **data plane**. openXYOS is the control plane.",
        "Do not start a second chat runtime.",
        "",
        "- High-risk tools (outbound / delete / pay / prod) go through",
        "  `xyos-governance-mcp` first. If `execute` is false, **stop**.",
        "- One tenant = one workspace/sandbox. Never use another tenant's files.",
        f"- Tenant id: `{blueprint.tenant_id or 'unset'}`.",
    ]
    if blueprint.external_write_disabled:
        lines.append("- External write / send / pay / prod-change is disabled until promoted.")
    if blueprint.high_risk_requires_human_review:
        lines.append("- High-risk conclusions require a human review (durable pause).")
    if blueprint.ima_url:
        lines.extend(["", f"Linked knowledge URL (unverified): {blueprint.ima_url}"])
    lines.extend(
        ["", "This colleague is produced by `xyos2freeos` from `openxyos.agent-blueprint.v1`."]
    )
    return "\n".join(lines) + "\n"


def _render_memory(blueprint: AgentBlueprint) -> str:
    parts = [
        f"# MEMORY seed — {blueprint.name}",
        "",
        "Seeded from the control-plane blueprint. Runtime memory stays in this workspace.",
        "",
    ]
    if blueprint.experience:
        parts.extend(["## Experience / operating guidance", "", blueprint.experience[:4000], ""])
    if blueprint.references:
        parts.append("## Reference excerpts")
        parts.append("")
        for item in blueprint.references:
            parts.append(f"### {item.name}")
            parts.append(item.excerpt[:1500] or "(empty)")
            parts.append("")
    return "\n".join(parts)


def _render_skill(blueprint: AgentBlueprint, capability: str) -> str:
    slug = _cap_slug(capability)
    return (
        f"---\n"
        f"name: {slug}\n"
        f"description: {capability} — compiled from openXYOS blueprint {blueprint.name}.\n"
        f"metadata:\n"
        f"  freeos:\n"
        f"    source: openxyos-blueprint\n"
        f"    colleague: {blueprint.slug}\n"
        f"---\n\n"
        f"# {capability}\n\n"
        f"Use FreeOS org skills (`org-*`) and the BFF `/api/org-module/sidecar` "
        f"with `X-FreeOS-Tenant-Id`. High-risk actions must call "
        f"`xyos-governance-mcp` / `gate_tool_call` first.\n"
    )


def _render_env(blueprint: AgentBlueprint, *, sidecar_url: str, home: Path) -> str:
    return (
        f"FREEOS_ORG_TENANT_ID={blueprint.tenant_id}\n"
        f"FREEOS_ORG_SIDECAR_URL={sidecar_url}\n"
        f"FREEOS_HOME={home}\n"
        f"XYOS_BLUEPRINT_SCHEMA={blueprint.schema}\n"
        f"FREEOS_COLLEAGUE_SLUG={blueprint.slug}\n"
        "# Tenant-scoped. Do not copy this file into another tenant workspace.\n"
    )


def compile_blueprint(
    source: AgentBlueprint | dict[str, Any] | Path,
    *,
    home: Path,
    tenant_id: str = "",
    sidecar_url: str = "http://127.0.0.1:3780",
    out_dir: Path | None = None,
) -> CompiledEmployee:
    """Write SOUL.md, skills, knowledge, MEMORY seed, .env, and cron.json."""
    blueprint = (
        source
        if isinstance(source, AgentBlueprint)
        else parse_blueprint(source, tenant_id=tenant_id)
    )
    if tenant_id and not blueprint.tenant_id:
        blueprint = parse_blueprint(blueprint.to_dict(), tenant_id=tenant_id)
    tid = blueprint.tenant_id or tenant_id or "default"
    workspace = out_dir or (home / "tenants" / tid / "employees" / blueprint.slug)
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "knowledge").mkdir(parents=True, exist_ok=True)
    (workspace / "skills").mkdir(parents=True, exist_ok=True)

    soul = workspace / "SOUL.md"
    memory = workspace / "MEMORY.md"
    env_file = workspace / ".env"
    cron_file = workspace / "cron.json"
    blueprint_file = workspace / "blueprint.json"
    soul.write_text(_render_soul(blueprint), encoding="utf-8")
    memory.write_text(_render_memory(blueprint), encoding="utf-8")
    env_file.write_text(
        _render_env(blueprint, sidecar_url=sidecar_url, home=home), encoding="utf-8"
    )
    cron_jobs = [
        {
            "name": duty.name,
            "schedule_spec": duty.schedule,
            "prompt": duty.prompt,
            "enabled": False,
            "note": "Enabled only in lifecycle=active. Disabled in shadow/offboard.",
        }
        for duty in blueprint.job_duties
    ]
    cron_file.write_text(json.dumps(cron_jobs, indent=2) + "\n", encoding="utf-8")
    blueprint_file.write_text(json.dumps(blueprint.to_dict(), indent=2) + "\n", encoding="utf-8")

    knowledge_files: list[Path] = []
    for index, ref in enumerate(blueprint.references, start=1):
        path = workspace / "knowledge" / f"{index:02d}-{_cap_slug(ref.name)}.md"
        path.write_text(f"# {ref.name}\n\n{ref.excerpt}\n", encoding="utf-8")
        knowledge_files.append(path)

    skill_files: list[Path] = []
    for capability in blueprint.capabilities:
        skill_dir = workspace / "skills" / _cap_slug(capability)
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_md = skill_dir / "SKILL.md"
        skill_md.write_text(_render_skill(blueprint, capability), encoding="utf-8")
        skill_files.append(skill_md)

    (workspace / "workspace.json").write_text(
        json.dumps(
            {
                "kind": "freeos.employee-workspace.v1",
                "slug": blueprint.slug,
                "tenant_id": tid,
                "runtime": "octop-data-plane",
                "isolation": "one-tenant-one-workspace",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return CompiledEmployee(
        slug=blueprint.slug,
        tenant_id=tid,
        workspace=workspace,
        soul=soul,
        memory=memory,
        env_file=env_file,
        cron_file=cron_file,
        blueprint_file=blueprint_file,
        knowledge_files=knowledge_files,
        skill_files=skill_files,
    )

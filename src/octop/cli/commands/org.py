"""``freeos org`` / ``octop org`` — organization module, governance, skills."""

from __future__ import annotations

import json
from pathlib import Path

import click

from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.service import OrgModuleService


@click.group()
def org() -> None:
    """Enable, inspect, or bridge the openXYOS organization module."""


def _service() -> OrgModuleService:
    paths = PathLayout.from_env()
    paths.ensure_root()
    return OrgModuleService(config_path=paths.config, home=paths.root)


def _engine():
    from octop.modules.org_os.governance.engine import GovernanceEngine

    service = _service()
    return GovernanceEngine.from_home(service.home, sidecar_url=service.sidecar_url())


@org.command("status")
@click.pass_context
def org_status(ctx: click.Context) -> None:
    """Show enablement, sidecar health, and capability keys."""
    status = _service().status()
    if ctx.obj and ctx.obj.get("json_out"):
        click.echo(json.dumps(status.to_dict(), ensure_ascii=False, indent=2))
        return
    click.echo(f"enabled: {status.enabled}")
    click.echo(f"home: {status.home}")
    click.echo(f"tenant_id: {status.tenant_id or '(unset)'}")
    click.echo(f"governance: {status.governance_enabled}")
    click.echo(f"sidecar: {status.sidecar.url} ({status.sidecar.detail or 'unknown'})")
    click.echo(f"catalog: {', '.join(status.catalog_keys)}")
    click.echo(f"start: {status.start_command}")


@org.command("enable")
def org_enable() -> None:
    """Turn on the organization module (does not start the sidecar)."""
    service = _service()
    service.set_enabled(True)
    click.echo("Organization module enabled.")
    click.echo(f"Start the sidecar with: {service.status().start_command}")


@org.command("disable")
def org_disable() -> None:
    """Turn off the organization module."""
    _service().set_enabled(False)
    click.echo("Organization module disabled.")


@org.group("governance")
def org_governance() -> None:
    """xyos-governance-mcp — default-deny high-risk tools, durable HITL."""


@org_governance.command("enable")
@click.option("--tenant-id", default="", help="Hint written to config and MCP env.")
def governance_enable(tenant_id: str) -> None:
    """Enable the governance gate and write the stdio MCP connector snippet."""
    from octop.modules.org_os.governance.mcp_server import write_connector_snippet

    service = _service()
    service.set_governance_enabled(True, tenant_id=tenant_id or None)
    snippet = write_connector_snippet()
    click.echo("Governance gate enabled (default-deny high-risk tools).")
    click.echo(f"MCP snippet: {snippet}")
    click.echo("Run: uv run xyos-governance-mcp")
    click.echo("See src/octop/modules/org_os/governance/README.md")


@org_governance.command("disable")
def governance_disable() -> None:
    """Disable the in-process interceptor (MCP server can still be run manually)."""
    _service().set_governance_enabled(False)
    click.echo("Governance interceptor disabled.")


@org_governance.command("check")
@click.option("--tool", "tool_name", required=True)
@click.option("--category", default="")
@click.option("--action", default="")
@click.option("--approval-id", default="")
@click.option("--auto-pause/--no-auto-pause", default=True)
def governance_check(
    tool_name: str, category: str, action: str, approval_id: str, auto_pause: bool
) -> None:
    """Policy-check a tool. High-risk unmatched rules default-deny."""
    from octop.modules.org_os.governance.types import PolicyRequest

    service = _service()
    decision = _engine().evaluate(
        PolicyRequest(
            tool_name=tool_name,
            category=category,
            action=action,
            tenant_id=service.tenant_id(),
            approval_id=approval_id,
            auto_pause=auto_pause,
        )
    )
    click.echo(json.dumps(decision.to_dict(), ensure_ascii=False, indent=2))
    if not decision.execute:
        raise SystemExit(3)


@org_governance.command("approve")
@click.argument("pause_id")
def governance_approve(pause_id: str) -> None:
    """Approve a durable pause. The agent must re-check before executing."""
    click.echo(json.dumps(_engine().approve(pause_id).to_dict(), indent=2))


@org_governance.command("reject")
@click.argument("pause_id")
def governance_reject(pause_id: str) -> None:
    """Reject a durable pause. execute stays false."""
    click.echo(json.dumps(_engine().reject(pause_id).to_dict(), indent=2))


@org_governance.command("audit")
@click.option("--limit", default=20, type=int)
def governance_audit(limit: int) -> None:
    """Print recent local audit events (not sidecar SQL.js)."""
    click.echo(json.dumps(_engine().store.tail_audit(limit), indent=2, default=str))


@org.group("skills")
def org_skills() -> None:
    """Module ↔ skill bridge — generate from catalog, publish as tenant plugin."""


@org_skills.command("generate")
@click.option("--module", "modules", multiple=True, help="Catalog key (repeatable).")
@click.option("--out", "out_dir", type=click.Path(path_type=Path), default=None)
def skills_generate(modules: tuple[str, ...], out_dir: Path | None) -> None:
    """Write SKILL.md trees that call real /api routes with tenant headers."""
    from octop.modules.org_os.skill_bridge.generate import generate_module_skills

    service = _service()
    dest = out_dir or (service.home / "org-skills")
    keys = list(modules) if modules else None
    generated = generate_module_skills(dest, module_keys=keys)
    click.echo(f"wrote {len(generated)} skill(s) under {dest}")
    for item in generated:
        click.echo(f"  {item.slug} → {item.skill_md}")
    click.echo("See src/octop/modules/org_os/skill_bridge/README.md")


@org_skills.command("publish")
@click.argument("skill_dir", type=click.Path(path_type=Path, exists=True))
@click.option("--out", "out_dir", type=click.Path(path_type=Path), default=None)
def skills_publish(skill_dir: Path, out_dir: Path | None) -> None:
    """Publish a polished skill as a tenant-toggleable plugin draft (not auto-on)."""
    from octop.modules.org_os.skill_bridge.publish import publish_skill

    if skill_dir.is_file() and skill_dir.name == "SKILL.md":
        skill_dir = skill_dir.parent
    draft = publish_skill(skill_dir, out_dir=out_dir)
    click.echo(json.dumps(draft.to_dict(), indent=2))

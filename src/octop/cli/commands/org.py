"""``freeos org`` / ``octop org`` — organization module controls."""

from __future__ import annotations

import json

import click

from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.service import OrgModuleService


@click.group()
def org() -> None:
    """Enable, disable, or inspect the openXYOS organization module."""


def _service() -> OrgModuleService:
    paths = PathLayout.from_env()
    paths.ensure_root()
    return OrgModuleService(config_path=paths.config, home=paths.root)


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

"""octop version command."""

from __future__ import annotations

import click

from octop import __version__


@click.command("version")
def version() -> None:
    """Show the version of the running octop package."""
    click.echo(f"octop v{__version__}")

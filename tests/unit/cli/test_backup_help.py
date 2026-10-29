"""``octop backup --help`` names the FreeOS home and the legacy Octop home."""

from __future__ import annotations

from click.testing import CliRunner

from octop.cli.main import cli


def test_backup_help_uses_freeos_home_and_legacy_octop() -> None:
    runner = CliRunner()
    result = runner.invoke(cli, ["backup", "--help"])
    assert result.exit_code == 0, result.output
    assert "~/.freeos" in result.output
    assert "~/.octop" in result.output
    assert "default ~/.octop" not in result.output
    assert "FREEOS_HOME" in result.output
    assert "OCTOP_DESKTOP" in result.output

    create = runner.invoke(cli, ["backup", "create", "--help"])
    assert create.exit_code == 0, create.output
    assert "~/.freeos" in create.output
    assert "existing ~/.octop" in create.output
    assert "default ~/.octop" not in create.output

    restore = runner.invoke(cli, ["backup", "restore", "--help"])
    assert restore.exit_code == 0, restore.output
    assert "~/.freeos" in restore.output
    assert "~/.octop" in restore.output
    assert "default ~/.octop" not in restore.output

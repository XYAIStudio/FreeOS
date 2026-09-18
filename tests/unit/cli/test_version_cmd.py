"""Tests for `octop version`."""

from __future__ import annotations

import tomllib
from pathlib import Path

from click.testing import CliRunner

from octop import __version__
from octop.cli.main import cli

_REPO_ROOT = Path(__file__).resolve().parents[3]


def test_product_version_is_002() -> None:
    with (_REPO_ROOT / "pyproject.toml").open("rb") as fh:
        declared = tomllib.load(fh)["project"]["version"]
    assert declared == "0.0.2"
    assert __version__ == "0.0.2"


def test_version_prints_orca_version() -> None:
    runner = CliRunner()
    result = runner.invoke(cli, ["version"])
    assert result.exit_code == 0
    assert "octop" in result.output.lower()
    assert "0.0.2" in result.output


def test_version_in_help() -> None:
    runner = CliRunner()
    result = runner.invoke(cli, ["--help"])
    assert "version" in result.output


def test_root_version_flag() -> None:
    runner = CliRunner()
    result = runner.invoke(cli, ["-v"])
    assert result.exit_code == 0
    assert "octop" in result.output.lower()
    assert "0.0.2" in result.output

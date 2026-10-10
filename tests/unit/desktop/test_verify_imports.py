"""The portable smoke gate must inspect the launcher that users will run."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize("launcher", ["print('ready')\n", "def broken(\n", None])
def test_shipped_launcher_is_checked(tmp_path: Path, monkeypatch, capsys, launcher):
    checker = Path(__file__).parents[3] / "desktop/portable/verify_imports.py"
    spec = importlib.util.spec_from_file_location("portable_verify_imports", checker)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    packages = tmp_path / "packages"
    packages.mkdir()
    requirements = tmp_path / "requirements.txt"
    requirements.write_text("", encoding="utf-8")
    if launcher is not None:
        (tmp_path / "launch.py").write_text(launcher, encoding="utf-8")
    monkeypatch.setattr(module, "_SMOKE_IMPORTS", ())
    monkeypatch.setattr(module.site, "addsitedir", lambda _: None)
    monkeypatch.setattr(module, "_installed_version", lambda _: None)
    monkeypatch.setattr(
        sys,
        "argv",
        [str(checker), "--packages", str(packages), "--requirements", str(requirements)],
    )
    result = module.main()
    if launcher == "print('ready')\n":
        assert result == 0
    else:
        assert result == 1
        assert "launch.py:" in capsys.readouterr().err

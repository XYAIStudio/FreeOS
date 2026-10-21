"""GitHub Release prerelease classification for FreeOS tags."""

from __future__ import annotations

import importlib.util
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "release_prerelease.py"
_spec = importlib.util.spec_from_file_location("release_prerelease", _SCRIPT)
assert _spec is not None and _spec.loader is not None
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)


def test_rc_alpha_beta_and_dev_are_prereleases() -> None:
    assert _mod.is_release_prerelease("v0.1.0rc1") is True
    assert _mod.is_release_prerelease("0.1.0rc1") is True
    assert _mod.is_release_prerelease("v0.1.0a1") is True
    assert _mod.is_release_prerelease("v0.1.0b2") is True
    assert _mod.is_release_prerelease("v0.1.0.dev1") is True
    assert _mod.is_release_prerelease("0.1.0.dev3") is True


def test_production_tags_are_not_prereleases() -> None:
    assert _mod.is_release_prerelease("v0.1.0") is False
    assert _mod.is_release_prerelease("0.0.10") is False
    assert _mod.is_release_prerelease("v0.1.0-rc.1") is False

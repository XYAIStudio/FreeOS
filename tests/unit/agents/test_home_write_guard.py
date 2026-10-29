"""Product-home write guards and Windows path containment."""

from __future__ import annotations

from pathlib import Path

import pytest

from octop.infra.agents.workspace_dir import (
    path_is_within,
    seed_workspace_dir_on_create,
)
from octop.infra.errors import ErrorCode, OctopError
from octop.infra.utils.paths import PathLayout


def _scoped(root: Path) -> dict:
    return {
        "backend": {
            "type": "local_shell",
            "root_dir": str(root),
            "virtual_mode": True,
        }
    }


def test_windows_profile_workspace_is_outside_isolated_home() -> None:
    profile = r"C:\Users\alice\.octop\workspaces\main"
    isolated = r"D:\freeos-data"
    assert path_is_within(profile, isolated) is False
    assert path_is_within(r"D:\freeos-data\.octop\workspaces\main", isolated) is True
    assert path_is_within(r"c:/Users/alice/.octop/workspaces/main", r"C:\Users\alice") is True


def test_refuse_preexisting_directory_outside_home(tmp_path: Path) -> None:
    product = tmp_path / "freeos-home"
    product.mkdir()
    user = tmp_path / "Users" / "alice"
    existing = user / ".octop" / "workspaces" / "main"
    existing.mkdir(parents=True)
    (existing / "SOUL.md").write_text("keep", encoding="utf-8")
    (existing / "memory.sqlite").write_bytes(b"db")

    with pytest.raises(OctopError) as exc:
        seed_workspace_dir_on_create(_scoped(user), paths=PathLayout(product), agent_id="main")

    assert exc.value.code == ErrorCode.HOME_WRITE_REFUSED
    assert (existing / "SOUL.md").read_text(encoding="utf-8") == "keep"
    assert (existing / "memory.sqlite").read_bytes() == b"db"


def test_refuse_seed_over_existing_data_inside_home(tmp_path: Path) -> None:
    product = tmp_path / "freeos-home"
    existing = product / ".octop" / "workspaces" / "main"
    existing.mkdir(parents=True)
    (existing / "SOUL.md").write_text("keep", encoding="utf-8")

    with pytest.raises(OctopError) as exc:
        seed_workspace_dir_on_create(_scoped(product), paths=PathLayout(product), agent_id="main")

    assert exc.value.code == ErrorCode.AGENT_SEED_EXISTS
    assert (existing / "SOUL.md").read_text(encoding="utf-8") == "keep"
    assert not (existing / "manifest.json").exists()

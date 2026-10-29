"""Upgrades must take a full backup and record its sha256 before replacing bits."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def test_install_sh_backs_up_before_package_install() -> None:
    text = (REPO / "scripts" / "install.sh").read_text(encoding="utf-8")
    backup = text.index("_backup_before_upgrade")
    call = text.index("\n_backup_before_upgrade\n")
    package = text.index('uv pip install "${SOURCE_DIR}${EXTRAS_SUFFIX}"', call)
    assert "backup create" in text[backup:package]
    assert "--include-chats" in text[backup:package]
    assert "--home" in text[backup:package]
    assert "Upgrade aborted: backup failed" in text
    assert "sha256" in text[backup:package]


def test_install_ps1_backs_up_before_venv_clear() -> None:
    text = (REPO / "scripts" / "install.ps1").read_text(encoding="utf-8")
    backup = text.index("backup create")
    clear = text.index("uv venv $OctopVenv")
    assert backup < clear
    assert "--include-chats" in text
    assert "Upgrade aborted: backup failed" in text
    assert "SHA256" in text


def test_in_app_upgrade_runs_full_backup_not_only_sqlite() -> None:
    text = (REPO / "desktop" / "src" / "portable_upgrade.go").read_text(encoding="utf-8")
    assert '"backup", "create"' in text
    assert '"--include-chats"' in text
    assert '"--home"' in text
    assert "sha256File" in text
    assert ".sha256" in text
    assert "sqlite3" not in text
    assert "pre-upgrade backup failed" in text

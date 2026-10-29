"""Upgrades must take a full backup and record its sha256 before replacing bits."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
posix_only = pytest.mark.skipif(os.name != "posix", reason="install.sh refuses non-POSIX uname")


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


@posix_only
def test_install_sh_backup_only_writes_archive_and_sha256(tmp_path: Path) -> None:
    home = tmp_path / "home"
    bin_dir = home / "venv" / "bin"
    bin_dir.mkdir(parents=True)
    (home / "octop.db").write_bytes(b"sqlite")
    octop = bin_dir / "octop"
    octop.write_text(
        "#!/bin/sh\n"
        "out=\n"
        "prev=\n"
        'for arg in "$@"; do\n'
        '  if [ "$prev" = "-o" ]; then out=$arg; fi\n'
        "  prev=$arg\n"
        "done\n"
        'mkdir -p "$(dirname "$out")"\n'
        'printf backup > "$out"\n',
        encoding="utf-8",
    )
    octop.chmod(0o755)
    python = bin_dir / "python"
    python.write_text("#!/bin/sh\necho Python 3.12.12\n", encoding="utf-8")
    python.chmod(0o755)
    env = {
        "HOME": str(home),
        "FREEOS_HOME": str(home),
        "PATH": "/usr/bin:/bin",
        "FREEOS_INSTALL_BACKUP_ONLY": "1",
    }
    import os
    import subprocess

    result = subprocess.run(
        ["bash", str(REPO / "scripts" / "install.sh")],
        cwd=REPO,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    archives = list((home / "backups").glob("pre-upgrade-*.tar.gz"))
    assert len(archives) == 1
    checksum = Path(str(archives[0]) + ".sha256").read_text(encoding="utf-8")
    assert archives[0].name in checksum
    assert os.path.getsize(archives[0]) > 0


@posix_only
def test_install_sh_backup_failure_aborts(tmp_path: Path) -> None:
    home = tmp_path / "home"
    bin_dir = home / "venv" / "bin"
    bin_dir.mkdir(parents=True)
    (home / "config.json").write_text("{}\n", encoding="utf-8")
    octop = bin_dir / "octop"
    octop.write_text("#!/bin/sh\nexit 1\n", encoding="utf-8")
    octop.chmod(0o755)
    python = bin_dir / "python"
    python.write_text("#!/bin/sh\necho Python 3.12.12\n", encoding="utf-8")
    python.chmod(0o755)
    import subprocess

    result = subprocess.run(
        ["bash", str(REPO / "scripts" / "install.sh")],
        cwd=REPO,
        env={
            "HOME": str(home),
            "FREEOS_HOME": str(home),
            "PATH": "/usr/bin:/bin",
            "FREEOS_INSTALL_BACKUP_ONLY": "1",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert "Upgrade aborted: backup failed" in result.stderr
    assert list((home / "backups").glob("pre-upgrade-*.tar.gz.sha256")) == []


def test_nsis_overwrite_backs_up_before_copying_files() -> None:
    nsi = (REPO / "desktop" / "src" / "build" / "windows" / "nsis" / "project.nsi").read_text(
        encoding="utf-8"
    )
    tools = (REPO / "desktop" / "src" / "build" / "windows" / "nsis" / "wails_tools.nsh").read_text(
        encoding="utf-8"
    )
    backup = nsi.index("wails.backupBeforeOverwrite")
    files = nsi.index("wails.files", backup)
    assert backup < files
    assert "Abort" in tools[tools.index("wails.backupBeforeOverwrite") :]
    assert "backup-before-overwrite.ps1" in tools
    script = (
        REPO / "desktop" / "src" / "build" / "windows" / "nsis" / "backup-before-overwrite.ps1"
    ).read_text(encoding="utf-8")
    assert "--include-chats" in script
    assert "Upgrade aborted: backup failed" in script


def test_in_app_upgrade_runs_full_backup_not_only_sqlite() -> None:
    text = (REPO / "desktop" / "src" / "portable_upgrade.go").read_text(encoding="utf-8")
    assert '"backup", "create"' in text
    assert '"--include-chats"' in text
    assert '"--home"' in text
    assert "sha256File" in text
    assert ".sha256" in text
    assert "sqlite3" not in text
    assert "pre-upgrade backup failed" in text

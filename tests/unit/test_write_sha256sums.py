"""SHA256SUMS generation for FreeOS release artifacts."""

from __future__ import annotations

import hashlib
import importlib.util
import subprocess
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "write_sha256sums.py"


def _load():
    spec = importlib.util.spec_from_file_location("write_sha256sums", _SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_checksum_covers_desktop_zip_wheel_and_sdist(tmp_path: Path) -> None:
    mod = _load()
    names = {
        "FreeOS-desktop-windows-amd64-0.1.0rc1.exe": b"exe",
        "FreeOS-desktop-darwin-arm64-0.1.0rc1.dmg": b"dmg",
        "FreeOS-desktop-linux-amd64-0.1.0rc1.tar.gz": b"linux-desktop",
        "FreeOS-portable-linux-amd64-0.1.0rc1.zip": b"zip",
        "freeos-0.1.0rc1-py3-none-any.whl": b"wheel",
        "freeos-0.1.0rc1.tar.gz": b"sdist",
        "FreeOS-fnos-docker-0.1.0rc1.fpk": b"not-a-target",
        "notes.txt": b"nope",
    }
    for name, payload in names.items():
        (tmp_path / name).write_bytes(payload)

    destination = mod.write_sha256sums(tmp_path)
    text = destination.read_text(encoding="utf-8")
    lines = text.splitlines()
    covered = [line.split("  ", 1)[1] for line in lines]
    assert covered == [
        "FreeOS-desktop-darwin-arm64-0.1.0rc1.dmg",
        "FreeOS-desktop-linux-amd64-0.1.0rc1.tar.gz",
        "FreeOS-desktop-windows-amd64-0.1.0rc1.exe",
        "FreeOS-portable-linux-amd64-0.1.0rc1.zip",
        "freeos-0.1.0rc1-py3-none-any.whl",
        "freeos-0.1.0rc1.tar.gz",
    ]
    assert "FreeOS-fnos" not in text
    assert "notes.txt" not in text
    assert text.endswith("\n")
    wheel_line = next(line for line in lines if line.endswith("freeos-0.1.0rc1-py3-none-any.whl"))
    assert wheel_line.startswith(hashlib.sha256(b"wheel").hexdigest() + "  ")


def test_empty_directory_is_rejected(tmp_path: Path) -> None:
    mod = _load()
    try:
        mod.write_sha256sums(tmp_path)
    except SystemExit as exc:
        assert "no desktop" in str(exc)
    else:
        raise AssertionError("expected SystemExit")


def test_missing_from_reports_assets_added_after_the_hash(tmp_path: Path) -> None:
    mod = _load()
    (tmp_path / "freeos-0.1.0rc1-py3-none-any.whl").write_bytes(b"wheel")
    checksum = mod.write_sha256sums(tmp_path)
    missing = mod.missing_targets(
        checksum,
        [
            "freeos-0.1.0rc1-py3-none-any.whl",
            "SHA256SUMS",
            "FreeOS-desktop-windows-amd64-0.1.0rc1.exe",
            "FreeOS-fnos-native-0.1.0rc1.fpk",
        ],
    )
    assert missing == ["FreeOS-desktop-windows-amd64-0.1.0rc1.exe"]


def test_cli_missing_from_exits_3(tmp_path: Path) -> None:
    (tmp_path / "freeos-0.1.0rc1.tar.gz").write_bytes(b"sdist")
    spec_mod = _load()
    checksum = spec_mod.write_sha256sums(tmp_path)
    completed = subprocess.run(
        ["python3", str(_SCRIPT), "--missing-from", str(checksum)],
        input="FreeOS-portable-darwin-arm64-0.1.0rc1.zip\n",
        text=True,
        capture_output=True,
        check=False,
    )
    assert completed.returncode == 3
    assert completed.stdout.strip() == "FreeOS-portable-darwin-arm64-0.1.0rc1.zip"


def test_release_workflows_publish_sha256sums() -> None:
    root = Path(__file__).resolve().parents[2]
    release = (root / ".github/workflows/release.yml").read_text(encoding="utf-8")
    desktop = (root / ".github/workflows/octop-desktop.yml").read_text(encoding="utf-8")
    assert "bash scripts/publish_sha256sums.sh" in release
    assert "bash scripts/publish_sha256sums.sh" in desktop
    assert 'scripts/release_prerelease.py "${GITHUB_REF_NAME}"' in release

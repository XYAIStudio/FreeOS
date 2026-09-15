"""Tests for octop.infra.setup.self_update."""

from __future__ import annotations

import pytest

from pathlib import Path

from octop.infra.setup.github_releases import GitHubReleaseInfo, ReleaseAsset
from octop.infra.setup.self_update import (
    is_newer,
    is_prerelease,
    package_requirement,
    parse_version,
    pending_portable_zip,
    pick_latest_versions,
    run_upgrade,
)


def test_pep440_order() -> None:
    assert parse_version("0.9.34a1") < parse_version("0.9.34b1")
    assert parse_version("0.9.34b1") < parse_version("0.9.34rc1")
    assert parse_version("0.9.34rc1") < parse_version("0.9.34")
    assert parse_version("0.9.34-beta.1") == parse_version("0.9.34b1")
    assert parse_version("0.7.2") > parse_version("0.7.1")


def test_is_prerelease() -> None:
    assert is_prerelease("0.9.34b1")
    assert is_prerelease("0.9.34-beta.1")
    assert is_prerelease("0.9.34rc1")
    assert is_prerelease("0.9.34a1")
    assert is_prerelease("0.9.34.dev1")
    assert not is_prerelease("0.9.34")
    assert not is_prerelease("0.7.1")


def test_is_newer() -> None:
    assert is_newer("0.7.2", "0.7.1")
    assert not is_newer("0.7.1", "0.7.2")
    assert not is_newer("0.7.1", "0.7.1")
    assert is_newer("0.9.34", "0.9.34b1")
    assert is_newer("0.9.34b1", "0.9.33")
    assert not is_newer("0.9.34b1", "0.9.34")


def test_pick_latest_versions_splits_stable_and_pre() -> None:
    latest_any, latest_stable = pick_latest_versions(["0.9.33", "0.9.34b1", "0.9.32", "0.9.34a1"])
    assert latest_any == "0.9.34b1"
    assert latest_stable == "0.9.33"


def test_pick_latest_versions_all_prerelease() -> None:
    latest_any, latest_stable = pick_latest_versions(["0.9.34b1", "0.9.34a1"])
    assert latest_any == "0.9.34b1"
    assert latest_stable is None


def test_package_requirement_never_installs_upstream_octop() -> None:
    with pytest.raises(RuntimeError, match="XYAIStudio/FreeOS"):
        package_requirement("1.0.0")


def test_same_version_is_not_newer() -> None:
    assert not is_newer("0.0.1", "0.0.1")
    assert is_newer("0.0.2", "0.0.1")
    assert not is_newer("0.0.1", "1.0.0")


def test_run_upgrade_stages_freeos_portable(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    zip_url = (
        "https://github.com/XYAIStudio/FreeOS/releases/download/"
        "v0.0.2/FreeOS-portable-linux-amd64-0.0.2.zip"
    )
    info = GitHubReleaseInfo(
        version="0.0.2",
        latest_stable="0.0.2",
        assets=[ReleaseAsset(name="FreeOS-portable-linux-amd64-0.0.2.zip", url=zip_url)],
    )
    monkeypatch.setattr("octop.infra.setup.self_update.fetch_release_info", lambda: info)
    monkeypatch.setattr("octop.infra.setup.self_update.desktop_plat", lambda: "linux-amd64")
    monkeypatch.setenv("FREEOS_HOME", str(tmp_path))
    monkeypatch.setenv("OCTOP_HOME", str(tmp_path))
    monkeypatch.setenv("OCTOP_DESKTOP", "1")

    def fake_download(url: str, dest: Path, **_: object) -> None:
        dest.write_bytes(b"PK\x03\x04")

    monkeypatch.setattr("octop.infra.setup.self_update.download_release_asset", fake_download)

    result = run_upgrade(version="0.0.2")
    assert result.success is True
    assert result.installed_version == "0.0.2"
    assert pending_portable_zip(tmp_path).is_file()
    assert "staged FreeOS 0.0.2" in (result.message or "")


def test_run_upgrade_does_not_pip_install_octop(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    info = GitHubReleaseInfo(version="0.0.1", latest_stable="0.0.1", assets=[])
    monkeypatch.setattr("octop.infra.setup.self_update.fetch_release_info", lambda: info)
    monkeypatch.setattr("octop.infra.setup.self_update.desktop_plat", lambda: "linux-amd64")
    monkeypatch.setenv("FREEOS_HOME", str(tmp_path))
    monkeypatch.delenv("OCTOP_DESKTOP", raising=False)
    monkeypatch.delenv("FREEOS_DESKTOP", raising=False)
    monkeypatch.delenv("OCTOP_GREEN_PACKAGES", raising=False)

    result = run_upgrade(version="0.0.1")
    assert result.success is False
    assert result.error is not None
    assert "PyPI" in result.error or "GitHub" in result.error
    assert "octop==" not in result.error

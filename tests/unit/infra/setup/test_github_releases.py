"""GitHub Releases update channel — FreeOS only, never Octop/PyPI."""

from __future__ import annotations

import pytest

from octop.infra.setup.github_releases import (
    GITHUB_RELEASES_API,
    SOURCE_LABEL,
    GitHubReleaseInfo,
    assert_allowed_update_url,
    parse_github_releases,
    pick_portable_asset,
    pick_release_versions,
)
from octop.infra.setup.self_update import is_prerelease, parse_version


def test_assert_allowed_update_url_accepts_github() -> None:
    assert assert_allowed_update_url(GITHUB_RELEASES_API).startswith("https://api.github.com/")
    assert SOURCE_LABEL == "github.com/XYAIStudio/FreeOS"


@pytest.mark.parametrize(
    "url",
    [
        "https://pypi.org/pypi/octop/json",
        "https://mirrors.cloud.tencent.com/pypi/simple/octop/",
        "https://mirrors.aliyun.com/pypi/simple/octop/",
        "https://pypi.tuna.tsinghua.edu.cn/simple/octop/",
        "https://mirrors.ustc.edu.cn/pypi/simple/octop/",
        "https://finnie-1258344699.cos.ap-guangzhou.myqcloud.com/octop/install.sh",
        "https://octop-1258344699.cos.ap-guangzhou.myqcloud.com/octop/FreeOS.zip",
    ],
)
def test_assert_allowed_update_url_rejects_octop_feeds(url: str) -> None:
    with pytest.raises(ValueError, match="refusing"):
        assert_allowed_update_url(url)


def test_parse_github_releases_ignores_octop_assets_and_drafts() -> None:
    rows = parse_github_releases(
        [
            {
                "tag_name": "v1.0.0",
                "draft": False,
                "body": "upstream Octop",
                "html_url": "https://github.com/other/octop/releases/tag/v1.0.0",
                "assets": [
                    {
                        "name": "octop-desktop-windows-amd64-1.0.0.exe",
                        "browser_download_url": "https://github.com/other/octop/releases/download/v1.0.0/octop.exe",
                    }
                ],
            },
            {
                "tag_name": "v0.0.1",
                "draft": False,
                "body": "## [0.0.1]\nFreeOS",
                "html_url": "https://github.com/XYAIStudio/FreeOS/releases/tag/v0.0.1",
                "assets": [
                    {
                        "name": "FreeOS-portable-windows-amd64-0.0.1.zip",
                        "browser_download_url": (
                            "https://github.com/XYAIStudio/FreeOS/releases/download/"
                            "v0.0.1/FreeOS-portable-windows-amd64-0.0.1.zip"
                        ),
                    }
                ],
            },
        ]
    )
    assert [ver for ver, _ in rows] == ["0.0.1"]
    assert rows[0][1].assets[0].name.startswith("FreeOS-portable-")


def test_pick_release_versions_skips_prerelease_for_stable() -> None:
    rows = [
        (
            "0.0.2a1",
            GitHubReleaseInfo(version="0.0.2a1", latest_stable=None, assets=[]),
        ),
        (
            "0.0.1",
            GitHubReleaseInfo(version="0.0.1", latest_stable=None, assets=[]),
        ),
    ]
    latest_any, latest_stable = pick_release_versions(
        rows, is_prerelease=is_prerelease, parse_version=parse_version
    )
    assert latest_any is not None
    assert latest_any.version == "0.0.2a1"
    assert latest_stable is not None
    assert latest_stable.version == "0.0.1"


def test_pick_portable_asset_requires_matching_plat() -> None:
    info_rows = parse_github_releases(
        [
            {
                "tag_name": "v0.0.2",
                "assets": [
                    {
                        "name": "FreeOS-portable-darwin-arm64-0.0.2.zip",
                        "browser_download_url": (
                            "https://github.com/XYAIStudio/FreeOS/releases/download/"
                            "v0.0.2/FreeOS-portable-darwin-arm64-0.0.2.zip"
                        ),
                    },
                    {
                        "name": "FreeOS-portable-windows-amd64-0.0.2.zip",
                        "browser_download_url": (
                            "https://github.com/XYAIStudio/FreeOS/releases/download/"
                            "v0.0.2/FreeOS-portable-windows-amd64-0.0.2.zip"
                        ),
                    },
                ],
            }
        ]
    )
    assets = info_rows[0][1].assets
    picked = pick_portable_asset(assets, plat="windows-amd64", version="0.0.2")
    assert picked is not None
    assert "windows-amd64" in picked.name
    assert pick_portable_asset(assets, plat="linux-arm64", version="0.0.2") is None

"""FreeOS update channel — GitHub Releases for XYAIStudio/FreeOS only."""

from __future__ import annotations

import json
import logging
import os
import platform
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

GITHUB_OWNER = "XYAIStudio"
GITHUB_REPO = "FreeOS"
GITHUB_RELEASES_API = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases"
GITHUB_RELEASES_HTML = f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/releases"
SOURCE_LABEL = f"github.com/{GITHUB_OWNER}/{GITHUB_REPO}"

_FORBIDDEN_HOSTS = (
    "pypi.org",
    "pypi.python.org",
    "files.pythonhosted.org",
    "mirrors.cloud.tencent.com",
    "mirrors.aliyun.com",
    "pypi.tuna.tsinghua.edu.cn",
    "mirrors.ustc.edu.cn",
    "finnie-1258344699.cos.ap-guangzhou.myqcloud.com",
    "octop-1258344699.cos.ap-guangzhou.myqcloud.com",
)

_TAG_RE = re.compile(r"^v?(?P<version>.+)$", re.IGNORECASE)


@dataclass(frozen=True)
class ReleaseAsset:
    name: str
    url: str
    size: int = 0
    content_type: str = ""

    def is_freeos_desktop(self) -> bool:
        lower = self.name.lower()
        if "octop" in lower and "freeos" not in lower:
            return False
        return lower.startswith("freeos-portable-") or lower.startswith("freeos-desktop-")

    def is_portable_zip(self) -> bool:
        lower = self.name.lower()
        return lower.startswith("freeos-portable-") and lower.endswith(".zip")


@dataclass
class GitHubReleaseInfo:
    """Newest FreeOS GitHub Release that publishes desktop/portable artifacts."""

    version: str
    """Newest version including pre-releases (``latest_any``)."""

    description: str | None = None
    source: str | None = SOURCE_LABEL
    latest_stable: str | None = None
    html_url: str | None = GITHUB_RELEASES_HTML
    assets: list[ReleaseAsset] = field(default_factory=list)


def assert_allowed_update_url(url: str) -> str:
    """Reject Octop / PyPI / TencentCloud update hosts."""
    cleaned = (url or "").strip()
    parsed = urlparse(cleaned)
    host = (parsed.hostname or "").lower()
    if not host:
        raise ValueError("update URL is missing a host")
    if any(host == banned or host.endswith(f".{banned}") for banned in _FORBIDDEN_HOSTS):
        raise ValueError(f"refusing Octop/PyPI/Tencent update host: {host}")
    if "pypi" in host:
        raise ValueError(f"refusing PyPI-like update host: {host}")
    return cleaned


def tag_to_version(tag: str) -> str:
    raw = (tag or "").strip()
    match = _TAG_RE.match(raw)
    if match is None:
        return raw.lstrip("vV")
    return match.group("version").lstrip("vV") or raw


def desktop_plat() -> str:
    """Match desktop/Go ``greenPlat``: ``windows-amd64``, ``darwin-arm64``, …"""
    system = sys.platform
    if system == "win32":
        os_name = "windows"
    elif system == "darwin":
        os_name = "darwin"
    else:
        os_name = "linux"
    machine = platform.machine().lower()
    arch = "arm64" if machine in {"arm64", "aarch64"} else "amd64"
    return f"{os_name}-{arch}"


def _asset_from_payload(raw: dict[str, Any]) -> ReleaseAsset | None:
    name = str(raw.get("name") or "").strip()
    url = str(raw.get("browser_download_url") or raw.get("url") or "").strip()
    if not name or not url:
        return None
    try:
        assert_allowed_update_url(url)
    except ValueError:
        logger.warning("skipping forbidden release asset %s (%s)", name, url)
        return None
    asset = ReleaseAsset(
        name=name,
        url=url,
        size=int(raw.get("size") or 0),
        content_type=str(raw.get("content_type") or ""),
    )
    if not asset.is_freeos_desktop():
        return None
    return asset


def parse_github_releases(payload: Any) -> list[tuple[str, GitHubReleaseInfo]]:
    """Return ``(version, info)`` rows that have at least one FreeOS desktop asset."""
    if not isinstance(payload, list):
        return []
    rows: list[tuple[str, GitHubReleaseInfo]] = []
    for item in payload:
        if not isinstance(item, dict) or item.get("draft"):
            continue
        version = tag_to_version(str(item.get("tag_name") or ""))
        if not version:
            continue
        assets = [
            asset
            for raw in (item.get("assets") or [])
            if isinstance(raw, dict)
            for asset in [_asset_from_payload(raw)]
            if asset is not None
        ]
        if not assets:
            continue
        rows.append(
            (
                version,
                GitHubReleaseInfo(
                    version=version,
                    description=str(item.get("body") or "") or None,
                    source=SOURCE_LABEL,
                    html_url=str(item.get("html_url") or GITHUB_RELEASES_HTML),
                    assets=assets,
                ),
            )
        )
    return rows


def pick_release_versions(
    rows: list[tuple[str, GitHubReleaseInfo]],
    *,
    is_prerelease: Any,
    parse_version: Any,
) -> tuple[GitHubReleaseInfo | None, GitHubReleaseInfo | None]:
    """Return ``(latest_any, latest_stable)`` using the caller's PEP 440 helpers."""
    if not rows:
        return None, None
    latest_any_ver = max((ver for ver, _ in rows), key=parse_version)
    latest_any = next(info for ver, info in rows if ver == latest_any_ver)
    stables = [(ver, info) for ver, info in rows if not is_prerelease(ver)]
    latest_stable = None
    if stables:
        latest_stable_ver = max((ver for ver, _ in stables), key=parse_version)
        latest_stable = next(info for ver, info in stables if ver == latest_stable_ver)
        latest_any.latest_stable = latest_stable_ver
        latest_stable.latest_stable = latest_stable_ver
    else:
        latest_any.latest_stable = None
    latest_any.version = latest_any_ver
    return latest_any, latest_stable


def pick_portable_asset(
    assets: list[ReleaseAsset],
    *,
    plat: str | None = None,
    version: str | None = None,
) -> ReleaseAsset | None:
    """Prefer ``FreeOS-portable-<plat>-<version>.zip`` for the running arch."""
    wanted = plat or desktop_plat()
    portable = [asset for asset in assets if asset.is_portable_zip()]
    if not portable:
        return None

    def _score(asset: ReleaseAsset) -> tuple[int, int, str]:
        name = asset.name.lower()
        exact_plat = 1 if wanted in name else 0
        exact_ver = 1 if version and version.lower() in name else 0
        return (exact_plat, exact_ver, name)

    ranked = sorted(portable, key=_score, reverse=True)
    best = ranked[0]
    if wanted not in best.name.lower():
        return None
    return best


def _github_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "FreeOS-updater/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = (os.environ.get("FREEOS_GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def fetch_github_releases(
    timeout: int = 10,
    *,
    urlopen: Any = None,
    is_prerelease: Any,
    parse_version: Any,
) -> GitHubReleaseInfo | None:
    """GET the public Releases API. Returns None on network/parse failure."""
    assert_allowed_update_url(GITHUB_RELEASES_API)
    opener = urlopen or urllib.request.urlopen
    try:
        req = urllib.request.Request(GITHUB_RELEASES_API, headers=_github_headers())
        with opener(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        rows = parse_github_releases(data)
        latest_any, _latest_stable = pick_release_versions(
            rows, is_prerelease=is_prerelease, parse_version=parse_version
        )
        return latest_any
    except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError, ValueError) as exc:
        logger.warning("failed to fetch FreeOS GitHub Releases: %s", exc)
        return None

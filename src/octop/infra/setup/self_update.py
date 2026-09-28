"""Self-upgrade helpers shared by CLI and HTTP update API."""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.infra.setup.github_releases import (
    GITHUB_RELEASES_HTML,
    SOURCE_LABEL,
    GitHubReleaseInfo,
    assert_allowed_update_url,
    desktop_plat,
    fetch_github_releases,
    pick_portable_asset,
)
from octop.infra.utils.paths import PathLayout

logger = logging.getLogger(__name__)

_PACKAGE_NAME = "octop"
_GREEN_PACKAGES_ENV = "OCTOP_GREEN_PACKAGES"
PENDING_PORTABLE_NAME = "pending-portable.zip"
PENDING_META_NAME = "pending.json"

_COMMON_UV_PATHS = [
    os.path.expanduser("~/.local/bin/uv"),
    os.path.expanduser("~/.cargo/bin/uv"),
    "/usr/local/bin/uv",
    "/opt/homebrew/bin/uv",
]


@dataclass
class UpgradeResult:
    success: bool
    message: str | None = None
    error: str | None = None
    installed_version: str | None = None
    mirror_errors: list[str] = field(default_factory=list)


def green_packages_dir() -> Path | None:
    """Return ``--target`` dir for green portable installs, if configured."""
    raw = (os.environ.get(_GREEN_PACKAGES_ENV) or "").strip()
    if not raw:
        return None
    return Path(raw).expanduser()


def resolve_venv_python() -> str:
    """Return the Python executable for the managed ~/.octop/venv install."""
    # Green portable: always the interpreter that launched launch.py, never ~/.octop/venv.
    if green_packages_dir() is not None:
        return sys.executable

    base_prefix = getattr(sys, "base_prefix", sys.prefix)
    if sys.prefix != base_prefix:
        return sys.executable

    virtual_env = os.environ.get("VIRTUAL_ENV", "").strip()
    if virtual_env:
        for rel in ("bin/python", "Scripts/python.exe"):
            candidate = Path(virtual_env) / rel
            if candidate.is_file():
                return str(candidate)

    for rel in ("bin/python", "Scripts/python.exe"):
        candidate = PathLayout.from_env().root / "venv" / rel
        if candidate.is_file():
            return str(candidate)

    return sys.executable


def detect_installer() -> str:
    if shutil.which("uv"):
        return "uv"
    for candidate in _COMMON_UV_PATHS:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return "uv"
    return "pip"


def find_uv_executable() -> str:
    if shutil.which("uv"):
        return "uv"
    for candidate in _COMMON_UV_PATHS:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return "uv"


def get_local_version() -> str:
    try:
        from importlib.metadata import version

        return version(_PACKAGE_NAME)
    except Exception:
        return "0.0.0"


# Backward-compatible name used by older tests / imports.
PyPIInfo = GitHubReleaseInfo


def updates_dir(home: Path | None = None) -> Path:
    root = home or PathLayout.from_env().root
    dest = root / "updates"
    dest.mkdir(parents=True, exist_ok=True)
    return dest


def pending_portable_zip(home: Path | None = None) -> Path:
    return updates_dir(home) / PENDING_PORTABLE_NAME


def pending_portable_meta(home: Path | None = None) -> Path:
    return updates_dir(home) / PENDING_META_NAME


def is_desktop_install() -> bool:
    if green_packages_dir() is not None:
        return True
    raw = (os.environ.get("OCTOP_DESKTOP") or os.environ.get("FREEOS_DESKTOP") or "").strip()
    return raw.lower() in {"1", "true", "yes", "on"}


def fetch_latest_pypi_version(
    timeout: int = 10,
    *,
    include_prerelease: bool = False,
) -> str | None:
    """Deprecated alias — FreeOS reads GitHub Releases, never PyPI."""
    info = fetch_release_info(timeout=timeout)
    if info is None:
        return None
    if include_prerelease:
        return info.version
    return info.latest_stable


def pick_latest_versions(versions: list[str]) -> tuple[str | None, str | None]:
    """Return ``(latest_any, latest_stable)`` using PEP 440 order."""
    usable = [ver for ver in versions if ver]
    if not usable:
        return None, None
    latest_any = max(usable, key=parse_version)
    stables = [ver for ver in usable if not is_prerelease(ver)]
    latest_stable = max(stables, key=parse_version) if stables else None
    return latest_any, latest_stable


def fetch_release_info(timeout: int = 10) -> GitHubReleaseInfo | None:
    """Fetch the newest FreeOS desktop release from GitHub Releases."""
    return fetch_github_releases(
        timeout=timeout,
        is_prerelease=is_prerelease,
        parse_version=parse_version,
    )


def fetch_pypi_info(timeout: int = 10) -> GitHubReleaseInfo | None:
    """Deprecated name kept so callers/tests can patch one entry point."""
    return fetch_release_info(timeout=timeout)


def parse_changelog_for_version(description: str | None, version: str) -> str | None:
    """Extract the changelog entry for *version* from a Keep a Changelog string.

    Searches for ``## [<version>]`` and returns everything up to the next
    ``## [`` heading (or end of string). Returns None if not found.
    """
    if not description:
        return None
    pattern = re.compile(
        r"(##\s+\[" + re.escape(version) + r"\][^\n]*\n.*?)(?=\n##\s+\[|\Z)",
        re.DOTALL | re.IGNORECASE,
    )
    match = pattern.search(description)
    if not match:
        return None
    return match.group(1).strip()


# PEP 440 letter ranks: a/alpha < b/beta < rc/c/pre/preview. Final has no pre.
_PRE_RANK = {
    "a": 0,
    "alpha": 0,
    "b": 1,
    "beta": 1,
    "c": 2,
    "rc": 2,
    "pre": 2,
    "preview": 2,
}

_PEP440_RE = re.compile(
    r"""
    ^v?
    (?:(?P<epoch>\d+)!)?
    (?P<release>\d+(?:\.\d+)*)
    (?:
        [-_\.]?
        (?P<pre_l>alpha|a|beta|b|preview|pre|rc|c)
        [-_\.]?
        (?P<pre_n>\d+)?
    )?
    (?:
        (?:[-_\.]?(?P<post_l>post|rev|r)[-_\.]?(?P<post_n>\d+))
        |
        (?:-(?P<post_n1>\d+))
    )?
    (?:
        [-_\.]?
        (?P<dev_l>dev)
        [-_\.]?
        (?P<dev_n>\d+)?
    )?
    (?:\+(?P<local>[a-z0-9]+(?:[-_\.][a-z0-9]+)*))?
    $
    """,
    re.VERBOSE | re.IGNORECASE,
)


def _numeric_release_key(value: str) -> tuple[int, ...]:
    parts: list[int] = []
    for segment in value.split("."):
        numeric = ""
        for ch in segment:
            if ch.isdigit():
                numeric += ch
            else:
                break
        parts.append(int(numeric) if numeric else 0)
    return tuple(parts) or (0,)


VersionKey = tuple[int, tuple[int, ...], tuple[int, ...], int, tuple[int, ...]]


def parse_version(value: str) -> VersionKey:
    """Return a comparable PEP 440 sort key for *value*."""
    match = _PEP440_RE.match(value.strip())
    if match is None:
        # Unknown shape: keep previous numeric-only behaviour.
        numeric = _numeric_release_key(value)
        return (0, numeric + (0,) * max(0, 8 - len(numeric)), (1,), -1, (1,))
    epoch = int(match.group("epoch") or 0)
    release_parts = tuple(int(part) for part in match.group("release").split("."))
    # Pad so 1.0 and 1.0.0 compare equal under tuple ordering.
    release = release_parts + (0,) * max(0, 8 - len(release_parts))
    pre_l = match.group("pre_l")
    if pre_l:
        pre_key: tuple[int, ...] = (
            0,
            _PRE_RANK[pre_l.lower()],
            int(match.group("pre_n") or 0),
        )
    elif match.group("dev_l"):
        # Bare .devN sorts before a/b/rc of the same release.
        pre_key = (-1,)
    else:
        pre_key = (1,)
    post_raw = match.group("post_n") or match.group("post_n1")
    post_key = int(post_raw) if post_raw is not None else -1
    if match.group("dev_l"):
        dev_key: tuple[int, ...] = (0, int(match.group("dev_n") or 0))
    else:
        dev_key = (1,)
    return (epoch, release, pre_key, post_key, dev_key)


def is_prerelease(value: str) -> bool:
    """True when *value* is a PEP 440 pre-release (a/b/rc/dev)."""
    match = _PEP440_RE.match(value.strip())
    if match is None:
        return False
    return match.group("pre_l") is not None or match.group("dev_l") is not None


def is_newer(remote: str, local: str) -> bool:
    return parse_version(remote) > parse_version(local)


def get_editable_path() -> str | None:
    try:
        import importlib.metadata as meta

        dist = meta.distribution(_PACKAGE_NAME)
        direct_url = dist.read_text("direct_url.json")
        if direct_url:
            info = json.loads(direct_url)
            if info.get("dir_info", {}).get("editable", False):
                return info.get("url", "").replace("file://", "") or None
    except Exception:
        pass
    return None


def has_pip(python_exe: str) -> bool:
    try:
        result = subprocess.run(
            [python_exe, "-m", "pip", "--version"],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode == 0
    except Exception:
        return False


def find_pip_in_venv(python_exe: str) -> str | None:
    bin_dir = os.path.dirname(os.path.abspath(python_exe))
    for name in ("pip", "pip3"):
        candidate = os.path.join(bin_dir, name)
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def package_requirement(version: str | None = None) -> str:
    """Deprecated PyPI spec — FreeOS no longer installs ``octop`` from indexes."""
    raise RuntimeError(
        "FreeOS does not install the upstream octop package. "
        f"Download desktop builds from {GITHUB_RELEASES_HTML}"
    )


def append_prerelease_flags(
    cmd: list[str],
    installer: str,
    *,
    allow_prerelease: bool,
) -> None:
    if not allow_prerelease:
        return
    if installer == "uv":
        cmd.extend(["--prerelease", "allow"])
    else:
        cmd.append("--pre")


def build_upgrade_command(
    installer: str,
    venv_python: str,
    *,
    index_url: str = "",
    allow_prerelease: bool = False,
    version: str | None = None,
) -> list[str] | None:
    target = green_packages_dir()
    target_args: list[str] = []
    if target is not None:
        target_args = ["--target", str(target)]
    requirement = package_requirement(version)

    if installer == "uv":
        uv_exe = find_uv_executable()
        cmd = [
            uv_exe,
            "pip",
            "install",
            "--python",
            venv_python,
            *target_args,
            "--upgrade-package",
            _PACKAGE_NAME,
        ]
        if index_url:
            cmd.extend(["--index-url", index_url])
        append_prerelease_flags(cmd, installer, allow_prerelease=allow_prerelease)
        cmd.append(requirement)
        return cmd

    upgrade_flags = ["--upgrade", "--upgrade-strategy", "only-if-needed"]
    if has_pip(venv_python):
        cmd = [venv_python, "-m", "pip", "install", *upgrade_flags, *target_args]
    else:
        venv_pip = find_pip_in_venv(venv_python)
        if venv_pip:
            cmd = [venv_pip, "install", *upgrade_flags, *target_args]
        else:
            standalone = shutil.which("pip3") or shutil.which("pip")
            if not standalone:
                return None
            cmd = [standalone, "install", *upgrade_flags, *target_args]
    if index_url:
        cmd.extend(["-i", index_url])
    append_prerelease_flags(cmd, installer, allow_prerelease=allow_prerelease)
    cmd.append(requirement)
    return cmd


def get_installed_version(python_exe: str) -> str | None:
    try:
        result = subprocess.run(
            [
                python_exe,
                "-c",
                f"from importlib.metadata import version; print(version({_PACKAGE_NAME!r}))",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip() or None
    except Exception:
        pass
    return None


def get_version_in_dir(python_exe: str, target: str) -> str | None:
    """Return the octop version installed in *target* (a ``pip --target`` dir)."""
    try:
        code = (
            "import sys; sys.path.insert(0, sys.argv[1]); "
            "from importlib.metadata import version; print(version('octop'))"
        )
        result = subprocess.run(
            [python_exe, "-c", code, target],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip() or None
    except Exception:
        pass
    return None


def _verify_fpk_upgrade(
    local_ver: str,
    site_packages: str,
    python_exe: str,
    mirror_errors: list[str],
) -> UpgradeResult:
    actual_ver: str | None = None
    for attempt in range(3):
        actual_ver = get_version_in_dir(python_exe, site_packages)
        if actual_ver and actual_ver != local_ver:
            break
        if attempt < 2:
            time.sleep(0.5)

    if actual_ver and is_newer(actual_ver, local_ver):
        return UpgradeResult(
            success=True,
            message=f"已升级到 {actual_ver}，请重启服务生效（应用中心托管的服务重启后加载新版）。",
            installed_version=actual_ver,
            mirror_errors=mirror_errors,
        )
    if actual_ver == local_ver:
        return UpgradeResult(
            success=False,
            error=(
                f"安装完成但版本仍为 {actual_ver}；"
                "请确认新版已发布，或改用飞牛应用中心安装新版 FPK。"
            ),
            installed_version=actual_ver,
            mirror_errors=mirror_errors,
        )
    return UpgradeResult(
        success=True,
        message="upgrade completed",
        installed_version=actual_ver,
        mirror_errors=mirror_errors,
    )


def download_release_asset(
    url: str,
    dest: Path,
    *,
    timeout: int = 120,
    urlopen: Any = None,
) -> None:
    """Download a GitHub release asset to *dest* (forbidden hosts rejected)."""
    assert_allowed_update_url(url)
    dest.parent.mkdir(parents=True, exist_ok=True)
    opener = urlopen or urllib.request.urlopen
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "FreeOS-updater/1.0",
            "Accept": "application/octet-stream",
        },
    )
    with opener(req, timeout=timeout) as resp, dest.open("wb") as out:
        shutil.copyfileobj(resp, out)


def stage_desktop_portable(
    asset_url: str,
    *,
    version: str,
    plat: str,
    home: Path | None = None,
    urlopen: Any = None,
) -> Path:
    """Write a pending FreeOS portable zip for the desktop shell to apply on restart."""
    home_root = home or PathLayout.from_env().root
    zip_path = pending_portable_zip(home_root)
    tmp = zip_path.with_suffix(".part")
    if tmp.exists():
        tmp.unlink()
    download_release_asset(asset_url, tmp, urlopen=urlopen)
    tmp.replace(zip_path)
    pending_portable_meta(home_root).write_text(
        json.dumps(
            {
                "version": version,
                "plat": plat,
                "source": SOURCE_LABEL,
                "html_url": GITHUB_RELEASES_HTML,
                "zip": str(zip_path),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return zip_path


def run_upgrade(
    *,
    verbose: bool = False,
    allow_prerelease: bool = False,
    version: str | None = None,
) -> UpgradeResult:
    """Download the matching FreeOS desktop/portable asset from GitHub Releases.

    Desktop installs stage ``{home}/updates/pending-portable.zip``. The Wails
    shell applies it on the next launch (``FREEOS_STAMP`` preserved). Non-desktop
    installs are pointed at the public Releases page — we never ``pip install
    octop`` from PyPI or Tencent mirrors.
    """
    del verbose
    info = fetch_release_info()
    if info is None:
        return UpgradeResult(
            success=False,
            error=f"could not reach {SOURCE_LABEL}",
        )
    target = (version or "").strip() or (
        info.version if allow_prerelease else (info.latest_stable or info.version)
    )
    if not target:
        return UpgradeResult(success=False, error="no FreeOS release on GitHub")
    if not allow_prerelease and is_prerelease(target):
        return UpgradeResult(
            success=False,
            error=f"{target} is a pre-release; pass --allow-prerelease to install it",
        )

    local = get_local_version()
    if local != "0.0.0" and not is_newer(target, local):
        return UpgradeResult(
            success=False,
            error=f"FreeOS {target} is not newer than the installed {local}",
            installed_version=local,
        )
    plat = desktop_plat()
    asset = pick_portable_asset(info.assets, plat=plat, version=target)
    if asset is None:
        if is_desktop_install():
            return UpgradeResult(
                success=False,
                error=(
                    f"no FreeOS-portable-{plat}-*.zip on {SOURCE_LABEL} "
                    f"for {target}. Download from {GITHUB_RELEASES_HTML}"
                ),
            )
        return UpgradeResult(
            success=False,
            error=(
                "FreeOS no longer upgrades from PyPI or Tencent Cloud mirrors. "
                f"Install a FreeOS desktop build from {GITHUB_RELEASES_HTML}"
            ),
        )
    try:
        staged = stage_desktop_portable(asset.url, version=target, plat=plat)
    except Exception as exc:
        return UpgradeResult(success=False, error=str(exc) or type(exc).__name__)
    return UpgradeResult(
        success=True,
        message=(
            f"staged FreeOS {target} portable ({asset.name}) at {staged}; "
            "restart the desktop app to apply it"
        ),
        installed_version=target,
    )

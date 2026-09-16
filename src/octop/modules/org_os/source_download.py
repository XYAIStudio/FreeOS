"""Download the latest openXYOS source zip for other deployments."""

from __future__ import annotations

import io
import shutil
import zipfile
from pathlib import Path

import httpx

from octop.infra.utils.host_dirs import assert_safe_host_path
from octop.infra.utils.win_utf8 import repair_utf8_mojibake

OPENXYOS_SOURCE_ZIP = "https://github.com/XYAIStudio/openXYOS/archive/refs/heads/main.zip"

_CJK_START = 0x4E00
_CJK_END = 0x9FFF


def _score_decoded_name(text: str) -> int:
    """Prefer real CJK folder names; penalize replacement characters."""
    cjk = sum(1 for ch in text if _CJK_START <= ord(ch) <= _CJK_END)
    return cjk - text.count("\ufffd") * 5


def decode_zip_name(info: zipfile.ZipInfo) -> str:
    """Decode a zip member path as UTF-8 (or GBK) instead of CP437 mojibake.

    GitHub source zips often set the UTF-8 flag. Windows-built zips with
    Chinese folder names frequently omit it and store GBK bytes. Python's
    default ``ZipInfo.filename`` then treats those bytes as CP437 — the same
    class of mojibake as a knowledge-base mount path on zh-CN Windows.
    """
    name = info.filename.replace("\\", "/")
    if info.flag_bits & 0x800:
        return name
    try:
        raw = name.encode("cp437")
    except UnicodeEncodeError:
        return name
    best = name
    best_score = _score_decoded_name(name)
    for encoding in ("utf-8", "gbk", "gb2312", "gb18030"):
        try:
            decoded = raw.decode(encoding)
        except UnicodeDecodeError:
            continue
        score = _score_decoded_name(decoded)
        if score > best_score:
            best_score = score
            best = decoded.replace("\\", "/")
    return best.replace("\\", "/")


def _assert_inside(dest: Path, target: Path) -> None:
    dest_root = dest.resolve()
    resolved = target.resolve()
    if resolved != dest_root and dest_root not in resolved.parents:
        raise ValueError(f"illegal zip path {target}")


def extract_zip_unicode(archive: zipfile.ZipFile, dest: Path) -> None:
    """Extract ``archive`` into ``dest`` preserving Unicode folder names."""
    dest.mkdir(parents=True, exist_ok=True)
    dest_root = dest.resolve()
    for info in archive.infolist():
        name = decode_zip_name(info).lstrip("/")
        if not name or name in {".", "./"}:
            continue
        target = dest_root.joinpath(*Path(name).parts)
        _assert_inside(dest_root, target)
        is_dir = info.is_dir() or name.endswith("/")
        if is_dir:
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with archive.open(info) as src, target.open("wb") as out:
            shutil.copyfileobj(src, out)


def download_openxyos_source(dest: str, *, url: str = OPENXYOS_SOURCE_ZIP) -> str:
    """Save the GitHub main-branch source zip into ``dest`` and extract it.

    Strategy: download ``XYAIStudio/openXYOS`` ``main`` zip (latest published
    tree on the default branch). The zip is extracted into a new
    ``openXYOS-main`` folder under the user-chosen destination. Existing
    files in that destination are not overwritten outside that folder.
    """
    dest = repair_utf8_mojibake(dest)
    target = Path(dest).expanduser()
    assert_safe_host_path(str(target))
    target.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        payload = response.content
    archive = zipfile.ZipFile(io.BytesIO(payload))
    extract_zip_unicode(archive, target)
    zip_path = target / "openXYOS-main.zip"
    zip_path.write_bytes(payload)
    return str(target.resolve())

"""openXYOS source zip must keep Unicode folder names on Windows."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pytest

from octop.modules.org_os.source_download import (
    decode_zip_name,
    download_openxyos_source,
    extract_zip_unicode,
)


def _zip_payload(name: str, payload: bytes = b"hi") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        info = zipfile.ZipInfo(name)
        info.flag_bits |= 0x800
        zf.writestr(info, payload)
    return buf.getvalue()


def _patch_httpx_zip(monkeypatch: pytest.MonkeyPatch, payload: bytes) -> None:
    class _Resp:
        content = payload

        def raise_for_status(self) -> None:
            return None

    class _Client:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> _Client:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def get(self, url: str) -> _Resp:
            assert "openXYOS" in url
            return _Resp()

    import octop.modules.org_os.source_download as mod

    monkeypatch.setattr(mod.httpx, "Client", _Client)  # type: ignore[attr-defined]


def _zip_with_member(name: str, *, utf8_flag: bool, payload: bytes = b"ok") -> zipfile.ZipFile:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        info = zipfile.ZipInfo(name)
        if utf8_flag:
            info.flag_bits |= 0x800
        else:
            info.flag_bits &= ~0x800
        zf.writestr(info, payload)
    return zipfile.ZipFile(io.BytesIO(buf.getvalue()))


def test_decode_zip_name_honors_utf8_flag() -> None:
    archive = _zip_with_member("组织/蓝图/readme.txt", utf8_flag=True)
    info = archive.infolist()[0]
    assert decode_zip_name(info) == "组织/蓝图/readme.txt"


def test_decode_zip_name_recovers_gbk_folder() -> None:
    """Windows zips often store GBK bytes without the UTF-8 flag (CP437 mojibake)."""
    name = "源码/模块/说明.txt"
    info = zipfile.ZipInfo(name.encode("gbk").decode("cp437"))
    info.flag_bits = 0
    assert decode_zip_name(info) == name


def test_extract_zip_unicode_writes_chinese_folders(tmp_path: Path) -> None:
    name = "源码/组织控制台/readme.txt"
    archive = _zip_with_member(name, utf8_flag=True, payload=b"hello")
    dest = tmp_path / "dest"
    extract_zip_unicode(archive, dest)
    written = dest / "源码" / "组织控制台" / "readme.txt"
    assert written.is_file()
    assert written.read_bytes() == b"hello"


def test_download_extracts_unicode_and_keeps_zip(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_httpx_zip(monkeypatch, _zip_payload("openXYOS-main/文档/你好.txt"))
    dest = tmp_path / "下载目录"
    dest.mkdir()
    result = download_openxyos_source(str(dest))
    assert Path(result) == dest.resolve()
    assert (dest / "openXYOS-main" / "文档" / "你好.txt").read_bytes() == b"hi"
    assert (dest / "openXYOS-main.zip").is_file()


def test_download_repairs_mojibake_dest(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Picker ACP/CP1252 dest must land in the real UTF-8 Chinese folder."""
    _patch_httpx_zip(monkeypatch, _zip_payload("openXYOS-main/文档/你好.txt"))
    dest = tmp_path / "下载目录"
    dest.mkdir()
    garbled = str(dest).encode("utf-8").decode("cp1252")
    assert garbled != str(dest)
    result = download_openxyos_source(garbled)
    assert Path(result) == dest.resolve()
    assert (dest / "openXYOS-main" / "文档" / "你好.txt").read_bytes() == b"hi"

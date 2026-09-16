"""Repair UTF-8 text that Windows bridges exposed as Latin-1 / CP1252."""

from __future__ import annotations


def repair_utf8_mojibake(text: str) -> str:
    """Decode *text* when it is UTF-8 bytes mis-read as Latin-1 or CP1252.

    Typical case: ``项目结构.png`` arrives as ``é¡¹ç®ç»æ.png``. Already-valid
    Unicode (including CJK that cannot encode as Latin-1) is returned unchanged.
    """
    if not text:
        return text
    for encoding in ("cp1252", "latin-1"):
        try:
            repaired = text.encode(encoding).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if repaired != text:
            return repaired
    return text

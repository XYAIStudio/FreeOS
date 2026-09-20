#!/usr/bin/env python3
"""Refuse to ship a portable tree that contains user secrets or home data."""

from __future__ import annotations

import re
import sys
from pathlib import Path

_DEEPSEEK_LIKE = re.compile(r"\bsk-[a-fA-F0-9]{32,}\b")
_SKIP_DIR_NAMES = frozenset(
    {
        "node_modules",
        "dist",
        "backend-dist",
        "packages",
        "runtime",
        "__pycache__",
    }
)
_SECRET_FILENAMES = frozenset({".env", "octop.db"})
_SECRET_DIRNAMES = frozenset({".freeos", ".octop"})


def iter_findings(root: Path) -> list[str]:
    hits: list[str] = []
    if not root.is_dir():
        return [f"{root}: staging directory missing"]
    for path in root.rglob("*"):
        parts = set(path.parts)
        if parts & _SKIP_DIR_NAMES:
            continue
        if path.is_dir():
            if path.name in _SECRET_DIRNAMES:
                hits.append(f"{path}: user-home data directory must not be packaged")
            continue
        if path.name in _SECRET_FILENAMES or (
            path.name.startswith(".env.") and path.name != ".env.example"
        ):
            hits.append(f"{path}: secret/user-data file must not be packaged")
            continue
        if path.suffix.lower() in {".db", ".sqlite", ".sqlite3"}:
            hits.append(f"{path}: sqlite database must not be packaged")
            continue
        if (
            path.suffix.lower()
            not in {
                ".env",
                ".example",
                ".json",
                ".txt",
                ".md",
                ".sh",
                ".bat",
                ".cmd",
                ".ps1",
                ".yml",
                ".yaml",
            }
            and path.name != "env"
        ):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if _DEEPSEEK_LIKE.search(text):
            hits.append(f"{path}: DeepSeek-like API key must not be packaged")
    return hits


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        sys.stderr.write("usage: scan_packaged_secrets.py <staging-dir>\n")
        return 2
    root = Path(argv[1])
    hits = iter_findings(root)
    if hits:
        sys.stderr.write("packaged tree contains secrets / user data:\n")
        for hit in hits:
            sys.stderr.write(f"  {hit}\n")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

#!/usr/bin/env python3
"""Print whether a FreeOS tag must be a GitHub prerelease.

After a leading ``v`` is stripped, PEP 440 pre-releases match
``(a|b|rc)[0-9]+$`` or ``.dev[0-9]+$``. ``v0.1.0rc1`` is a prerelease;
``v0.1.0`` is not. Output is a GitHub Actions assignment: ``prerelease=true``.
"""

from __future__ import annotations

import re
import sys

_PRE = re.compile(r"(?:(?:a|b|rc)[0-9]+|\.dev[0-9]+)$")


def is_release_prerelease(tag: str) -> bool:
    version = tag[1:] if tag.startswith("v") else tag
    return _PRE.search(version) is not None


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: release_prerelease.py <tag>", file=sys.stderr)
        return 2
    flag = "true" if is_release_prerelease(argv[1]) else "false"
    print(f"prerelease={flag}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

#!/usr/bin/env python3
"""Write GNU SHA256SUMS for FreeOS GitHub Release artifacts.

Covers desktop installers (``FreeOS-desktop-*``), portable zips
(``FreeOS-portable-*.zip``), FnOS packages (``FreeOS-fnos-*.fpk``),
wheels (``*.whl``), and sdists (``freeos-*.tar.gz``). ``SHA256SUMS``
itself is not hashed.

    python3 scripts/write_sha256sums.py dist/
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path


def is_checksum_target(name: str) -> bool:
    """Return whether ``name`` is a desktop installer, zip, FnOS package, wheel, or sdist."""
    if not name or name == "SHA256SUMS" or name.startswith("."):
        return False
    if name.startswith("FreeOS-desktop-"):
        return True
    if name.startswith("FreeOS-portable-") and name.endswith(".zip"):
        return True
    if name.startswith("FreeOS-fnos-") and name.endswith(".fpk"):
        return True
    if name.endswith(".whl"):
        return True
    # Linux desktop packages are FreeOS-desktop-*.tar.gz, already matched.
    return name.startswith("freeos-") and name.endswith(".tar.gz")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_sha256sums(directory: Path) -> Path:
    """Write ``directory/SHA256SUMS`` and return that path.

    Lines use the GNU coreutils form ``<hex>  <filename>`` so
    ``sha256sum -c SHA256SUMS`` can verify them. Names are sorted.
    """
    if not directory.is_dir():
        raise SystemExit(f"not a directory: {directory}")
    # Sort by the filename string. pathlib.Path ordering on Windows is
    # case-insensitive, which would place freeos-* ahead of FreeOS-*.
    files = sorted(
        (path for path in directory.iterdir() if path.is_file() and is_checksum_target(path.name)),
        key=lambda path: path.name,
    )
    if not files:
        raise SystemExit(f"no desktop, zip, wheel, or sdist artifacts in {directory}")
    lines = [f"{_sha256(path)}  {path.name}" for path in files]
    destination = directory / "SHA256SUMS"
    destination.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return destination


def covered_names(checksum_file: Path) -> set[str]:
    names: set[str] = set()
    text = checksum_file.read_text(encoding="utf-8")
    for line in text.splitlines():
        if not line.strip():
            continue
        _digest, _sep, name = line.partition("  ")
        if name:
            names.add(name)
    return names


def missing_targets(checksum_file: Path, remote_names: list[str]) -> list[str]:
    covered = covered_names(checksum_file)
    return [name for name in remote_names if is_checksum_target(name) and name not in covered]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write SHA256SUMS for FreeOS release artifacts.")
    parser.add_argument("directory", nargs="?", type=Path)
    parser.add_argument(
        "--is-target",
        metavar="NAME",
        help="Exit 0 when NAME should be covered, else 1.",
    )
    parser.add_argument(
        "--missing-from",
        type=Path,
        metavar="SHA256SUMS",
        help="Read release asset names on stdin. Print targets absent from the file "
        "and exit 3 when any are missing.",
    )
    args = parser.parse_args(argv)
    if args.is_target is not None:
        return 0 if is_checksum_target(args.is_target) else 1
    if args.missing_from is not None:
        remote = [line.strip() for line in sys.stdin if line.strip()]
        missing = missing_targets(args.missing_from, remote)
        if missing:
            sys.stdout.write("\n".join(missing) + "\n")
            return 3
        return 0
    if args.directory is None:
        parser.error("directory is required")
    write_sha256sums(args.directory)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

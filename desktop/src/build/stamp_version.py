#!/usr/bin/env python3
"""Stamp the FreeOS version into Wails desktop metadata copies."""

from __future__ import annotations

import argparse
import json
import plistlib
import re
import shutil
import sys
from pathlib import Path

_MANIFEST_IDENTITY = re.compile(
    r'(<assemblyIdentity\b[^>]*\bname="com\.xyaistudio\.freeos"[^>]*\bversion=")[^"]+(")',
    re.IGNORECASE,
)
# 0.1.0rc1 / 0.1.0a1 / 0.1.0b1 / 0.1.0.dev1 → release core 0.1.0.
_PEP440_CORE = re.compile(r"^(?P<core>\d+(?:\.\d+)*)(?:(?:a|b|rc)\d+|\.dev\d+)?$")
# wails_tools.nsh fallback INFO_PRODUCTVERSION, plus the extra ".0" NSIS appends.
_NSIS_DEV_FALLBACK = "0.0.2.0"


def should_stamp(version: str) -> bool:
    """Skip placeholders that are not a product version (NSIS needs x.y.z)."""
    return bool(version) and version != "dev"


def four_part_version(version: str) -> str | None:
    """Windows assemblyIdentity requires four numeric components."""
    parts = version.split(".")
    if not parts or not all(p.isdigit() for p in parts):
        return None
    while len(parts) < 4:
        parts.append("0")
    return ".".join(parts[:4])


def release_core(version: str) -> str | None:
    """Numeric core of a PEP 440 version, dropping a/b/rc/.dev suffixes."""
    if not should_stamp(version):
        return None
    match = _PEP440_CORE.fullmatch(version)
    if match is None:
        return None
    return match.group("core")


def nsis_vi_version(version: str) -> str:
    """Four integers for NSIS VIProductVersion / VIFileVersion.

    ``0.1.0`` stays ``0.1.0.0``. ``0.1.0rc1`` uses the same numeric fields;
    the installer display string keeps the prerelease text separately.
    ``dev`` matches the local makensis fallback in ``wails_tools.nsh``.
    """
    if not should_stamp(version):
        return _NSIS_DEV_FALLBACK
    core = release_core(version)
    if core is None:
        raise SystemExit(f"cannot map {version!r} to an NSIS version")
    dotted = four_part_version(core)
    if dotted is None:
        raise SystemExit(f"cannot map {version!r} to an NSIS version")
    return dotted


def write_nsis_numeric(version: str, dest: Path) -> None:
    """Write the ``!define`` included by ``project.nsi``."""
    numeric = nsis_vi_version(version)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        f'!define INFO_PRODUCTVERSION_NUMERIC "{numeric}"\n',
        encoding="utf-8",
    )


def stamp_plist(path: Path, version: str) -> None:
    if not should_stamp(version):
        return
    data = plistlib.loads(path.read_bytes())
    data["CFBundleVersion"] = version
    data["CFBundleShortVersionString"] = version
    path.write_bytes(plistlib.dumps(data))


def stamp_info_json(src: Path, dest: Path, version: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src.resolve() != dest.resolve():
        shutil.copyfile(src, dest)
    if not should_stamp(version):
        return
    data = json.loads(dest.read_text(encoding="utf-8"))
    # go-winres parses file_version as integers. A prerelease string such as
    # 0.1.0rc1 stays on the ProductVersion display field only.
    file_version = version if four_part_version(version) is not None else nsis_vi_version(version)
    data["fixed"]["file_version"] = file_version
    data["info"]["0000"]["ProductVersion"] = version
    dest.write_text(json.dumps(data, indent=4) + "\n", encoding="utf-8")


def stamp_manifest(src: Path, dest: Path, version: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src.resolve() != dest.resolve():
        shutil.copyfile(src, dest)
    if not should_stamp(version):
        return
    dotted = four_part_version(version)
    if dotted is None:
        core = release_core(version)
        dotted = four_part_version(core) if core is not None else None
    if dotted is None:
        return
    text = dest.read_text(encoding="utf-8")
    updated, n = _MANIFEST_IDENTITY.subn(rf"\g<1>{dotted}\2", text, count=1)
    if n != 1:
        raise SystemExit(f"FreeOS assemblyIdentity not found in {dest}")
    dest.write_text(updated, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    plist_p = sub.add_parser("plist", help="Set CFBundleVersion keys on a copied Info.plist")
    plist_p.add_argument("path", type=Path)
    plist_p.add_argument("version")

    json_p = sub.add_parser("json", help="Copy windows/info.json and set file/product version")
    json_p.add_argument("src", type=Path)
    json_p.add_argument("dest", type=Path)
    json_p.add_argument("version")

    man_p = sub.add_parser("manifest", help="Copy wails.exe.manifest and set assembly version")
    man_p.add_argument("src", type=Path)
    man_p.add_argument("dest", type=Path)
    man_p.add_argument("version")

    nsis_p = sub.add_parser(
        "nsis-numeric",
        help="Write product_version.nsh with a four-integer VIProductVersion",
    )
    nsis_p.add_argument("version")
    nsis_p.add_argument("dest", type=Path)

    args = parser.parse_args(argv)
    if args.cmd == "plist":
        stamp_plist(args.path, args.version)
    elif args.cmd == "json":
        stamp_info_json(args.src, args.dest, args.version)
    elif args.cmd == "nsis-numeric":
        write_nsis_numeric(args.version, args.dest)
    else:
        stamp_manifest(args.src, args.dest, args.version)
    return 0


if __name__ == "__main__":
    sys.exit(main())

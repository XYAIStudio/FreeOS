"""Register discovered host-app artifacts into FreeOS without writing back."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from octop.infra.connectors.custom_mcp import normalize_server_spec
from octop.infra.errors import ErrorCode, OctopError
from octop.infra.host_apps.scan import HostAppReport, scan_host_apps
from octop.infra.skills.skill_package_store import SkillPackageStore
from octop.infra.skills.skill_packages import read_skill_directory
from octop.infra.utils.host_dirs import assert_safe_host_path

_SERVER_NAME_RE = re.compile(r"[^A-Za-z0-9_-]+")


def _reports_by_id(home: Path | None) -> dict[str, HostAppReport]:
    return {row.id: row for row in scan_host_apps(home=home)}


def _find_item(report: HostAppReport, kind: str, item_id: str) -> dict[str, Any]:
    bucket = {"skill": report.skills, "plugin": report.plugins, "mcp": report.mcp}[kind]
    for item in bucket:
        if str(item.get("id")) == item_id:
            return item
    raise OctopError(ErrorCode.NOT_FOUND, f"{kind} {item_id!r} was not found on {report.id}")


def _safe_mcp_name(host_id: str, name: str) -> str:
    raw = _SERVER_NAME_RE.sub("-", f"{host_id}-{name}").strip("-")
    return raw[:64] or "imported-mcp"


def import_mcp(
    *,
    host_id: str,
    item_id: str,
    connector_service: Any,
    user_id: int,
    home: Path | None = None,
) -> dict[str, Any]:
    report = _reports_by_id(home).get(host_id)
    if report is None:
        raise OctopError(ErrorCode.NOT_FOUND, f"unknown host app {host_id!r}")
    item = _find_item(report, "mcp", item_id)
    name = _safe_mcp_name(host_id, str(item.get("id") or "mcp"))
    raw: dict[str, Any] = {
        "transport": "streamable_http" if item.get("url") else "stdio",
        "enabled": True,
        "display_name": f"{report.label}: {item.get('name') or item_id}",
    }
    if item.get("url"):
        raw["url"] = item["url"]
    else:
        raw["command"] = item.get("command") or ""
        raw["args"] = item.get("args") or []
    spec = normalize_server_spec(name, raw)
    existing = dict(connector_service.get_custom_servers(user_id))
    if name in existing:
        raise OctopError(
            ErrorCode.CONNECTOR_NAME_TAKEN,
            f"MCP server {name!r} is already registered in FreeOS",
        )
    existing[name] = spec
    connector_service.put_custom_servers(user_id, existing)
    return {"kind": "mcp", "name": name, "host": host_id, "source_path": item.get("source_path")}


def import_skill(
    *,
    host_id: str,
    item_id: str,
    store: SkillPackageStore,
    created_by: str,
    home: Path | None = None,
) -> dict[str, Any]:
    report = _reports_by_id(home).get(host_id)
    if report is None:
        raise OctopError(ErrorCode.NOT_FOUND, f"unknown host app {host_id!r}")
    item = _find_item(report, "skill", item_id)
    source = assert_safe_host_path(str(item.get("path") or ""))
    files = read_skill_directory(source)
    package_name = f"{report.label} / {item.get('name') or item_id}"
    row = store.create(
        name=package_name[:80],
        description=f"Imported from {report.label} (read-only source {source})",
        created_by=created_by,
    )
    store.write_skill(row.id, str(item.get("id") or source.name), files)
    return {
        "kind": "skill",
        "package_id": row.id,
        "slug": item.get("id"),
        "host": host_id,
        "source_path": str(source),
    }


def import_plugin(
    *,
    host_id: str,
    item_id: str,
    plugin_manager: Any,
    store: SkillPackageStore,
    created_by: str,
    home: Path | None = None,
) -> dict[str, Any]:
    report = _reports_by_id(home).get(host_id)
    if report is None:
        raise OctopError(ErrorCode.NOT_FOUND, f"unknown host app {host_id!r}")
    item = _find_item(report, "plugin", item_id)
    source = assert_safe_host_path(str(item.get("path") or ""))
    fmt = str(item.get("format") or "")
    if fmt == "plugin.yaml":
        loaded = plugin_manager.install_path(source, force=False)
        return {
            "kind": "plugin",
            "plugin_id": loaded.manifest.id,
            "host": host_id,
            "source_path": str(source),
        }
    # Claude-style plugins: copy bundled skills into a FreeOS skill package.
    skills_dir = source / "skills"
    imported: list[str] = []
    if skills_dir.is_dir():
        row = store.create(
            name=f"{report.label} / {item.get('name') or item_id}"[:80],
            description=f"Skills from {report.label} plugin (source left untouched)",
            created_by=created_by,
        )
        for child in sorted(skills_dir.iterdir()):
            if not child.is_dir() or not (child / "SKILL.md").is_file():
                continue
            store.write_skill(row.id, child.name, read_skill_directory(child))
            imported.append(child.name)
        return {
            "kind": "plugin",
            "format": fmt,
            "package_id": row.id,
            "skills": imported,
            "host": host_id,
            "source_path": str(source),
        }
    raise OctopError(
        ErrorCode.PLUGIN_INVALID_ARCHIVE,
        "this plugin is not a FreeOS plugin.yaml package and has no SKILL.md tree to import",
    )

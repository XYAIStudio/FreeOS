"""Read-only scan of well-known local AI desktop/CLI install layouts.

Only paths documented by the vendor (or widely confirmed on Windows/macOS/Linux)
are probed. Missing software yields ``installed=False`` and empty catalogs.
The scan never writes, deletes, or rewrites third-party files.
"""

from __future__ import annotations

import json
import os
import shutil
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

try:
    import tomllib
except ImportError:  # pragma: no cover - Python 3.12+ always has tomllib
    tomllib = None  # type: ignore[assignment]

import yaml


def _home(home: Path | None) -> Path:
    return Path(home) if home is not None else Path.home()


def _env_dir(name: str) -> Path | None:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return None
    path = Path(raw).expanduser()
    return path if path.is_dir() else None


def _roaming() -> Path | None:
    raw = os.environ.get("APPDATA", "").strip()
    if raw:
        return Path(raw)
    if os.name == "nt":
        return Path.home() / "AppData" / "Roaming"
    return None


def _local_appdata() -> Path | None:
    raw = os.environ.get("LOCALAPPDATA", "").strip()
    if raw:
        return Path(raw)
    if os.name == "nt":
        return Path.home() / "AppData" / "Local"
    return None


def _macos_support(*parts: str) -> Path:
    return Path.home() / "Library" / "Application Support" / Path(*parts)


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def _read_toml(path: Path) -> Any:
    if tomllib is None:
        return None
    try:
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, tomllib.TOMLDecodeError):
        return None


def _read_yaml(path: Path) -> Any:
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, yaml.YAMLError):
        return None


def _redact_env(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    return {str(key): "***" for key in raw if str(key).strip()}


def _skill_name(skill_dir: Path) -> str:
    manifest = skill_dir / "SKILL.md"
    if not manifest.is_file():
        return skill_dir.name
    text = ""
    try:
        text = manifest.read_text(encoding="utf-8", errors="replace")[:4000]
    except OSError:
        return skill_dir.name
    for line in text.splitlines():
        if line.startswith("name:"):
            value = line.split(":", 1)[1].strip().strip("\"'")
            if value:
                return value
    return skill_dir.name


def _scan_skill_tree(root: Path, *, limit: int = 80) -> list[dict[str, Any]]:
    if not root.is_dir():
        return []
    out: list[dict[str, Any]] = []
    try:
        children = sorted(root.iterdir(), key=lambda p: p.name.lower())
    except OSError:
        return []
    for child in children:
        if len(out) >= limit:
            break
        if not child.is_dir() or child.name.startswith("."):
            continue
        if not (child / "SKILL.md").is_file():
            continue
        out.append(
            {
                "id": child.name,
                "name": _skill_name(child),
                "path": str(child),
                "kind": "skill",
            }
        )
    return out


def _scan_claude_plugins(root: Path, *, limit: int = 40) -> list[dict[str, Any]]:
    if not root.is_dir():
        return []
    out: list[dict[str, Any]] = []
    try:
        children = list(root.rglob("plugin.json"))
    except OSError:
        return []
    for manifest in children[:200]:
        if len(out) >= limit:
            break
        if manifest.name != "plugin.json":
            continue
        if manifest.parent.name != ".claude-plugin":
            continue
        plugin_root = manifest.parent.parent
        data = _read_json(manifest)
        name = plugin_root.name
        if isinstance(data, dict):
            name = str(data.get("displayName") or data.get("name") or name)
        out.append(
            {
                "id": plugin_root.name,
                "name": name,
                "path": str(plugin_root),
                "kind": "plugin",
                "format": "claude-plugin",
            }
        )
    return out


def _scan_freeos_plugins(root: Path, *, limit: int = 40) -> list[dict[str, Any]]:
    if not root.is_dir():
        return []
    out: list[dict[str, Any]] = []
    try:
        children = sorted(root.iterdir(), key=lambda p: p.name.lower())
    except OSError:
        return []
    for child in children:
        if len(out) >= limit:
            break
        if not child.is_dir():
            continue
        manifest = child / "plugin.yaml"
        if not manifest.is_file():
            continue
        out.append(
            {
                "id": child.name,
                "name": child.name,
                "path": str(child),
                "kind": "plugin",
                "format": "plugin.yaml",
            }
        )
    return out


def _mcp_item(
    name: str,
    spec: dict[str, Any],
    *,
    source_path: str,
) -> dict[str, Any]:
    command = str(spec.get("command") or "").strip()
    url = str(spec.get("url") or spec.get("serverUrl") or "").strip()
    transport = str(spec.get("transport") or spec.get("type") or "").strip()
    if not transport:
        transport = "streamable_http" if url else "stdio"
    if transport in {"http", "sse"}:
        transport = "streamable_http"
    args = spec.get("args")
    return {
        "id": name,
        "name": name,
        "kind": "mcp",
        "transport": transport,
        "command": command,
        "args": [str(item) for item in args] if isinstance(args, list) else [],
        "url": url,
        "env_keys": sorted(_redact_env(spec.get("env"))),
        "source_path": source_path,
        "enabled": spec.get("disabled") is not True and spec.get("enabled", True) is not False,
    }


def _mcp_from_map(raw: Any, *, source_path: str) -> list[dict[str, Any]]:
    if not isinstance(raw, dict):
        return []
    servers = raw.get("mcpServers")
    if servers is None and all(isinstance(v, dict) for v in raw.values()):
        servers = raw
    if not isinstance(servers, dict):
        return []
    out: list[dict[str, Any]] = []
    for name, spec in servers.items():
        if not isinstance(spec, dict):
            continue
        key = str(name).strip()
        if not key:
            continue
        out.append(_mcp_item(key, spec, source_path=source_path))
    return out


def _mcp_from_list(raw: Any, *, source_path: str) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for spec in raw:
        if not isinstance(spec, dict):
            continue
        name = str(spec.get("name") or spec.get("id") or "").strip()
        if not name:
            continue
        out.append(_mcp_item(name, spec, source_path=source_path))
    return out


def _mcp_from_json_file(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    data = _read_json(path)
    if not isinstance(data, dict):
        return []
    items = _mcp_from_map(data, source_path=str(path))
    if items:
        return items
    nested = data.get("mcpServers")
    if isinstance(nested, list):
        return _mcp_from_list(nested, source_path=str(path))
    return []


def _mcp_from_continue_yaml(path: Path) -> list[dict[str, Any]]:
    data = _read_yaml(path)
    if not isinstance(data, dict):
        return []
    return _mcp_from_list(data.get("mcpServers"), source_path=str(path))


def _mcp_from_codex_toml(path: Path) -> list[dict[str, Any]]:
    data = _read_toml(path)
    if not isinstance(data, dict):
        return []
    block = data.get("mcp_servers") or data.get("mcpServers")
    if not isinstance(block, dict):
        return []
    out: list[dict[str, Any]] = []
    for name, spec in block.items():
        if not isinstance(spec, dict):
            continue
        out.append(_mcp_item(str(name), spec, source_path=str(path)))
    return out


def _claude_json_mcp(path: Path) -> list[dict[str, Any]]:
    data = _read_json(path)
    if not isinstance(data, dict):
        return []
    items = _mcp_from_map(data, source_path=str(path))
    projects = data.get("projects")
    if isinstance(projects, dict):
        for proj in projects.values():
            if isinstance(proj, dict):
                items.extend(_mcp_from_map(proj, source_path=str(path)))
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for item in items:
        key = str(item.get("id") or "")
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


@dataclass
class HostAppReport:
    id: str
    label: str
    installed: bool
    paths_checked: list[str] = field(default_factory=list)
    paths_found: list[str] = field(default_factory=list)
    skills: list[dict[str, Any]] = field(default_factory=list)
    plugins: list[dict[str, Any]] = field(default_factory=list)
    mcp: list[dict[str, Any]] = field(default_factory=list)
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _mark_found(report: HostAppReport, path: Path) -> None:
    text = str(path)
    if path.exists():
        report.installed = True
        if text not in report.paths_found:
            report.paths_found.append(text)


def _check(report: HostAppReport, path: Path) -> Path:
    report.paths_checked.append(str(path))
    _mark_found(report, path)
    return path


def _scan_ollama(home: Path) -> HostAppReport:
    report = HostAppReport(
        id="ollama",
        label="Ollama",
        installed=False,
        notes="Ollama stores local models, not Agent Skills / plugins / MCP servers.",
    )
    _check(report, home / ".ollama")
    if shutil.which("ollama"):
        report.installed = True
        report.paths_found.append("ollama")
    return report


def _claude_desktop_config_candidates() -> list[Path]:
    out: list[Path] = []
    roaming = _roaming()
    if roaming is not None:
        out.append(roaming / "Claude" / "claude_desktop_config.json")
    local = _local_appdata()
    if local is not None:
        packages = local / "Packages"
        if packages.is_dir():
            try:
                for pkg in packages.iterdir():
                    if not pkg.name.lower().startswith("claude"):
                        continue
                    out.append(
                        pkg / "LocalCache" / "Roaming" / "Claude" / "claude_desktop_config.json"
                    )
            except OSError:
                pass
    out.append(_macos_support("Claude", "claude_desktop_config.json"))
    return out


def _scan_claude_desktop(home: Path) -> HostAppReport:
    del home
    report = HostAppReport(id="claude-desktop", label="Claude Desktop", installed=False)
    for path in _claude_desktop_config_candidates():
        _check(report, path)
        report.mcp.extend(_mcp_from_json_file(path))
    return report


def _scan_claude_code(home: Path) -> HostAppReport:
    report = HostAppReport(id="claude-code", label="Claude Code", installed=False)
    root = _env_dir("CLAUDE_CONFIG_DIR") or (home / ".claude")
    _check(report, root)
    _check(report, home / ".claude.json")
    report.skills.extend(_scan_skill_tree(root / "skills"))
    report.plugins.extend(_scan_claude_plugins(root / "plugins"))
    report.mcp.extend(_claude_json_mcp(home / ".claude.json"))
    report.mcp.extend(_mcp_from_json_file(root / ".mcp.json"))
    report.mcp.extend(_mcp_from_json_file(root / "mcp.json"))
    return report


def _scan_codex(home: Path) -> HostAppReport:
    report = HostAppReport(id="codex", label="OpenAI Codex", installed=False)
    root = _env_dir("CODEX_HOME") or (home / ".codex")
    _check(report, root)
    _check(report, home / ".agents" / "skills")
    report.skills.extend(_scan_skill_tree(home / ".agents" / "skills"))
    report.skills.extend(_scan_skill_tree(root / "skills"))
    report.mcp.extend(_mcp_from_codex_toml(root / "config.toml"))
    report.plugins.extend(_scan_freeos_plugins(root / "plugins"))
    return report


def _scan_workbuddy(home: Path) -> HostAppReport:
    report = HostAppReport(id="workbuddy", label="WorkBuddy", installed=False)
    root = _env_dir("WORKBUDDY_CONFIG_DIR") or (home / ".workbuddy")
    _check(report, root)
    report.mcp.extend(_mcp_from_json_file(root / "mcp.json"))
    report.mcp.extend(_mcp_from_json_file(root / ".mcp.json"))
    report.skills.extend(_scan_skill_tree(root / "skills"))
    report.plugins.extend(_scan_claude_plugins(root / "plugins"))
    report.plugins.extend(_scan_freeos_plugins(root / "plugins"))
    return report


def _scan_codebuddy(home: Path) -> HostAppReport:
    report = HostAppReport(
        id="codebuddy",
        label="Tencent CodeBuddy",
        installed=False,
        notes="Related Tencent workbench; scanned only when its documented config dir exists.",
    )
    root = home / ".codebuddy"
    _check(report, root)
    _check(report, home / ".codebuddy.json")
    report.mcp.extend(_mcp_from_json_file(root / ".mcp.json"))
    report.mcp.extend(_mcp_from_json_file(root / "mcp.json"))
    report.mcp.extend(_claude_json_mcp(home / ".codebuddy.json"))
    report.skills.extend(_scan_skill_tree(root / "skills"))
    return report


def _scan_cursor(home: Path) -> HostAppReport:
    report = HostAppReport(id="cursor", label="Cursor", installed=False)
    root = home / ".cursor"
    _check(report, root)
    report.mcp.extend(_mcp_from_json_file(root / "mcp.json"))
    report.skills.extend(_scan_skill_tree(root / "skills"))
    # Extensions are VS Code-compatible add-ons, not FreeOS plugin.yaml packages.
    return report


def _scan_continue(home: Path) -> HostAppReport:
    report = HostAppReport(id="continue", label="Continue", installed=False)
    root = _env_dir("CONTINUE_GLOBAL_DIR") or (home / ".continue")
    _check(report, root)
    report.mcp.extend(_mcp_from_continue_yaml(root / "config.yaml"))
    data = _read_json(root / "config.json")
    if isinstance(data, dict):
        experimental = data.get("experimental")
        if isinstance(experimental, dict):
            servers = experimental.get("modelContextProtocolServers")
            if isinstance(servers, list):
                for spec in servers:
                    if not isinstance(spec, dict):
                        continue
                    transport = spec.get("transport")
                    body = transport if isinstance(transport, dict) else spec
                    name = str(spec.get("name") or body.get("name") or "").strip()
                    if not name:
                        name = str(body.get("command") or "continue-mcp")
                    report.mcp.append(_mcp_item(name, body, source_path=str(root / "config.json")))
    mcp_dir = root / "mcpServers"
    if mcp_dir.is_dir():
        report.installed = True
        try:
            for child in sorted(mcp_dir.iterdir()):
                if child.suffix.lower() == ".json":
                    report.mcp.extend(_mcp_from_json_file(child))
                elif child.suffix.lower() in {".yaml", ".yml"}:
                    report.mcp.extend(_mcp_from_continue_yaml(child))
        except OSError:
            pass
    report.skills.extend(_scan_skill_tree(root / "skills"))
    return report


def _scan_windsurf(home: Path) -> HostAppReport:
    report = HostAppReport(id="windsurf", label="Windsurf", installed=False)
    path = home / ".codeium" / "windsurf" / "mcp_config.json"
    _check(report, path.parent)
    _check(report, path)
    report.mcp.extend(_mcp_from_json_file(path))
    return report


def _scan_cline() -> HostAppReport:
    report = HostAppReport(
        id="cline",
        label="Cline",
        installed=False,
        notes="Detected only when the VS Code / Cursor globalStorage settings file exists.",
    )
    roaming = _roaming()
    if roaming is None:
        return report
    for product in ("Code", "Cursor", "Code - Insiders", "VSCodium"):
        path = (
            roaming
            / product
            / "User"
            / "globalStorage"
            / "saoudrizwan.claude-dev"
            / "settings"
            / "cline_mcp_settings.json"
        )
        _check(report, path)
        report.mcp.extend(_mcp_from_json_file(path))
    return report


def _scan_vscode() -> HostAppReport:
    report = HostAppReport(
        id="vscode",
        label="Visual Studio Code",
        installed=False,
        notes="Official user MCP file only (skills/plugins are not a VS Code layout).",
    )
    roaming = _roaming()
    if roaming is None:
        return report
    path = roaming / "Code" / "User" / "mcp.json"
    _check(report, path)
    report.mcp.extend(_mcp_from_json_file(path))
    return report


def scan_host_apps(*, home: Path | None = None) -> list[HostAppReport]:
    """Probe documented local AI app paths. Read-only."""
    root = _home(home)
    reports = [
        _scan_ollama(root),
        _scan_claude_desktop(root),
        _scan_claude_code(root),
        _scan_codex(root),
        _scan_workbuddy(root),
        _scan_codebuddy(root),
        _scan_cursor(root),
        _scan_continue(root),
        _scan_windsurf(root),
        _scan_cline(),
        _scan_vscode(),
    ]
    return reports

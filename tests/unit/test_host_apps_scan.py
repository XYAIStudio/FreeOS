from __future__ import annotations

import json
from pathlib import Path

from octop.infra.host_apps.scan import scan_host_apps


def test_scan_empty_home_is_graceful(tmp_path: Path) -> None:
    reports = {row.id: row for row in scan_host_apps(home=tmp_path)}
    assert "ollama" in reports
    assert "claude-code" in reports
    assert "workbuddy" in reports
    assert reports["claude-code"].installed is False
    assert reports["claude-code"].skills == []
    assert reports["workbuddy"].mcp == []


def test_scan_does_not_write(tmp_path: Path) -> None:
    before = list(tmp_path.rglob("*"))
    scan_host_apps(home=tmp_path)
    assert list(tmp_path.rglob("*")) == before


def test_scan_claude_code_skills_and_mcp(tmp_path: Path) -> None:
    claude = tmp_path / ".claude"
    skill = claude / "skills" / "demo"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text("---\nname: Demo\n---\nbody\n", encoding="utf-8")
    (tmp_path / ".claude.json").write_text(
        json.dumps({"mcpServers": {"notes": {"command": "npx", "args": ["-y", "demo"]}}}),
        encoding="utf-8",
    )
    report = next(row for row in scan_host_apps(home=tmp_path) if row.id == "claude-code")
    assert report.installed is True
    assert [item["id"] for item in report.skills] == ["demo"]
    assert report.mcp[0]["id"] == "notes"
    assert report.mcp[0]["command"] == "npx"
    assert (skill / "SKILL.md").read_text(encoding="utf-8").startswith("---")


def test_scan_cursor_and_workbuddy_mcp(tmp_path: Path) -> None:
    cursor = tmp_path / ".cursor"
    cursor.mkdir()
    (cursor / "mcp.json").write_text(
        json.dumps({"mcpServers": {"github": {"url": "https://example.com/mcp"}}}),
        encoding="utf-8",
    )
    workbuddy = tmp_path / ".workbuddy"
    workbuddy.mkdir()
    (workbuddy / "mcp.json").write_text(
        json.dumps({"mcpServers": {"wecom": {"command": "uvx", "args": ["wecom-bot-mcp-server"]}}}),
        encoding="utf-8",
    )
    reports = {row.id: row for row in scan_host_apps(home=tmp_path)}
    assert reports["cursor"].installed is True
    assert reports["cursor"].mcp[0]["url"] == "https://example.com/mcp"
    assert reports["workbuddy"].mcp[0]["id"] == "wecom"


def test_scan_codex_toml_and_agents_skills(tmp_path: Path) -> None:
    codex = tmp_path / ".codex"
    codex.mkdir()
    (codex / "config.toml").write_text(
        '[mcp_servers.docs]\ncommand = "uvx"\nargs = ["docs-mcp"]\n',
        encoding="utf-8",
    )
    skill = tmp_path / ".agents" / "skills" / "office"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text("# office\n", encoding="utf-8")
    report = next(row for row in scan_host_apps(home=tmp_path) if row.id == "codex")
    assert report.installed is True
    assert report.mcp[0]["id"] == "docs"
    assert [item["id"] for item in report.skills] == ["office"]

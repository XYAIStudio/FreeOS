"""``freeos org export-standalone`` writes a commercializable openXYOS pack."""

from __future__ import annotations

import json
from pathlib import Path

from click.testing import CliRunner

from octop.cli.main import cli

_SHARED = [
    "announcements",
    "organization",
    "employees",
    "skills",
    "governance",
    "knowledge",
    "tasks",
    "reflections",
    "settings",
    "agents",
    "workspace",
]


def _export(
    tmp_path: Path, *extra: str, dest_name: str = "openxyos-web"
) -> tuple[Path, dict[str, object]]:
    out = tmp_path / dest_name
    runner = CliRunner()
    result = runner.invoke(cli, ["org", "export-standalone", "--out", str(out), *extra])
    assert result.exit_code == 0, result.output
    return out, json.loads(result.output)


def _assert_org_ui_slice(slice_root: Path) -> None:
    app = (slice_root / "src" / "App.tsx").read_text(encoding="utf-8")
    for name in (
        "AnnouncementPage",
        "OrgChartPage",
        "EmployeesPage",
        "EmployeeDetailPage",
        "SkillsPage",
        "GovernancePage",
        "KnowledgePage",
        "TasksPage",
        "TaskDetailPage",
        "ReflectionsPage",
        "SettingsPage",
        "AgentsPage",
        "WorkspacePage",
        "CoveragePage",
        "createLocalJwtBridge",
        "HostDeepLinkPage",
    ):
        assert name in app
    assert 'from "org-ui"' in app
    assert 'path="/chat"' in app
    assert 'path="/coverage"' in app
    readme = (slice_root / "README.md").read_text(encoding="utf-8")
    assert "AnnouncementPage" in readme
    assert "WorkspacePage" in readme
    assert "openxyos.standalone.jwt" in readme
    assert "docker compose" in readme
    assert "FREEOS_UPSTREAM" in readme
    assert "FreeOS / Octop agent chat" in readme or "工作室智能体对话" in readme
    assert (slice_root / "src" / "org-ui" / "pages" / "workspace" / "WorkspacePage.tsx").is_file()
    assert (slice_root / "src" / "org-ui" / "bridges" / "localJwt.ts").is_file()
    assert list((slice_root / "src" / "org-ui").rglob("*.test.tsx")) == []
    license_text = (slice_root / "LICENSE").read_text(encoding="utf-8")
    assert "MIT License" in license_text
    deeplink = (slice_root / "src" / "shell" / "HostDeepLinkPage.tsx").read_text(encoding="utf-8")
    assert "second agent runtime" in deeplink
    coverage = (slice_root / "src" / "shell" / "CoveragePage.tsx").read_text(encoding="utf-8")
    assert "modules.json" in coverage


def test_export_standalone_default_is_full_source_pack(tmp_path: Path) -> None:
    out, payload = _export(tmp_path)
    assert payload["mode"] == "full"
    assert payload["modules"] == _SHARED
    assert payload["auth"] == "standalone local JWT (openxyos.standalone.jwt)"
    assert payload["licenses"]["openxyos_tree"] == "Apache-2.0"
    assert payload["licenses"]["host_bridge_slice"] == "MIT"
    assert "freeos_agent_chat" in payload["omissions"]
    assert (out / "openxyos" / "frontend" / "src" / "App.tsx").is_file()
    assert (out / "openxyos" / "backend" / "server.ts").is_file()
    assert (out / "openxyos" / "package.json").is_file()
    apache = (out / "openxyos" / "LICENSE").read_text(encoding="utf-8")
    assert "Apache License" in apache
    app = (out / "openxyos" / "frontend" / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "ContractPage" in app
    assert "AttendancePage" in app
    assert "ChatPage" in app
    readme = (out / "README.md").read_text(encoding="utf-8")
    assert "Apache-2.0" in readme
    assert "MIT" in readme
    assert "npm ci" in readme
    assert "FREEOS_UPSTREAM" in readme
    assert "freeos_agent_chat" in readme
    zh = (out / "README.zh-CN.md").read_text(encoding="utf-8")
    assert "Apache-2.0" in zh
    assert "工作室" in zh
    notice = (out / "NOTICE").read_text(encoding="utf-8")
    assert "Apache-2.0" in notice
    assert "MIT" in notice
    manifest = json.loads((out / "modules.json").read_text(encoding="utf-8"))
    assert manifest["mode"] == "full"
    assert manifest["shared_org_ui_modules"] == _SHARED
    assert "/organization/announcements" in manifest["host_organization_routes"]
    assert "chat" not in _SHARED
    routes = {
        row["route"]: row
        for row in manifest["openxyos_app_routes"]
        if row["source_shell"] == "App.tsx"
    }
    assert routes["/announcements"]["in_slice"] is True
    assert routes["/announcements"]["host_route_exists"] is True
    assert routes["/chat"]["in_full_tree"] is True
    assert routes["/chat"]["in_slice"] is False
    assert routes["/contracts"]["kind"] == "commercial"
    assert routes["/contracts"]["in_slice"] is False
    assert routes["/contracts"]["in_full_tree"] is True
    assert any(item["id"] == "freeos_agent_chat" for item in manifest["omissions"])
    assert manifest["not_exported"] == ["freeos_agent_chat"]
    assert manifest["pages"]["workspace"]["not_migrated"] == ["chat"]
    _assert_org_ui_slice(out / "slice")
    slice_manifest = json.loads(
        (out / "slice" / "src" / "modules.json").read_text(encoding="utf-8")
    )
    assert slice_manifest["openxyos_app_routes"] == manifest["openxyos_app_routes"]
    assert not list((out / "openxyos").rglob("node_modules"))


def test_export_standalone_slice_mode_keeps_runnable_vite_root(tmp_path: Path) -> None:
    out, payload = _export(tmp_path, "--mode", "slice", dest_name="slice-only")
    assert payload["mode"] == "slice"
    assert payload["modules"] == _SHARED
    assert "FREEOS_UPSTREAM" in str(payload["api"])
    assert not (out / "openxyos").exists()
    _assert_org_ui_slice(out)
    modules = json.loads((out / "src" / "modules.json").read_text(encoding="utf-8"))
    assert modules["mode"] == "slice"
    assert modules["shared_org_ui_modules"] == _SHARED
    assert "org_collaboration_chat" in modules["not_exported"]
    assert modules["pages"]["announcements"]["component"] == "AnnouncementPage"
    assert modules["pages"]["workspace"]["standalone_route"] == "/app"
    package = json.loads((out / "package.json").read_text(encoding="utf-8"))
    assert package["scripts"]["dev"] == "vite"
    assert "vite build" in package["scripts"]["build"]
    assert package["scripts"]["start"] == "node server/proxy.mjs"
    vite = (out / "vite.config.ts").read_text(encoding="utf-8")
    assert '"org-ui"' in vite
    assert "FREEOS_UPSTREAM" in vite
    assert (out / "Dockerfile").is_file()
    compose = (out / "docker-compose.yml").read_text(encoding="utf-8")
    assert "FREEOS_UPSTREAM" in compose
    assert "3780:80" in compose
    nginx = (out / "nginx.conf.template").read_text(encoding="utf-8")
    assert "${FREEOS_UPSTREAM}" in nginx
    proxy = (out / "server" / "proxy.mjs").read_text(encoding="utf-8")
    assert "FREEOS_UPSTREAM" in proxy
    login = (out / "src" / "auth" / "LoginPage.tsx").read_text(encoding="utf-8")
    assert "/auth/login" in login
    env_example = (out / ".env.example").read_text(encoding="utf-8")
    assert "VITE_API_BASE=/api" in env_example
    assert "FREEOS_UPSTREAM" in env_example


def test_export_standalone_full_slice_is_runnable_vite_package(tmp_path: Path) -> None:
    out, _payload = _export(tmp_path, dest_name="full-pack")
    slice_root = out / "slice"
    package = json.loads((slice_root / "package.json").read_text(encoding="utf-8"))
    assert package["scripts"]["dev"] == "vite"
    assert package["scripts"]["start"] == "node server/proxy.mjs"
    openxyos_pkg = json.loads((out / "openxyos" / "package.json").read_text(encoding="utf-8"))
    assert "dev" in openxyos_pkg["scripts"]
    assert (out / "openxyos" / ".env.example").is_file() or (out / "openxyos" / "frontend").is_dir()

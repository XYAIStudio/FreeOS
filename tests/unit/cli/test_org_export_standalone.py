"""``freeos org export-standalone`` writes a runnable org-ui package."""

from __future__ import annotations

import json
from pathlib import Path

from click.testing import CliRunner

from octop.cli.main import cli


def _export(tmp_path: Path) -> tuple[Path, dict[str, object]]:
    out = tmp_path / "openxyos-web"
    runner = CliRunner()
    result = runner.invoke(cli, ["org", "export-standalone", "--out", str(out)])
    assert result.exit_code == 0, result.output
    return out, json.loads(result.output)


def test_export_standalone_lists_shared_org_ui_modules(tmp_path: Path) -> None:
    out, payload = _export(tmp_path)
    assert payload["modules"] == [
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
    assert payload["auth"] == "standalone local JWT (openxyos.standalone.jwt)"
    assert "FREEOS_UPSTREAM" in str(payload["api"])
    modules = json.loads((out / "src" / "modules.json").read_text(encoding="utf-8"))
    assert modules["shared_org_ui_modules"] == [
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
    assert modules["not_exported"] == ["chat"]
    assert modules["identity"]["standalone"] == "local JWT (openxyos.standalone.jwt)"
    assert modules["pages"]["announcements"]["component"] == "AnnouncementPage"
    assert modules["pages"]["announcements"]["embedded_route"] == "/organization/announcements"
    assert modules["pages"]["organization"]["component"] == "OrgChartPage"
    assert modules["pages"]["organization"]["embedded_route"] == "/organization/org"
    assert modules["pages"]["employees"]["component"] == "EmployeesPage"
    assert modules["pages"]["employees"]["embedded_route"] == "/organization/employees"
    assert modules["pages"]["employees"]["api"] == "/api/org-module/org/employees"
    assert modules["pages"]["skills"]["component"] == "SkillsPage"
    assert modules["pages"]["skills"]["embedded_route"] == "/organization/skills"
    assert modules["pages"]["skills"]["api"] == "/api/org-module/skills"
    assert modules["pages"]["governance"]["component"] == "GovernancePage"
    assert modules["pages"]["governance"]["embedded_route"] == "/organization/governance"
    assert modules["pages"]["governance"]["api"] == "/api/org-module/governance"
    assert modules["pages"]["knowledge"]["component"] == "KnowledgePage"
    assert modules["pages"]["knowledge"]["embedded_route"] == "/organization/knowledge"
    assert modules["pages"]["knowledge"]["api"] == "/api/org-module/knowledge"
    assert modules["pages"]["tasks"]["component"] == "TasksPage"
    assert modules["pages"]["tasks"]["embedded_route"] == "/organization/tasks"
    assert modules["pages"]["tasks"]["api"] == "/api/org-module/tasks"
    assert modules["pages"]["tasks"]["store"] == "{FREEOS_HOME}/org/tasks.sqlite"
    assert modules["pages"]["reflections"]["component"] == "ReflectionsPage"
    assert modules["pages"]["reflections"]["embedded_route"] == "/organization/reflections"
    assert modules["pages"]["reflections"]["api"] == "/api/org-module/reflections"
    assert modules["pages"]["reflections"]["store"] == "{FREEOS_HOME}/org/reflections.sqlite"
    assert modules["pages"]["settings"]["component"] == "SettingsPage"
    assert modules["pages"]["settings"]["embedded_route"] == "/organization/settings"
    assert modules["pages"]["settings"]["api"] == "/api/org-module/settings"
    assert modules["pages"]["settings"]["modules_api"] == "/api/org-module/modules"
    assert modules["pages"]["settings"]["prefs_api"] == "/api/org-module/prefs"
    assert modules["pages"]["settings"]["store"] == "{FREEOS_HOME}/org-os/prefs.json"
    assert modules["pages"]["agents"]["component"] == "AgentsPage"
    assert modules["pages"]["agents"]["embedded_route"] == "/organization/agents"
    assert modules["pages"]["agents"]["api"] == "/api/org-module/agents"
    assert modules["pages"]["agents"]["compile_api"] == "/api/org-module/blueprints/compile"
    assert modules["pages"]["agents"]["store"] == "{FREEOS_HOME}/tenants/<id>/employees"
    assert modules["pages"]["workspace"]["component"] == "WorkspacePage"
    assert modules["pages"]["workspace"]["embedded_route"] == "/organization/workspace"
    assert modules["pages"]["workspace"]["standalone_route"] == "/app"
    assert modules["pages"]["workspace"]["api"] == "/api/org-module/overview"
    assert modules["pages"]["workspace"]["not_migrated"] == ["chat"]
    app = (out / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "AnnouncementPage" in app
    assert "OrgChartPage" in app
    assert "EmployeesPage" in app
    assert "EmployeeDetailPage" in app
    assert "SkillsPage" in app
    assert "GovernancePage" in app
    assert "KnowledgePage" in app
    assert "TasksPage" in app
    assert "TaskDetailPage" in app
    assert "ReflectionsPage" in app
    assert "SettingsPage" in app
    assert "AgentsPage" in app
    assert "WorkspacePage" in app
    assert "createLocalJwtBridge" in app
    assert 'from "org-ui"' in app
    assert 'path="/chat"' in app
    assert "HostDeepLinkPage" in app
    readme = (out / "README.md").read_text(encoding="utf-8")
    assert "AnnouncementPage" in readme
    assert "OrgChartPage" in readme
    assert "EmployeesPage" in readme
    assert "SkillsPage" in readme
    assert "GovernancePage" in readme
    assert "KnowledgePage" in readme
    assert "TasksPage" in readme
    assert "ReflectionsPage" in readme
    assert "SettingsPage" in readme
    assert "AgentsPage" in readme
    assert "WorkspacePage" in readme
    assert "Chat is **not** migrated" in readme
    assert "openxyos.standalone.jwt" in readme
    assert "docker compose" in readme
    assert "FREEOS_UPSTREAM" in readme


def test_export_standalone_is_runnable_vite_package(tmp_path: Path) -> None:
    out, _payload = _export(tmp_path)
    package = json.loads((out / "package.json").read_text(encoding="utf-8"))
    assert package["scripts"]["dev"] == "vite"
    assert "vite build" in package["scripts"]["build"]
    assert package["scripts"]["start"] == "node server/proxy.mjs"
    vite = (out / "vite.config.ts").read_text(encoding="utf-8")
    assert 'alias: {\n        "org-ui"' in vite or '"org-ui"' in vite
    assert "FREEOS_UPSTREAM" in vite
    assert (out / "Dockerfile").is_file()
    compose = (out / "docker-compose.yml").read_text(encoding="utf-8")
    assert "FREEOS_UPSTREAM" in compose
    assert "3780:80" in compose
    nginx = (out / "nginx.conf.template").read_text(encoding="utf-8")
    assert "${FREEOS_UPSTREAM}" in nginx
    proxy = (out / "server" / "proxy.mjs").read_text(encoding="utf-8")
    assert "FREEOS_UPSTREAM" in proxy
    assert "/api" in proxy
    login = (out / "src" / "auth" / "LoginPage.tsx").read_text(encoding="utf-8")
    assert "/auth/login" in login
    assert "openxyos.standalone.jwt" in login or "setSession" in login
    assert (out / "src" / "org-ui" / "index.ts").is_file()
    assert (out / "src" / "org-ui" / "bridges" / "localJwt.ts").is_file()
    assert (out / "src" / "org-ui" / "pages" / "workspace" / "WorkspacePage.tsx").is_file()
    assert (out / "src" / "org-ui" / "pages" / "announcements" / "AnnouncementPage.tsx").is_file()
    copied_tests = list((out / "src" / "org-ui").rglob("*.test.tsx"))
    assert copied_tests == []
    env_example = (out / ".env.example").read_text(encoding="utf-8")
    assert "VITE_API_BASE=/api" in env_example
    assert "FREEOS_UPSTREAM" in env_example

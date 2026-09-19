"""``freeos org export-standalone`` — runnable Vite package from org-ui."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from octop.modules.org_os.contract import SHARED_ORG_UI_MODULES

_ORG_UI_IGNORE = (
    "*.test.ts",
    "*.test.tsx",
    "*.spec.ts",
    "*.spec.tsx",
    "__snapshots__",
    ".DS_Store",
)


def _repo_root() -> Path:
    here = Path(__file__).resolve()
    packaged = here.parents[4]
    if _looks_like_checkout(packaged):
        return packaged
    cwd = Path.cwd()
    if _looks_like_checkout(cwd):
        return cwd
    raise FileNotFoundError(
        "freeos org export-standalone needs a FreeOS source checkout "
        "(dashboard/src/org-ui and scripts/org-export/template). "
        "Installed wheels without those trees cannot generate the package."
    )


def _looks_like_checkout(root: Path) -> bool:
    return (root / "dashboard" / "src" / "org-ui").is_dir() and (
        root / "scripts" / "org-export" / "template"
    ).is_dir()


def _modules_manifest() -> dict[str, Any]:
    return {
        "shared_org_ui_modules": list(SHARED_ORG_UI_MODULES),
        "import": "dashboard/src/org-ui",
        "identity": {
            "embedded": "FreeOS Dashboard session (auth_token)",
            "standalone": "local JWT (openxyos.standalone.jwt)",
            "bridge": "org-ui createLocalJwtBridge",
        },
        "api": {
            "interim": "same-origin /api proxied to FREEOS_UPSTREAM (FreeOS /api/org-module)",
            "target": "self-contained server implementing /api/org-module/* in this package",
        },
        "pages": {
            "announcements": {
                "component": "AnnouncementPage",
                "embedded_route": "/organization/announcements",
                "standalone_route": "/announcements",
                "api": "/api/org-module/announcements",
            },
            "organization": {
                "component": "OrgChartPage",
                "embedded_route": "/organization/org",
                "standalone_route": "/org",
                "api": "/api/org-module/org",
            },
            "employees": {
                "component": "EmployeesPage",
                "detail_component": "EmployeeDetailPage",
                "embedded_route": "/organization/employees",
                "standalone_route": "/employees",
                "api": "/api/org-module/org/employees",
                "store": "{FREEOS_HOME}/org/org_chart.sqlite",
            },
            "skills": {
                "component": "SkillsPage",
                "embedded_route": "/organization/skills",
                "standalone_route": "/skills",
                "api": "/api/org-module/skills",
                "store": "{FREEOS_HOME}/org-skills",
            },
            "governance": {
                "component": "GovernancePage",
                "embedded_route": "/organization/governance",
                "standalone_route": "/governance",
                "api": "/api/org-module/governance",
                "store": "{FREEOS_HOME}/governance",
            },
            "knowledge": {
                "component": "KnowledgePage",
                "embedded_route": "/organization/knowledge",
                "standalone_route": "/knowledge",
                "api": "/api/org-module/knowledge",
                "store": "host knowledge_bases / knowledge_documents",
            },
            "tasks": {
                "component": "TasksPage",
                "detail_component": "TaskDetailPage",
                "embedded_route": "/organization/tasks",
                "standalone_route": "/tasks",
                "api": "/api/org-module/tasks",
                "store": "{FREEOS_HOME}/org/tasks.sqlite",
            },
            "reflections": {
                "component": "ReflectionsPage",
                "embedded_route": "/organization/reflections",
                "standalone_route": "/reflections",
                "api": "/api/org-module/reflections",
                "store": "{FREEOS_HOME}/org/reflections.sqlite",
            },
            "settings": {
                "component": "SettingsPage",
                "embedded_route": "/organization/settings",
                "standalone_route": "/settings",
                "api": "/api/org-module/settings",
                "modules_api": "/api/org-module/modules",
                "prefs_api": "/api/org-module/prefs",
                "store": "{FREEOS_HOME}/org-os/prefs.json",
            },
            "agents": {
                "component": "AgentsPage",
                "embedded_route": "/organization/agents",
                "standalone_route": "/agents",
                "api": "/api/org-module/agents",
                "compile_api": "/api/org-module/blueprints/compile",
                "transition_api": "/api/org-module/employees/transition",
                "spawn_api": "/api/org-module/employees/spawn",
                "store": "{FREEOS_HOME}/tenants/<id>/employees",
            },
            "workspace": {
                "component": "WorkspacePage",
                "embedded_route": "/organization/workspace",
                "standalone_route": "/app",
                "api": "/api/org-module/overview",
                "not_migrated": ["chat"],
            },
        },
        "not_exported": ["chat"],
        "todo": "self-contained org API (export still proxies to FREEOS_UPSTREAM); optional packages/org-ui extraction",
    }


def write_standalone_scaffold(out_dir: Path) -> dict[str, Any]:
    dest = Path(out_dir)
    dest.mkdir(parents=True, exist_ok=True)
    root = _repo_root()
    template = root / "scripts" / "org-export" / "template"
    org_ui = root / "dashboard" / "src" / "org-ui"
    shutil.copytree(template, dest, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".DS_Store"))
    shutil.copytree(
        org_ui,
        dest / "src" / "org-ui",
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(*_ORG_UI_IGNORE),
    )
    src = dest / "src"
    src.mkdir(parents=True, exist_ok=True)
    (src / "modules.json").write_text(
        json.dumps(_modules_manifest(), indent=2) + "\n",
        encoding="utf-8",
    )
    files = [
        "README.md",
        "package.json",
        "vite.config.ts",
        "Dockerfile",
        "docker-compose.yml",
        "nginx.conf.template",
        "server/proxy.mjs",
        "src/App.tsx",
        "src/modules.json",
        "src/org-ui/index.ts",
        "src/org-ui/bridges/localJwt.ts",
        "src/auth/LoginPage.tsx",
    ]
    return {
        "out_dir": str(dest),
        "modules": list(SHARED_ORG_UI_MODULES),
        "files": files,
        "auth": "standalone local JWT (openxyos.standalone.jwt)",
        "api": "proxies /api to FREEOS_UPSTREAM (interim); self-contained server is the target end-state",
        "todo": "self-contained org API; optional packages/org-ui extraction",
    }

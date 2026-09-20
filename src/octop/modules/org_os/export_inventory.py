"""Route/module inventory for ``freeos org export-standalone``.

Compares the desktop host Organization routes, shared org-ui slices, and
the vendored openXYOS ``App.tsx`` / ``OpenApp.tsx`` trees. Used as
``modules.json`` in the export pack so a customer can see what shipped.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Literal

from octop.modules.org_os.catalog import catalog_keys
from octop.modules.org_os.contract import SHARED_ORG_UI_MODULES

ExportMode = Literal["full", "slice"]

_ROUTE = re.compile(r'<Route\s+path="([^"]+)"\s+element=\{(.*?)\}\s*/>', re.S)
_LAZY = re.compile(r'(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\("(\./pages/[^"]+)"\)')
_HOST_ROUTE = re.compile(r'path:\s*"(/organization[^"]*)"')
_APP_MODULE_ROUTE = re.compile(r'prefix:\s*"([^"]+)"\s*,\s*moduleKey:\s*"([^"]+)"')

# App.tsx MODULE_ROUTES plus Open-12 / commercial aliases used in the inventory.
_ROUTE_KEY: dict[str, str] = {
    "/": "dashboard",
    "/dashboard": "dashboard",
    "/app": "workspace",
    "/workspace": "workspace",
    "/announcements": "announcements",
    "/org": "organization",
    "/employees": "employees",
    "/skills": "skills",
    "/chat": "chat",
    "/agents": "agents",
    "/tasks": "tasks",
    "/workflows": "workflows",
    "/contracts": "contracts",
    "/assets": "assets",
    "/attendance": "attendance",
    "/leave": "attendance",
    "/expense": "expenses",
    "/daily-report": "work_records",
    "/goals": "goals",
    "/budgets": "budgets",
    "/routines": "routines",
    "/performance": "performance",
    "/efficiency": "efficiency",
    "/reflections": "reflections",
    "/knowledge": "knowledge",
    "/governance": "governance",
    "/audit": "audit",
    "/settings": "settings",
    "/admin": "admin",
    "/customers": "customers",
    "/electricity": "electricity",
}

_HOST_ALIAS = {"/": "dashboard", "/app": "workspace", "/dashboard": "dashboard"}

_OMISSIONS: tuple[dict[str, Any], ...] = (
    {
        "id": "freeos_agent_chat",
        "in_full_tree": False,
        "in_slice": False,
        "title_en": "FreeOS / Octop agent chat (studio)",
        "title_zh": "FreeOS / Octop 智能体对话（工作室）",
        "reason_en": (
            "Everyday studio conversations, IM, cron, and sandboxes stay on the "
            "FreeOS host. This pack does not export a second agent runtime."
        ),
        "reason_zh": (
            "工作室日常对话、IM、定时任务和沙箱留在 FreeOS 宿主。本包不导出第二套智能体运行时。"
        ),
    },
    {
        "id": "org_collaboration_chat",
        "in_full_tree": True,
        "in_slice": False,
        "title_en": "Organization collaboration chat",
        "title_zh": "组织沟通协作",
        "reason_en": (
            "Ships in the full openXYOS tree (App.tsx / OpenApp.tsx /chat). "
            "The host-bridge slice only shows a stub: org rooms need the Node "
            "app, and must not replace studio agent chat."
        ),
        "reason_zh": (
            "完整 openXYOS 树（App.tsx / OpenApp.tsx 的 /chat）里有。"
            "宿主桥 slice 只有说明页：组织会话需要 Node 应用，"
            "且不得替换工作室智能体对话。"
        ),
    },
    {
        "id": "desktop_iframe_nsis",
        "in_full_tree": False,
        "in_slice": False,
        "title_en": "Desktop iframe / NSIS / managed Node runtime",
        "title_zh": "桌面 iframe / NSIS / 托管 Node 运行时",
        "reason_en": (
            "Managed Node + iframe is a FreeOS desktop transition bridge, "
            "not part of the commercial source pack. Default installers stay "
            "zero-Node."
        ),
        "reason_zh": (
            "托管 Node + iframe 是 FreeOS 桌面的过渡桥，不是本商业源码包的一部分。"
            "默认安装器仍为零 Node。"
        ),
    },
)


def _key_for_route(route: str) -> str:
    if route in _ROUTE_KEY:
        return _ROUTE_KEY[route]
    for prefix, key in sorted(_ROUTE_KEY.items(), key=lambda item: -len(item[0])):
        if prefix != "/" and (route == prefix or route.startswith(prefix + "/")):
            return key
    return route.strip("/").split("/")[0] or "unknown"


def _host_route_for(route: str) -> str:
    slug = _HOST_ALIAS.get(route, route.lstrip("/"))
    return "/organization/" + slug


def _kind_for(key: str, open12: set[str]) -> str:
    if key in open12:
        return "open12"
    return "commercial"


def parse_shell_routes(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8")
    components = dict(_LAZY.findall(text))
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for route, expression in _ROUTE.findall(text):
        if route in seen:
            continue
        symbols = re.findall(r"<(\w+)", expression)
        component = next((symbol for symbol in symbols if symbol in components), None)
        if component is None:
            continue
        seen.add(route)
        rows.append(
            {
                "route": route,
                "component": component,
                "source_file": components[component],
            }
        )
    return rows


def host_organization_routes(root: Path) -> list[str]:
    host = root / "dashboard" / "src" / "routes" / "index.tsx"
    if not host.is_file():
        return []
    return sorted(set(_HOST_ROUTE.findall(host.read_text(encoding="utf-8"))))


def app_module_route_keys(root: Path) -> dict[str, str]:
    app = root / "modules" / "openxyos" / "frontend" / "src" / "App.tsx"
    mapping = dict(_ROUTE_KEY)
    if app.is_file():
        mapping.update(_APP_MODULE_ROUTE.findall(app.read_text(encoding="utf-8")))
    return mapping


def host_org_ui_pages() -> dict[str, Any]:
    """Existing org-ui slice page map (host + slice SPA)."""
    return {
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
    }


def build_export_manifest(root: Path, *, mode: ExportMode) -> dict[str, Any]:
    open12 = set(catalog_keys())
    shared = list(SHARED_ORG_UI_MODULES)
    host_routes = host_organization_routes(root)
    frontend = root / "modules" / "openxyos" / "frontend" / "src"
    app_rows: list[dict[str, Any]] = []
    for shell in ("App.tsx", "OpenApp.tsx"):
        path = frontend / shell
        if not path.is_file():
            continue
        for row in parse_shell_routes(path):
            key = _key_for_route(row["route"])
            host = _host_route_for(row["route"])
            in_slice = key in SHARED_ORG_UI_MODULES
            kind = _kind_for(key, open12)
            app_rows.append(
                {
                    "source_shell": shell,
                    "route": row["route"],
                    "component": row["component"],
                    "source_file": row["source_file"],
                    "catalog_key": key,
                    "kind": kind,
                    "host_route": host,
                    "host_route_exists": host in host_routes,
                    "in_slice": in_slice,
                    "in_full_tree": True,
                }
            )
    return {
        "pack": "openxyos-source",
        "mode": mode,
        "product": "FreeOS commercializable openXYOS source pack (P1.2)",
        "licenses": {
            "openxyos_tree": "Apache-2.0",
            "host_bridge_slice": "MIT",
        },
        "copied_this_export": {
            "openxyos": mode == "full",
            "slice": True,
        },
        "shared_org_ui_modules": shared,
        "open12_catalog_keys": list(open12),
        "host_organization_routes": host_routes,
        "openxyos_app_routes": app_rows,
        "omissions": [dict(item) for item in _OMISSIONS],
        "host_proxied_in_slice": [
            "/api/org-module/*",
            "/api/auth/login (slice bridge only; not the org-room end state)",
        ],
        "full_tree_self_contained": (
            "openxyos/ is the Apache-2.0 Node+Vite app; npm ci && npm run dev "
            "runs App.tsx without FreeOS. Slice still proxies to FREEOS_UPSTREAM."
        ),
        "import": "dashboard/src/org-ui",
        "identity": {
            "embedded": "FreeOS Dashboard session (auth_token) — everyday studio",
            "standalone": "local JWT (openxyos.standalone.jwt)",
            "bridge": "org-ui createLocalJwtBridge",
            "slice_login": (
                "slice posts to host /api/auth/login as an interim bridge; "
                "not the organization-room end state"
            ),
            "full_tree_org_room": (
                "openxyos AuthPage talks to its own /api/auth (organization room)"
            ),
        },
        "api": {
            "interim": (
                "slice same-origin /api proxied to FREEOS_UPSTREAM (FreeOS /api/org-module)"
            ),
            "target": (
                "full tree: self-contained openXYOS Express APIs in openxyos/; "
                "slice still proxies until a customer replaces the bridge"
            ),
        },
        "pages": host_org_ui_pages(),
        "not_exported": (
            ["freeos_agent_chat"]
            if mode == "full"
            else ["org_collaboration_chat", "freeos_agent_chat", "commercial_app_verticals"]
        ),
        "todo": (
            "optional self-contained org API inside the slice; unify "
            "POST /api/org-module/source/download with this generated tree"
        ),
    }

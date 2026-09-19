"""Minimal ``freeos org export-standalone`` scaffold (Phase 3).

Full Vite + Node server packaging is Phase 5. This writes a snapshot that
lists the shared org-ui modules and points at the same AnnouncementPage,
OrgChartPage, EmployeesPage, SkillsPage, GovernancePage, and KnowledgePage
sources Dashboard mounts under ``/organization/...``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from octop.modules.org_os.contract import SHARED_ORG_UI_MODULES

_README = """# Standalone Organization web (export skeleton)

This directory is produced by `freeos org export-standalone`.

## Shared UI (single source)

Dashboard and this export consume the **same** org-ui pages:

| Module | Dashboard route | Standalone route | Import |
|---|---|---|---|
| announcements | `/organization/announcements` | `/announcements` | `dashboard/src/org-ui` → `AnnouncementPage` |
| organization | `/organization/org` | `/org` | `dashboard/src/org-ui` → `OrgChartPage` |
| employees | `/organization/employees` | `/employees` | `dashboard/src/org-ui` → `EmployeesPage` / `EmployeeDetailPage` |
| skills | `/organization/skills` | `/skills` | `dashboard/src/org-ui` → `SkillsPage` |
| governance | `/organization/governance` | `/governance` | `dashboard/src/org-ui` → `GovernancePage` |
| knowledge | `/organization/knowledge` | `/knowledge` | `dashboard/src/org-ui` → `KnowledgePage` |

Do **not** copy those pages into a second tree. Edit `dashboard/src/org-ui`.

Directory employees share `{FREEOS_HOME}/org/org_chart.sqlite` with the org
chart. Host lifecycle colleagues stay on `GET /api/org-module/employees`.
Governance pauses and audit stay on `{FREEOS_HOME}/governance/`.
Organization skills stay on `{FREEOS_HOME}/org-skills/` (skill_bridge).
Host Agent Skills remain FreeOS skill packages — not a second runtime.
Organization Knowledge lists the same FreeOS knowledge bases Chat retrieves
from. It does not clone the openXYOS sidecar notes/files DB.

## Phase 3 vs Phase 5

Phase 3 (this scaffold):

- Shared module list (`src/modules.json`)
- Thin `src/App.tsx` that imports `AnnouncementPage`, `OrgChartPage`,
  `EmployeesPage`, `SkillsPage`, `GovernancePage`, and `KnowledgePage`
- Documents IdentityBridge: embedded mode uses FreeOS JWT; standalone uses local JWT

Phase 5 (TODO — not implemented here):

- Full Vite + minimal server packaging
- Commercial `App.tsx` routes
- Independent `packages/org-ui` extraction if the Dashboard Vite graph must be left behind
- Default installer stays zero-Node; this export is an explicit operator action

## Next

```bash
# from a FreeOS checkout
uv run freeos org export-standalone --out dist/openxyos-web
# then (Phase 5) npm install && npm run build inside the out dir
```
"""

_APP_TSX = """\
import {
  AnnouncementPage,
  EmployeeDetailPage,
  EmployeesPage,
  GovernancePage,
  KnowledgePage,
  OrgChartPage,
  SHARED_ORG_UI_MODULES,
  SkillsPage,
} from "org-ui";
import type {
  OrgAnnouncementsClient,
  OrgChartClient,
  OrgEmployeesClient,
  OrgGovernanceClient,
  OrgKnowledgeClient,
  OrgSession,
  OrgSkillsClient,
} from "org-ui";

/**
 * Standalone shell stub. Phase 5 wires a real IdentityBridge + local JWT.
 * Page components are the same ones Dashboard mounts at
 * /organization/announcements, /organization/org, /organization/employees,
 * /organization/skills, /organization/governance, and /organization/knowledge.
 */
const session: OrgSession = {
  userId: 0,
  displayName: "standalone",
  role: "admin",
  isAdmin: true,
};

export default function App(props: {
  client: OrgAnnouncementsClient;
  orgClient: OrgChartClient;
  employeesClient: OrgEmployeesClient;
  skillsClient: OrgSkillsClient;
  governanceClient: OrgGovernanceClient;
  knowledgeClient: OrgKnowledgeClient;
  locale?: "zh" | "en";
}) {
  return (
    <>
      <AnnouncementPage
        client={props.client}
        session={session}
        locale={props.locale ?? "en"}
        modules={SHARED_ORG_UI_MODULES}
      />
      <OrgChartPage
        client={props.orgClient}
        session={session}
        locale={props.locale ?? "en"}
        modules={SHARED_ORG_UI_MODULES}
      />
      <EmployeesPage
        client={props.employeesClient}
        session={session}
        locale={props.locale ?? "en"}
        modules={SHARED_ORG_UI_MODULES}
      />
      <EmployeeDetailPage
        client={props.employeesClient}
        session={session}
        locale={props.locale ?? "en"}
        employeeId={0}
        modules={SHARED_ORG_UI_MODULES}
      />
      <SkillsPage
        client={props.skillsClient}
        session={session}
        locale={props.locale ?? "en"}
        modules={SHARED_ORG_UI_MODULES}
      />
      <GovernancePage
        client={props.governanceClient}
        session={session}
        locale={props.locale ?? "en"}
        modules={SHARED_ORG_UI_MODULES}
      />
      <KnowledgePage
        client={props.knowledgeClient}
        session={session}
        locale={props.locale ?? "en"}
        modules={SHARED_ORG_UI_MODULES}
      />
    </>
  );
}
"""

_PACKAGE_JSON = {
    "name": "openxyos-web",
    "private": True,
    "version": "0.0.0",
    "description": (
        "Standalone Organization web export skeleton. "
        "Pages come from dashboard/src/org-ui "
        "(Phase 3: Announcements + Org chart + Employees + Skills + Governance + Knowledge). "
        "Full Node packaging is Phase 5."
    ),
    "type": "module",
    "scripts": {
        "dev": "echo 'TODO Phase 5: Vite + server packaging'",
        "build": "echo 'TODO Phase 5: Vite + server packaging'",
    },
    "peerDependencies": {
        "antd": "^5",
        "react": "^18",
        "react-dom": "^18",
    },
}


def write_standalone_scaffold(out_dir: Path) -> dict[str, Any]:
    dest = Path(out_dir)
    dest.mkdir(parents=True, exist_ok=True)
    src = dest / "src"
    src.mkdir(parents=True, exist_ok=True)

    modules = {
        "shared_org_ui_modules": list(SHARED_ORG_UI_MODULES),
        "import": "dashboard/src/org-ui",
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
        },
        "todo": "Phase 5: full Vite + server packaging; do not fork org-ui pages",
    }
    (dest / "README.md").write_text(_README, encoding="utf-8")
    (dest / "package.json").write_text(json.dumps(_PACKAGE_JSON, indent=2) + "\n", encoding="utf-8")
    (src / "modules.json").write_text(json.dumps(modules, indent=2) + "\n", encoding="utf-8")
    (src / "App.tsx").write_text(_APP_TSX, encoding="utf-8")
    return {
        "out_dir": str(dest),
        "modules": list(SHARED_ORG_UI_MODULES),
        "files": ["README.md", "package.json", "src/modules.json", "src/App.tsx"],
        "todo": "Phase 5: full Vite + server packaging",
    }

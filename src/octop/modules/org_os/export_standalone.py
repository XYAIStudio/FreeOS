"""Minimal ``freeos org export-standalone`` scaffold (Phase 2).

Full Vite + Node server packaging is Phase 5. This writes a snapshot that
lists the shared org-ui modules and points at the same AnnouncementPage
source Dashboard mounts under ``/organization/announcements``.
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

Do **not** copy `AnnouncementPage.tsx` into a second tree. Edit `dashboard/src/org-ui`.

## Phase 2 vs Phase 5

Phase 2 (this scaffold):

- Shared module list (`src/modules.json`)
- Thin `src/App.tsx` that imports `AnnouncementPage`
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
import { AnnouncementPage, SHARED_ORG_UI_MODULES } from "org-ui";
import type { OrgAnnouncementsClient, OrgSession } from "org-ui";

/**
 * Standalone shell stub. Phase 5 wires a real IdentityBridge + local JWT.
 * The page component is the same one Dashboard mounts at
 * /organization/announcements.
 */
const session: OrgSession = {
  userId: 0,
  displayName: "standalone",
  role: "admin",
  isAdmin: true,
};

export default function App(props: {
  client: OrgAnnouncementsClient;
  locale?: "zh" | "en";
}) {
  return (
    <AnnouncementPage
      client={props.client}
      session={session}
      locale={props.locale ?? "en"}
      modules={SHARED_ORG_UI_MODULES}
    />
  );
}
"""

_PACKAGE_JSON = {
    "name": "openxyos-web",
    "private": True,
    "version": "0.0.0",
    "description": (
        "Standalone Organization web export skeleton. "
        "Pages come from dashboard/src/org-ui (Phase 2: Announcements). "
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
            }
        },
        "todo": "Phase 5: full Vite + server packaging; do not fork AnnouncementPage",
    }
    (dest / "README.md").write_text(_README, encoding="utf-8")
    (dest / "package.json").write_text(
        json.dumps(_PACKAGE_JSON, indent=2) + "\n", encoding="utf-8"
    )
    (src / "modules.json").write_text(json.dumps(modules, indent=2) + "\n", encoding="utf-8")
    (src / "App.tsx").write_text(_APP_TSX, encoding="utf-8")
    return {
        "out_dir": str(dest),
        "modules": list(SHARED_ORG_UI_MODULES),
        "files": ["README.md", "package.json", "src/modules.json", "src/App.tsx"],
        "todo": "Phase 5: full Vite + server packaging",
    }

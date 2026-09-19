# Organization standalone export (Phase 3 skeleton)

`freeos org export-standalone --out dist/openxyos-web` writes a scaffold that
**imports the same org-ui pages** Dashboard mounts under `/organization/...`.

Phase 3 includes **Announcements**, **Org chart**, **Employees**, **Skills**,
**Governance**, **Knowledge**, **Tasks**, and **Reflections**:

| Delivery | Route | Component |
|---|---|---|
| Dashboard | `/organization/announcements` | `dashboard/src/org-ui` → `AnnouncementPage` |
| Standalone (this export) | `/announcements` | same import |
| Dashboard | `/organization/org` | `dashboard/src/org-ui` → `OrgChartPage` |
| Standalone (this export) | `/org` | same import |
| Dashboard | `/organization/employees` | `dashboard/src/org-ui` → `EmployeesPage` |
| Dashboard | `/organization/employees/:id` | `dashboard/src/org-ui` → `EmployeeDetailPage` |
| Standalone (this export) | `/employees` | same import |
| Dashboard | `/organization/skills` | `dashboard/src/org-ui` → `SkillsPage` |
| Standalone (this export) | `/skills` | same import |
| Dashboard | `/organization/governance` | `dashboard/src/org-ui` → `GovernancePage` |
| Standalone (this export) | `/governance` | same import |
| Dashboard | `/organization/knowledge` | `dashboard/src/org-ui` → `KnowledgePage` |
| Standalone (this export) | `/knowledge` | same import |
| Dashboard | `/organization/tasks` | `dashboard/src/org-ui` → `TasksPage` |
| Dashboard | `/organization/tasks/:id` | `dashboard/src/org-ui` → `TaskDetailPage` |
| Standalone (this export) | `/tasks` | same import |
| Dashboard | `/organization/reflections` | `dashboard/src/org-ui` → `ReflectionsPage` |
| Standalone (this export) | `/reflections` | same import |

Directory employees share `{FREEOS_HOME}/org/org_chart.sqlite` with the org
chart. Organization skills live under `{FREEOS_HOME}/org-skills/` (skill_bridge).
Governance pauses/audit live under `{FREEOS_HOME}/governance/`.
Organization Knowledge lists host FreeOS knowledge bases (same rows as
`/knowledge-bases`); it does not clone the sidecar notes/files DB.
Organization Tasks live in `{FREEOS_HOME}/org/tasks.sqlite` — not Octop cron
and not agent/project chat.
Organization Reflections live in `{FREEOS_HOME}/org/reflections.sqlite` —
lessons learned, not Chat and not a second skill runtime.
Do not copy the pages into a second tree.

## Phase 5 TODO

- Full Vite + minimal server packaging
- Local JWT IdentityBridge for customer self-host
- Remaining Open-12 pages after they land in `org-ui`
- Optional `packages/org-ui` extraction if the Dashboard Vite graph must be left behind

Default FreeOS installers stay **zero-Node**. This export is an explicit operator action.

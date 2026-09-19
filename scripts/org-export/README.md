# Organization standalone export (Phase 4)

`freeos org export-standalone --out dist/openxyos-web` copies this
`template/` plus `dashboard/src/org-ui` into a **runnable** Vite package.

OpenApp-like routes: `/app`, `/announcements`, `/org`, `/employees`,
`/skills`, `/agents`, `/tasks`, `/knowledge`, `/reflections`,
`/governance`, `/settings`. Chat is **not** exported.

| Delivery | Route | Component |
|---|---|---|
| Dashboard | `/organization/workspace` | `WorkspacePage` |
| Standalone | `/app` | same |
| Dashboard | `/organization/announcements` | `AnnouncementPage` |
| Standalone | `/announcements` | same |
| Dashboard | `/organization/org` | `OrgChartPage` |
| Standalone | `/org` | same |
| Dashboard | `/organization/employees` | `EmployeesPage` / `EmployeeDetailPage` |
| Standalone | `/employees` | same |
| Dashboard | `/organization/skills` | `SkillsPage` |
| Standalone | `/skills` | same |
| Dashboard | `/organization/agents` | `AgentsPage` |
| Standalone | `/agents` | same |
| Dashboard | `/organization/tasks` | `TasksPage` / `TaskDetailPage` |
| Standalone | `/tasks` | same |
| Dashboard | `/organization/knowledge` | `KnowledgePage` |
| Standalone | `/knowledge` | same |
| Dashboard | `/organization/reflections` | `ReflectionsPage` |
| Standalone | `/reflections` | same |
| Dashboard | `/organization/governance` | `GovernancePage` |
| Standalone | `/governance` | same |
| Dashboard | `/organization/settings` | `SettingsPage` |
| Standalone | `/settings` | same |

Identity: standalone `createLocalJwtBridge` (`openxyos.standalone.jwt`),
not the embedded FreeOS Dashboard session.

Interim API: SPA + proxy to a FreeOS host (`FREEOS_UPSTREAM`).
Target end-state: self-contained server in the export (see
[docs/org-export.md](../../docs/org-export.md)).

## Phase 5 (default installer)

Default FreeOS installers stay **zero-Node**. This export is an explicit
operator / commercial action — it does not change the desktop package.

Residual (not default install):

- Self-contained org API (export still proxies to `FREEOS_UPSTREAM`)
- Optional `packages/org-ui` extraction if the Dashboard Vite graph must be left behind

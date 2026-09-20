# Organization standalone export

`freeos org export-standalone --out dist/openxyos-web` writes a
**commercializable openXYOS source pack** (default `--mode full`):

1. `openxyos/` — copy of `modules/openxyos` (Apache-2.0, full `App.tsx`)
2. `slice/` — this `template/` plus `dashboard/src/org-ui` (MIT host bridge)
3. `modules.json` — route/module manifest vs desktop `/organization`

`--mode slice` writes only the MIT SPA at the output root (same files as
`slice/` in a full pack). Chat on the slice is a stub; organization
collaboration chat lives in the full tree. FreeOS/Octop agent chat is
never exported.

| Delivery | Route | Component |
|---|---|---|
| Dashboard | `/organization/workspace` | `WorkspacePage` |
| Slice | `/app` | same |
| Dashboard | `/organization/announcements` | `AnnouncementPage` |
| Slice | `/announcements` | same |
| Dashboard | `/organization/org` | `OrgChartPage` |
| Slice | `/org` | same |
| Dashboard | `/organization/employees` | `EmployeesPage` / `EmployeeDetailPage` |
| Slice | `/employees` | same |
| Dashboard | `/organization/skills` | `SkillsPage` |
| Slice | `/skills` | same |
| Dashboard | `/organization/agents` | `AgentsPage` |
| Slice | `/agents` | same |
| Dashboard | `/organization/tasks` | `TasksPage` / `TaskDetailPage` |
| Slice | `/tasks` | same |
| Dashboard | `/organization/knowledge` | `KnowledgePage` |
| Slice | `/knowledge` | same |
| Dashboard | `/organization/reflections` | `ReflectionsPage` |
| Slice | `/reflections` | same |
| Dashboard | `/organization/governance` | `GovernancePage` |
| Slice | `/governance` | same |
| Dashboard | `/organization/settings` | `SettingsPage` |
| Slice | `/settings` | same |
| Slice | `/coverage` | `CoveragePage` (manifest vs App.tsx) |

Identity (slice): `createLocalJwtBridge` (`openxyos.standalone.jwt`),
not the embedded FreeOS Dashboard session. Slice login posting to host
`/api/auth/login` is an interim bridge.

Full tree: self-contained Node+Vite in `openxyos/` (`npm ci && npm run
dev`). Slice still proxies to `FREEOS_UPSTREAM`. See
[docs/org-export.md](../../docs/org-export.md).

## Phase 5 (default installer)

Default FreeOS installers stay **zero-Node**. This export is an explicit
operator / commercial action — it does not change the desktop package.

Residual:

- Optional self-contained org API **inside the slice** (slice still proxies)
- Unify `POST /api/org-module/source/download` with this generated tree

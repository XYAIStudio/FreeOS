# Organization standalone export (Phase 3 skeleton)

`freeos org export-standalone --out dist/openxyos-web` writes a scaffold that
**imports the same org-ui pages** Dashboard mounts under `/organization/...`.

Phase 3 includes **Announcements** and **Org chart**:

| Delivery | Route | Component |
|---|---|---|
| Dashboard | `/organization/announcements` | `dashboard/src/org-ui` → `AnnouncementPage` |
| Standalone (this export) | `/announcements` | same import |
| Dashboard | `/organization/org` | `dashboard/src/org-ui` → `OrgChartPage` |
| Standalone (this export) | `/org` | same import |

Do not copy the pages into a second tree.

## Phase 5 TODO

- Full Vite + minimal server packaging
- Local JWT IdentityBridge for customer self-host
- Remaining Open-12 pages after they land in `org-ui`
- Optional `packages/org-ui` extraction if the Dashboard Vite graph must be left behind

Default FreeOS installers stay **zero-Node**. This export is an explicit operator action.

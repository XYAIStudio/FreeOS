# openXYOS → FreeOS capability migration map (P0.2)

**Status:** Inventory freeze on `main` (2026-09-20). Documentation only.

**Languages:** English · [简体中文](org-capability-migration-map.zh-CN.md)

**Machine-readable:** [org-capability-migration-map.json](org-capability-migration-map.json)

This map answers: what is already native on the FreeOS/Octop host, what still lives on managed Node / iframe, and what to migrate next. It does **not** change runtime code.

Product intent (canonical): [product-contract.md](product-contract.md) (P0.1, merged in #73). North star:

- End state: migrate openXYOS web/org capabilities **into** the host (native). Do not permanently ship a large Node runtime.
- Desktop managed Node + iframe is a **transition bridge**.
- Dual entry: local studio vs organization as another **room**. Soft wording in user docs; implementers keep **two auth spaces** separate.
- Bidirectional assets; exportable openXYOS source for commercialization; local models and knowledge bases.
- Slogans: CN「FreeOS：自由的 AI 工作室，想象空间由你来打开」· EN「Your FreeOS, free for you.」

Older merge docs ([org-merge-plan.md](org-merge-plan.md), [org-full-integration.md](org-full-integration.md), [ADR 003](adr/003-org-ui-single-source-dual-delivery.md)) record engineering history. Where they say “organization login is the only authority” or “keep Node forever”, this map follows the product contract instead.

## Summary

| Status | Count | Meaning |
|---|---:|---|
| `native_host` | 9 | Host Python/React already owns the capability (may still be incomplete). |
| `org_ui_slice` | 10 | Shared `dashboard/src/org-ui` page + `/api/org-module/*`, thinner than original App.tsx. |
| `managed_node_iframe` | 13 | Full original UI/API still requires desktop `FREEOS_ORG_INTEGRATED` iframe or Node proxy. |
| `sidecar_optional` | 1 | Opt-in `:3780` (`FREEOS_ORG_SIDECAR`). |
| `export_only` | 1 | Commercial generator; not the default desktop runtime. |
| `missing` | 0 | No major domain is absent from both trees; gaps are depth/parity, not empty names. |
| **Total** | **34** | |

Priority: **P0 = 7** (waves A–D) · **P1 = 17** · **P2 = 10**.

| Domain | Status | Node? | Export? | Pri | Next engineering step |
|---|---|---|---|---|---|
| [Bidirectional assets bus](#1-bidirectional-assets-bus) | native_host | partial | yes | P0 | Host-owned ingest/export that does not need live Node `/api/freeos/ingest`. |
| [Export-standalone](#2-export-standalone-commercial-package) | export_only | partial | yes | P0 | Default `--mode full` writes the openXYOS **source tree**; `--mode slice` is the SPA+proxy host bridge. |
| [Tenant / auth (dual identity)](#3-tenant--auth-dual-identity) | managed_node_iframe | partial | yes | P0 | Two auth spaces; stop Node `/api/auth` as org-room authority. |
| [Local models](#4-local-models) | native_host | partial | yes | P0 | Org room uses the studio local-model pool, not sidecar `/api/settings/ai`. |
| [Host knowledge bases](#5-host-knowledge-bases) | native_host | no | partial | P0 | Keep local RAG default; cloud connectors optional. |
| [Organization knowledge](#6-organization-knowledge-notesfiles) | org_ui_slice | partial | yes | P0 | Upload/folders/reparse on host KB; do not clone sidecar notes DB. |
| [Blueprints / compiler](#10-blueprints--compiler) | native_host | no | yes | P0 | Feed compile output into the assets bus for exportable blueprints. |
| [Managed Node + iframe shell](#7-managed-node--iframe-shell) | managed_node_iframe | yes | no | P1 | Stop using iframe as Organization home; shrink runtime. |
| [Module catalog](#9-module-catalog) | native_host | no | yes | P1 | Add keys as App.tsx verticals native-port. |
| [Colleague lifecycle](#11-colleague-lifecycle) | native_host | no | yes | P1 | Join registry with people/talent UI. |
| [Governance](#12-governance-engine--ui) | native_host | partial | yes | P1 | Port permission matrix/comm-rules; keep PEP/PDP. |
| [Organization workbench](#13-organization-workbench-assemble--pack--loop) | native_host | no | partial | P1 | Keep factory reachable when integrated (today iframe hides it). |
| [Workspace overview](#14-workspace-overview) | org_ui_slice | partial | yes | P1 | Match OpenDashboard metrics without Node. |
| [Announcements](#15-announcements) | org_ui_slice | no | yes | P1 | Field-level parity vs original page. |
| [Org chart](#16-org-chart) | org_ui_slice | partial | yes | P1 | Versions, reporting-lines, import, avatars. |
| [People directory](#17-people-directory) | org_ui_slice | partial | yes | P1 | Onboard/offboard/skills on the same sqlite. |
| [Talent market](#18-talent-market) | managed_node_iframe | yes | yes | P1 | Native recruit → host lifecycle. |
| [Skills / plugins](#19-skills--plugins) | org_ui_slice | partial | yes | P1 | Marketplace stays export-or-later; inventory is host. |
| [Agent studio](#20-agent-studio) | org_ui_slice | partial | yes | P1 | Reference upload; ignore unmounted sidecar studio API. |
| [Organization tasks](#21-organization-tasks) | org_ui_slice | no | yes | P1 | Attachments; not cron/Chat. |
| [Reflections](#22-reflections) | org_ui_slice | no | yes | P1 | Only port sidecar extras still referenced. |
| [Organization settings](#23-organization-settings) | org_ui_slice | partial | yes | P1 | Org-room company/roles/backup; studio keeps host keys. |
| [Organization chat](#24-organization-collaboration-chat) | managed_node_iframe | yes | yes | P1 | Native org rooms; **do not** replace Octop agent chat. |
| [Source download](#34-openxyos-source-download) | native_host | no | yes | P1 | One tree with Wave B export, not a second zip. |
| [Optional :3780 sidecar](#8-optional-node-sidecar-3780) | sidecar_optional | yes | no | P2 | Opt-in until native coverage; not default installer. |
| [Workflows](#25-workflows) | managed_node_iframe | yes | yes | P2 | Host store + designer; HR docs depend on it. |
| [Contracts](#26-contracts) | managed_node_iframe | yes | yes | P2 | After workflows (approvals/payments). |
| [Physical / org assets](#27-physical--org-assets-ledger) | managed_node_iframe | yes | yes | P2 | Ledger ≠ `freeos.asset-pack.v1`. |
| [Attendance / leave / expense / daily report](#28-attendance--leave--expense--daily-report) | managed_node_iframe | yes | yes | P2 | Cluster after workflows. |
| [Goals / budgets / routines / performance / efficiency](#29-goals--budgets--routines--performance--efficiency) | managed_node_iframe | yes | yes | P2 | Chain after tasks + org-chart. |
| [Organization audit](#30-organization-audit-trail) | managed_node_iframe | yes | yes | P2 | Unify with host governance audit. |
| [Admin / tenants / payments](#31-admin--tenants--payments) | managed_node_iframe | yes | partial | P2 | Split SaaS billing from tenant CRUD. |
| [Customer service](#32-customer-service) | managed_node_iframe | yes | partial | P2 | In inventory; native-port only if export still ships it. |
| [Electricity market](#33-electricity-market) | managed_node_iframe | yes | partial | P2 | Same; likely industry demo. |

## Recommended waves (after P0.1)

Aligned with product order: **assets bus → export → dual identity UX → local models/KB → cut Node**.

| Wave | Pri | Do this | Not this |
|---|---|---|---|
| **A. Assets bus** | P0 | Host-owned pack / ingest / apply so FreeOS and the org room exchange employees, skills, plugins, MCPs without a healthy Node HTTP hop. | Treating `{FREEOS_HOME}/openxyos-mirror/` plus optional `/api/freeos/ingest` as finished bidirectional product. |
| **B. Export** | P0 | Generate **exportable openXYOS source** for commercialization. | Freezing `export-standalone` (Vite SPA + proxy to FreeOS `/api/org-module`) as the commercial artifact. |
| **C. Dual-identity UX** | P0 | Studio vs organization **room**; two auth spaces stay separate. User-facing copy stays soft. | Making org registration the host authority, or one login wall for both rooms. |
| **D. Local models / KB** | P0 | Default chat, RAG, and org knowledge run on the operator’s machine. | Org LLM/KB that only work through Node `/api/settings/ai` or a vendor cloud. |
| **E. Cut Node** | P1→P2 | Native-port remaining iframe App surfaces (Open-12 depth first, then commercial verticals), then remove managed Node. | Re-bundling Node into the default installer, or calling iframe “done”. |

## Do not treat as end state

These shipping shapes still need a native port. They are bridges.

1. **Desktop integrated iframe** of the full App — `FREEOS_ORG_INTEGRATED=1` (`desktop/src/process.go`) makes `/organization` render `<iframe src="/organization-app/dashboard?freeos_embed=1">` (`OrganizationEntry.tsx`). `org_ui` FastAPI (`org_ui.py`) proxies that path to the private-port Node process.
2. **`ManagedOrganizationRuntime`** — `src/octop/modules/org_os/managed_runtime.py` (restart loop, `OPENXYOS_BASE_URL` on localhost).
3. **`/api/org-module/identity/*` and `/business/*`** — `org_identity.py` forwards login/register and business CRUD to Node `/api/auth` and `/api/*`.
4. **Optional sidecar on `:3780`** — `FREEOS_ORG_SIDECAR` / `SHIP_OPENXYOS_RUNTIME`. Phase 5 default installer is already zero-Node; do not reverse that.
5. **Open-12 host slices that are not App parity** — `host_route_exists=true` in [org-full-parity-inventory.json](org-full-parity-inventory.json) is **not** acceptance. Inventory sets every route to `parity=not_accepted`. Missing depth: reporting-lines, talent market, marketplace, Chat, company/AI/DB settings, attachments, …
6. **Orphan `OrgMiniBrowser.tsx`** — leftover iframe chrome, unused by routes. Do not revive it as Organization home.

## Evidence rules

- Prefer [org-full-parity-inventory.json](org-full-parity-inventory.json) (generated by `scripts/org-parity-inventory.py`), [org-full-integration.md](org-full-integration.md), [org-merge-plan.md](org-merge-plan.md), Dashboard `routeConfigs`, `modules/openxyos` `App.tsx` / `OpenApp.tsx`, and `src/octop/modules/org_os/`.
- Inventory limitation (quoted): static scan only; route existence is not parity.
- **Unknowns** are marked per domain. Do not invent API field maps.
- Two runtimes on current `main`:
  - **Source `freeos run`** (no `FREEOS_ORG_INTEGRATED`): native workbench + org-ui slices; Node sidecar opt-in.
  - **Desktop 0.0.3**: integrated Node + iframe of App.tsx. That is the bridge, not the destination.

## Domains

### 1. Bidirectional assets bus

| | |
|---|---|
| **Lives today** | `src/octop/modules/org_os/assets/` (`freeos.asset-pack.v1`), `apply/apply.py` (HTTP `POST /api/freeos/ingest` when sidecar healthy; always `{FREEOS_HOME}/openxyos-mirror/`), `freeos org assets *`, Organization workbench assemble/pack/loop, `modules/openxyos/backend/routes/freeos-bridge.ts` |
| **Status** | `native_host` |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P0 · Wave A |
| **Next step** | Host-owned ingest/export contract so apply does not need live Node to land employees/talent/plugins in the org room. |
| **Tests** | `tests/unit/test_asset_loop.py`, `test_openxyos_apply.py`, `test_org_loop.py`, `tests/e2e/test_org_growth_loop.py` |
| **Unknown** | Whether standalone commercial export ships the bus as CLI-only or in-app. |

### 2. Export-standalone (commercial package)

| | |
|---|---|
| **Lives today** | `export_standalone.py`, `freeos org export-standalone` (`--mode full` default copies `modules/openxyos` + `slice/`), `scripts/org-export/template/` + `pack/`, copy of `dashboard/src/org-ui`, [org-export.md](org-export.md) |
| **Status** | `export_only` |
| **Depends on Node?** | partial (full tree **runs** with Node; slice still proxies to FreeOS) |
| **Commercial export?** | yes |
| **Priority** | P0 · Wave B |
| **Next step** | Unify with `POST /api/org-module/source/download`; optional self-contained API inside the slice. Do not freeze slice-only SPA+proxy as the commercial artifact. |
| **Tests** | `tests/unit/cli/test_org_export_standalone.py` |
| **Unknown** | Slice self-contained org API is still a stated follow-on, not implemented. |

### 3. Tenant / auth (dual identity)

| | |
|---|---|
| **Lives today** | Studio: FreeOS JWT (`api/routers/auth.py`) when not integrated. Org room (desktop): `integration.py` validates Bearer against sidecar `GET /api/auth/me`. `org_identity.py` login/register/refresh. Login/AuthGuard branch on `integrated`. Export-standalone: local JWT then `POST` FreeOS `/api/auth/login`. |
| **Status** | `managed_node_iframe` (org-room authority still Node) |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P0 · Wave C |
| **Next step** | Keep **two auth spaces** separate. User-facing: studio vs another room. Stop Node `/api/auth` as org-room authority. Do not collapse both entries into one login. |
| **Tests** | `dashboard/src/components/AuthGuard.test.tsx`; org-module proxy header tests |
| **Unknown** | `org-full-integration.md` still says org login is the only authority — historical after P0.1. Export-standalone logging into FreeOS `/api/auth` collides with two spaces unless the commercial package grows its own org accounts. |

### 4. Local models

| | |
|---|---|
| **Lives today** | Dashboard Models (Ollama/GGUF, speed test, set default); `infra/agents/providers/local_register.py`. Org Settings AI still Node `/api/settings/ai`. |
| **Status** | `native_host` (studio) |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P0 · Wave D |
| **Next step** | Organization room consumes the same local pool; do not leave org LLM on sidecar settings. |
| **Tests** | (none org-module-specific found) |
| **Unknown** | No test asserts org pages call host local providers. |

### 5. Host knowledge bases

| | |
|---|---|
| **Lives today** | `/knowledge-bases`, Octop `KnowledgeService` |
| **Status** | `native_host` |
| **Depends on Node?** | no |
| **Commercial export?** | partial |
| **Priority** | P0 · Wave D |
| **Next step** | Local folder mounts/embeddings stay default; WeKnora/IMA remain optional connectors. |
| **Unknown** | Default-path policy vs optional cloud is not fully encoded in org docs on main. |

### 6. Organization knowledge (notes/files)

| | |
|---|---|
| **Lives today** | org-ui `KnowledgePage` + `/api/org-module/knowledge*` wrapping host KB. Original `KnowledgePage.tsx` + sidecar `/api/knowledge` files/notes. |
| **Status** | `org_ui_slice` |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P0 · Wave D |
| **Next step** | Parity for upload/folders/reparse on the host store; do not clone sidecar notes DB. |
| **Tests** | `tests/unit/test_org_knowledge.py`, `KnowledgePage.test.tsx` |

### 7. Managed Node + iframe shell

| | |
|---|---|
| **Lives today** | `managed_runtime.py`, `/organization-app`, `OrganizationEntry.tsx`, openXYOS Vite `base: /organization-app/` |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | no (bridge, not the sellable artifact) |
| **Priority** | P1 · Wave E |
| **Next step** | Native routes own App surfaces; then remove the iframe home and the managed process. |
| **Tests** | `tests/unit/api/test_org_ui.py`, `tests/integration/test_dashboard_serve.py` |

### 8. Optional Node sidecar (:3780)

| | |
|---|---|
| **Lives today** | `FREEOS_ORG_SIDECAR`, `sidecar_launch.py`, `/api/org-module/sidecar/{path}` |
| **Status** | `sidecar_optional` |
| **Depends on Node?** | yes |
| **Commercial export?** | no |
| **Priority** | P2 · Wave E |
| **Next step** | Keep opt-in until native coverage; do not re-bundle into the default installer. |
| **Tests** | `tests/unit/test_org_module.py` |

### 9. Module catalog

| | |
|---|---|
| **Lives today** | `org_os/catalog.py` (12 Open-12 keys) ↔ `open-module-catalog.ts`; `module_toggles.py`; `org-ui/contract.ts` |
| **Status** | `native_host` |
| **Depends on Node?** | no |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Extend keys when native-porting App.tsx verticals; keep drift tests green. |
| **Tests** | catalog comparison in `test_org_module.py` |

### 10. Blueprints / compiler

| | |
|---|---|
| **Lives today** | `org_os/compiler/`, `POST /api/org-module/blueprints/compile`, `freeos org compile-blueprint` |
| **Status** | `native_host` |
| **Depends on Node?** | no |
| **Commercial export?** | yes |
| **Priority** | P0 · Wave A |
| **Next step** | Compiled blueprints ride the assets bus so a customized org can export source without sidecar. |
| **Tests** | `test_blueprint_compiler.py`, `test_colleague_spawn.py` |

### 11. Colleague lifecycle

| | |
|---|---|
| **Lives today** | `org_os/lifecycle/`, `runtime/spawn.py`, `/api/org-module/employees*`, `freeos org employee *` |
| **Status** | `native_host` |
| **Depends on Node?** | no |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | One native flow: directory + talent + `draft → market → recruit → shadow → active`. |
| **Tests** | `test_lifecycle.py`, `test_colleague_spawn.py` |

### 12. Governance (engine + UI)

| | |
|---|---|
| **Lives today** | Host PEP/PDP/pause/MCP; org-ui pauses/audit. Sidecar `/api/governance` permissions, comm-rules, templates **unmigrated**. |
| **Status** | `native_host` (engine) |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Port matrix/rules/templates onto the host engine; do not rewrite PEP/PDP. |
| **Tests** | `test_org_governance.py`, `test_host_governance.py`, `GovernancePage.test.tsx` |

### 13. Organization workbench (assemble / pack / loop)

| | |
|---|---|
| **Lives today** | `/organization` native Ant Design factory (`index.tsx`). **Hidden** on desktop when `integrated=true` (iframe). |
| **Status** | `native_host` |
| **Depends on Node?** | no |
| **Commercial export?** | partial |
| **Priority** | P1 |
| **Next step** | Studio factory and org room both reachable; iframe must not swallow `/organization`. |
| **Tests** | `dashboard/src/pages/Organization/index.test.tsx` |
| **Unknown** | Confirm product wants both rooms without an env flag. |

### 14. Workspace overview

| | |
|---|---|
| **Lives today** | Thin `WorkspacePage` + `GET /api/org-module/overview`. Original OpenDashboard `/app` `/workspace`; commercial Dashboard `/` `/dashboard` has **no** host route. |
| **Status** | `org_ui_slice` |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Native metrics matching OpenDashboard/Dashboard. |
| **Tests** | `test_org_workspace.py`, `WorkspacePage.test.tsx` |

### 15. Announcements

| | |
|---|---|
| **Lives today** | org-ui + `{FREEOS_HOME}/org/announcements.sqlite` + original `AnnouncementPage` |
| **Status** | `org_ui_slice` |
| **Depends on Node?** | no |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Pin/unread/visitor-log parity on the host store. |
| **Tests** | `test_org_announcements.py`, `AnnouncementPage.test.tsx` |

### 16. Org chart

| | |
|---|---|
| **Lives today** | org-ui tree/CRUD on `org_chart.sqlite`. Original: versions, reporting-lines, import, avatars still Node. |
| **Status** | `org_ui_slice` |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Native-port postponed OrgChart features onto the same sqlite. |
| **Tests** | `test_org_chart.py`, `OrgChartPage.test.tsx` |

### 17. People directory

| | |
|---|---|
| **Lives today** | org-ui employees on **same** `org_chart.sqlite`. Original onboard/reserve/offboard/performance/talent still Node. |
| **Status** | `org_ui_slice` |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Lifecycle actions without a second employee database. |
| **Tests** | `EmployeesPage.test.tsx`, `EmployeeDetailPage.test.tsx` |

### 18. Talent market

| | |
|---|---|
| **Lives today** | EmployeesPage talent tab + `/api/talent`. Iframe-only; no host route. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Native list/recruit writing the host lifecycle registry. |
| **Tests** | none on host |
| **Unknown** | Inventory is the evidence the UI calls `/api/talent`. |

### 19. Skills / plugins

| | |
|---|---|
| **Lives today** | org-ui lists `{FREEOS_HOME}/org-skills` via `skill_bridge`. Sidecar marketplace `/api/plugins` unmigrated. |
| **Status** | `org_ui_slice` |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Host inventory is enough for default; marketplace/paid install is export-or-later. |
| **Tests** | `test_org_skills.py`, `test_skill_bridge.py`, `SkillsPage.test.tsx` |

### 20. Agent studio

| | |
|---|---|
| **Lives today** | org-ui AgentsPage → compile + lifecycle. Original `AgentStudioPage`; sidecar `routes/agent-studio.ts` is **not** `app.use`d in `server.ts` (source-tree gap). |
| **Status** | `org_ui_slice` |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Native reference upload + talent registration; do not wait on unmounted sidecar studio. |
| **Tests** | `test_org_agents.py`, `AgentsPage.test.tsx` |
| **Unknown** | Confirm original studio API gap before treating it as a migration blocker. |

### 21. Organization tasks

| | |
|---|---|
| **Lives today** | org-ui + `tasks.sqlite`. Not Octop cron, not Chat. |
| **Status** | `org_ui_slice` |
| **Depends on Node?** | no |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Attachments. |
| **Tests** | `test_org_tasks.py`, Tasks page tests |

### 22. Reflections

| | |
|---|---|
| **Lives today** | org-ui + `reflections.sqlite` |
| **Status** | `org_ui_slice` |
| **Depends on Node?** | no |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Port sidecar skill-stats only if the original page still needs them. |
| **Tests** | `test_org_reflections.py`, `ReflectionsPage.test.tsx` |

### 23. Organization settings

| | |
|---|---|
| **Lives today** | org-ui module toggles + `prefs.json`. Original SettingsPage: company/AI/users/database/tenants still Node. FreeOS `/system-settings` is the **studio** side. |
| **Status** | `org_ui_slice` |
| **Depends on Node?** | partial |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Org-room company/roles/backup on host; do not copy studio keys/timezone into org settings. |
| **Tests** | `test_org_settings.py`, `SettingsPage.test.tsx` |

### 24. Organization collaboration chat

| | |
|---|---|
| **Lives today** | `ChatPage.tsx` + sidecar `/api/chats` + WebSocket. **No** `/organization/chat`. FreeOS `/chat` is agent runtime — keep both. Export currently deep-links an explanation page only. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | yes |
| **Priority** | P1 |
| **Next step** | Native org rooms/mentions/pins. Do **not** replace Octop agent chat. Historical “Chat 永久不迁” in the Open-12 plan is not the product end state ([org-full-integration.md](org-full-integration.md)). |
| **Tests** | none on host |
| **Unknown** | Reuse gateway threads vs new `org_os` store is not decided. |

### 25. Workflows

| | |
|---|---|
| **Lives today** | `WorkflowPage` + designer; `/api/workflows` and `/api/workflows-v2`. App.tsx only. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | yes |
| **Priority** | P2 |
| **Next step** | Inventory v2 designer/instance/task APIs, then host store + org-ui. Leave/expense/daily-report depend on it. |
| **Unknown** | v1 vs v2 overlap is original-system complexity. |

### 26. Contracts

| | |
|---|---|
| **Lives today** | `ContractPage` + `/api/contracts*` (approvals, payments, Gantt). App.tsx only. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | yes |
| **Priority** | P2 |
| **Next step** | After workflows. |

### 27. Physical / org assets (ledger)

| | |
|---|---|
| **Lives today** | `/assets`, `/assets/count`, `/assets/dashboard`, `/assets/vehicles`, `/assets/procurement`, `/assets/:id`. **Not** `freeos.asset-pack.v1`. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | yes |
| **Priority** | P2 |
| **Next step** | Native ledger after Wave A (do not mix the two “assets”). |

### 28. Attendance / leave / expense / daily report

| | |
|---|---|
| **Lives today** | Four App.tsx pages; leave/expense/daily-report call `workflows-v2`. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | yes |
| **Priority** | P2 |
| **Next step** | Cluster after workflows so approvals write back to the same documents. |

### 29. Goals / budgets / routines / performance / efficiency

| | |
|---|---|
| **Lives today** | Five App.tsx pages; no host routes. [org-full-integration.md](org-full-integration.md) “目标与执行” chain. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | yes |
| **Priority** | P2 |
| **Next step** | After host employees + org tasks so goals can reference them. |

### 30. Organization audit trail

| | |
|---|---|
| **Lives today** | `AuditTrailPage` + sidecar `/api/audit/*`. Host governance JSONL is a **different** store. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | yes |
| **Priority** | P2 |
| **Next step** | Unify with host governance audit; do not clone sidecar `/api/audit` blindly. |
| **Unknown** | Which store is commercial SoT. |

### 31. Admin / tenants / payments

| | |
|---|---|
| **Lives today** | `AdminPage` + `/api/admin`, `/api/payments`, `/api/assistant`. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | partial |
| **Priority** | P2 |
| **Next step** | Split SaaS billing/visitor stats (maybe drop) from tenant CRUD the org room needs. |
| **Unknown** | Inventory does not label SaaS vs self-host tabs. |

### 32. Customer service

| | |
|---|---|
| **Lives today** | `CustomerServicePage` + `/api/customers`. In full-integration inventory on purpose. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | partial |
| **Priority** | P2 |
| **Next step** | Native-port only if a commercial package still ships the route; else `export_only`. |
| **Unknown** | Not stated as required for the default FreeOS org room. |

### 33. Electricity market

| | |
|---|---|
| **Lives today** | `ElectricityMarketPage` + `/api/electricity/*`. |
| **Status** | `managed_node_iframe` |
| **Depends on Node?** | yes |
| **Commercial export?** | partial |
| **Priority** | P2 |
| **Next step** | Confirm industry-package demo before a native slice. |

### 34. openXYOS source download

| | |
|---|---|
| **Lives today** | `source_download.py`, `POST /api/org-module/source/download` (GitHub `openXYOS` main.zip). |
| **Status** | `native_host` |
| **Depends on Node?** | no |
| **Commercial export?** | yes |
| **Priority** | P1 · Wave B |
| **Next step** | One artifact with Wave B generated source; GitHub upstream zip ≠ `export-standalone` ≠ customized tree. |
| **Unknown** | Operators currently get three different “source” meanings. |

## Shared org-ui modules (already exported)

From `src/octop/modules/org_os/contract.py` `SHARED_ORG_UI_MODULES`:

`announcements` · `organization` · `employees` · `skills` · `governance` · `knowledge` · `tasks` · `reflections` · `settings` · `agents` · `workspace`

**Not** in that list (still iframe or host-only): `chat` and every commercial `App.tsx` vertical.

Dashboard host routes (`dashboard/src/routes/index.tsx`): `/organization` plus the eleven slices above. There is **no** `/organization/chat`, `/organization/workflows`, `/organization/contracts`, `/organization/assets`, `/organization/attendance`, …

## See also

- [product-contract.md](product-contract.md) (P0.1, on `main`)
- [architecture-integration.md](architecture-integration.md)
- [org-full-integration.md](org-full-integration.md)
- [org-merge-plan.md](org-merge-plan.md)
- [org-export.md](org-export.md)
- [asset-loop.md](asset-loop.md)
- [ADR 003](adr/003-org-ui-single-source-dual-delivery.md)
- [org-full-parity-inventory.json](org-full-parity-inventory.json)
- [README.md](../README.md)

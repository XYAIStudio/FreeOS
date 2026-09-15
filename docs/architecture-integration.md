# FreeOS architecture: Octop host + openXYOS organization module

FreeOS is **Octop** (MIT, Python/FastAPI + React dashboard) with **openXYOS**
(Apache-2.0, Express + React) mounted as an **enable/disable organization
module**. This document is the capability map, the chosen topology, rejected
alternatives, auth/tenant mapping, data ownership, and the phased roadmap.

FreeOS is an independent project. It is not affiliated with Tencent Cloud,
Octop, XYAIStudio, or XYOS trademarks beyond accurate license attribution.
See [NOTICE](../NOTICE).

## 1. Capability map

| Capability | Owner in MVP | Path / API | Notes |
|---|---|---|---|
| Multi-user JWT, agents, chat, plugins, cron, connectors | FreeOS host (Octop) | `src/octop/`, `/api/*`, dashboard `/chat` | Unchanged control plane |
| Plugin seed + enable | `PluginManager` | `src/octop/infra/agents/plugins/`; bundled under `src/octop/infra/agents/plugins/bundled/`; runtime `~/.freeos/plugins/*` (or `~/.octop/plugins/*`) | Seeds bundled plugins disabled, then loads user plugins |
| Organization OS catalog | Bridge (Python) + upstream TS | `src/octop/modules/org_os/catalog.py` mirrors `modules/openxyos/backend/open-module-catalog.ts` and `frontend/src/open-modules.ts` | Keys: workspace, announcements, organization, employees, skills, chat, agents, tasks, knowledge, reflections, governance, settings |
| Enable / disable org module | FreeOS BFF + plugin `org-os` | `PATCH /api/org-module` · `freeos org enable` · dashboard `/organization` · Admin → Plugins | Writes `config.json` `modules.org_os.enabled` and `plugins.org-os.enabled` |
| Org APIs (employees, org tree, tenants, governance, …) | openXYOS sidecar | `modules/openxyos/backend/routes/*.ts` mounted at `/api/org`, `/api/employees`, `/api/tenants`, `/api/governance`, `/api/module-settings`, … | Reachable via sidecar origin or ` /api/org-module/sidecar/{path}` when enabled |
| Org UI | openXYOS Vite/Express app | sidecar `:3780` (default); iframe on `/organization` when healthy | Host shell is FreeOS; org console is the sidecar |
| Branding | FreeOS | `dashboard/public/logo*.png`, `favico.svg`, `pwa-*.png`, `docs/assets/readme-banner.png` | Circular mark: gray ring, yellow/green/red teardrops, blue center |

### Upstream verification (live trees, not hypotheses)

Octop `PluginManager` (`src/octop/infra/agents/plugins/manager.py`):

1. `seed_bundled()` copies `src/octop/infra/agents/plugins/bundled/<id>/` into the install `plugins/` directory with `enabled: false`.
2. `load_installed()` loads `~/.freeos/plugins/*` (legacy `~/.octop/plugins/*`).
3. Dashboard admin patches `PATCH /api/plugins/{id}` `{ "enabled": true }`.

openXYOS module keys are defined twice and must stay aligned:

- Backend catalog: `modules/openxyos/backend/open-module-catalog.ts` (`OPENXYOS_MODULES`)
- Frontend store: `modules/openxyos/frontend/src/open-modules.ts` (`OPEN_MODULE_KEYS`)
- Runtime toggle API: `GET/PUT /api/module-settings` (`open-module-settings` routes)

Dashboard source lives in `dashboard/` and is built into `src/octop/dashboard/` for the packaged server.

## 2. Chosen topology (MVP)

```
                 ┌─────────────────────────────────────────┐
  Browser        │ FreeOS dashboard (React, dashboard/)    │
                 │  shell, chat, plugins, /organization    │
                 └───────────────┬─────────────────────────┘
                                 │ JWT cookie / Bearer
                 ┌───────────────▼─────────────────────────┐
  Host process   │ FastAPI  src/octop/api/app.py            │
                 │  /api/* Octop routers                    │
                 │  /api/org-module/status|catalog|PATCH    │
                 │  /api/org-module/sidecar/*  (BFF proxy)  │
                 │  PluginManager + bundled org-os          │
                 └───────────────┬─────────────────────────┘
                                 │ HTTP, X-FreeOS-User*
                 ┌───────────────▼─────────────────────────┐
  Sidecar        │ openXYOS  modules/openxyos               │
  (optional)     │  Express :3780  + React org console      │
                 │  own SQLite/Postgres + tenants           │
                 └─────────────────────────────────────────┘
```

**Why this topology**

- Octop is Python; openXYOS is TypeScript. A full language merge would rewrite
  org routes, PEP/PDP, and the module catalog into FastAPI — high risk, no MVP.
- Octop already has a plugin enable/disable surface. Treating org OS as a
  bundled plugin plus a first-class dashboard page matches that model.
- A BFF proxy keeps one browser origin for API calls later (SSO, CSRF) without
  forcing openXYOS to import Python packages.

### Sequence: enable the module

```
User → GET /organization
     → GET /api/org-module/status
Host → read ~/.freeos/config.json modules.org_os
     → GET {sidecar}/api/health/livez
User → Switch on
     → PATCH /api/org-module  { "enabled": true }
Host → write modules.org_os.enabled + plugins.org-os.enabled
     → optional PluginManager.set_enabled("org-os", true)
User → bash scripts/run-org-sidecar.sh
Host → iframe embed_url when livez succeeds
Agent → tool org_os_status (bundled plugin)
```

### Sequence: call an org API through the BFF

```
User (JWT) → GET /api/org-module/sidecar/api/org
Host       → 409 if disabled
           → 503 if livez fails
           → strip Authorization, add X-FreeOS-User / X-FreeOS-User-Id / X-FreeOS-Role
           → GET http://127.0.0.1:3780/api/org
Sidecar    → own cookie/JWT still required for mutating org routes
```

## 3. Rejected alternatives

| Alternative | Why rejected for MVP |
|---|---|
| Rewrite openXYOS routes into FastAPI / SQLAlchemy | Two full backends, duplicate PEP/PDP, months of work, easy to break tenants |
| iframe-only with no BFF or plugin | No enable/disable in the host; agents cannot see org capabilities |
| npm-import openXYOS React into the Octop dashboard | Conflicting routers, Vite configs, auth stores; would still need the Express API |
| Git submodule only, no vendored tree | Clone would not be self-contained; CI/offline installs break |
| Rename every `octop` package/import to `freeos` | Touches hundreds of files and breaks `orcakit-harness-agent` assumptions; documented as leftover identifiers instead |

## 4. Auth and tenant mapping

| Layer | Identity | Store |
|---|---|---|
| FreeOS host | Octop `User` (id, username, role, permissions) | `~/.freeos/octop.db` (legacy filename) + JWT |
| openXYOS sidecar | Sidecar users + `tenant_id` | `modules/openxyos` SQLite/Postgres (`DB_DIALECT`) |

**MVP contract**

- FreeOS JWT is **not** accepted as an openXYOS session. The proxy strips
  `Authorization` so a host token cannot be confused with a sidecar token.
- The proxy **does** forward `X-FreeOS-User`, `X-FreeOS-User-Id`,
  `X-FreeOS-Role` for later SSO / JIT provisioning.
- Operators sign in to the sidecar separately (openXYOS `/api/auth`).
- Phase 2 should map `FreeOS user.id → openXYOS tenant member` with a signed
  handshake (one-time code or shared OIDC).

Default sidecar origin: `http://127.0.0.1:3780`  
Override: `FREEOS_ORG_SIDECAR_URL` or `config.json` `modules.org_os.sidecar_url`.

## 5. Data ownership

| Data | Location | License / notes |
|---|---|---|
| Host config, users, agents, chats, plugins | `FREEOS_HOME` else `OCTOP_HOME` else existing `~/.freeos` or `~/.octop`, else new `~/.freeos` | MIT host platform |
| Bundled plugin copies | `{home}/plugins/org-os/` | MIT bridge; seeded disabled |
| Org tenants, employees, governance, module settings | sidecar working dir / openXYOS DB | Apache-2.0 tree under `modules/openxyos/` |
| Brand assets | `dashboard/public/`, `docs/assets/freeos-banner.png` | FreeOS |

The two databases are **not** merged in MVP. Backups of FreeOS (`octop backup` /
`freeos backup`) do not include sidecar data unless operators back up the
openXYOS directory themselves.

## 6. Remaining `octop` identifiers (intentional)

A full rename is larger than this MVP. These stay for compatibility:

- Python package and imports: `octop.*` (`pyproject.toml` `name = "octop"`)
- CLI: `octop` still works; `freeos` is an alias to the same entry point
- Env: `OCTOP_HOME`, `OCTOP_USER`, `OCTOP_DATABASE_*` still honored; prefer `FREEOS_HOME` / `FREEOS_ORG_SIDECAR_URL`
- SQLite filename: `octop.db` inside the home directory
- Many tests, IM channels, and desktop strings still say “Octop”

## 7. Phased roadmap

1. **MVP (this branch)** — import Octop history; vendor openXYOS; FreeOS branding in the UI shell and README; org module toggle + catalog + sidecar proxy/plugin.
2. **SSO** — exchange FreeOS JWT for an openXYOS session; map one host user to one tenant member.
3. **Unified nav** — surface individual openXYOS modules (organization, employees, governance) as FreeOS sidebar items gated by sidecar module-settings.
4. **Shared agents** — register sidecar AI employees as Octop experts/tools instead of a second agent runtime.
5. **Optional deep merge** — only after APIs stabilize; port selected org routes into FastAPI if a single process is required.

## 8. Concrete file index

| Role | Path |
|---|---|
| Architecture (this file) | `docs/architecture-integration.md` |
| BFF router | `src/octop/api/routers/org_module.py` |
| Enablement + health | `src/octop/modules/org_os/service.py` |
| Catalog | `src/octop/modules/org_os/catalog.py` |
| Proxy | `src/octop/modules/org_os/proxy.py` |
| Bundled plugin | `src/octop/infra/agents/plugins/bundled/org-os/` |
| Dashboard page | `dashboard/src/pages/Organization/index.tsx` |
| CLI | `src/octop/cli/commands/org.py` (`freeos org`) |
| Sidecar launcher | `scripts/run-org-sidecar.sh` |
| Vendored org OS | `modules/openxyos/` (subtree from XYAIStudio/openXYOS @ `1bdba35f`) |

# FreeOS × openXYOS integration architecture

FreeOS is the **Octop-derived data plane** (MIT: skills, workspace FS, memory,
cron, multi-agent, MCP, sandboxes, real IM channels) plus a **control-plane
contract** from openXYOS (Apache-2.0: org hierarchy, multi-tenant modules,
`openxyos.agent-blueprint.v1`, governance, module catalog).

They are complementary, not competitors. FreeOS does **not** replace Octop’s
agent runtime with openXYOS chat. openXYOS is the organization control plane;
FreeOS/Octop remains the execution runtime.

## Related

- [ADR 001](adr/001-single-process-model.md) — single process, no external queue
- [ADR 003](adr/003-org-ui-single-source-dual-delivery.md) — org-ui single source, dual delivery (Accepted)
- [org-merge-plan.md](org-merge-plan.md) — Phases 0–5; Phase 2 = Announcements; Phase 3 org chart slice in progress
- [asset-loop.md](asset-loop.md) — operator self-growth loop
- [ADR index](adr/)

## North star — internally self-growing multi-agent management

FreeOS grows its own AI workforce and capability catalog:

1. The **data plane** (FreeOS/Octop) **produces** AI employees, skills,
   plugins, MCPs, and related assets at scale.
2. Those assets **assemble into openXYOS** so org modules get stronger
   (tenant-toggleable drafts — never auto-on).
3. openXYOS assets (org tree, `openxyos.agent-blueprint.v1`, governance,
   module catalog, talent market, knowledge/reflections) **feed back**
   into FreeOS to spawn or upgrade more runtime agents and skills.
4. The loop repeats and is **runnable**: `freeos org loop run`. Operator
   guide: [asset-loop.md](asset-loop.md).

FreeOS is an independent project. It is not affiliated with Tencent Cloud,
Octop, XYAIStudio, or XYOS trademarks beyond accurate license attribution.
See [NOTICE](../NOTICE) and `modules/openxyos/TRADEMARKS.md`.

## Framing

| Plane | System | Owns |
|---|---|---|
| **Control plane** | openXYOS sidecar (`modules/openxyos`) | Org tree, tenants, module catalog, blueprints `openxyos.agent-blueprint.v1`, governance/audit, talent market, module contract |
| **Data plane** | FreeOS host (Octop) | Agent runtime, SKILL.md, workspace FS, harness-memory, cron, multi-agent, MCP connectors, sandboxes, Feishu/DingTalk/Discord/… |

```
  Control plane (openXYOS)          Data plane (FreeOS / Octop)
  ────────────────────────          ───────────────────────────
  tenants / org tree                agent workspace + sandbox
  module catalog + toggles          SKILL.md + plugins
  agent-blueprint.v1                SOUL.md / MEMORY / cron
  GovernanceEngine + audit          MCP + HITL IM + tool_guard
  talent market                     running agent instances
```

## Running topology

Desktop keeps **one** resident runtime: the FreeOS/Octop Python host.
Organization control-plane capabilities (`org_os`, `/api/org-module/*`,
the Organization page) live in that host. The full openXYOS Node stack on
`127.0.0.1:3780` is **optional** (export / sync / advanced deploy). It is
not required to install FreeOS, open Organization, or run
`freeos org loop run`. Default Windows NSIS and portable zips do **not**
embed `openxyos-runtime.zip` (the ~500MB Node payload). Opt-in builds set
`SHIP_OPENXYOS_RUNTIME=1`.

The host inserts governance in front of high-risk data-plane tools,
generates module skills, compiles blueprints into chat-usable colleagues,
and applies asset packs onto openXYOS-shaped **in-host** surfaces
(`{FREEOS_HOME}/openxyos-mirror/`, lifecycle registry, org-skills).

```
                 ┌─────────────────────────────────────────────┐
  Browser / IM   │ FreeOS dashboard + Octop IM channels         │
                 │  /organization (native) · /experts · /approve│
                 └───────────────┬─────────────────────────────┘
                                 │ JWT / IM session
                 ┌───────────────▼─────────────────────────────┐
  Host           │ FastAPI  src/octop/api/app.py                │
  (single runtime)│ /api/* Octop routers                        │
                 │  /api/org-module/status|catalog|overview     │
                 │  /api/org-module/assemble|pack|loop|produce  │
                 │  /api/org-module/employees|assets|governance │
                 │  in-host org storage + xyos-governance-mcp   │
                 └───────┬───────────────────┬─────────────────┘
                         │ optional HTTP     │ durable pause
                         │ if opted in       │ ~/.freeos/governance/
                 ┌───────▼─────────┐   ┌─────▼─────────────────┐
  Optional       │ openXYOS :3780  │   │ Pause + audit JSONL   │
  Node sidecar   │ export / sync   │   │ Human must approve    │
                 └─────────────────┘   └───────────────────────┘
```

**Why this topology for 2 + 3**

- Governance as MCP matches Octop’s connector model (`overlay_stdio_spec_env`)
  without rewriting `GovernanceEngine` into FastAPI.
- Default-deny lives in-process so a down sidecar cannot fail *open*.
- Durable pauses live on the FreeOS home disk so a process restart cannot
  silently resume a high-risk tool.
- Generated skills call the existing BFF (`/api/org-module/sidecar/…`) so
  tenant headers and enablement checks stay in one place.
- Reverse publish writes a plugin draft + tenant-toggle payload; it does
  not auto-install into production tenants.

### Sequence: high-risk tool (Direction 2)

```
Agent → tool (outbound / delete / pay / prod)
     → GovernanceInterceptor.enforce() / MCP check_policy
     → classify → high-risk
     → optional POST {sidecar}/api/governance/validate
     → no matching allow rule → DEFAULT DENY
     → write audit.jsonl (and sidecar log when reachable)
     → create durable pause  ~/.freeos/governance/pauses/<id>.json
     → return execute=false  (caller MUST stop)
Human → FreeOS/Octop IM /approve  or  `freeos org governance approve <id>`
     → pause status=approved
Agent → check_policy(approval_id=…)
     → execute=true only for the same tool + args digest
     → tool runs
```

If the interceptor/MCP result is `deny` or `pending`, execution is a hard
stop. Prompt-only “please get approval” is not governance.

### Sequence: module → skill (Direction 3)

```
Operator → freeos org skills generate [--module employees]
Host     → OPENXYOS_MODULES + endpoint map
         → write skills/org-<key>/SKILL.md
         → write skills/org-<key>/scripts/call_module.py
Skill    → curl/python  /api/org-module/sidecar/api/<resource>
         → headers X-FreeOS-Tenant-Id / X-FreeOS-User*
         → high-risk verbs go through governance first
Polished → freeos org skills publish <dir>
         → plugin.yaml draft + sidecar tenant-toggle payload
         → operator enables per tenant; not auto-on
```

## Seven directions (all required for the running loop)

#### Direction 2 — `xyos-governance-mcp` + host tool_guard

Wrap openXYOS governance/audit as an MCP server and insert it **before**
high-risk tool calls.

| Piece | Path |
|---|---|
| Engine (default deny, classify, sidecar validate) | `src/octop/modules/org_os/governance/` |
| Durable pause / resume + JSONL audit | `{FREEOS_HOME}/governance/` |
| stdio MCP | `xyos-governance-mcp` → `mcp_server.py` |
| HTTP BFF | `POST /api/org-module/governance/check` |
| Enable | `freeos org governance enable` |
| How-to | `src/octop/modules/org_os/governance/README.md` |

High-risk classes: **outbound**, **delete**, **pay**, **prod**. Unmatched
rules **deny**. Human approval is a durable pause; `execute` stays false
until the pause is approved for the same action digest.

#### Direction 3 — Module ↔ Skill bidirectional bridge

| Direction | Behavior |
|---|---|
| Module → skill | Generate FreeOS/Octop `SKILL.md` from the openXYOS catalog; each skill calls real `/api/…` routes via the BFF with tenant headers |
| Skill → module | Publish a polished skill as a tenant-toggleable plugin draft (`plugin.yaml` + sidecar payload). Never auto-enable |

| Piece | Path |
|---|---|
| Generator / publisher | `src/octop/modules/org_os/skill_bridge/` |
| Catalog source | `src/octop/modules/org_os/catalog.py` (mirrors `modules/openxyos/backend/open-module-catalog.ts`) |
| CLI | `freeos org skills generate` · `freeos org skills publish` |
| How-to | `src/octop/modules/org_os/skill_bridge/README.md` |

### Directions 1 + 4 + asset loop (implemented)

#### Direction 1 — `xyos2freeos` / blueprint compiler

Compile `openxyos.agent-blueprint.v1` (see
`modules/openxyos/backend/routes/agent-studio.ts`) into a runnable FreeOS
agent workspace:

- `SOUL.md`, `skills/`, `knowledge/`, MEMORY seed, tenant-scoped `.env`
- `cron.json` from `job_duties` (enabled only in `active`)
- reverse telemetry: `export-profile` → openXYOS HR payload (`OpenXyosHrClient`)

| Piece | Path |
|---|---|
| Compiler | `src/octop/modules/org_os/compiler/` |
| CLI | `xyos2freeos` · `freeos org compile-blueprint` · `freeos org employee spawn` |
| How-to | `src/octop/modules/org_os/compiler/README.md` |

Do **not** start a second chat runtime. The compiler emits files the
existing Octop agent already knows how to run.

#### Direction 4 — Digital-colleague lifecycle

`draft → market → recruit → shadow → active → offboard`

| FreeOS | openXYOS talent / employee |
|---|---|
| draft | not listed |
| market | `talent_pool.status=available` |
| recruit | `recruited` + `employment_category=reserve` |
| shadow | probation, read-only + governance |
| active | staff; cron enabled |
| offboard | archived; `.env` revoked; MEMORY copied to org-knowledge |

Persisted in `{FREEOS_HOME}/tenants/<id>/employees/registry.json`, not
sidecar SQL.js.

| Piece | Path |
|---|---|
| Store + transitions | `src/octop/modules/org_os/lifecycle/` |
| CLI | `freeos org employee list\|transition\|export-profile` |

#### Bidirectional asset factory

| Direction | CLI | Behavior |
|---|---|---|
| Outbound | `freeos org assets publish` | Pack skills/plugins/MCPs/agents as `freeos.asset-pack.v1` + `openxyos/` drafts |
| Inbound | `freeos org assets import --catalog\|--blueprint\|--policies\|--from-sidecar` | Drive skill generator, compiler, and `imported-policies.json` (engine loads it; allow still needs human approval) |

High-risk runtime actions still pass through Phase A governance.

#### Direction 5 — Chat / session routing (implemented as far as the loop needs)

Compiled colleagues are registered as FreeOS agents (`org-<slug>`) with a
tenant routing table (`tenants/<id>/routing.json`). `AgentManager.resolve_user_agent`
resolves colleague slugs and display names so produced employees are
usable in FreeOS chat. This does **not** duplicate openXYOS chat.

#### Direction 6 — Org memory hooks (implemented as far as the loop needs)

Colleague `MEMORY.md` + `knowledge/` sync into
`tenants/<id>/org-knowledge/live/<slug>/`. Offboard still archives into
`org-knowledge/archived-colleagues/`. Tenant isolation stays at the
workspace boundary.

#### Direction 7 — Org-as-code GitOps (beyond the running loop)

Reconcile control-plane YAML with running agents. The contract and
runtime now exist; GitOps convergence remains an operator workflow on
top of `freeos org loop run`, not a substitute for it.

## Risks (encoded in design)

1. **openXYOS is a community-candidate; SQL.js is the default.** Use it as
   the control-plane / contract layer, not the production multi-tenant
   database of record. Durable FreeOS state (pauses, audit, workspaces)
   lives under `FREEOS_HOME`. Sidecar data is optional and separately
   backed up.
2. **Octop is not natively multi-tenant.** Isolate as **one tenant = one
   workspace / sandbox instance**. Never rely on prompt-only isolation.
   Generated skills always send `X-FreeOS-Tenant-Id`; the BFF must not
   collapse tenants into one agent home.
3. **Licenses and trademarks.** Preserve Apache-2.0 (vendored tree) and
   MIT (host + bridge). Follow `modules/openxyos/TRADEMARKS.md`: FreeOS
   uses distinct branding (circular mark already in the dashboard/README).
   No XYOS / Tencent Cloud trademark claims.
4. **Human approval must truly block execution.** A `pending` or `deny`
   decision sets `execute=false` and the interceptor raises
   `GovernanceBlockedError`. Cosmetic “please confirm” text in a skill
   is not sufficient. Restarts must not resume paused high-risk calls.

## Host bootstrap (unchanged)

The Phase A work sits on the existing FreeOS bootstrap:

- Octop history as the host (`src/octop/`, `dashboard/`)
- openXYOS vendored at `modules/openxyos/` (subtree `@ 1bdba35f`)
- Bundled plugin `org-os`, BFF `/api/org-module`, CLI `freeos org`
- PathLayout: `FREEOS_HOME` > `OCTOP_HOME` > existing `~/.freeos` >
  existing `~/.octop` > new `~/.freeos`
- Package name stays `octop`; CLI alias `freeos`

### Capability map (host + sidecar)

| Capability | Owner | Path / API |
|---|---|---|
| Multi-user JWT, agents, chat, plugins, cron, connectors | FreeOS host | `src/octop/`, `/api/*` |
| Plugin seed + enable | `PluginManager` | bundled `src/octop/infra/agents/plugins/bundled/`; runtime `{home}/plugins/*` |
| Organization OS catalog | Bridge + upstream TS | `catalog.py` ↔ `open-module-catalog.ts` / `open-modules.ts` |
| Enable / disable org module | BFF + plugin `org-os` | `PATCH /api/org-module` · `freeos org enable` · `/organization` |
| Governance MCP (Phase A) | Bridge | `xyos-governance-mcp` · `/api/org-module/governance/*` |
| Module ↔ skill bridge (Phase A) | Bridge | `freeos org skills generate|publish` |
| Blueprint compiler (Phase B) | Bridge | `xyos2freeos` · `/api/org-module/blueprints/compile` |
| Colleague lifecycle (Phase B) | Bridge | `freeos org employee *` · `{home}/tenants/<id>/employees/` |
| Asset factory | Bridge | `freeos org assets publish\|import\|apply` · `{home}/asset-packs/` · `{home}/openxyos-mirror/` |
| Self-growth loop | Bridge | `freeos org loop run` · `/api/org-module/loop/run` |
| Colleague agents | Host agents table | `org-<slug>` · `{home}/org-agents/` · tenant `routing.json` |
| Org APIs | Host BFF + optional sidecar | `/api/org-module/*` in-host (announcements + org chart CRUD are in-host); sidecar `/api/org`, `/api/employees`, … until each remaining CRUD slice moves (see [org-merge-plan.md](org-merge-plan.md)) |
| Org UI | Host Dashboard (`org-ui`) | Native `/organization` workbench + `/organization/announcements` + `/organization/org` (shared `dashboard/src/org-ui`). Standalone site is **exported** from the same source (`freeos org export-standalone`). Sidecar `:3780` iframe is opt-in compat only |

### Auth and tenant mapping

| Layer | Identity | Store |
|---|---|---|
| FreeOS host | Octop `User` | `{home}/octop.db` + JWT |
| openXYOS sidecar | Sidecar users + `tenant_id` | sidecar SQL.js / Postgres (`DB_DIALECT`) |

- FreeOS JWT is **not** an openXYOS session. The proxy strips
  `Authorization` and forwards `X-FreeOS-User`, `X-FreeOS-User-Id`,
  `X-FreeOS-Role`, `X-FreeOS-Tenant-Id`.
- Operators still sign in to the sidecar for mutating org routes.
- Tenant isolation for agents is **workspace/sandbox per tenant**, not
  a shared workspace with a header in the prompt.

Default sidecar: `http://127.0.0.1:3780`  
Override: `FREEOS_ORG_SIDECAR_URL` or `config.json` `modules.org_os.sidecar_url`.  
Tenant hint: `FREEOS_ORG_TENANT_ID` or `modules.org_os.tenant_id`.

### Data ownership

| Data | Location |
|---|---|
| Host users, agents, chats, plugins | `FREEOS_HOME` / legacy `OCTOP_HOME` |
| Governance pauses + audit | `{home}/governance/pauses/`, `{home}/governance/audit.jsonl` |
| Generated org skills | `{home}/org-skills/` (or `--out`) |
| Digital colleagues | `{home}/tenants/<tenant>/employees/<slug>/` |
| Asset packs | `{home}/asset-packs/` |
| Org tenants, employees, matrix | sidecar DB — **not** the production SoT |
| Brand assets | `dashboard/public/`, `docs/assets/` |

`freeos backup` does not include sidecar SQL.js files unless operators
copy the openXYOS working directory themselves.

## Remaining `octop` identifiers (intentional)

- Python package / imports: `octop.*` (`pyproject.toml` `name = "octop"`)
- CLI: `octop` still works; `freeos` is the same entry point
- Env: `OCTOP_*` still honored; prefer `FREEOS_*`
- SQLite filename: `octop.db`
- Many tests and IM strings still say “Octop”

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Replace Octop chat with openXYOS chat | Violates the control/data-plane split; loses IM, cron, sandboxes |
| Rewrite openXYOS routes into FastAPI | Duplicate PEP/PDP; not MVP |
| Prompt-only multi-tenant isolation | Risk 2; one tenant = one workspace/sandbox |
| iframe-only, no BFF / MCP / skills | Agents cannot call org APIs or be governed |
| Permanent dual UI process or hand-maintained standalone | Rejected in [ADR 003](adr/003-org-ui-single-source-dual-delivery.md): one `org-ui` source, Dashboard adapter + export |
| Start with org-as-code GitOps (Direction 7) | End-state; contract + runtime first |
| Fail-open when sidecar/SQL.js is down | Makes governance cosmetic |

## Concrete file index

| Role | Path |
|---|---|
| Architecture (this file) | `docs/architecture-integration.md` |
| Org-ui dual-delivery ADR | `docs/adr/003-org-ui-single-source-dual-delivery.md` |
| Org merge plan (Phases 0–5) | `docs/org-merge-plan.md` |
| BFF router | `src/octop/api/routers/org_module.py` |
| Enablement + health | `src/octop/modules/org_os/service.py` |
| Catalog | `src/octop/modules/org_os/catalog.py` |
| Proxy + tenant headers | `src/octop/modules/org_os/proxy.py` |
| Self-growth loop (operators) | `docs/asset-loop.md` |
| Governance MCP / interceptor | `src/octop/modules/org_os/governance/` |
| Module ↔ skill bridge | `src/octop/modules/org_os/skill_bridge/` |
| Blueprint compiler | `src/octop/modules/org_os/compiler/` |
| Colleague lifecycle | `src/octop/modules/org_os/lifecycle/` |
| Asset factory | `src/octop/modules/org_os/assets/` |
| Apply + mirror | `src/octop/modules/org_os/apply/` |
| Loop orchestrator | `src/octop/modules/org_os/loop/` |
| Colleague spawn / routing / memory | `src/octop/modules/org_os/runtime/` |
| Host governance middleware | `src/octop/infra/agents/middleware/org_governance.py` |
| Bundled plugin | `src/octop/infra/agents/plugins/bundled/org-os/` |
| Dashboard page | `dashboard/src/pages/Organization/index.tsx` |
| CLI | `src/octop/cli/commands/org.py` |
| Sidecar launcher | `scripts/run-org-sidecar.sh` |
| Vendored org OS | `modules/openxyos/` |

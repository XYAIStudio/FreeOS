# FreeOS × openXYOS integration architecture

FreeOS is the **Octop-derived data plane** (MIT: skills, workspace FS, memory,
cron, multi-agent, MCP, sandboxes, real IM channels) plus a **control-plane
contract** from openXYOS (Apache-2.0: org hierarchy, multi-tenant modules,
`openxyos.agent-blueprint.v1`, governance, module catalog).

They are complementary, not competitors. FreeOS does **not** replace Octop’s
agent runtime with openXYOS chat. openXYOS is the organization control plane;
FreeOS/Octop remains the execution runtime.

## North star — internally self-growing multi-agent management

FreeOS grows its own AI workforce and capability catalog:

1. The **data plane** (FreeOS/Octop) **produces** AI employees, skills,
   plugins, MCPs, and related assets at scale.
2. Those assets **assemble into openXYOS** so org modules get stronger
   (tenant-toggleable drafts — never auto-on).
3. openXYOS assets (org tree, `openxyos.agent-blueprint.v1`, governance,
   module catalog, talent market, knowledge/reflections) **feed back**
   into FreeOS to spawn or upgrade more runtime agents and skills.
4. The loop repeats. Phase A is the safety gate + module↔skill pipe.
   Phase B is the blueprint compiler, colleague lifecycle, and the
   bidirectional asset factory. Operator guide:
   [asset-loop.md](asset-loop.md).

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

## Chosen MVP topology (Phase A — Directions 2 + 3)

Phase A does **not** compile blueprints or merge chat UIs. It inserts
governance in front of high-risk data-plane tools, and generates real
module skills that call sidecar `/api/*` with tenant headers.

```
                 ┌─────────────────────────────────────────────┐
  Browser / IM   │ FreeOS dashboard + Octop IM channels         │
                 │  /organization · /approve · /pending         │
                 └───────────────┬─────────────────────────────┘
                                 │ JWT / IM session
                 ┌───────────────▼─────────────────────────────┐
  Host           │ FastAPI  src/octop/api/app.py                │
  (data plane)   │  /api/* Octop routers                        │
                 │  /api/org-module/status|catalog|PATCH        │
                 │  /api/org-module/governance/*                │
                 │  /api/org-module/skills/*                    │
                 │  /api/org-module/sidecar/*  (BFF proxy)      │
                 │  PluginManager + bundled org-os              │
                 │  xyos-governance-mcp (stdio MCP)             │
                 └───────┬───────────────────┬─────────────────┘
                         │ HTTP              │ durable pause
                         │ X-FreeOS-User*    │ ~/.freeos/governance/
                         │ X-FreeOS-Tenant-Id│
                 ┌───────▼─────────┐   ┌─────▼─────────────────┐
  Sidecar        │ openXYOS :3780  │   │ Pause + audit JSONL   │
  (control plane)│ /api/governance │   │ Human must approve    │
                 │ /api/module-…   │   │ before execute=true   │
                 │ own SQL.js/PG   │   └───────────────────────┘
                 └─────────────────┘
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

## Seven directions

### Phase A — implement now (highest value / verifiable)

#### Direction 2 — `xyos-governance-mcp`

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

### Phase B — implemented (Directions 1 + 4 + asset loop)

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

### Phase C — architecture only (do not implement in this pass)

#### Direction 5 — Chat / session routing Web ↔ IM

One conversation identity across FreeOS dashboard chat and Octop IM
channels. Route; do not duplicate openXYOS chat as the agent loop.

#### Direction 6 — Reflections ↔ harness-memory

openXYOS reflections become an org learning loop that writes into
harness-memory (and back). Keep tenant isolation at the workspace
boundary, not in the prompt.

#### Direction 7 — Org-as-code GitOps (end-state, not MVP start)

Reconcile control-plane YAML (modules, blueprints, policy) with running
agents. Desired end-state: git is the source of org intent; FreeOS
instances converge. Not the starting point — the contract and runtime
must exist first (Phases A/B).

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
| Asset factory (Phase B) | Bridge | `freeos org assets publish\|import` · `{home}/asset-packs/` |
| Org APIs | openXYOS sidecar | `/api/org`, `/api/employees`, `/api/governance`, `/api/module-settings`, … |
| Org UI | openXYOS Vite/Express | sidecar `:3780`; iframe on `/organization` when healthy |

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
| Start with org-as-code GitOps (Direction 7) | End-state; contract + runtime first |
| Fail-open when sidecar/SQL.js is down | Makes governance cosmetic |

## Concrete file index

| Role | Path |
|---|---|
| Architecture (this file) | `docs/architecture-integration.md` |
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
| Bundled plugin | `src/octop/infra/agents/plugins/bundled/org-os/` |
| Dashboard page | `dashboard/src/pages/Organization/index.tsx` |
| CLI | `src/octop/cli/commands/org.py` |
| Sidecar launcher | `scripts/run-org-sidecar.sh` |
| Vendored org OS | `modules/openxyos/` |

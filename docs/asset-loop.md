# FreeOS self-growth loop (operator guide)

FreeOS is meant to **grow its own AI workforce** over time. You do not
need to write code. The loop has four moves:

1. **Produce** runtime assets on FreeOS/Octop (the data plane): AI
   employees, skills, plugins, MCP connectors.
2. **Assemble** those assets into openXYOS (the control plane) so org
   modules get stronger.
3. **Feed back** openXYOS org structure, blueprints, governance, the
   module catalog, and the talent market into FreeOS to spawn or upgrade
   more agents and skills.
4. **Repeat.** Each cycle adds colleagues and capabilities.

openXYOS does **not** replace Octop chat. Octop still runs the agents.
Governance from Phase A still **blocks** high-risk tools until a human
approves.

## One-time enable

```bash
uv sync
uv run freeos init
uv run freeos org enable
bash scripts/run-org-sidecar.sh          # optional control-plane UI
uv run freeos org governance enable --tenant-id 1
```

Set a tenant and keep it. **One tenant = one workspace/sandbox.** Do not
share a home directory across companies.

## The loop, in commands

### Inbound — control plane → runtime

Import the module catalog (makes `org-*` skills) and/or a blueprint
(makes an AI employee workspace):

```bash
uv run freeos org assets import --catalog
uv run freeos org assets import --blueprint path/to/blueprint.json --tenant-id 1
uv run freeos org assets import --policies path/to/matrix.json --tenant-id 1
# optional: GET sidecar /api/governance/permissions (best-effort)
uv run freeos org assets import --from-sidecar --tenant-id 1
# same as:
uv run xyos2freeos path/to/blueprint.json --tenant-id 1
uv run freeos org employee spawn --blueprint path/to/blueprint.json --tenant-id 1
```

A blueprint is JSON with `"schema": "openxyos.agent-blueprint.v1"`
(name, positioning, capabilities, optional experience / references /
`job_duties` for cron).

### Lifecycle — grow a colleague safely

```
draft → market → recruit → shadow → active → offboard
```

```bash
uv run freeos org employee list --tenant-id 1
uv run freeos org employee transition my-analyst market
uv run freeos org employee transition my-analyst recruit
uv run freeos org employee transition my-analyst shadow    # read-only + human review
uv run freeos org employee transition my-analyst active    # cron from job duties turns on
uv run freeos org employee transition my-analyst offboard  # revoke .env + archive MEMORY
```

| FreeOS state | Meaning | openXYOS mapping |
|---|---|---|
| `draft` | Workspace compiled, not listed | not in talent market |
| `market` | Listed for hire | `talent_pool.status = available` |
| `recruit` | Hired into reserve | `recruited` + `employment_category = reserve` |
| `shadow` | Probation: read-only, governance on | `probation` |
| `active` | Full runtime colleague | `staff` |
| `offboard` | Credentials cleared, memory archived | `archived` / `inactive` |

Shadow and offboard keep cron **disabled**. Offboard copies `MEMORY.md`
into `{FREEOS_HOME}/tenants/<id>/org-knowledge/archived-colleagues/`.

### Outbound — runtime → control plane drafts

```bash
uv run freeos org skills generate          # if you have not imported the catalog yet
uv run freeos org assets publish
uv run freeos org employee export-profile my-analyst --tenant-id 1
```

`assets publish` writes `{FREEOS_HOME}/asset-packs/latest/`:

- `skills/` — generated / polished SKILL.md trees
- `plugins/` — tenant-toggleable plugin drafts (`enabled: false`)
- `mcps/` — `xyos-governance-mcp` stdio snippet
- `agents/` — compiled colleague workspaces
- `openxyos/` — payloads shaped for `/api/plugins`, `/api/module-settings`, `/api/employees`, `/api/talent` (`org-employees.publish.json`, `org-talent.publish.json`)
- `manifest.json` — `freeos.asset-pack.v1`

Packed agent `.env` files keep only tenant/slug/schema keys. Secrets are stripped.

Nothing is auto-enabled on the sidecar. You review the draft, then toggle
per tenant.

`export-profile` writes an HR/capability digest locally and **tries**
`POST /api/employees`. If the sidecar is down, the local draft is the
record (SQL.js is not the production database).

## Where files live

| What | Path |
|---|---|
| Tenant tree | `{FREEOS_HOME}/tenants/<tenant-id>/` |
| Colleague workspace | `…/employees/<slug>/` (`SOUL.md`, `MEMORY.md`, `skills/`, `knowledge/`, `.env`, `cron.json`) |
| Lifecycle registry | `…/employees/registry.json` |
| Generated module skills | `{FREEOS_HOME}/org-skills/` |
| Governance pauses / audit | `{FREEOS_HOME}/governance/` |
| Imported policy matrix | `{FREEOS_HOME}/governance/imported-policies.json` (engine loads this) |
| Asset pack | `{FREEOS_HOME}/asset-packs/latest/` |

## High-risk actions

Outbound, delete, pay, and production changes still go through
`xyos-governance-mcp`. If `execute` is false, the tool must not run.
See `src/octop/modules/org_os/governance/README.md`.

## What this run does not do

Chat/session routing (Web ↔ IM), reflections ↔ harness-memory as a live
learning loop, and org-as-code GitOps stay **Phase C / architecture
only**. The loop above is enough to grow colleagues and a capability
catalog on disk.

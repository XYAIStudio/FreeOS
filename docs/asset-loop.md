# FreeOS self-growth loop

> Product intent: [product-contract.md](product-contract.md). The loop is how Octop and openXYOS **assets interoperate**. Sidecar ingest on `:3780` is a bridge; the durable mirror works without Node. Running the loop does not collapse the organization room and everyday studio use into one way in.

FreeOS **grows its own AI workforce**. The loop is the product:

1. **Produce** runtime assets on FreeOS (the data plane): experts / assistants not yet in a department, skills, plugins, MCP connectors.
2. **Assemble** those assets into openXYOS (the control plane) as department employees so org modules get stronger.
3. **Feed back** openXYOS org structure, blueprints, governance, the module catalog, and the talent market into FreeOS as colleagues — same-organization peers you can chat with.
4. **Repeat.** Each cycle adds colleagues and capabilities that are usable in FreeOS chat and governed.

openXYOS does **not** replace FreeOS chat. FreeOS still runs the agents. Governance **blocks** high-risk tools until a human approves.

## One command

```bash
uv sync
uv run freeos org loop run
# or: bash scripts/org-loop.sh
```

That path:

- enables the org module + governance gate
- imports the demo catalog / blueprint / policies (`tests/fixtures/org-loop/`)
- compiles colleagues and promotes `draft → market → recruit → shadow → active`
- **registers real FreeOS agents** (`org-<slug>`) so they appear in chat routing
- publishes `freeos.asset-pack.v1`
- **applies** the pack via `/api/freeos/ingest` when a managed organization runtime, `OPENXYOS_BASE_URL`, or `{FREEOS_HOME}/org-os/runtime.json` is available (always a durable `{FREEOS_HOME}/openxyos-mirror/` as well). Ingest uses the **current org workspace tenant**, not a hardcoded `1`. Without a runtime URL the loop stays mirror-only and does not start Node.
- imports the applied surfaces back
- proves a high-risk tool is blocked (`execute=false`)

Proof lands at `{FREEOS_HOME}/asset-packs/loop-proof.json`.

## One-time enable (optional, already done by `loop run`)

```bash
uv run freeos init
uv run freeos org enable
bash scripts/run-org-sidecar.sh          # optional live control-plane UI
uv run freeos org governance enable --tenant-id 1
```

Set a tenant and keep it. **One tenant = one workspace/sandbox.** Do not share a home directory across companies.

## Manual steps (same loop, split out)

### Inbound — control plane → runtime

```bash
uv run freeos org assets import --catalog
uv run freeos org assets import --blueprint tests/fixtures/org-loop/agent-blueprint.v1.json --tenant-id 1
uv run freeos org assets import --policies tests/fixtures/org-loop/policies.json --tenant-id 1
uv run freeos org assets import --from-sidecar --tenant-id 1
# same as:
uv run xyos2freeos tests/fixtures/org-loop/agent-blueprint.v1.json --tenant-id 1
uv run freeos org employee spawn --blueprint tests/fixtures/org-loop/agent-blueprint.v1.json --tenant-id 1
```

A blueprint is JSON with `"schema": "openxyos.agent-blueprint.v1"`.
Import **spawns a FreeOS agent** (workspace + `octop.db` row + routing table), not only files on disk.

### Lifecycle — grow a colleague safely

```
draft → market → recruit → shadow → active → offboard
```

```bash
uv run freeos org employee list --tenant-id 1
uv run freeos org employee transition my-analyst market
uv run freeos org employee transition my-analyst recruit
uv run freeos org employee transition my-analyst shadow    # read-only + human review; agent registered
uv run freeos org employee transition my-analyst active    # cron from job duties turns on
uv run freeos org employee transition my-analyst offboard  # revoke .env + archive MEMORY
```

Shadow and offboard keep cron **disabled**. Offboard copies `MEMORY.md` into `{FREEOS_HOME}/tenants/<id>/org-knowledge/archived-colleagues/`. Live colleagues sync MEMORY + knowledge into `org-knowledge/live/<slug>/` so chat has org memory.

### Outbound — runtime → control plane

```bash
uv run freeos org assets publish
uv run freeos org assets apply
uv run freeos org employee export-profile my-analyst --tenant-id 1
```

`assets publish` writes `{FREEOS_HOME}/asset-packs/latest/`.
`assets apply` POSTs to `/api/freeos/ingest` when a control-plane URL is present (`OPENXYOS_BASE_URL`, `FREEOS_ORG_SIDECAR_URL`, or `{FREEOS_HOME}/org-os/runtime.json` from the managed runtime) and always writes `{FREEOS_HOME}/openxyos-mirror/<tenant>/`. Ingest follows the **org workspace tenant** (config / `FREEOS_ORG_TENANT_ID` / the organization room), so department employees, talent, skills, and plugins land in that workspace. FreeOS studio accounts stay separate from the org room. With no runtime URL, apply is mirror-only and does not start Node.

## Host ↔ org asset bus

| Direction | What moves |
|---|---|
| FreeOS → org | Asset pack apply / `POST /api/org-module/loop/run` ingest employees, talent, skills, plugins, MCP into the control plane when a runtime URL exists (`remote_applied=true`) |
| Org → FreeOS | Import + spawn registers chat-addressable colleagues as `org-<slug>` agents |
| No runtime | Same loop; durable `openxyos-mirror/` only; `remote_applied=false` |

## Where files live

| What | Path |
|---|---|
| Tenant tree | `{FREEOS_HOME}/tenants/<tenant-id>/` |
| Colleague workspace | `…/employees/<slug>/` (`SOUL.md`, `MEMORY.md`, `skills/`, `knowledge/`, `.env`, `cron.json`, `agent.json`) |
| Lifecycle registry | `…/employees/registry.json` |
| Chat routing | `…/routing.json` |
| Generated module skills | `{FREEOS_HOME}/org-skills/` |
| Spawned agents | `{FREEOS_HOME}/org-agents/` and the host `agents` table |
| Governance pauses / audit | `{FREEOS_HOME}/governance/` |
| Imported policy matrix | `{FREEOS_HOME}/governance/imported-policies.json` |
| Asset pack | `{FREEOS_HOME}/asset-packs/latest/` |
| Control-plane mirror | `{FREEOS_HOME}/openxyos-mirror/<tenant>/` |
| Managed runtime origin | `{FREEOS_HOME}/org-os/runtime.json` |
| Loop proof | `{FREEOS_HOME}/asset-packs/loop-proof.json` |

## High-risk actions

Outbound, delete, pay, and production changes go through `OrgGovernanceMiddleware` on the host tool path and `xyos-governance-mcp`. If `execute` is false, the tool does not run. See `src/octop/modules/org_os/governance/README.md`.

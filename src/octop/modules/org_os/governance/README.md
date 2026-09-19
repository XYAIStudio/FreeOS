# xyos-governance-mcp (Direction 2)

Wraps openXYOS governance as a FreeOS/Octop **stdio MCP** and a hard
in-process interceptor. High-risk tools (`outbound`, `delete`, `pay`,
`prod`) are **default-denied**. Human approval is a durable pause on
disk. `execute` stays false until the same tool + args digest is
re-checked with the approval id.

This is the data-plane gate. It does **not** replace Octop HITL or the
agent runtime. openXYOS `GovernanceEngine.validateAction` is consulted
when the sidecar is up; a down sidecar **fails closed**.

## Enable

```bash
# 1. Organization module + sidecar (control plane, optional but recommended)
uv run freeos org enable
bash scripts/run-org-sidecar.sh

# 2. Turn on the governance gate and write the MCP connector snippet
uv run freeos org governance enable
```

That writes:

- `config.json` → `modules.org_os.governance.enabled = true`
- `{FREEOS_HOME}/governance/xyos-governance-mcp.json` — paste into the
  agent’s MCP / connector stdio list

Or run the server directly:

```bash
FREEOS_HOME=~/.freeos FREEOS_ORG_TENANT_ID=1 uv run xyos-governance-mcp
```

Octop overlays stdio env via `overlay_stdio_spec_env` (spec env wins;
`OCTOP_*` keys are protected). Prefer `FREEOS_HOME` and
`FREEOS_ORG_TENANT_ID` in the snippet.

## Tools

| MCP tool | Purpose |
|---|---|
| `classify` | outbound / delete / pay / prod / low |
| `check_policy` | default-deny + optional durable pause; `execute` is the only green light |
| `resolve_approval` | human approve/reject (does **not** run the tool) |
| `audit_tail` | local `{FREEOS_HOME}/governance/audit.jsonl` |

CLI equivalents:

```bash
uv run freeos org governance check --tool delete_employee --category delete
uv run freeos org governance approve <pause_id>
uv run freeos org governance reject <pause_id>
uv run freeos org governance audit
```

HTTP (host JWT):

- `POST /api/org-module/governance/check`
- `POST /api/org-module/governance/resolve` (plugins / admin)
- `GET /api/org-module/governance/pauses`
- `GET /api/org-module/governance/audit`

Dashboard: `/organization/governance` (shared `org-ui` GovernancePage).

## Approval must block

1. Agent calls `check_policy` (or `gate_tool_call` / `enforce`).
2. High-risk + no matching allow rule → `status=pending`, `execute=false`.
3. Pause file: `{FREEOS_HOME}/governance/pauses/<id>.json`.
4. Human approves via IM (`/approve` once wired) or the CLI.
5. Agent **re-checks** with `approval_id`. Only then is `execute=true`.
6. Restarts do not resume: in-memory HITL is not the source of truth.

If you catch `GovernanceBlockedError` and still run the tool, governance
is cosmetic — do not do that.

## Isolation

One tenant = one FreeOS workspace/sandbox. Set `FREEOS_ORG_TENANT_ID`
per instance. Do not share a workspace across tenants and “prompt” the
model to stay isolated.

SQL.js in openXYOS is the contract/sidecar store, not the production
audit of record. Local `audit.jsonl` is.

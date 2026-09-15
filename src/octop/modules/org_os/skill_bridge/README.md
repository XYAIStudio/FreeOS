# Module ↔ Skill bridge (Direction 3)

Bidirectional path between the openXYOS **module catalog** (control plane)
and FreeOS/Octop **skills** (data plane).

- **Forward:** generate `SKILL.md` + `scripts/call_module.py` that hit
  real sidecar `/api/…` routes with tenant headers.
- **Reverse:** publish a polished skill as a **tenant-toggleable** plugin
  draft. Nothing is auto-enabled.

openXYOS chat is not the agent runtime. These skills call APIs; Octop
still runs the agent.

## Enable / generate

```bash
uv run freeos org enable
uv run freeos org skills generate
# or one module:
uv run freeos org skills generate --module employees
```

Default output: `{FREEOS_HOME}/org-skills/org-<module>/`.

Each skill:

- YAML frontmatter (`name`, `description`, `metadata.freeos.module_key`)
- Documents `X-FreeOS-Tenant-Id` / `X-FreeOS-User*`
- Tables real `/api/org`, `/api/employees`, `/api/governance`, …
- Calls the BFF: `/api/org-module/sidecar{path}`
- Sends high-risk verbs through `xyos-governance-mcp` before HTTP

```bash
FREEOS_ORG_TENANT_ID=1 FREEOS_HOME=~/.freeos \
  python ~/.freeos/org-skills/org-employees/scripts/call_module.py \
    --method GET --path /api/employees --risk low
```

## Publish back (tenant toggle)

```bash
uv run freeos org skills publish ~/.freeos/org-skills/org-employees
```

Writes `org-employees.plugin/` next to the skill (or `--out`):

| File | Role |
|---|---|
| `plugin.yaml` / `main.py` / `ui/` | Octop bundled-plugin shape |
| `publish.json` | Sidecar POST `/api/plugins` + PUT `/api/module-settings` payload |

`enabled` is always `false` in the draft. Operators enable per tenant.
Do not install one plugin copy into a shared workspace used by multiple
tenants.

## Isolation and licenses

- One tenant = one workspace/sandbox instance (not prompt isolation).
- Generated skills are MIT host/bridge code. They call Apache-2.0
  sidecar APIs; they do not rebrand as XYOS.

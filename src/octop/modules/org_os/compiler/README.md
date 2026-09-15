# xyos2freeos (Direction 1)

Compiles `openxyos.agent-blueprint.v1` into a **tenant-scoped** FreeOS
agent workspace. Octop remains the runtime.

```bash
uv run xyos2freeos blueprint.json --tenant-id 1
# or
uv run freeos org compile-blueprint blueprint.json --tenant-id 1
uv run freeos org employee spawn --blueprint blueprint.json --tenant-id 1
```

Writes `{FREEOS_HOME}/tenants/<tenant>/employees/<slug>/`:

| File | Source |
|---|---|
| `SOUL.md` | name, positioning, capabilities, governance rules |
| `MEMORY.md` | experience + reference excerpts |
| `knowledge/` | one markdown file per blueprint reference |
| `skills/<cap>/SKILL.md` | one skill stub per capability |
| `.env` | tenant id, sidecar URL, home — no shared secrets |
| `cron.json` | `job_duties` (`name`, `schedule`, `prompt`); enabled only when lifecycle is `active` |
| `blueprint.json` | normalized source |

Reverse path: `freeos org employee export-profile <slug>` writes an
openXYOS-shaped HR payload (`OpenXyosHrClient`). HTTP is best-effort;
the local draft is authoritative.

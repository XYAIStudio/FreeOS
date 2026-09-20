# Node runtime: flags, defaults, cut plan

**Status:** Canonical for Node packaging (P2). Product intent:
[product-contract.md](product-contract.md). Capability map:
[org-capability-migration-map.md](org-capability-migration-map.md) wave **E**.

Managed Node + iframe is a **transition bridge** toward native host
organization UI. It is not the destination and must not be re-frozen as
`SHIP_OPENXYOS_RUNTIME=1` forever.

[简体中文](node-runtime.zh-CN.md)

## Defaults (zero-Node)

These paths **do not** bundle, extract, or start Node:

| Path | How |
|---|---|
| `uv run freeos run` / `octop run` | Host Python only. Organization is `/organization` + `/api/org-module/*`. |
| Docker Compose / `docker/Dockerfile` | One Python process. No sidecar service, no port 3780. |
| Default `desktop/portable/package.sh` | `SHIP_OPENXYOS_RUNTIME` defaults to `0` → `SKIP_ORG_SIDECAR=1`. |
| Default `wails3 task package` | `SHIP_OPENXYOS_RUNTIME` defaults to `0`; NSIS does not embed `openxyos-runtime.zip`. |

Missing Node is **skip**, not host abort. `ManagedOrganizationRuntime.start()`
logs a warning and returns when no bundled/source runtime is present, so
`FREEOS_ORG_INTEGRATED=1` on a source checkout does not fail `uv run`.

## Transitional desktop flavor (explicit opt-in)

The GitHub workflow **FreeOS Desktop Package** (`.github/workflows/octop-desktop.yml`)
sets `SHIP_OPENXYOS_RUNTIME=1` and `SKIP_ORG_SIDECAR=0` so existing Windows
users keep the 0.0.3 iframe bridge (still packaged by 0.0.4 desktop CI). That flag is **labeled transitional** in
the workflow, NSIS strings, and this file. Do not copy it into Docker, `uv run`,
or the default installer.

| Flag | Default | Meaning |
|---|---|---|
| `SHIP_OPENXYOS_RUNTIME` | `0` | Build-time: embed `org-sidecar` / `openxyos-runtime.zip`. Desktop CI sets `1`. |
| `SKIP_ORG_SIDECAR` | follows ship flag (`1` when ship is `0`) | Packager escape hatch. Explicit `0` still ships sidecar. |
| `FREEOS_ORG_SIDECAR` | unset | Runtime: start optional `:3780` sidecar (`ensure_sidecar`). |
| `FREEOS_ORG_INTEGRATED` | unset (desktop Go may set `1`) | Runtime: iframe `/organization` → `/organization-app` + managed Node. |
| `OPENXYOS_BASE_URL` / `FREEOS_ORG_SIDECAR_URL` | unset | Point asset loop / BFF at a live control plane. Does not start Node. |

## Cut plan (tied to the migration map)

Do **not** delete the managed runtime until native coverage exists. Sequence
from [org-capability-migration-map.md](org-capability-migration-map.md):

1. **Keep** default installers / `uv run` / Docker zero-Node (this file).
2. **Keep** desktop `SHIP_OPENXYOS_RUNTIME=1` until wave E domains that still
   live only in App.tsx (`managed_node_iframe`) have a native host route
   operators can use.
3. **Then** stop setting `SHIP_OPENXYOS_RUNTIME=1` in desktop CI (same as
   default packaging). Sidecar remains `FREEOS_ORG_SIDECAR=1` for export/sync.
4. **Last** remove `ManagedOrganizationRuntime` and the `/organization-app`
   iframe home.

Anti-goals: re-bundling Node into Docker or `uv run`; calling iframe “done”;
expanding `SHIP_OPENXYOS_RUNTIME=1` to new flavors.

## Images and security (release hygiene)

| What | Canonical FreeOS target |
|---|---|
| GHCR image | `ghcr.io/xyaistudio/freeos:{version\|latest}` |
| Local Compose tag | `octop:latest` (compatibility alias; one Python process) |
| Security advisories | [XYAIStudio/FreeOS](https://github.com/XYAIStudio/FreeOS/security/advisories/new) |
| PyPI package name | `octop` (intentional remaining identifier; CLI is `freeos`) |

### Release / PyPI / Docker gates

- **Docker Publish** pushes GHCR always. Docker Hub login is **optional**
  (`DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`). Missing Hub secrets must not
  fail the workflow.
- **PyPI** still publishes the `octop` distribution (`PYPI_API_TOKEN` on the
  `pypi` environment). That name is the Python package, not a pointer at
  Tencent Cloud advisories.
- **FnOS Docker `.fpk`** compose must pull `ghcr.io/xyaistudio/freeos`, not
  `ghcr.io/tencentcloud/octop`.

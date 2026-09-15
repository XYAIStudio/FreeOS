<p align="center">
  <img src="docs/assets/readme-banner.png" alt="FreeOS" width="600" />
</p>

<p align="center">
  <strong>FreeOS — a self-hosted multi-user, multi-agent assistant with an optional organization OS.</strong>
</p>

<p align="center">
  <a href="https://www.python.org/downloads/"><img alt="Python 3.12+" src="https://img.shields.io/badge/python-3.12%2B-blue?logo=python&logoColor=white" /></a>
  <a href="LICENSE"><img alt="License: MIT + Apache-2.0" src="https://img.shields.io/badge/license-MIT%20%2B%20Apache--2.0-green" /></a>
</p>

<p align="center">
  <a href="#run-freeos">Run</a> ·
  <a href="#enable-the-organization-module">Organization module</a> ·
  <a href="#license-and-attribution">License</a> ·
  <a href="docs/architecture-integration.md">Architecture</a>
</p>

**FreeOS** is an independent open-source host for teams and individuals. The control plane is derived from [Octop](https://github.com/TencentCloud/Octop) (MIT). Organization capabilities come from [openXYOS](https://github.com/XYAIStudio/openXYOS) (Apache-2.0), wired as an **enable/disable sidecar module** — not a trademark or product affiliation with Tencent Cloud or XYAIStudio.

The web shell, README banner, favicons, and PWA icons use the FreeOS circular mark (gray ring, yellow / green / red teardrops, blue center).

## Run FreeOS

### Prerequisites

- Python 3.12+ (the project uses [uv](https://docs.astral.sh/uv/))
- Node.js 20.19+ only if you start the organization sidecar or rebuild the dashboard

### From this repository

```bash
git clone https://github.com/XYAIStudio/FreeOS.git
cd FreeOS
uv sync
uv run freeos init
uv run freeos run
```

`freeos` is an alias of the upstream `octop` CLI (same package). Either name works.

Open the dashboard (default port is the Octop/FreeOS listen port printed by `run`, commonly `http://127.0.0.1:18900`). Complete the first-run wizard.

Data directory precedence:

1. `FREEOS_HOME`
2. `OCTOP_HOME` (legacy)
3. existing `~/.freeos`
4. existing `~/.octop`
5. new installs → `~/.freeos`

### Rebuild the dashboard (optional)

```bash
cd dashboard
npm install
npm run build
```

The Vite app in `dashboard/` is what you edit; packaged builds land in `src/octop/dashboard/`.

### Tests

```bash
uv run pytest tests/unit/test_org_module.py tests/unit/test_paths.py tests/unit/test_bundled_plugins_layout.py tests/unit/test_governance_mcp.py tests/unit/test_skill_bridge.py
```

Full Octop-derived suite: `uv run pytest` / `make test-fast` (needs the usual extra services for marked tests).

## Enable the organization module

The host stays Python. openXYOS stays a TypeScript sidecar under `modules/openxyos/`. Toggle it from any of:

| Surface | Action |
|---|---|
| Dashboard | Sidebar → **Organization** → enable switch |
| CLI | `uv run freeos org enable` · `uv run freeos org status` |
| Plugin | Admin → Plugins → **Organization OS** (`org-os`) |
| API | `PATCH /api/org-module` with `{ "enabled": true }` |

Then start the sidecar (Node 20+):

```bash
bash scripts/run-org-sidecar.sh
```

Default origin: `http://127.0.0.1:3780` (`FREEOS_ORG_SIDECAR_URL` / `FREEOS_ORG_SIDECAR_PORT` to override). When `/api/health/livez` succeeds, `/organization` embeds the org console and `/api/org-module/sidecar/*` proxies to it.

Sidecar env is generated at `modules/openxyos/.env` on first launch (do not commit secrets). See `modules/openxyos/.env.example` and [docs/architecture-integration.md](docs/architecture-integration.md).

**Auth (MVP):** FreeOS JWT users and openXYOS tenants are separate. The proxy forwards `X-FreeOS-User*` and `X-FreeOS-Tenant-Id`; sign in to the sidecar for mutating org APIs. One tenant = one workspace/sandbox — not prompt isolation.

## Phase A — governance MCP + module skills

openXYOS is the **control plane**. FreeOS/Octop stays the **data plane** (do not replace Octop chat). Phase A inserts governance before high-risk tools and generates skills from the module catalog.

### Direction 2 — `xyos-governance-mcp`

```bash
uv run freeos org governance enable
# writes {FREEOS_HOME}/governance/xyos-governance-mcp.json — add that stdio server to the agent
uv run xyos-governance-mcp   # optional: run by hand
uv run freeos org governance check --tool delete_employee --category delete
```

High-risk classes (`outbound`, `delete`, `pay`, `prod`) **default-deny**. Human approval is a durable pause under `~/.freeos/governance/pauses/`. `execute` stays false until `freeos org governance approve <id>` (or IM `/approve` once wired) and the agent **re-checks** with the same args. How-to: [src/octop/modules/org_os/governance/README.md](src/octop/modules/org_os/governance/README.md).

### Direction 3 — module ↔ skill bridge

```bash
uv run freeos org skills generate
uv run freeos org skills publish ~/.freeos/org-skills/org-employees
```

Each generated `SKILL.md` calls real `/api/…` routes through `/api/org-module/sidecar` with tenant headers. Publish writes a **disabled** tenant-toggleable plugin draft — it does not auto-enable. How-to: [src/octop/modules/org_os/skill_bridge/README.md](src/octop/modules/org_os/skill_bridge/README.md).

Phase B (blueprint compiler, digital-colleague lifecycle) and Phase C (chat routing, reflections, org-as-code) are specified in [docs/architecture-integration.md](docs/architecture-integration.md) only.

## Host platform features (from Octop)

Unchanged in this fork: multi-user JWT, multi-agent chat, expert library, connectors, ACP, knowledge bases, bundled plugins, cron, terminal/browser/desktop surfaces. Upstream-oriented installers and desktop artifacts still refer to **Octop** and `~/.octop/` — use `freeos` / `FREEOS_HOME` here.

Longer host docs: [docs/user-guide.md](docs/user-guide.md), [docs/configuration.md](docs/configuration.md), [docs/architecture.md](docs/architecture.md), [README_CN.md](README_CN.md).

## License and attribution

| Component | License | Location |
|---|---|---|
| FreeOS host + bridge | MIT | [LICENSE](LICENSE), [NOTICE](NOTICE) |
| Octop-derived code | MIT | Copyright Octop contributors; no Tencent Cloud affiliation claimed |
| openXYOS tree | Apache-2.0 | [modules/openxyos/LICENSE](modules/openxyos/LICENSE), [licenses/APACHE-2.0.txt](licenses/APACHE-2.0.txt) |

## Remaining `octop` identifiers

Intentional for MVP compatibility (not a rebrand miss):

- Python package name `octop` and `import octop`
- CLI `octop` alongside `freeos`
- `OCTOP_*` environment variables
- SQLite file `octop.db` inside the home directory
- Many internal tests and IM strings

See [docs/architecture-integration.md](docs/architecture-integration.md) for the seven integration directions, Phase A/B/C, and the chosen MVP topology.

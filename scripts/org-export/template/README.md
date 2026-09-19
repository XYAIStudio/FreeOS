# Standalone Organization web (openXYOS)

This directory is produced by `freeos org export-standalone`.
Pages come from **the same** `dashboard/src/org-ui` source Dashboard mounts
under `/organization/...`. Do not fork those pages.

Chat is **not** migrated. `/chat` is a deep-link stub that points operators
back to FreeOS / Octop.

## What you get

| Module | Standalone route | Host API (interim) |
|---|---|---|
| workspace | `/app` | `GET /api/org-module/overview` |
| announcements | `/announcements` | `/api/org-module/announcements` |
| organization | `/org` | `/api/org-module/org` |
| employees | `/employees` | `/api/org-module/org/employees` |
| skills | `/skills` | `/api/org-module/skills` |
| agents | `/agents` | `/api/org-module/agents` |
| tasks | `/tasks` | `/api/org-module/tasks` |
| knowledge | `/knowledge` | `/api/org-module/knowledge` |
| reflections | `/reflections` | `/api/org-module/reflections` |
| governance | `/governance` | `/api/org-module/governance` |
| settings | `/settings` | `/api/org-module/settings` |

Components: `AnnouncementPage`, `OrgChartPage`, `EmployeesPage`,
`EmployeeDetailPage`, `SkillsPage`, `GovernancePage`, `KnowledgePage`,
`TasksPage`, `TaskDetailPage`, `ReflectionsPage`, `SettingsPage`,
`AgentsPage`, `WorkspacePage`.

## Auth (IdentityBridge)

Standalone uses a **local JWT** stored as `openxyos.standalone.jwt`.
That key is distinct from the FreeOS Dashboard `auth_token` session.

The login page posts to `/api/auth/login` on the configured FreeOS host
(via the same-origin proxy). After sign-in, every org-ui request sends
`Authorization: Bearer <token>`.

## Interim vs target API

**Interim (this package):** the SPA talks to `/api` on its own origin.
`npm run dev`, `npm start`, and Docker **proxy** `/api` to a FreeOS host
(`FREEOS_UPSTREAM`). That host already implements `/api/org-module/*`.

**Target end-state:** a self-contained server in this package that stores
org data and issues its own local JWT — no FreeOS process required.
`server/proxy.mjs` is the placeholder for that server.

## Run locally

```bash
cp .env.example .env          # set FREEOS_UPSTREAM if FreeOS is not :8088
npm install
npm run dev                   # Vite on :3780, proxies /api
```

Production-style (build + tiny Node static/proxy server):

```bash
npm install
npm run build
FREEOS_UPSTREAM=http://127.0.0.1:8088 npm start
```

Open `http://127.0.0.1:3780`, sign in with a FreeOS user.

## Docker

```bash
export FREEOS_UPSTREAM=http://host.docker.internal:8088
docker compose up --build
```

`docker-compose.yml` publishes `:3780` and proxies `/api` to `FREEOS_UPSTREAM`.
On Linux the compose file adds `host-gateway` so `host.docker.internal` works.

## Config

| Variable | Where | Meaning |
|---|---|---|
| `VITE_API_BASE` | build-time | SPA API prefix. Default `/api` (same origin). |
| `FREEOS_UPSTREAM` | runtime | FreeOS origin that owns `/api/org-module` and `/api/auth`. |
| `PORT` | `npm start` / Vite | Listen port (default 3780). |

## Not included

- openXYOS Chat / a second agent runtime
- Default FreeOS installer changes (sidecar stays optional — Phase 5)
- Commercial `App.tsx` routes (contracts, attendance, …)

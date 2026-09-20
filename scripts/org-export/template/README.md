# Host-bridge Organization slice (openXYOS)

This directory is the **MIT host-bridge slice** from `freeos org export-standalone`.

Pages come from **the same** `dashboard/src/org-ui` source the FreeOS Dashboard
mounts under `/organization/...`. Do not fork those pages.

Default export (`--mode full`) places this tree under `slice/` next to the
Apache-2.0 `openxyos/` app. `--mode slice` writes only this SPA at the output
root.

中文说明见下方。

## What you get

| Module | Standalone route | Host API (proxied) |
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

`/coverage` renders `modules.json` against the desktop org inventory.
Commercial `App.tsx` verticals (contracts, assets, attendance, …) are **not**
in this slice; they ship in the sibling `openxyos/` tree of a full pack.

## Chat (two different things)

- **Organization collaboration chat** ships in the **full** pack (`openxyos/`
  `App.tsx` `/chat`). This slice only has a stub at `/chat`.
- **FreeOS / Octop agent chat** (studio conversations) is **not** exported.
  Open `/chat` on the host Dashboard. This slice does not ship a second agent
  runtime.

## Auth (IdentityBridge)

This slice uses a **local JWT** stored as `openxyos.standalone.jwt`.
That key is distinct from the FreeOS Dashboard `auth_token` session.

The login page currently posts to `/api/auth/login` on the configured FreeOS
host (via the same-origin proxy). That is an **interim bridge**, not the
organization-room end state. The full `openxyos/` tree has its own room
signup/login. Everyday studio use and the organization room stay two ways in.

## Still host-proxied

**This slice:** the SPA talks to `/api` on its own origin. `npm run dev`,
`npm start`, and Docker **proxy** `/api` to a FreeOS host (`FREEOS_UPSTREAM`)
that already implements `/api/org-module/*`.

**Full pack `openxyos/`:** self-contained Express APIs — no FreeOS process
required to run App.tsx.

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

Open `http://127.0.0.1:3780`. Sign-in currently uses a host user as a bridge.

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

## License

MIT for this slice (see `LICENSE`). The sibling `openxyos/` tree, when present,
is Apache-2.0.

---

# 宿主桥组织切片（openXYOS）

本目录是 `freeos org export-standalone` 的 **MIT 宿主桥 slice**。

页面与 FreeOS Dashboard 在 `/organization/...` 下挂载的 **同一套**
`dashboard/src/org-ui` 同源，请勿分叉。

默认导出（`--mode full`）把它放在 `slice/`，旁边是 Apache-2.0 的 `openxyos/`。
`--mode slice` 只把本 SPA 写到输出根目录。

## 仍走宿主的部分

slice 的 `/api` 反代到 `FREEOS_UPSTREAM`（`/api/org-module/*` 与过渡性的
`/api/auth/login`）。完整 `openxyos/` 树自带 Express，不需要 FreeOS 也能跑
App.tsx。

## 有意省略

- **工作室智能体对话**不导出，留在 FreeOS 宿主 `/chat`。
- **组织沟通协作**在完整包的 `openxyos/` 里；本 slice 的 `/chat` 只是说明页。
- 商业 App.tsx 垂类不在本 SPA，在完整树里。

工作室日常与组织房间两种进入方式保持分开。slice 登录打宿主只是过渡桥，不是终态。

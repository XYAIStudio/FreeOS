# openXYOS source pack (FreeOS export)

This directory is produced by `freeos org export-standalone` (default `--mode full`).
It is a **commercializable openXYOS system source** generated from a FreeOS checkout — not only a thin SPA that reverse-proxies the host.

Chinese: [README.zh-CN.md](README.zh-CN.md)

## What you get

| Path | What it is | License |
|---|---|---|
| `openxyos/` | Vendored **full** openXYOS tree (`App.tsx` + Express APIs). Run it with Node. | **Apache-2.0** |
| `slice/` | Host-bridge org-ui SPA (Open-12 pages from `dashboard/src/org-ui`). Proxies `/api` to a FreeOS host. | **MIT** |
| `modules.json` | Route/module manifest vs the desktop host `/organization` inventory | — |
| `NOTICE` | License split and attribution | — |

`uv run freeos org export-standalone --out … --mode slice` writes only the MIT SPA at the output root (same files as `slice/` here).

## How to run standalone

### Full organization app (recommended for productization)

Needs **Node ≥ 20.19**. This is the original App.tsx surface (Open-12 + commercial verticals + organization collaboration chat).

```bash
cd openxyos
cp .env.example .env    # optional
npm ci
npm run dev             # Vite + Express; see openxyos/README.md
```

The full tree has its **own organization-room signup/login**. That space is separate from everyday FreeOS studio signup. Do not treat “log in with a FreeOS studio user” as the commercial end state.

### Host-bridge slice (talks to a running FreeOS)

Use this when you want the thinner in-host org-ui pages against `/api/org-module` without standing up the Node app.

```bash
cd slice
cp .env.example .env    # set FREEOS_UPSTREAM if FreeOS is not :8088
npm install
npm run dev             # Vite on :3780, proxies /api
```

Or: `FREEOS_UPSTREAM=http://127.0.0.1:8088 docker compose up --build` inside `slice/`.

Slice login currently posts to the host `/api/auth/login` as an **interim bridge**. Organization-room identity in the full tree is separate. Everyday studio use and the organization room stay two ways in.

## Still host-proxied (slice only)

| Call | Notes |
|---|---|
| `/api/org-module/*` | Slice CRUD goes to the FreeOS host BFF |
| `/api/auth/login` | Slice bridge only; not the org-room end state |

The **full** `openxyos/` tree is self-contained: its Express server implements `/api/auth`, `/api/announcements`, `/api/chats`, commercial verticals, and so on. Optional FreeOS ingest (`/api/freeos/*`) remains a bridge if you connect the two products later.

## Manifest

`modules.json` lists:

- `shared_org_ui_modules` — pages extracted into `dashboard/src/org-ui` (also the slice SPA)
- `host_organization_routes` — desktop Dashboard `/organization/…`
- `openxyos_app_routes` — `App.tsx` / `OpenApp.tsx` routes, each flagged `in_slice` / `in_full_tree` / `host_route_exists`
- `omissions` — intentional gaps (see below)

Compare this file to the host inventory. The slice SPA also renders it at `/coverage`.

## Intentional omissions

| Id | Full tree | Slice | Why |
|---|---|---|---|
| `freeos_agent_chat` | no | no | Studio agent chat, IM, cron, sandboxes stay on FreeOS. Not a second agent runtime. |
| `org_collaboration_chat` | **yes** (`/chat`) | stub page | Org rooms ship in `openxyos/`; the slice does not replace studio chat. |
| `desktop_iframe_nsis` | no | no | Managed Node + iframe / NSIS is a FreeOS desktop bridge, not this pack. |

Commercial `App.tsx` verticals (contracts, assets, attendance, workflows, …) **are** in `openxyos/`. They are omitted from the slice SPA on purpose (documented in `modules.json` as `kind: commercial`, `in_slice: false`).

## Commercialization notes

- **Apache-2.0** applies to `openxyos/` (and unmodified copies of that tree). See `openxyos/LICENSE` and `openxyos/NOTICE`. Keep attribution; trademark rules are in `openxyos/TRADEMARKS.md` when present.
- **MIT** applies to the FreeOS-authored host bridge: `slice/` (Vite shell, IdentityBridge, copied `org-ui` pages, Docker/proxy helpers). See `slice/LICENSE`.
- You may productize and self-host the Apache tree. Replacing slice proxy calls with the Express APIs (or your own) is expected follow-on work for a fully detached commercial site.
- This pack is **not** the default FreeOS installer. Default desktop/NSIS/portable builds stay zero-Node.

## Identity (soft)

FreeOS is a local studio; organization capabilities are another room you can arrange on its own. Two ways in stay distinct. The full tree’s organization-room accounts are not the studio login, and the slice’s host-bridge login is not the destination identity model.

## See also

- `openxyos/README.md` — upstream project intro and `npm run dev`
- `slice/README.md` — slice SPA, Docker, `FREEOS_UPSTREAM`
- FreeOS `docs/org-export.md` and `docs/product-contract.md`

# openXYOS 源码包（FreeOS 导出）

本目录由 `freeos org export-standalone` 生成（默认 `--mode full`）。
这是从 FreeOS 检出生成的 **可商业化 openXYOS 系统源码**，不只是一层反代到宿主的薄 SPA。

English: [README.md](README.md)

## 包内有什么

| 路径 | 内容 | 许可证 |
|---|---|---|
| `openxyos/` | 完整 openXYOS 树（`App.tsx` + Express API）。用 Node 运行。 | **Apache-2.0** |
| `slice/` | 宿主桥 org-ui SPA（来自 `dashboard/src/org-ui` 的 Open-12 页）。`/api` 反代到 FreeOS。 | **MIT** |
| `modules.json` | 路由/模块清单，可对照桌面宿主 `/organization` | — |
| `NOTICE` | 许可证拆分与归属 | — |

`uv run freeos org export-standalone --out … --mode slice` 只把 MIT SPA 写到输出根目录（等同这里的 `slice/`）。

## 如何独立运行

### 完整组织应用（适合产品化）

需要 **Node ≥ 20.19**。这是原来的 App.tsx 表面（Open-12 + 商业垂类 + 组织沟通协作）。

```bash
cd openxyos
cp .env.example .env    # 可选
npm ci
npm run dev             # Vite + Express；详见 openxyos/README.md
```

完整树有 **自己的组织房间注册/登录**。那一套与 FreeOS 工作室日常注册分开。不要把「用工作室日常账号登录」写成商业终态。

### 宿主桥 slice（对接正在运行的 FreeOS）

只想跑较薄的宿主 org-ui 页、走 `/api/org-module`、先不拉起 Node 应用时用这个。

```bash
cd slice
cp .env.example .env    # FreeOS 不在 :8088 时设置 FREEOS_UPSTREAM
npm install
npm run dev             # Vite :3780，反代 /api
```

或在 `slice/` 里：`FREEOS_UPSTREAM=http://127.0.0.1:8088 docker compose up --build`。

slice 登录目前 `POST` 到宿主 `/api/auth/login`，只是 **过渡桥**。完整树里的组织房间身份是另一套。工作室日常与组织房间两种进入方式保持分开。

## 仍走宿主反代的（仅 slice）

| 调用 | 说明 |
|---|---|
| `/api/org-module/*` | slice 的 CRUD 打到 FreeOS 宿主 BFF |
| `/api/auth/login` | 仅 slice 桥；不是组织房间终态 |

**完整** `openxyos/` 树是自包含的：Express 实现 `/api/auth`、`/api/announcements`、`/api/chats`、商业垂类等。若以后要接回 FreeOS，可选的 `/api/freeos/*` ingest 仍是桥。

## 清单

`modules.json` 记录：

- `shared_org_ui_modules` — 抽到 `dashboard/src/org-ui` 的页面（也是 slice SPA）
- `host_organization_routes` — 桌面 Dashboard `/organization/…`
- `openxyos_app_routes` — `App.tsx` / `OpenApp.tsx` 路由，带 `in_slice` / `in_full_tree` / `host_route_exists`
- `omissions` — 有意不导出的项（见下）

可与宿主清单对照。slice SPA 在 `/coverage` 也会渲染这份清单。

## 有意省略

| Id | 完整树 | Slice | 原因 |
|---|---|---|---|
| `freeos_agent_chat` | 无 | 无 | 工作室智能体对话、IM、定时任务、沙箱留在 FreeOS。不是第二套运行时。 |
| `org_collaboration_chat` | **有**（`/chat`） | 说明页 | 组织会话在 `openxyos/`；slice 不替代工作室对话。 |
| `desktop_iframe_nsis` | 无 | 无 | 托管 Node + iframe / NSIS 是 FreeOS 桌面过渡桥，不是本包。 |

商业 `App.tsx` 垂类（合同、资产、考勤、流程……）**在** `openxyos/` 里。slice SPA 故意不含它们（`modules.json` 里 `kind: commercial`，`in_slice: false`）。

## 商业化说明

- **Apache-2.0** 适用于 `openxyos/`（及未改动的拷贝）。见 `openxyos/LICENSE`、`openxyos/NOTICE`。保留归属；商标见 `openxyos/TRADEMARKS.md`（若有）。
- **MIT** 适用于 FreeOS 编写的宿主桥：`slice/`（Vite 壳、IdentityBridge、拷贝的 `org-ui`、Docker/反代）。见 `slice/LICENSE`。
- 可以对 Apache 树做产品化与自托管。把 slice 反代换成 Express API（或自有实现）是完全脱离宿主之后的跟进工作。
- 本包 **不是** 默认 FreeOS 安装器。默认桌面 / NSIS / 便携包仍为零 Node。

## 身份（柔和表述）

FreeOS 更像本机工作室；组织能力是另一间可独立布置的房间。两种进入方式保持分开。完整树的组织房间账号不是工作室登录；slice 的宿主桥登录也不是终态身份模型。

## 另见

- `openxyos/README.md` — 上游介绍与 `npm run dev`
- `slice/README.md` — slice SPA、Docker、`FREEOS_UPSTREAM`
- FreeOS `docs/org-export.md` 与 `docs/product-contract.zh-CN.md`

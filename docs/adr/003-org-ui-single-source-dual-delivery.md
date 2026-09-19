# ADR 003 — Organization UI: Single Source, Dual Delivery

**Status:** Accepted
**Date:** 2026-09-19

> Scope amendment (2026-09-19): the user requires full openXYOS UI/function/relationship parity, including App.tsx business modules and organizational chat capabilities. Open-12-only and permanent chat-exclusion clauses below are historical scope, superseded by [the full integration contract](../org-full-integration.md). The approved runtime topology is a FreeOS-managed bundled Node organization service with organization-owned registration and login.

**Related:** [ADR 001](001-single-process-model.md), [architecture-integration.md](../architecture-integration.md), [org-merge-plan.md](../org-merge-plan.md), [asset-loop.md](../asset-loop.md), in-host Organization (#55)

> Numbering note: `docs/adr/002-database-backends.md` already exists. This decision is **ADR 003**.

---

## 摘要（Chinese summary）

组织模块代码是**唯一事实来源**。openXYOS 网页不再作为第二套常驻系统，而是变成 **FreeOS Dashboard `/organization/...` 下的子 UI**。同一套页面必须还能 **导出** 为客户自托管的独立 openXYOS Web（商业加售）。默认一个安装器、一个 Python 进程，Node sidecar 仅作可选兼容。**不**用 openXYOS Chat 替换 FreeOS/Octop 的 Agent 对话运行时。

落地形态：壳无关的 `org-ui` 包 + 薄 Dashboard 适配器 + `freeos org export-standalone` 导出流水线。

否决：永久双进程、永远 iframe、手维护两套独立站。

---

## Context

#55 moved Organization **control-plane capability** into the FreeOS/Octop host (`org_os`, `/api/org-module/*`, a native Ant Design workbench at `/organization`). The optional Node sidecar (`127.0.0.1:3780`, `FREEOS_ORG_SIDECAR`, `SHIP_OPENXYOS_RUNTIME`) is no longer required to install FreeOS or open Organization.

What remains is a **UI/API ownership** problem:

- The 12 OpenApp module pages (workspace, announcements, org chart, employees, skills, chat, agents, tasks, knowledge, reflections, governance UI, settings) still live in `modules/openxyos` and historically rendered through a sidecar / iframe.
- Customers still need a **standalone** openXYOS web deployment generated from the same product, not a second hand-maintained tree.
- Operators rejected a mandatory Node sidecar in the default installer (ADR 001: one process, one port).
- FreeOS/Octop remains the agent **data plane**. openXYOS Chat must not replace host chat, IM, cron, or sandboxes.

Phase 0 mapped the overlap. This ADR freezes the merge contract before any page is moved.

## Decision

Ship **one** organization UI source and **two** deliveries:

1. **完整组织应用为功能基线** — 保留 openXYOS 页面、路由和业务关系，构建到同域 `/organization/`。
2. **FreeOS 为产品宿主** — 托管 Node 运行时、统一启动恢复、反向代理和组织身份校验，不复制一套精简 CRUD 页面。
3. **独立站为同一产物的交付形态** — 客户自托管时仍使用相同组织前端与业务后端。

```
                    ┌─────────────────────────┐
                    │  org-ui (single source) │
                    │  pages · hooks · client │
                    └───────────┬─────────────┘
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
   Dashboard adapter                    export-standalone
   /organization/...                    dist/openxyos-web
   FreeOS JWT / one port                local JWT / self-host
```

**Non-negotiable product rules**

| Rule | Meaning |
|---|---|
| 完整组织应用为功能基线 | 所有已实现网页模块、页面内部能力与关系以其为对照 |
| FreeOS 是产品宿主 | `/organization/` 同域交付，宿主负责生命周期、代理和商业化入口 |
| 组织身份为唯一权威 | 注册、登录、令牌撤销和租户边界由组织服务决定 |
| 一个安装器 | 内置受 FreeOS 管理的 Node 组织运行时 |
| 独立站可生成 | 自托管是交付方式，不分叉功能代码 |
| 两类对话均保留 | 组织协作聊天与 FreeOS Agent 对话分别保留并按入口使用 |

Phase 2 proves the contract on **Announcements** (see [org-merge-plan.md](../org-merge-plan.md)). Later Open-12 pages follow the same seam. Full commercial `App.tsx` routes stay out of the Open-12 wave.

## Rationale

- **#55 already in-hosted the control plane.** Keeping a second always-on UI process would re-introduce the cost the workbench removed.
- **Commercial self-host is a delivery, not a product fork.** Generating a standalone site from `org-ui` preserves the upsell without two codebases.
- **iframe is a compatibility hatch, not a contract.** It cannot share FreeOS session, Ant Design, or host routing without a login wall; it also forces a second origin/port.
- **ADR 001 still holds.** Organization pages in the Dashboard keep the default topology at one Python process and one port. Export is an explicit operator/customer action, not boot.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| Keep a permanent dual process (host + Node sidecar always on) | Doubles ops; contradicts the default installer and ADR 001; #55 already made sidecar optional |
| iframe forever (`:3780` inside `/organization`) | Second origin, second login, no shared chrome; agents still cannot treat org pages as host routes |
| Duplicate, hand-maintained standalone openXYOS | Drift is guaranteed; violates “organization module = single source of truth” |
| Replace FreeOS/Octop chat with openXYOS Chat | Violates the control/data-plane split; loses IM, cron, sandboxes, governance-on-tool-path |
| Rewrite all openXYOS CRUD into FastAPI before any UI move | Blocks the vertical slice; BFF + proxy already exist for unmigrated APIs |

## Consequences

- New org pages **must** land in `org-ui` (or a path that export can import). Dashboard-only copies and sidecar-only copies are out of contract.
- `org-ui` takes a **`ShellAdapter` / `IdentityBridge`**: embedded mode uses the FreeOS session; standalone mode uses local JWT. Default UX is **no dual login wall**.
- Host **`/api/org-module/*`** remains the in-process BFF (catalog, loop, lifecycle, governance, asset factory). Business CRUD (e.g. `/api/announcements`) migrates **per slice**; unmigrated routes may still proxy to an opt-in sidecar.
- Chat, IM, cron, and agent runtime stay on the host. The OpenApp `/chat` page is **not** a migration target.
- Default desktop/NSIS/portable builds stay **zero-Node**. Sidecar zip is opt-in (`SHIP_OPENXYOS_RUNTIME=1`).
- Commercial `App.tsx` routes (contracts, assets, attendance, …) are **not** in the Open-12 wave; export may include them later from the same `org-ui` seam if they are extracted.
- `modules/openxyos` remains the vendored Apache-2.0 tree and the source of catalog/blueprint contracts until `org-contract` is extracted. It is not a second always-on runtime.

## Follow-through

Implementation sequencing, overlap matrix, package layout, API ownership, and Phase 2–5 status live in [org-merge-plan.md](../org-merge-plan.md). Phase 5 default installer is **zero-Node**; standalone commercial deploy is [org-export.md](../org-export.md), not a second always-on runtime.

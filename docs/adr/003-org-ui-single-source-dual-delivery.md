# ADR 003 — Organization UI: Single Source, Dual Delivery

**Status:** Accepted
**Date:** 2026-09-19

> **Historical vs Current.**
>
> **Current (canonical):** [product-contract.md](../product-contract.md). Settle in locally first; organization capabilities are another room in the same studio. Managed Node and full-App iframe are a **transition bridge**. End state: migrate openXYOS into the host. Phase-5 zero-Node is a lean default, not a claim that unmigrated App surfaces are done.
>
> **Historical (2026-09-19 scope amendment, superseded for runtime/identity):** full openXYOS UI/function/relationship parity, including App.tsx business modules and organizational chat capabilities. Open-12-only and permanent chat-exclusion clauses in the body below are historical scope; capability inventory lives in [org-full-integration.md](../org-full-integration.md). The sentence that approved “FreeOS-managed bundled Node + organization-owned registration/login as unique identity authority” is **void**.

**Related:** [ADR 001](001-single-process-model.md), [architecture-integration.md](../architecture-integration.md), [org-merge-plan.md](../org-merge-plan.md), [asset-loop.md](../asset-loop.md), in-host Organization (#55)

> Numbering note: `docs/adr/002-database-backends.md` already exists. This decision is **ADR 003**.

---

## 摘要（Chinese summary）

组织模块代码是**唯一事实来源**（页面/能力对齐）。openXYOS 网页应变成 **FreeOS Dashboard `/organization/...` 下的子 UI**，并最终能 **导出** 独立 openXYOS 系统源码。默认一个安装器、一个 Python 进程；Node sidecar / iframe 仅作过渡桥。组织能力像工作室里另一间可独立布置的房间，与日常对话、助手同在一个 FreeOS。**不**用 openXYOS Chat 替换 FreeOS/Octop 的 Agent 对话运行时。

落地形态：壳无关的 `org-ui` 包 + 薄 Dashboard 适配器 + `freeos org export-standalone` 导出流水线。托管 Node / iframe **不是** 终态（见 [产品契约](../product-contract.zh-CN.md)）。

否决：永久双进程、永远 iframe、手维护两套独立站、把组织登录写成宿主身份权威。

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

1. **完整组织应用为功能基线** — 保留 openXYOS 页面、路由和业务关系，迁入同域 `/organization/`（iframe 仅为过渡）。
2. **FreeOS 为产品宿主** — 统一生命周期与同域交付。**Current：** 把能力做成宿主原生部分；托管 Node 只是桥。组织能力像工作室里另一间可独立布置的房间，与日常对话、助手协作同在一个 FreeOS。
3. **独立站为同一产物的交付形态** — 最终目标是可导出的 openXYOS 系统源码；今日 `export-standalone` 是早期交付。

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

**Current** identity and runtime: [product-contract.md](../product-contract.md). The table below is the Phase-1 / 2026-09-19 freeze. Struck rows are **Historical**.

| Rule | Meaning |
|---|---|
| 完整组织应用为功能基线 | 所有已实现网页模块、页面内部能力与关系以其为对照（迁入宿主，不是永远 iframe） |
| FreeOS 是产品宿主 | `/organization/` 同域交付，宿主负责生命周期、代理和商业化入口 |
| ~~组织身份为唯一权威~~ | **Historical / void.** Current：组织能力像工作室里另一间可独立布置的房间，与日常对话、助手同在一个 FreeOS，两种进入方式不捏成一种。 |
| ~~一个安装器 · 内置托管 Node~~ | **Historical as destination.** 默认安装器可零 Node（Phase 5）；托管 Node + iframe 仅为过渡桥。 |
| 独立站可生成 | 自托管是交付方式，不分叉功能代码；最终目标是可导出的 openXYOS 系统源码 |
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
- `org-ui` takes a **`ShellAdapter` / `IdentityBridge`**: embedded host mode uses the everyday studio session; the organization room keeps its own space (see [product-contract.md](../product-contract.md)). Standalone export uses local JWT. Default UX is **no extra login wall on the host chrome**.
- Host **`/api/org-module/*`** remains the in-process BFF (catalog, loop, lifecycle, governance, asset factory). Business CRUD (e.g. `/api/announcements`) migrates **per slice**; unmigrated routes may still proxy to an opt-in sidecar.
- Chat, IM, cron, and agent runtime stay on the host. The OpenApp `/chat` page is **not** a migration target.
- Default desktop/NSIS/portable builds stay **zero-Node**. Sidecar zip is opt-in (`SHIP_OPENXYOS_RUNTIME=1`).
- Commercial `App.tsx` routes (contracts, assets, attendance, …) are **not** in the Open-12 wave; export may include them later from the same `org-ui` seam if they are extracted.
- `modules/openxyos` remains the vendored Apache-2.0 tree and the source of catalog/blueprint contracts until `org-contract` is extracted. It is not a second always-on runtime.

## Follow-through

Implementation sequencing, overlap matrix, package layout, API ownership, and Phase 2–5 status live in [org-merge-plan.md](../org-merge-plan.md). Phase-5 default installer is **zero-Node as a transition default**; standalone commercial deploy is [org-export.md](../org-export.md). Canonical product intent: [product-contract.md](../product-contract.md).

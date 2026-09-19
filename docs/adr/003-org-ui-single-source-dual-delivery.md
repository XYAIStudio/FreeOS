# ADR 003 — Organization UI: Single Source, Dual Delivery

**Status:** Accepted
**Date:** 2026-09-19

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

1. **Shell-agnostic `org-ui`** — pages, hooks, and an API-client factory with no dependency on Dashboard chrome, Vite root, or the openXYOS Express shell.
2. **Thin Dashboard adapter** — mounts those pages under `/organization/...`, supplies FreeOS session + Ant Design / i18n / timezone, and talks to the host.
3. **Export pipeline** — `freeos org export-standalone --out dist/openxyos-web` assembles the **same** pages into a standalone Vite + server artifact for customer self-host (commercial upsell).

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
| Organization module is the SoT | Edit pages/contracts once; both deliveries consume them |
| Dashboard is the primary shell | openXYOS pages are **sub-UIs**, not a second always-on system |
| Standalone is generated | Self-host artifact is an export, not a fork |
| One installer by default | No mandatory Node sidecar |
| Sidecar is opt-in only | `FREEOS_ORG_SIDECAR` / `SHIP_OPENXYOS_RUNTIME` for advanced sync/compat |
| Chat runtime stays FreeOS | Do not migrate or replace Octop agent chat with openXYOS Chat |

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

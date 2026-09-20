# FreeOS product contract

**Status:** Canonical (P0.1). This is the single source of truth for product intent.

**Languages:** English · [简体中文](product-contract.zh-CN.md)

This document **supersedes** earlier wording that treated organization identity as the authority over FreeOS host identity, or treated a bundled / managed Node runtime (or a permanent iframe of openXYOS) as the destination architecture.

Related but subordinate: [architecture-integration.md](architecture-integration.md) (control/data-plane split and the running loop), [org-merge-plan.md](org-merge-plan.md) and [org-full-integration.md](org-full-integration.md) (engineering history — read their Historical vs Current banners first), [ADR 001](adr/001-single-process-model.md), [ADR 003](adr/003-org-ui-single-source-dual-delivery.md), [org-export.md](org-export.md).

---

## Vision

FreeOS exists so users get **Octop + openXYOS capabilities in one self-hosted platform**:

- **Local-first** models and knowledge bases as much as possible.
- Octop and openXYOS **assets interoperate and mutually enhance**.
- Users can customize and eventually **export a new openXYOS system source** for commercialization.

FreeOS is an independent downstream host. It is not an official Octop release. Host login is not tied to Octop official accounts.

## Dual identity

Two user systems exist. They are **not** the same, and neither is “the” identity of the other.

| Identity | What it is | What it is not |
|---|---|---|
| **FreeOS software users** | Local-first registration and login on the host app. Later the host **may** connect to a FreeOS official site for **commercial licensing**. | Not Octop official accounts. Not the organization-module test users. |
| **Organization-module users** | The integrated openXYOS organization module is an **independent test environment** with its **own** user system. | Not the authority over FreeOS host identity. Not the software-license account. |

Do **not** say that organization registration/login is the unique identity authority over the FreeOS host.

## Transition bridge (not the destination)

**Direction of travel:** migrate openXYOS web and capabilities **into** FreeOS/Octop as **new native parts**.

That is **not** “permanently embed a large Node runtime.”

These shipping shapes are **bridges** while native migration proceeds:

| Shipping shape | Role |
|---|---|
| Desktop **0.0.3** managed Node + iframe of openXYOS | Transition so operators can still exercise the full original App surface. |
| **Phase-5 zero-Node** default installer (in-host `/organization` + `/api/org-module/*`; sidecar opt-in) | Lean default while pages move native. Not a claim that unmigrated App surfaces are done. |
| **Full-App iframe** / optional `FREEOS_ORG_SIDECAR` on `:3780` | Compatibility hatch for unmigrated pages and export/sync. |

End state: native in-host capabilities, **plus** an exportable openXYOS source tree. Node sidecar and iframe must shrink as native coverage grows; they must not be re-frozen as the architecture.

## Local models and knowledge bases

Prefer models and knowledge bases that run on the operator’s machine. Cloud providers remain optional. Do not design the default path so that chat, RAG, or organization knowledge **require** a vendor cloud.

## Export goal

Operators should be able to customize the organization system and **eventually export a new openXYOS system source** suitable for commercial self-hosting. Today’s `freeos org export-standalone` (SPA + proxy to the host) is an early delivery, not the finished export product. Rewriting that pipeline is **out of scope for this contract freeze** (later work).

## What not to do next

This freeze is documentation. The next engineering increments must not invert it.

- Do **not** treat bundled/managed Node, or a full-App iframe, as the permanent runtime.
- Do **not** collapse organization test users into FreeOS software users, or make org login the host identity authority.
- Do **not** bind FreeOS app auth to Octop official accounts.
- Do **not** implement the asset bus, the export rewrite, Node removal, or migration maps **in the name of this contract** — those are later items (P0.2+). Follow this intent when they land.
- Do **not** silently contradict this file. If a historical ADR or merge plan still says otherwise, keep the old prose under **Historical** and point here for **Current**.

## Contributor check

A new contributor who has read [README.md](../README.md) and this file should be able to state:

1. FreeOS local auth ≠ organization-module test auth.
2. Managed Node is a bridge.
3. The end state is to migrate openXYOS into the host.
4. Exportable openXYOS source is a goal.

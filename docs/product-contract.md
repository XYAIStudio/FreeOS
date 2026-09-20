# FreeOS product contract

**Status:** Canonical (P0.1). This is the single source of truth for product intent.

**Languages:** English · [简体中文](product-contract.zh-CN.md)

This document **supersedes** earlier wording that treated organization identity as the authority over FreeOS host identity, or treated a bundled / managed Node runtime (or a permanent iframe of openXYOS) as the destination architecture.

Related but subordinate: [architecture-integration.md](architecture-integration.md) (control/data-plane split and the running loop), [org-merge-plan.md](org-merge-plan.md) and [org-full-integration.md](org-full-integration.md) (engineering history — read their Historical vs Current banners first), [ADR 001](adr/001-single-process-model.md), [ADR 003](adr/003-org-ui-single-source-dual-delivery.md), [org-export.md](org-export.md).

---

## Founding intent (canonical vision)

> **Your FreeOS, free for you.**

Chinese original: [product-contract.zh-CN.md](product-contract.zh-CN.md). Do not drift from that meaning.

FreeOS was created for a simple, clear purpose: on top of Octop’s self-hosted multi-agent capabilities, anyone should be able to have the power of **both** Octop and openXYOS — without choosing between “chat and automation” and “organization and governance.”

We want models to run locally when possible, and knowledge to stay local. Existing Octop and openXYOS capabilities and assets should interoperate and strengthen each other. On that base, users can develop, refine, and customize — grow a new openXYOS that fits their own setting — and export its system source for further productization and commercialization.

To avoid the install cost and size of shipping a full embedded openXYOS tree, FreeOS takes another path: gradually turn openXYOS web and organization capabilities into **native** capabilities on the Octop host, forming one unified system — FreeOS. The managed Node process and embedded organization page in the current desktop build are a **bridge** to that end state, not the destination.

In how you use it, FreeOS is more like a studio of your own: settle in locally first, with signup, login, data, and sessions staying within reach; links to broader services or licensing can open later as options, never as a gate at the start. Organization capabilities are like another room in that studio you can arrange on its own — for trying, rehearsing, and growing your own org workflows — sharing one FreeOS with everyday chat and assistants, yet leaving each use its own space so the two ways in don’t collapse into one.

In one line: **FreeOS = a locally controlled Octop base + growable, exportable organization capabilities; two systems in one, two identities kept apart.**

The sections below are an operational restatement of the same intent. They must not change it.

## Usage boundary

FreeOS is more like a studio of your own: settle in locally first. Organization capabilities are another room in that studio you can arrange on its own. Both live in one FreeOS; each keeps its space, so the two ways in don’t collapse into one.

| Scene | How it is used | Space left |
|---|---|---|
| **Everyday studio** | Settle in locally: signup, login, data, and sessions stay within reach | Broader services or licensing can open later as options, never as a gate at the start |
| **Organization room** | A room you can arrange on its own — trying, rehearsing, growing your own org workflows | Shares one FreeOS with everyday chat and assistants; the two ways in don’t collapse into one |

Do not describe the organization room as the only way into everyday studio use.

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
- Do **not** collapse everyday studio use and the organization room into one way in.
- Do **not** make broader services or licensing a gate at the start.
- Do **not** implement the asset bus, the export rewrite, Node removal, or migration maps **in the name of this contract** — those are later items (P0.2+). Follow this intent when they land.
- Do **not** silently contradict this file. If a historical ADR or merge plan still says otherwise, keep the old prose under **Historical** and point here for **Current**.

## Contributor check

A new contributor who has read [README.md](../README.md) and this file should be able to state:

1. Everyday chat/assistants and organization live in one FreeOS; organization is another room you can arrange on its own, so the two ways in don’t collapse into one.
2. Managed Node is a bridge.
3. The end state is to migrate openXYOS into the host.
4. Exportable openXYOS source is a goal.

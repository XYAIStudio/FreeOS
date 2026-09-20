# FreeOS product contract

**Status:** Canonical (P0.1). This is the single source of truth for product intent.

**Languages:** English · [简体中文](product-contract.zh-CN.md)

This document **supersedes** earlier wording that treated organization identity as the authority over FreeOS host identity, or treated a bundled / managed Node runtime (or a permanent iframe of openXYOS) as the destination architecture.

Related but subordinate: [architecture-integration.md](architecture-integration.md) (control/data-plane split and the running loop), [org-merge-plan.md](org-merge-plan.md) and [org-full-integration.md](org-full-integration.md) (engineering history — read their Historical vs Current banners first), [ADR 001](adr/001-single-process-model.md), [ADR 003](adr/003-org-ui-single-source-dual-delivery.md), [org-export.md](org-export.md).

---

## Founding intent (canonical vision)

> **FreeOS: a free AI studio — the space for imagination is yours to open.**

Chinese original: [product-contract.zh-CN.md](product-contract.zh-CN.md). Do not drift from that meaning.

FreeOS was created for a simple, clear purpose: on top of Octop’s self-hosted multi-agent capabilities, anyone should be able to have the power of **both** Octop and openXYOS — without choosing between “chat and automation” and “organization and governance.”

We want models to run locally when possible, and knowledge to stay local. Existing Octop and openXYOS capabilities and assets should interoperate and strengthen each other. On that base, users can develop, refine, and customize — grow a new openXYOS that fits their own setting — and export its system source for further productization and commercialization.

To avoid the install cost and size of shipping a full embedded openXYOS tree, FreeOS takes another path: gradually turn openXYOS web and organization capabilities into **native** capabilities on the Octop host, forming one unified system — FreeOS. The managed Node process and embedded organization page in the current desktop build are a **bridge** to that end state, not the destination.

In how you use it, FreeOS first lets you sign up and sign in inside your own environment, keeping data and sessions under local control. Linking to an external account system or commercial licensing can open later, as an option — not as a starting gate. Organization capabilities appear as a relatively separate workspace for trying, rehearsing, and customizing organization-side flows. That workspace works with everyday host use, yet each keeps a clear boundary, so the two scenes are not folded into one account model.

In one line: **FreeOS = a locally controlled Octop base + growable, exportable organization capabilities; two systems in one, two identities kept apart.**

The sections below are an operational restatement of the same intent. They must not change it.

## Usage boundary

Signup and sign-in start in your own environment; data and sessions stay under local control. Linking to an external account system or commercial licensing is optional later, not a starting gate. Organization capabilities appear as a relatively separate workspace for trying, rehearsing, and customizing organization-side flows. They work with everyday host use, yet each keeps a clear boundary.

| Scene | How it is used | Boundary |
|---|---|---|
| **Everyday host use** | Sign up and sign in in your own environment; data and sessions stay local | External accounts and commercial licensing may open later, as an option |
| **Organization workspace** | A relatively separate space to try, rehearse, and customize organization-side flows | Works with the host; do not fold the two scenes into one account model |

Do not describe organization-side login as the sole entry or sole authority for everyday host use.

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
- Do **not** fold the organization workspace and everyday host use into one account model, or treat organization-side login as the host’s only entry.
- Do **not** make an external account system or commercial licensing a starting requirement.
- Do **not** implement the asset bus, the export rewrite, Node removal, or migration maps **in the name of this contract** — those are later items (P0.2+). Follow this intent when they land.
- Do **not** silently contradict this file. If a historical ADR or merge plan still says otherwise, keep the old prose under **Historical** and point here for **Current**.

## Contributor check

A new contributor who has read [README.md](../README.md) and this file should be able to state:

1. Everyday host signup and the organization workspace keep a clear account boundary.
2. Managed Node is a bridge.
3. The end state is to migrate openXYOS into the host.
4. Exportable openXYOS source is a goal.

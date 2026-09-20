# Architecture Decision Records

Canonical product intent (local signup, organization as a separate workspace, Node as bridge, native migration):
[product-contract.md](../product-contract.md).

| ADR | Title | Status |
|---|---|---|
| [001](001-single-process-model.md) | Single-process, no external queue | Accepted |
| [002](002-database-backends.md) | Dual database backends (SQLite \| PostgreSQL) | Accepted |
| [003](003-org-ui-single-source-dual-delivery.md) | Organization UI: single source, dual delivery | Accepted — read the **Historical vs Current** banner |

Organization merge sequencing (Phases 0–5) lives in [org-merge-plan.md](../org-merge-plan.md), not in an ADR. Those phases are engineering history; product intent is the contract above.

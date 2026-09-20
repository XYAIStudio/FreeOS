# ADR 001 — Single-Process, No External Queue

**Status:** Accepted
**Date:** 2026-06

---

## Context

Octop needs to run a web server, a CLI, per-user Agent runtimes, IM channel connections, and cron schedulers simultaneously. The question was whether to split these into separate services (worker + API server) or keep everything in one process.

## Decision

Everything runs in a single Python process served by uvicorn. There is no external queue (Redis, RabbitMQ, Celery), no separate worker process, and no required backing services beyond the LLM provider.

## Rationale

- **Self-hosted target:** Operators install with `pip install octop && octop init`. Adding Redis or a process supervisor doubles the ops burden for the primary audience.
- **Workload profile:** Agent calls are LLM-bound (seconds to minutes of I/O wait). Python's asyncio handles this fan-out efficiently without threads or processes.
- **SQLite is sufficient:** Concurrent writes are rare (one writer per agent at a time); WAL mode handles the load. Migrating to Postgres requires only a new `SqlitePool` implementation.
- **Restart semantics are simple:** `OctopServer.start()` rebuilds the entire runtime tree from the SQLite file. No external state to reconcile.

## Trade-offs

| Benefit | Cost |
|---------|------|
| Zero external dependencies | Vertical scaling only (one machine) |
| Simple deployment (one process, one port) | Heavy CPU tasks block the event loop |
| Fast local dev | No horizontal worker scaling |

## Consequences

- All async; blocking calls must use `run_in_executor`.
- `SharedServices` (DI container) is process-global — safe because the process owns all state.
- Future scale-out would require extracting the worker into a separate process and adding a queue; that seam is already partially visible in `infra/gateway/processor.py`.

## Later confirmation (FreeOS Organization, 2026-09)

Organization control-plane UI and BFF stay in this same Python process
(`/api/org-module/*`, Dashboard `/organization`). A Node openXYOS sidecar
is **not** part of the default installer (Phase 5). Opt in only with
`FREEOS_ORG_SIDECAR=1` / `SHIP_OPENXYOS_RUNTIME=1`.

**Current:** Phase-5 zero-Node and managed Node + iframe are **transition
bridges** toward native migration of openXYOS into the host — not a
destination architecture and not a claim that unmigrated App surfaces
are done. Canonical intent: [product-contract.md](../product-contract.md).
This does not change the original decision: one process, one port, no
required extra runtime for the default host.

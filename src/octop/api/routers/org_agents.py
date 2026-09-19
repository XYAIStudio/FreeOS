"""In-host Agent Studio snapshot — digital colleagues + host surface links.

This is **not** the FreeOS agent editor, Chat runtime, or sidecar
``/api/agent-studio/*``. Compile / transition / spawn stay on the existing
``/blueprints/compile`` and ``/employees/*`` lifecycle routes.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from octop.api.deps import current_user, get_server
from octop.infra.server import OctopServer
from octop.modules.org_os.lifecycle.store import LIFECYCLE_STATES, LifecycleStore
from octop.modules.org_os.lifecycle.transitions import ALLOWED
from octop.modules.org_os.service import org_module_from_paths

router = APIRouter()

HOST_SURFACES = {
    "experts": "/experts",
    "personalization": "/personalization",
    "employees": "/organization/employees",
    "chat": "/chat",
    "workbench": "/organization",
}

NOT_ON_THIS_PAGE = (
    "chat_runtime",
    "personalization_editor",
    "sidecar_agent_studio",
    "talent_market",
)


def _ok(data: Any = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"success": True}
    if data is not None:
        payload["data"] = data
    return payload


def _next_states() -> dict[str, list[str]]:
    return {state: sorted(ALLOWED.get(state, frozenset())) for state in LIFECYCLE_STATES}


def _colleague_row(record: Any) -> dict[str, Any]:
    row = record.to_dict()
    row["spawned"] = bool(record.agent_id)
    row["next"] = sorted(ALLOWED.get(record.lifecycle, frozenset()))
    return row


def _snapshot(server: OctopServer) -> dict[str, Any]:
    service = org_module_from_paths(server.paths)
    tid = service.tenant_id() or "default"
    colleagues = [_colleague_row(item) for item in LifecycleStore(service.home, tid).list()]
    by_lifecycle: dict[str, int] = dict.fromkeys(LIFECYCLE_STATES, 0)
    spawned = 0
    for row in colleagues:
        state = str(row.get("lifecycle") or "draft")
        by_lifecycle[state] = by_lifecycle.get(state, 0) + 1
        if row.get("spawned"):
            spawned += 1
    return {
        "scope": "org_module",
        "tenant_id": tid,
        "schema": "openxyos.agent-blueprint.v1",
        "states": list(LIFECYCLE_STATES),
        "next_states": _next_states(),
        "colleagues": colleagues,
        "stats": {
            "total": len(colleagues),
            "spawned": spawned,
            "by_lifecycle": by_lifecycle,
        },
        "host_surfaces": dict(HOST_SURFACES),
        "not_on_this_page": list(NOT_ON_THIS_PAGE),
        "compile": "/api/org-module/blueprints/compile",
        "transition": "/api/org-module/employees/transition",
        "spawn": "/api/org-module/employees/spawn",
    }


@router.get("/agents", summary="Organization Agent Studio snapshot")
async def get_org_agents(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    """List compiled digital colleagues and deep-links to FreeOS agent surfaces."""
    return _ok(_snapshot(server))

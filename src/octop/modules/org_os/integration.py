"""Organization-owned identity for the integrated FreeOS product."""

from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx

from octop.infra.errors import ErrorCode, OctopError
from octop.modules.org_os.service import org_module_from_paths

_agent_bootstrap_locks: dict[int, asyncio.Lock] = {}
_agent_ready_users: set[int] = set()


def integrated_organization() -> bool:
    return os.environ.get("FREEOS_ORG_INTEGRATED", "").lower() in {"1", "true", "yes"}


async def organization_user(server: Any, token: str) -> Any:
    """Validate at the identity authority on every request (including revocation)."""
    bearer = (token or "").strip()
    if not bearer:
        raise OctopError(ErrorCode.AUTH_FAILED, "organization session expired or revoked")
    service = org_module_from_paths(server.paths)
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            result = await client.get(
                f"{service.sidecar_url()}/api/auth/me",
                headers={"Authorization": f"Bearer {bearer}"},
            )
    except httpx.HTTPError as exc:
        raise OctopError(
            ErrorCode.INTERNAL_ERROR, "organization identity unavailable", status=503
        ) from exc
    if result.status_code in {401, 403}:
        raise OctopError(ErrorCode.AUTH_FAILED, "organization session expired or revoked")
    if result.status_code != 200:
        raise OctopError(ErrorCode.INTERNAL_ERROR, "organization identity unavailable", status=503)
    try:
        profile = result.json()["data"]
        if not isinstance(profile, dict) or not profile.get("id") or not profile.get("tenant_id"):
            raise ValueError("invalid identity")
    except (ValueError, KeyError, TypeError) as exc:
        raise OctopError(ErrorCode.AUTH_FAILED, "invalid organization identity") from exc
    user = await server.user_manager.resolve_organization_user(
        issuer=str(server.paths.root.resolve()), profile=profile
    )
    if user.id not in _agent_ready_users:
        lock = _agent_bootstrap_locks.setdefault(user.id, asyncio.Lock())
        async with lock:
            if user.id not in _agent_ready_users:
                from octop.infra.agents.default_agent import (  # noqa: PLC0415
                    try_bootstrap_default_agent,
                )

                await try_bootstrap_default_agent(server, user_id=user.id, locale=user.locale)
                runtime = getattr(server, "app_runtime", None)
                registry = getattr(runtime, "agent_registry", None)
                if registry is not None and registry.list_agents(user.id):
                    _agent_ready_users.add(user.id)
    return user

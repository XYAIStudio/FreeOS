from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import httpx
import pytest

from octop.modules.org_os import integration


class _Response:
    status_code = 200

    @staticmethod
    def json() -> dict[str, Any]:
        return {
            "data": {
                "id": 7,
                "tenant_id": 3,
                "email": "owner@example.local",
                "nickname": "Owner",
                "role": "admin",
            }
        }


class _Client:
    async def __aenter__(self) -> _Client:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def get(self, *_args: object, **_kwargs: object) -> _Response:
        return _Response()


@pytest.mark.asyncio
async def test_organization_identity_bootstraps_one_octop_agent(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    user = SimpleNamespace(id=41, locale="zh")
    agents: list[object] = []
    calls: list[int] = []

    async def resolve_organization_user(**_kwargs: object) -> object:
        return user

    async def bootstrap(_server: object, *, user_id: int, locale: str) -> None:
        calls.append(user_id)
        await asyncio.sleep(0)
        agents.append(object())

    from octop.infra.agents import default_agent

    monkeypatch.setattr(httpx, "AsyncClient", lambda **_kwargs: _Client())
    monkeypatch.setattr(default_agent, "try_bootstrap_default_agent", bootstrap)
    integration._agent_bootstrap_locks.clear()
    integration._agent_ready_users.clear()
    server = SimpleNamespace(
        paths=SimpleNamespace(root=tmp_path, config=tmp_path / "config.json"),
        user_manager=SimpleNamespace(resolve_organization_user=resolve_organization_user),
        app_runtime=SimpleNamespace(
            agent_registry=SimpleNamespace(list_agents=lambda _uid: list(agents))
        ),
        expert_catalog=object(),
    )

    first, second = await asyncio.gather(
        integration.organization_user(server, "token"),
        integration.organization_user(server, "token"),
    )

    assert first is user
    assert second is user
    assert calls == [41]

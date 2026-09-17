from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest


def _seed_ollama(srv: Any, model_id: str = "tiny") -> None:
    srv.services.provider_repo.create(
        name="Ollama (Local)",
        kind="openai",
        base_url="http://127.0.0.1:11434/v1",
        api_key="ollama",
        models_json=json.dumps([{"id": model_id, "name": model_id, "enabled": True}]),
    )


@pytest.mark.asyncio
async def test_set_and_clear_local_default(env: Any) -> None:
    client, srv, auth = env
    _seed_ollama(srv)

    missing = await client.put(
        "/api/local-models/default",
        headers=auth,
        json={"name": "missing"},
    )
    assert missing.status_code == 200
    assert missing.json()["ok"] is False

    set_r = await client.put(
        "/api/local-models/default",
        headers=auth,
        json={"name": "tiny"},
    )
    assert set_r.status_code == 200, set_r.text
    body = set_r.json()
    assert body["ok"] is True
    assert body["ref"] == "Ollama (Local)/tiny"

    prefs = await client.get("/api/preferences", headers=auth)
    assert prefs.json()["preferred_model"] == "Ollama (Local)/tiny"
    active = await client.get("/api/providers/active-model", headers=auth)
    assert active.json() == {"provider_name": "Ollama (Local)", "model": "tiny"}

    cleared = await client.delete("/api/local-models/default?name=tiny", headers=auth)
    assert cleared.status_code == 200
    assert cleared.json()["ok"] is True
    prefs = await client.get("/api/preferences", headers=auth)
    assert prefs.json()["preferred_model"] is None
    active = await client.get("/api/providers/active-model", headers=auth)
    assert active.json() == {"provider_name": "", "model": ""}


@pytest.mark.asyncio
async def test_speed_test_endpoint(env: Any) -> None:
    client, srv, auth = env
    _seed_ollama(srv)
    fake = AsyncMock(
        return_value={
            "ok": True,
            "latency_ms": 120,
            "ttft_ms": 40,
            "tokens": 8,
            "tokens_per_sec": 20.0,
        }
    )
    with patch("octop.api.routers.local_models.speed_test_local_model", fake):
        r = await client.post(
            "/api/local-models/speed-test",
            headers=auth,
            json={"name": "tiny"},
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["latency_ms"] == 120
    assert body["tokens_per_sec"] == 20.0
    assert body["name"] == "tiny"
    fake.assert_awaited()

from __future__ import annotations

import httpx
import pytest

from octop.infra.agents.providers.local_speed import (
    _tokens_per_sec,
    ollama_native_root,
    openai_chat_url,
    speed_test_local_model,
)


def test_ollama_native_root_strips_v1() -> None:
    assert ollama_native_root("http://127.0.0.1:11434/v1") == "http://127.0.0.1:11434"
    assert ollama_native_root("http://127.0.0.1:11434") == "http://127.0.0.1:11434"
    assert ollama_native_root(None) == "http://127.0.0.1:11434"


def test_openai_chat_url() -> None:
    assert (
        openai_chat_url("http://127.0.0.1:11434/v1") == "http://127.0.0.1:11434/v1/chat/completions"
    )
    assert openai_chat_url("http://127.0.0.1:11434") == "http://127.0.0.1:11434/v1/chat/completions"


def test_tokens_per_sec_prefers_eval_duration() -> None:
    assert _tokens_per_sec(eval_count=20, eval_duration_ns=1_000_000_000, elapsed_s=4) == 20.0
    assert _tokens_per_sec(eval_count=10, eval_duration_ns=None, elapsed_s=2) == 5.0
    assert _tokens_per_sec(eval_count=None, eval_duration_ns=None, elapsed_s=1) is None


@pytest.mark.asyncio
async def test_speed_test_reads_ollama_generate_stream(monkeypatch: pytest.MonkeyPatch) -> None:
    body = (
        b'{"response":"ok","done":false}\n'
        b'{"response":"","done":true,"eval_count":8,"eval_duration":400000000}\n'
    )

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/generate"
        return httpx.Response(200, content=body)

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def fake_client(*_args: object, **_kwargs: object) -> httpx.AsyncClient:
        return real_client(transport=transport, timeout=5.0)

    monkeypatch.setattr("octop.infra.agents.providers.local_speed.httpx.AsyncClient", fake_client)
    result = await speed_test_local_model(name="tiny", base_url="http://127.0.0.1:11434/v1")
    assert result["ok"] is True
    assert result["latency_ms"] >= 0
    assert result["ttft_ms"] is not None
    assert result["tokens"] == 8
    assert result["tokens_per_sec"] == 20.0


@pytest.mark.asyncio
async def test_speed_test_falls_back_to_chat_completions(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/generate":
            return httpx.Response(404, text="not found")
        assert request.url.path.endswith("/chat/completions")
        payload = (
            b'data: {"choices":[{"delta":{"content":"ok"}}]}\n'
            b'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n'
            b"data: [DONE]\n"
        )
        return httpx.Response(200, content=payload)

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def fake_client(*_args: object, **_kwargs: object) -> httpx.AsyncClient:
        return real_client(transport=transport, timeout=5.0)

    monkeypatch.setattr("octop.infra.agents.providers.local_speed.httpx.AsyncClient", fake_client)
    result = await speed_test_local_model(name="tiny", base_url="http://127.0.0.1:11434/v1")
    assert result["ok"] is True
    assert result["tokens"] == 1


@pytest.mark.asyncio
async def test_speed_test_reports_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def fake_client(*_args: object, **_kwargs: object) -> httpx.AsyncClient:
        return real_client(transport=transport, timeout=5.0)

    monkeypatch.setattr("octop.infra.agents.providers.local_speed.httpx.AsyncClient", fake_client)
    result = await speed_test_local_model(name="tiny", base_url="http://127.0.0.1:11434/v1")
    assert result["ok"] is False
    assert result["action"] == "unreachable"
    assert "11434" in result["error"]

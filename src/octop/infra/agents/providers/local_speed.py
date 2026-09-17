"""Latency / throughput check against a local Ollama (or OpenAI-compat) model."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from octop.infra.agents.providers.model_flags import OLLAMA_DEFAULT_BASE_URL

logger = logging.getLogger(__name__)

SPEED_TEST_PROMPT = "Reply with the single word ok."
SPEED_TEST_TIMEOUT_S = 45.0
SPEED_TEST_MAX_TOKENS = 16
_UNREACHABLE = (
    "Ollama is not reachable. Start it from Settings → Models, then retry. "
    "If it is already running, confirm it is listening on port 11434."
)
_TIMEOUT = (
    f"Speed test timed out after {int(SPEED_TEST_TIMEOUT_S)}s. "
    "The model may still be loading, or Ollama is too slow on this machine."
)


def ollama_native_root(base_url: str | None) -> str:
    """Turn an OpenAI-compat ``…/v1`` URL into the Ollama daemon root."""
    raw = (base_url or OLLAMA_DEFAULT_BASE_URL).strip().rstrip("/")
    if raw.endswith("/v1"):
        raw = raw[:-3].rstrip("/")
    return raw or "http://127.0.0.1:11434"


def openai_chat_url(base_url: str | None) -> str:
    """OpenAI-compatible chat completions URL for a registered local provider."""
    raw = (base_url or OLLAMA_DEFAULT_BASE_URL).strip().rstrip("/")
    if raw.endswith("/chat/completions"):
        return raw
    if not raw.endswith("/v1"):
        raw = f"{raw}/v1"
    return f"{raw}/chat/completions"


def _tokens_per_sec(
    *, eval_count: int | None, eval_duration_ns: int | None, elapsed_s: float
) -> float | None:
    if eval_count and eval_duration_ns and eval_duration_ns > 0:
        return round(eval_count / (eval_duration_ns / 1_000_000_000), 2)
    if eval_count and elapsed_s > 0:
        return round(eval_count / elapsed_s, 2)
    return None


def _fail(message: str, *, action: str = "error") -> dict[str, Any]:
    return {
        "ok": False,
        "action": action,
        "error": message,
        "next_step": message,
    }


def _ok(
    *,
    latency_ms: int,
    ttft_ms: int | None,
    tokens: int | None,
    tokens_per_sec: float | None,
) -> dict[str, Any]:
    return {
        "ok": True,
        "latency_ms": latency_ms,
        "ttft_ms": ttft_ms,
        "tokens": tokens,
        "tokens_per_sec": tokens_per_sec,
    }


def _parse_ollama_line(line: str) -> dict[str, Any] | None:
    text = line.strip()
    if not text:
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _parse_openai_sse(line: str) -> dict[str, Any] | None:
    text = line.strip()
    if not text.startswith("data:"):
        return _parse_ollama_line(text)
    payload = text[5:].strip()
    if not payload or payload == "[DONE]":
        return None
    return _parse_ollama_line(payload)


async def _speed_test_ollama_generate(
    client: httpx.AsyncClient, *, model: str, root: str
) -> dict[str, Any]:
    url = f"{root}/api/generate"
    started = time.perf_counter()
    ttft_ms: int | None = None
    tokens = 0
    eval_count: int | None = None
    eval_duration_ns: int | None = None
    async with client.stream(
        "POST",
        url,
        json={
            "model": model,
            "prompt": SPEED_TEST_PROMPT,
            "stream": True,
            "options": {"num_predict": SPEED_TEST_MAX_TOKENS},
        },
    ) as response:
        if response.status_code >= 400:
            detail = (await response.aread()).decode("utf-8", "replace").strip()
            if len(detail) > 240:
                detail = detail[:240] + "…"
            return _fail(
                f"HTTP {response.status_code} POST {url}" + (f": {detail}" if detail else "")
            )
        async for raw in response.aiter_lines():
            data = _parse_ollama_line(raw)
            if data is None:
                continue
            chunk = str(data.get("response") or "")
            if chunk and ttft_ms is None:
                ttft_ms = int((time.perf_counter() - started) * 1000)
            if chunk:
                tokens += 1
            if data.get("done"):
                raw_count = data.get("eval_count")
                raw_dur = data.get("eval_duration")
                if isinstance(raw_count, int):
                    eval_count = raw_count
                if isinstance(raw_dur, int):
                    eval_duration_ns = raw_dur
                break
    elapsed = time.perf_counter() - started
    return _ok(
        latency_ms=int(elapsed * 1000),
        ttft_ms=ttft_ms,
        tokens=eval_count if eval_count is not None else tokens or None,
        tokens_per_sec=_tokens_per_sec(
            eval_count=eval_count if eval_count is not None else tokens or None,
            eval_duration_ns=eval_duration_ns,
            elapsed_s=elapsed,
        ),
    )


async def _speed_test_chat_completions(
    client: httpx.AsyncClient, *, model: str, url: str
) -> dict[str, Any]:
    started = time.perf_counter()
    ttft_ms: int | None = None
    tokens = 0
    async with client.stream(
        "POST",
        url,
        json={
            "model": model,
            "messages": [{"role": "user", "content": SPEED_TEST_PROMPT}],
            "max_tokens": SPEED_TEST_MAX_TOKENS,
            "stream": True,
        },
        headers={"Authorization": "Bearer ollama"},
    ) as response:
        if response.status_code >= 400:
            detail = (await response.aread()).decode("utf-8", "replace").strip()
            if len(detail) > 240:
                detail = detail[:240] + "…"
            return _fail(
                f"HTTP {response.status_code} POST {url}" + (f": {detail}" if detail else "")
            )
        async for raw in response.aiter_lines():
            data = _parse_openai_sse(raw)
            if data is None:
                continue
            choices = data.get("choices")
            first = choices[0] if isinstance(choices, list) and choices else None
            delta = first.get("delta") if isinstance(first, dict) else None
            chunk = ""
            if isinstance(delta, dict):
                chunk = str(delta.get("content") or "")
            elif isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict):
                    chunk = str(message.get("content") or "")
            if chunk and ttft_ms is None:
                ttft_ms = int((time.perf_counter() - started) * 1000)
            if chunk:
                tokens += 1
            if isinstance(first, dict) and first.get("finish_reason"):
                break
    elapsed = time.perf_counter() - started
    return _ok(
        latency_ms=int(elapsed * 1000),
        ttft_ms=ttft_ms,
        tokens=tokens or None,
        tokens_per_sec=_tokens_per_sec(
            eval_count=tokens or None, eval_duration_ns=None, elapsed_s=elapsed
        ),
    )


async def speed_test_local_model(*, name: str, base_url: str | None) -> dict[str, Any]:
    """Ping a local model with a tiny prompt; return latency and optional tok/s."""
    model = name.strip()
    if not model:
        return _fail("Model name is required.")
    root = ollama_native_root(base_url)
    timeout = httpx.Timeout(SPEED_TEST_TIMEOUT_S)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            generate = await _speed_test_ollama_generate(client, model=model, root=root)
            if generate.get("ok"):
                return generate
            error = str(generate.get("error") or "")
            if "HTTP 404" not in error and "HTTP 405" not in error:
                return generate
            return await _speed_test_chat_completions(
                client, model=model, url=openai_chat_url(base_url)
            )
    except httpx.TimeoutException:
        return _fail(_TIMEOUT, action="timeout")
    except httpx.ConnectError:
        return _fail(_UNREACHABLE, action="unreachable")
    except httpx.HTTPError as exc:
        logger.info("local speed test failed for %s: %s", model, exc)
        return _fail(str(exc).strip() or _UNREACHABLE)

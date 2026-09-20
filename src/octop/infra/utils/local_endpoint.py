"""Detect loopback / LAN-local OpenAI-compatible endpoints.

Used when filling optional API-key placeholders for Ollama, LM Studio,
llama.cpp, vLLM, and similar runtimes that already sit on the operator's machine.
"""

from __future__ import annotations

from urllib.parse import urlparse

# Many local OpenAI-compatible servers accept any non-empty Bearer token.
LOCAL_PLACEHOLDER_API_KEY = "local"

_LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "0.0.0.0"})
_LOCAL_SERVICE_HOSTS = frozenset({"ollama", "lmstudio", "vllm"})


def is_local_base_url(url: str | None) -> bool:
    """True when *url* points at this machine or a well-known local runtime host."""
    raw = (url or "").strip()
    if not raw:
        return False
    parsed = urlparse(raw if "://" in raw else f"http://{raw}")
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    if host in _LOOPBACK_HOSTS or host in _LOCAL_SERVICE_HOSTS:
        return True
    return host.endswith(".local")


def placeholder_api_key(url: str | None, existing: str | None = None) -> str:
    """Return a usable API key, filling a local placeholder when the URL is local."""
    key = (existing or "").strip()
    if key:
        return key
    if is_local_base_url(url):
        return LOCAL_PLACEHOLDER_API_KEY
    return ""

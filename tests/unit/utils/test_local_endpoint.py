"""Local OpenAI-compatible endpoint helpers."""

from __future__ import annotations

from octop.infra.agents.providers.model_flags import resolve_provider_credentials
from octop.infra.utils.local_endpoint import (
    LOCAL_PLACEHOLDER_API_KEY,
    is_local_base_url,
    placeholder_api_key,
)


def test_loopback_and_local_service_hosts_are_local() -> None:
    assert is_local_base_url("http://127.0.0.1:11434/v1")
    assert is_local_base_url("http://localhost:1234/v1")
    assert is_local_base_url("http://ollama:11434/v1")
    assert not is_local_base_url("https://api.openai.com/v1")
    assert not is_local_base_url("")


def test_placeholder_api_key_fills_only_local_urls() -> None:
    assert placeholder_api_key("http://127.0.0.1:8080/v1", "") == LOCAL_PLACEHOLDER_API_KEY
    assert placeholder_api_key("https://api.openai.com/v1", "") == ""
    assert placeholder_api_key("http://127.0.0.1:8080/v1", "sk-keep") == "sk-keep"


def test_resolve_provider_credentials_fills_ollama_defaults() -> None:
    key, url = resolve_provider_credentials("Ollama (Local)", api_key="", base_url="")
    assert key == "ollama"
    assert url == "http://127.0.0.1:11434/v1"


def test_resolve_provider_credentials_fills_lm_studio_style_url() -> None:
    key, url = resolve_provider_credentials(
        "LM Studio",
        api_key="",
        base_url="http://127.0.0.1:1234/v1",
    )
    assert key == LOCAL_PLACEHOLDER_API_KEY
    assert url == "http://127.0.0.1:1234/v1"

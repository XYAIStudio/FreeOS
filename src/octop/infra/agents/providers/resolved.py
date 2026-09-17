"""Resolved model list across enabled providers."""

from __future__ import annotations

from typing import Any

from octop.infra.agents.providers.model_flags import (
    is_chat_eligible_model,
    local_ollama_endpoint,
)
from octop.infra.agents.providers.reasoning import reasoning_capability


def list_resolved_models(providers: list[Any]) -> list[dict[str, Any]]:
    """Return chat-eligible enabled models for providers with credentials.

    Embedding-only models (``embedding: true`` / ``task: embedding`` / ONNX
    local) are excluded so they never appear in chat pickers or auto-route.
    """
    resolved: list[dict[str, Any]] = []
    for provider in providers:
        if not provider.enabled:
            continue
        provider_name = str(getattr(provider, "name", "") or "")
        provider_api_key = str(getattr(provider, "api_key", "") or "") or None
        provider_base_url = str(getattr(provider, "base_url", "") or "") or None
        api_key, _base_url = local_ollama_endpoint(
            provider_name,
            provider_api_key=provider_api_key,
            provider_base_url=provider_base_url,
        )
        if not api_key:
            continue
        for m in provider.get_models():
            if not is_chat_eligible_model(m, provider_name=provider_name, provider_api_key=api_key):
                continue
            # Total context drives the UI ring; prompt and output caps remain
            # separately available for runtime budgeting and model settings.
            window = m.get("context_window") or m.get("max_input_tokens")
            max_input = m.get("max_input_tokens") or window
            max_output = m.get("max_output_tokens") or m.get("max_tokens")
            resolved.append(
                {
                    "provider_id": provider.id,
                    "provider_name": provider.name,
                    "provider_kind": provider.kind,
                    "model": m["id"],
                    "name": m.get("name") or m["id"],
                    "input": m.get("input") or ["text"],
                    "reasoning": reasoning_capability(m, base_url=provider.base_url) is not None,
                    "reasoning_config": reasoning_capability(m, base_url=provider.base_url),
                    "context_window": window,
                    "max_tokens": max_output,
                    "max_output_tokens": max_output,
                    "max_input_tokens": max_input,
                }
            )
    return resolved

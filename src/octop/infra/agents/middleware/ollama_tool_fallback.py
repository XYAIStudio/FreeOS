"""Retry Ollama models without tools when the model rejects tool calling."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse


def _is_unsupported_tools_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "does not support tools" in message or "doesn't support tools" in message


class OllamaToolFallbackMiddleware(AgentMiddleware[Any, Any]):
    """Preserve chat for local models that do not implement tool calling.

    Ollama's OpenAI-compatible endpoint rejects such requests with HTTP 400.
    Retrying the same turn without tools is safe and lets vision/chat-only
    models answer normally instead of exhausting the generic model retry loop.
    """

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
    ) -> ModelResponse[Any]:
        try:
            return await handler(request)
        except Exception as exc:
            if not request.tools or not _is_unsupported_tools_error(exc):
                raise
            return await handler(request.override(tools=[], tool_choice=None))


__all__ = ["OllamaToolFallbackMiddleware"]

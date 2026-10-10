"""Keep checkpoint-resident system messages out of model requests."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain_core.messages import AnyMessage, SystemMessage


class SystemMessageCleanupMiddleware(AgentMiddleware[Any, Any]):
    """Remove stale system messages while preserving the compiled system prompt.

    Harness injects the active prompt through ``request.system_message``. Older
    checkpoints may still contain ``SystemMessage`` entries in ``messages``;
    strict chat templates such as Qwen reject those entries when they appear
    after conversation messages.
    """

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
    ) -> ModelResponse[Any]:
        messages: list[AnyMessage] = [
            message for message in request.messages if not isinstance(message, SystemMessage)
        ]
        if len(messages) != len(request.messages):
            request = request.override(messages=messages)
        return await handler(request)


__all__ = ["SystemMessageCleanupMiddleware"]

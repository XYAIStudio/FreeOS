from __future__ import annotations

from typing import Any
from unittest.mock import Mock

import pytest
from langchain.agents.middleware import ModelRequest, ModelResponse

from octop.infra.agents.middleware.ollama_tool_fallback import (
    OllamaToolFallbackMiddleware,
)


def _request(*, tools: list[Any]) -> ModelRequest[Any]:
    return ModelRequest(model=Mock(), messages=[], tools=tools)


@pytest.mark.asyncio
async def test_retries_without_tools_when_ollama_rejects_them() -> None:
    middleware = OllamaToolFallbackMiddleware()
    seen: list[ModelRequest[Any]] = []
    expected = Mock(spec=ModelResponse)

    async def handler(request: ModelRequest[Any]) -> ModelResponse[Any]:
        seen.append(request)
        if len(seen) == 1:
            raise RuntimeError("qwen2.5vl:3b does not support tools")
        return expected

    result = await middleware.awrap_model_call(_request(tools=[Mock()]), handler)

    assert result is expected
    assert len(seen) == 2
    assert seen[1].tools == []
    assert seen[1].tool_choice is None


@pytest.mark.asyncio
async def test_does_not_hide_unrelated_model_errors() -> None:
    middleware = OllamaToolFallbackMiddleware()

    async def handler(_request: ModelRequest[Any]) -> ModelResponse[Any]:
        raise RuntimeError("authentication failed")

    with pytest.raises(RuntimeError, match="authentication failed"):
        await middleware.awrap_model_call(_request(tools=[Mock()]), handler)

from __future__ import annotations

from typing import Any
from unittest.mock import Mock

import pytest
from langchain.agents.middleware import ModelRequest, ModelResponse
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from octop.infra.agents.middleware.system_message_cleanup import (
    SystemMessageCleanupMiddleware,
)


@pytest.mark.asyncio
async def test_removes_checkpoint_system_messages_and_keeps_compiled_prompt() -> None:
    middleware = SystemMessageCleanupMiddleware()
    compiled = SystemMessage(content="current prompt")
    request = ModelRequest(
        model=Mock(),
        system_message=compiled,
        messages=[
            HumanMessage(content="first"),
            SystemMessage(content="stale bootstrap"),
            AIMessage(content="reply"),
            HumanMessage(content="next"),
        ],
        tools=[],
    )
    seen: list[ModelRequest[Any]] = []
    expected = Mock(spec=ModelResponse)

    async def handler(value: ModelRequest[Any]) -> ModelResponse[Any]:
        seen.append(value)
        return expected

    result = await middleware.awrap_model_call(request, handler)

    assert result is expected
    assert seen[0].system_message is compiled
    assert [type(message) for message in seen[0].messages] == [
        HumanMessage,
        AIMessage,
        HumanMessage,
    ]


@pytest.mark.asyncio
async def test_forwards_clean_request_without_replacing_it() -> None:
    middleware = SystemMessageCleanupMiddleware()
    request = ModelRequest(model=Mock(), messages=[HumanMessage(content="hello")], tools=[])
    seen: list[ModelRequest[Any]] = []
    expected = Mock(spec=ModelResponse)

    async def handler(value: ModelRequest[Any]) -> ModelResponse[Any]:
        seen.append(value)
        return expected

    result = await middleware.awrap_model_call(request, handler)

    assert result is expected
    assert seen == [request]

from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from langchain.agents.middleware import ModelRequest, ModelResponse
from langchain_core.messages import AIMessage, HumanMessage
from langchain_openai import ChatOpenAI

from octop.infra.agents.middleware import group_mentions as gm


@pytest.fixture
def setup(monkeypatch):
    peers = [
        SimpleNamespace(agent_id="a", name="专家甲", metadata={"user_id": "u"}),
        SimpleNamespace(agent_id="b", name="专家乙", metadata={"user_id": "u"}),
        SimpleNamespace(agent_id="x", name="外部", metadata={"user_id": "other"}),
    ]
    manager = SimpleNamespace(
        team=SimpleNamespace(list_peers=lambda *a, **k: peers, peer_display_name=lambda p: p.name),
        shared_factory=SimpleNamespace(get_chat_model=Mock()),
    )
    config = {"configurable": {"user": "u", "agent_id": "host", "model": "local/qwen"}}
    monkeypatch.setattr(gm, "runtime_config", lambda r: config)
    monkeypatch.setattr(gm, "get_config", lambda: config)
    request = ModelRequest(
        model=ChatOpenAI(model="test", api_key="test"),
        messages=[HumanMessage(content="@专家甲 @专家乙 头脑风暴：工业供热预测")],
        tools=[{"name": "ask_agent"}, {"name": "cron"}],
    )
    return gm.GroupMentionMiddleware(lambda: manager), request, manager


async def test_sequential_real_calls_and_summary(setup):
    middleware, request, _ = setup

    async def unexpected(r):
        pytest.fail("Mention dispatch must not depend on model tool selection")

    for agent in ["a", "b"]:
        response = await middleware.awrap_model_call(request, unexpected)
        message = response.result[0]
        call = message.tool_calls[0]
        assert call["args"]["agent"] == agent
        assert "工业供热预测" in call["args"]["message"]
        assert "@专家" not in call["args"]["message"]
        request = request.override(messages=[*request.messages, message])

    async def summary(r):
        assert r.tools == []
        assert "实际回复" in gm._text(r.system_message.content)
        return ModelResponse(result=[AIMessage(content="总结")])

    await middleware.awrap_model_call(request, summary)


@pytest.mark.parametrize(
    "text", ["普通聊天", "@外部 讨论问题", "@专家甲乙 讨论问题", "@所有人 讨论问题"]
)
async def test_unmatched_or_other_user_passes_through(setup, text):
    middleware, request, _ = setup
    request = request.override(messages=[HumanMessage(content=text)])

    async def handler(r):
        assert r is request
        return ModelResponse(result=[AIMessage(content="原路径")])

    await middleware.awrap_model_call(request, handler)


async def test_disabled_collaboration_is_respected(setup):
    middleware, request, _ = setup
    request = request.override(tools=[])

    async def handler(r):
        assert r is request
        return ModelResponse(result=[AIMessage(content="disabled")])

    await middleware.awrap_model_call(request, handler)


async def test_explicit_selected_ids_route_even_when_display_tokens_do_not_match(setup):
    middleware, request, _ = setup
    request = request.override(
        messages=[
            HumanMessage(
                content="请分别给出建议",
                additional_kwargs={
                    "octop_composer_context": {"targetAgents": ["b", "a"]}
                },
            )
        ]
    )

    async def unexpected(r):
        pytest.fail("Explicit selected ids must be dispatched before model selection")

    first = await middleware.awrap_model_call(request, unexpected)
    assert first.result[0].tool_calls[0]["args"]["agent"] == "b"
    # Multiple selected peers are always a controlled discussion turn.
    assert first.result[0].tool_calls[0]["id"].startswith("freeos_mention_discussion_")


async def test_new_turn_does_not_reuse_old_dispatch_progress(setup):
    middleware, request, _ = setup

    async def unexpected(r):
        pytest.fail("Must dispatch the new turn")

    first = await middleware.awrap_model_call(request, unexpected)
    request = request.override(messages=[*request.messages, first.result[0], *request.messages])
    second = await middleware.awrap_model_call(request, unexpected)
    assert second.result[0].tool_calls[0]["args"]["agent"] == "a"


async def test_execution_request_preserves_tools_in_child(setup):
    middleware, request, _ = setup
    token = gm._PEER_TURN.set((None, False))
    try:

        async def handler(r):
            assert r.tools == request.tools
            return ModelResponse(result=[AIMessage(content="正常工具任务")])

        await middleware.awrap_model_call(request, handler)
    finally:
        gm._PEER_TURN.reset(token)


async def test_child_inherits_model_and_scope_resets_on_failure(setup):
    middleware, request, manager = setup
    manager.shared_factory.get_chat_model.return_value = request.model
    tool_request = SimpleNamespace(
        tool_call={"name": "ask_agent", "id": "freeos_mention_discussion_1"}
    )

    async def model_handler(r):
        assert r.tools == []
        manager.shared_factory.get_chat_model.assert_called_once_with("local/qwen")
        return ModelResponse(result=[AIMessage(content="成员意见")])

    async def tool_handler(r):
        await middleware.awrap_model_call(request, model_handler)
        raise RuntimeError("peer failed")

    with pytest.raises(RuntimeError, match="peer failed"):
        await middleware.awrap_tool_call(tool_request, tool_handler)
    assert gm._PEER_TURN.get() is None


def test_mention_boundaries():
    assert gm.has_mention("@AI-专家，发言", "AI 专家")
    assert not gm.has_mention("contact@专家", "专家")
    assert not gm.has_mention("@专家甲", "专家")


async def test_graph_executes_both_calls_before_model_summary(setup):
    from langchain.agents import create_agent
    from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
    from langchain_core.tools import tool

    middleware, request, _ = setup
    calls = []

    @tool
    async def ask_agent(agent: str, message: str, mode: str) -> str:
        """Ask a peer expert."""
        calls.append(agent)
        assert gm._PEER_TURN.get() == ("local/qwen", True)
        return f"{agent}: industrial steam forecast"

    graph = create_agent(
        model=FakeMessagesListChatModel(responses=[AIMessage(content="已汇总两位专家")]),
        tools=[ask_agent],
        middleware=[middleware],
    )
    result = await graph.ainvoke({"messages": request.messages})
    assert calls == ["a", "b"]
    assert result["messages"][-1].content == "已汇总两位专家"
    assert gm._PEER_TURN.get() is None

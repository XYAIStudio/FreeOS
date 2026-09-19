"""Dispatch explicit expert mentions without relying on model tool selection."""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from typing import Any
from uuid import uuid4

from deepagents.middleware._utils import append_to_system_message
from harness_agent.manager import HarnessAgentManager
from harness_agent.middleware.runtime import runtime_config
from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.config import get_config
from langgraph.prebuilt.tool_node import ToolCallRequest
from langgraph.types import Command

_CALL_PREFIX = "freeos_mention_"
_PEER_TURN: ContextVar[tuple[str | None, bool] | None] = ContextVar(
    "freeos_explicit_peer_turn", default=None
)


def _text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(
            str(part.get("text", ""))
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        )
    return ""


def has_mention(text: str, name: str) -> bool:
    token = "@" + re.sub(r"\s+", "-", name.strip())
    return bool(name.strip()) and bool(
        re.search(r"(?<!\S)" + re.escape(token) + r"(?=$|\s|[，。！？、,:：!?])", text)
    )


class GroupMentionMiddleware(AgentMiddleware[Any, Any]):
    """Use real ask_agent calls, sequentially, then let the host summarize.

    No shared mutable per-turn state: dispatch progress lives in the graph's
    messages. Child scope uses ContextVar so simultaneous chats stay isolated.
    """

    def __init__(self, manager: Callable[[], HarnessAgentManager | None]) -> None:
        super().__init__()
        self._manager = manager

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
    ) -> ModelResponse[Any]:
        manager = self._manager()
        if manager is None:
            return await handler(request)
        child = _PEER_TURN.get()
        if child is not None:
            model_ref, discussion = child
            updates: dict[str, Any] = {}
            if model_ref and manager.shared_factory is not None:
                updates["model"] = manager.shared_factory.get_chat_model(model_ref)
            if discussion:
                updates.update(tools=[], tool_choice=None)
            return await handler(request.override(**updates))

        latest = next(
            (
                i
                for i in range(len(request.messages) - 1, -1, -1)
                if isinstance(request.messages[i], HumanMessage)
            ),
            None,
        )
        if latest is None:
            return await handler(request)
        text = _text(request.messages[latest].content)
        config = runtime_config(request).get("configurable") or {}
        user_id, agent_id = config.get("user"), config.get("agent_id")
        if user_id is None or not agent_id:
            return await handler(request)
        peers = manager.team.list_peers(str(user_id), exclude_agent_id=str(agent_id))
        targets = [
            peer
            for peer in peers
            if str(peer.metadata.get("user_id")) == str(user_id)
            and has_mention(text, manager.team.peer_display_name(peer))
        ]
        if not targets:
            return await handler(request)
        tool_names = {
            tool.get("name") if isinstance(tool, dict) else tool.name for tool in request.tools
        }
        if "ask_agent" not in tool_names:
            # Do not bypass disabled collaboration or the runtime tool policy.
            return await handler(request)
        called = {
            str(call.get("args", {}).get("agent", ""))
            for message in request.messages[latest + 1 :]
            if isinstance(message, AIMessage)
            for call in message.tool_calls
            if call.get("name") == "ask_agent" and str(call.get("id", "")).startswith(_CALL_PREFIX)
        }
        discussion = bool(re.search(r"头脑风暴|讨论|brainstorm|discuss", text, re.I))
        for peer in targets:
            if peer.agent_id in called:
                continue
            # Peer input contains the actual user turn, not an invented subtask.
            # Remove roster mentions to avoid recursive peer fan-out.
            question = text
            for entry in peers:
                name = re.sub(r"\s+", "-", manager.team.peer_display_name(entry).strip())
                question = re.sub(
                    r"(?<!\S)@" + re.escape(name) + r"(?=$|\s|[，。！？、,:：!?])",
                    "",
                    question,
                )
            question = re.sub(r"(?<!\S)@(所有人|everyone)(?=$|\s)", "", question)
            instruction = (
                "请按你的专业角色回答下面这条当前用户请求，使用与用户相同的语言。"
                "不要代替其他成员发言。\n"
                if re.search(r"[\u4e00-\u9fff]", text)
                else "Answer the current request in the user's language from your own role. "
                "Do not impersonate other members.\n"
            )
            return ModelResponse(
                result=[
                    AIMessage(
                        content="",
                        tool_calls=[
                            {
                                "name": "ask_agent",
                                "id": _CALL_PREFIX
                                + ("discussion_" if discussion else "")
                                + uuid4().hex,
                                "args": {
                                    "agent": peer.agent_id,
                                    "message": instruction + question.strip(),
                                    "mode": "sync",
                                },
                            }
                        ],
                    )
                ]
            )
        instruction = (
            "请用用户当前使用的语言，按成员姓名分别呈现本轮专家的实际回复，再给出简短总结。"
            "如某成员调用失败或没有回复，请明确说明，不要编造其意见。"
            if re.search(r"[\u4e00-\u9fff]", text)
            else "Present this turn's actual peer replies by name, then briefly summarize. "
            "Use the user's language. Report failed or empty replies; never invent contributions."
        )
        updates = {"system_message": append_to_system_message(request.system_message, instruction)}
        if discussion:
            updates.update(tools=[], tool_choice=None)
        return await handler(request.override(**updates))

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command[Any]]],
    ) -> ToolMessage | Command[Any]:
        call = request.tool_call
        call_id = str(call.get("id", ""))
        if call.get("name") != "ask_agent" or not call_id.startswith(_CALL_PREFIX):
            return await handler(request)
        config = get_config().get("configurable") or {}
        model = config.get("model")
        token = _PEER_TURN.set(
            (
                model if isinstance(model, str) and model else None,
                call_id.startswith(_CALL_PREFIX + "discussion_"),
            )
        )
        try:
            return await handler(request)
        finally:
            _PEER_TURN.reset(token)

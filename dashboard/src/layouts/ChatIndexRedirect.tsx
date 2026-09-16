import { Navigate, useLocation } from "react-router-dom";
import { useAgent } from "../context/AgentContext";
import { CONVERSATION_LIST_PATH, chatCanvasPath } from "./conversationHome";

type ChatIntentState = {
  newChat?: boolean;
  prefillInput?: string;
  attachKnowledgeBaseId?: string;
};

function hasChatIntent(state: unknown): boolean {
  if (!state || typeof state !== "object") return false;
  const next = state as ChatIntentState;
  return Boolean(
    next.newChat || next.prefillInput || next.attachKnowledgeBaseId,
  );
}

/**
 * Bare ``/chat`` is not a second conversation home.
 * Intent (new chat / prefill / attach KB) opens the canvas; otherwise the
 * shared workspace 对话 list.
 */
export default function ChatIndexRedirect() {
  const location = useLocation();
  const { activeAgentId, agents } = useAgent();
  if (hasChatIntent(location.state)) {
    const agentId = activeAgentId || agents[0]?.agent_id;
    if (agentId) {
      return (
        <Navigate
          to={chatCanvasPath(agentId)}
          replace
          state={location.state}
        />
      );
    }
  }
  return <Navigate to={CONVERSATION_LIST_PATH} replace />;
}

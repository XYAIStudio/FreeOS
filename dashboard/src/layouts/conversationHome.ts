/** Shared conversation list lives under the workspace 对话 tab. */
export const CONVERSATION_LIST_PATH = "/projects";
export const WORKSPACE_PROJECTS_PATH = "/projects?view=projects";
export const WORKSPACE_TASKS_PATH = "/projects?view=tasks";

export type WorkspaceView = "conversations" | "projects" | "tasks";

export function workspaceViewFromSearch(search = ""): WorkspaceView {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const view = new URLSearchParams(raw).get("view");
  if (view === "projects" || view === "tasks") return view;
  return "conversations";
}

/** Sidebar key for the unified conversation / workspace hub. */
export function resolveWorkspaceNavKey(
  pathname: string,
  search = "",
): "chat" | "projects" | null {
  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) {
    return "projects";
  }
  if (pathname === "/projects" || pathname.startsWith("/projects/")) {
    return workspaceViewFromSearch(search) === "conversations"
      ? "chat"
      : "projects";
  }
  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return "chat";
  }
  return null;
}

export function chatCanvasPath(
  agentId?: string | null,
  threadId?: string | null,
): string {
  if (agentId && threadId) return `/chat/${agentId}/${threadId}`;
  if (agentId) return `/chat/${agentId}`;
  return CONVERSATION_LIST_PATH;
}

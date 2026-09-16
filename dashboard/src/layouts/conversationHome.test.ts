import { describe, expect, it } from "vitest";
import {
  CONVERSATION_LIST_PATH,
  WORKSPACE_PROJECTS_PATH,
  chatCanvasPath,
  resolveWorkspaceNavKey,
  workspaceViewFromSearch,
} from "./conversationHome";

describe("conversationHome", () => {
  it("treats the workspace conversations tab as the chat list", () => {
    expect(workspaceViewFromSearch("")).toBe("conversations");
    expect(workspaceViewFromSearch("?view=projects")).toBe("projects");
    expect(workspaceViewFromSearch("view=tasks")).toBe("tasks");
    expect(resolveWorkspaceNavKey("/projects")).toBe("chat");
    expect(resolveWorkspaceNavKey("/projects", "?view=projects")).toBe(
      "projects",
    );
    expect(resolveWorkspaceNavKey("/projects", "?view=tasks")).toBe("projects");
    expect(resolveWorkspaceNavKey("/chat/agent-1/thr_1")).toBe("chat");
    expect(resolveWorkspaceNavKey("/tasks")).toBe("projects");
    expect(resolveWorkspaceNavKey("/experts")).toBeNull();
  });

  it("opens a canvas only when an expert is known", () => {
    expect(chatCanvasPath()).toBe(CONVERSATION_LIST_PATH);
    expect(chatCanvasPath("exp-1")).toBe("/chat/exp-1");
    expect(chatCanvasPath("exp-1", "thr_1")).toBe("/chat/exp-1/thr_1");
    expect(WORKSPACE_PROJECTS_PATH).toBe("/projects?view=projects");
  });
});

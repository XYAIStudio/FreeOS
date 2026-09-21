import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OctopAgent } from "../../../context/AgentContext";
import SessionListToolbar from "./SessionListToolbar";

const navigate = vi.fn();
const setActiveAgent = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../../../context/AgentContext", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../../context/AgentContext")
  >();
  return {
    ...actual,
    useAgent: () => ({ setActiveAgent }),
  };
});

vi.mock("../../../utils/openGroupChat", () => ({
  openGroupChat: vi.fn(),
}));

import { openGroupChat } from "../../../utils/openGroupChat";

vi.mock("../../../utils/antdMessage", () => ({
  message: { success: vi.fn(), error: vi.fn() },
}));

function agent(id: string, name: string): OctopAgent {
  return {
    id: Number(id.replace(/\D/g, "") || 1),
    agent_id: id,
    name,
    description: null,
    persona_mbti: null,
    default_model: null,
    system_prompt: null,
    template_name: null,
    state: "running",
    last_error: null,
    icon: null,
    icon_name: null,
    icon_url: null,
    color: null,
    config: {},
  };
}

function renderToolbar(
  props: Partial<ComponentProps<typeof SessionListToolbar>> = {},
) {
  const onSearchQueryChange = props.onSearchQueryChange ?? vi.fn();
  return render(
    <MemoryRouter>
      <SessionListToolbar
        searchQuery={props.searchQuery ?? ""}
        onSearchQueryChange={onSearchQueryChange}
        agents={
          props.agents ?? [
            agent("a1", "分析师"),
            agent("a2", "研究员"),
            agent("a3", "设计师"),
          ]
        }
      />
    </MemoryRouter>,
  );
}

describe("SessionListToolbar", () => {
  beforeEach(() => {
    navigate.mockReset();
    setActiveAgent.mockReset();
    openGroupChat.mockReset();
  });

  it("puts search and new-group controls on the conversation header", () => {
    renderToolbar();
    expect(screen.getByTestId("chat-session-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "对话" })).toBeInTheDocument();
    expect(
      screen.getByTestId("chat-session-search-toggle"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("chat-session-new-group")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-session-search")).toBeNull();
  });

  it("opens the search field and reports query changes", () => {
    const onSearchQueryChange = vi.fn();
    renderToolbar({ onSearchQueryChange });
    fireEvent.click(screen.getByTestId("chat-session-search-toggle"));
    const input = screen.getByTestId("chat-session-search");
    fireEvent.change(input, { target: { value: "周会" } });
    expect(onSearchQueryChange).toHaveBeenCalledWith("周会");
  });

  it("creates a group chat from the plus button", async () => {
    openGroupChat.mockResolvedValue({
      record: {
        id: "t1",
        threadId: "t1",
        hostAgentId: "a1",
        memberIds: ["a1", "a2"],
        title: "群",
        createdAt: 1,
        lastActive: 1,
      },
      created: true,
    });
    renderToolbar();
    fireEvent.click(screen.getByTestId("chat-session-new-group"));
    fireEvent.click(screen.getByLabelText("分析师"));
    fireEvent.click(screen.getByLabelText("研究员"));
    fireEvent.click(screen.getByRole("button", { name: /创\s*建/ }));
    await waitFor(() => {
      expect(openGroupChat).toHaveBeenCalledWith(
        expect.objectContaining({
          memberIds: ["a1", "a2"],
          memberNames: ["分析师", "研究员"],
        }),
      );
    });
    expect(setActiveAgent).toHaveBeenCalledWith("a1");
    expect(navigate).toHaveBeenCalledWith("/chat/a1/t1", {
      state: { prefillInput: "@分析师 @研究员 " },
    });
  });
});

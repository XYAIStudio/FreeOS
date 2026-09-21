import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { OctopAgent } from "../../../context/AgentContext";
import type { Session } from "../hooks/useSessions";
import SessionList from "./SessionList";

vi.mock("../../../context/AgentContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../context/AgentContext")>();
  return {
    ...actual,
    useAgent: () => ({ setActiveAgent: vi.fn() }),
  };
});

function agent(id: string, name: string): OctopAgent {
  return {
    id: Number(id.replace(/\D/g, "") || 1),
    agent_id: id,
    name,
    description: "desc",
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

const sessions: Session[] = [
  {
    id: "s1",
    name: "周会纪要",
    threadId: "s1",
    updatedAt: null,
    channelType: "dashboard",
    hasActivity: true,
    pinned: false,
  },
  {
    id: "s2",
    name: "代码审查",
    threadId: "s2",
    updatedAt: null,
    channelType: "dashboard",
    hasActivity: true,
    pinned: false,
  },
];

describe("SessionList", () => {
  it("filters sessions from the header search control", () => {
    render(
      <MemoryRouter>
        <SessionList
          agents={[agent("a1", "分析师")]}
          sessions={sessions}
          activeId="s1"
          activeAgentId="a1"
          hasMore={false}
          loadingMore={false}
          onLoadMore={vi.fn()}
          onFetchAllSessions={vi.fn()}
          onSelect={vi.fn()}
          onAgentSelect={vi.fn()}
          onDelete={vi.fn()}
          onRename={vi.fn()}
          onPin={vi.fn()}
          onFork={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("周会纪要")).toBeInTheDocument();
    expect(screen.getByText("代码审查")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("chat-session-search-toggle"));
    fireEvent.change(screen.getByTestId("chat-session-search"), {
      target: { value: "周会" },
    });
    expect(screen.getByText("周会纪要")).toBeInTheDocument();
    expect(screen.queryByText("代码审查")).toBeNull();
  });
});

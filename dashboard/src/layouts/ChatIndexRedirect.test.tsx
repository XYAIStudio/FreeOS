import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../context/AgentContext", () => ({
  useAgent: () => ({ activeAgentId: null, agents: [] }),
}));

import ChatIndexRedirect from "./ChatIndexRedirect";

describe("ChatIndexRedirect", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("opens the first desktop agent instead of the /projects dump", async () => {
    render(
      <MemoryRouter initialEntries={["/chat?desktop=1"]}>
        <Routes>
          <Route path="/chat" element={<ChatIndexRedirect />} />
          <Route path="/chat/:agentId" element={<div>first agent</div>} />
          <Route path="/projects" element={<div>conversation list</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("first agent")).toBeInTheDocument();
    expect(screen.queryByText("conversation list")).toBeNull();
  });

  it("keeps the web console conversation list for bare /chat", async () => {
    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <Routes>
          <Route path="/chat" element={<ChatIndexRedirect />} />
          <Route path="/chat/:agentId" element={<div>first agent</div>} />
          <Route path="/projects" element={<div>conversation list</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("conversation list")).toBeInTheDocument();
    expect(screen.queryByText("first agent")).toBeNull();
  });
});

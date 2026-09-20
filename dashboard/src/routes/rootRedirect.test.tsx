import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { routeConfigs } from "./index";

function renderRoot(entry: string) {
  const root = routeConfigs.find((rc) => rc.path === "/");
  if (!root) throw new Error("missing / route");
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={root.element} />
        <Route path="/chat/:agentId" element={<div>first agent</div>} />
        <Route path="/projects" element={<div>conversation list</div>} />
        <Route path="/organization" element={<div>org room</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RootRedirect", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("sends desktop / to /chat/main, not /projects or organization", async () => {
    renderRoot("/?desktop=1");
    expect(await screen.findByText("first agent")).toBeInTheDocument();
    expect(screen.queryByText("conversation list")).toBeNull();
    expect(screen.queryByText("org room")).toBeNull();
  });

  it("keeps the web console / → /projects dump", async () => {
    renderRoot("/");
    expect(await screen.findByText("conversation list")).toBeInTheDocument();
    expect(screen.queryByText("first agent")).toBeNull();
  });
});

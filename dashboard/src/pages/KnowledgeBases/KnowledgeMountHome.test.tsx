import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KnowledgeMountHome } from "./KnowledgeMountHome";

vi.mock("../../api/modules/knowledgeBases", () => ({
  knowledgeBasesApi: {
    getMount: vi.fn().mockResolvedValue({ mounted: false, entries: [] }),
    setMount: vi.fn(),
    distillMount: vi.fn(),
  },
}));

describe("<KnowledgeMountHome />", () => {
  it("shows local and cloud mount setup immediately", () => {
    render(
      <KnowledgeMountHome
        canConfigure
        onOpenSettings={() => undefined}
        ensureKb={vi.fn()}
        onMounted={() => undefined}
      />,
    );

    expect(
      screen.getByText("knowledgeBases.homeTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("knowledgeBases.mountTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("knowledgeBases.cloudMountTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "knowledgeBases.settingsFoundation" }),
    ).toBeInTheDocument();
  });

  it("opens foundation settings from the secondary link", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <KnowledgeMountHome
        canConfigure
        onOpenSettings={onOpenSettings}
        ensureKb={vi.fn()}
        onMounted={() => undefined}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "knowledgeBases.settingsFoundation" }),
    );
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

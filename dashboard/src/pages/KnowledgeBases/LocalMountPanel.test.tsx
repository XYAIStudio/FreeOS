import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pickKnowledgeFolder = vi.fn();
const setMount = vi.fn();
const getMount = vi.fn();

vi.mock("./pickKnowledgeFolder", () => ({
  pickKnowledgeFolder: (...args: unknown[]) => pickKnowledgeFolder(...args),
  canPickKnowledgeFolder: () => true,
}));

vi.mock("../../api/modules/knowledgeBases", () => ({
  knowledgeBasesApi: {
    getMount: (...args: unknown[]) => getMount(...args),
    setMount: (...args: unknown[]) => setMount(...args),
    distillMount: vi.fn(),
  },
}));

import { LocalMountPanel } from "./LocalMountPanel";

describe("<LocalMountPanel />", () => {
  beforeEach(() => {
    pickKnowledgeFolder.mockReset();
    setMount.mockReset();
    getMount.mockReset();
    getMount.mockResolvedValue({
      mounted: false,
      source_path: "",
      entries: [],
    });
    setMount.mockResolvedValue({
      mounted: true,
      source_path: "/docs",
      entries: [],
    });
  });

  it("fills the path from the folder picker and mounts", async () => {
    const user = userEvent.setup();
    pickKnowledgeFolder.mockResolvedValue("/Users/ada/Notes");
    const ensureKb = vi.fn().mockResolvedValue("kb-new");

    render(<LocalMountPanel prominent ensureKb={ensureKb} />);

    await user.click(
      screen.getByRole("button", { name: "knowledgeBases.pickFolder" }),
    );
    expect(pickKnowledgeFolder).toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "knowledgeBases.mountAction" }),
    );
    expect(ensureKb).toHaveBeenCalled();
    expect(setMount).toHaveBeenCalledWith("kb-new", "/Users/ada/Notes");
  });
});

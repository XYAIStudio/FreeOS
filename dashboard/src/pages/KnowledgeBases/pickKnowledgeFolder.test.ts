import { describe, expect, it, vi } from "vitest";

const pickDesktopFolder = vi.fn();
const canPickDesktopFolder = vi.fn();

vi.mock("../../utils/desktopFolder", () => ({
  pickDesktopFolder: (...args: unknown[]) => pickDesktopFolder(...args),
  canPickDesktopFolder: (...args: unknown[]) => canPickDesktopFolder(...args),
}));

import {
  canPickKnowledgeFolder,
  pickKnowledgeFolder,
} from "./pickKnowledgeFolder";

describe("pickKnowledgeFolder", () => {
  it("delegates to the desktop folder picker", async () => {
    pickDesktopFolder.mockResolvedValue("/tmp/docs");
    canPickDesktopFolder.mockReturnValue(true);

    await expect(pickKnowledgeFolder()).resolves.toBe("/tmp/docs");
    expect(canPickKnowledgeFolder()).toBe(true);
  });
});

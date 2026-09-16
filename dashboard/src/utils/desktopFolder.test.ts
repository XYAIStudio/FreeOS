import { afterEach, describe, expect, it, vi } from "vitest";
import { canPickDesktopFolder, pickDesktopFolder } from "./desktopFolder";

describe("desktopFolder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is unavailable without the Wails bridge", () => {
    expect(canPickDesktopFolder({} as Window)).toBe(false);
  });

  it("resolves the native folder path from the desktop event", async () => {
    const invoke = vi.fn(() => {
      window.dispatchEvent(
        new CustomEvent("freeos-folder-selected", {
          detail: "D:\\Projects\\demo",
        }),
      );
    });
    const win = {
      _wails: { invoke },
      addEventListener: window.addEventListener.bind(window),
      removeEventListener: window.removeEventListener.bind(window),
    } as unknown as Window & { _wails?: { invoke?: (m: string) => void } };
    const path = await pickDesktopFolder(win, 1000);
    expect(invoke).toHaveBeenCalledWith("wails:event:emit:desktop:select-folder");
    expect(path).toBe("D:\\Projects\\demo");
  });

  it("returns null when the user cancels", async () => {
    const invoke = vi.fn(() => {
      window.dispatchEvent(new CustomEvent("freeos-folder-selected", { detail: "" }));
    });
    const win = {
      _wails: { invoke },
      addEventListener: window.addEventListener.bind(window),
      removeEventListener: window.removeEventListener.bind(window),
    } as unknown as Window & { _wails?: { invoke?: (m: string) => void } };
    await expect(pickDesktopFolder(win, 1000)).resolves.toBeNull();
  });
});

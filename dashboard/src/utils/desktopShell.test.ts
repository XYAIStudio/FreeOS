import { afterEach, describe, expect, it } from "vitest";
import { isDesktopShell } from "./desktopShell";

describe("isDesktopShell", () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("detects the desktop query and remembers it after the query is dropped", () => {
    expect(isDesktopShell("?desktop=1")).toBe(true);
    expect(isDesktopShell("")).toBe(true);
  });

  it("survives a dropped query after React Router replaces /", () => {
    expect(isDesktopShell("?desktop=1")).toBe(true);
    sessionStorage.clear();
    expect(isDesktopShell("")).toBe(true);
  });

  it("is false without the query or a remembered flag", () => {
    expect(isDesktopShell("")).toBe(false);
    expect(isDesktopShell("?foo=1")).toBe(false);
  });
});

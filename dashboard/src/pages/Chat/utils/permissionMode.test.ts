import { afterEach, describe, expect, it } from "vitest";
import {
  isChatPermissionMode,
  loadPermissionMode,
  savePermissionMode,
} from "./permissionMode";

describe("permissionMode", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("accepts only the three composer modes", () => {
    expect(isChatPermissionMode("default")).toBe(true);
    expect(isChatPermissionMode("auto")).toBe(true);
    expect(isChatPermissionMode("full")).toBe(true);
    expect(isChatPermissionMode("yolo")).toBe(false);
    expect(isChatPermissionMode("")).toBe(false);
  });

  it("defaults to default when nothing is stored", () => {
    expect(loadPermissionMode()).toBe("default");
    expect(loadPermissionMode("thr_1")).toBe("default");
  });

  it("uses the workspace default when the thread has no override", () => {
    savePermissionMode("auto");
    expect(loadPermissionMode("thr_1")).toBe("auto");
    expect(loadPermissionMode()).toBe("auto");
  });

  it("persists a per-conversation override", () => {
    savePermissionMode("auto");
    savePermissionMode("full", "thr_1");
    expect(loadPermissionMode("thr_1")).toBe("full");
    expect(loadPermissionMode("thr_2")).toBe("auto");
  });
});

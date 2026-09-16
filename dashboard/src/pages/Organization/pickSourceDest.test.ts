import { describe, expect, it, vi } from "vitest";
import { resolveOpenxyosSourceDest } from "./pickSourceDest";

describe("resolveOpenxyosSourceDest", () => {
  it("uses the native folder picker on desktop and ignores the typed path", async () => {
    const pickNative = vi.fn().mockResolvedValue("D:\\src\\openxyos");
    const dest = await resolveOpenxyosSourceDest({
      canPickNative: true,
      pickNative,
      typedDest: "C:\\typed-only",
    });
    expect(pickNative).toHaveBeenCalled();
    expect(dest).toBe("D:\\src\\openxyos");
  });

  it("returns null when the native picker is cancelled", async () => {
    const dest = await resolveOpenxyosSourceDest({
      canPickNative: true,
      pickNative: async () => null,
      typedDest: "C:\\typed-only",
    });
    expect(dest).toBeNull();
  });

  it("falls back to a typed path only outside the desktop shell", async () => {
    const pickNative = vi.fn();
    const dest = await resolveOpenxyosSourceDest({
      canPickNative: false,
      pickNative,
      typedDest: "  /home/me/src  ",
    });
    expect(pickNative).not.toHaveBeenCalled();
    expect(dest).toBe("/home/me/src");
  });
});

import { describe, expect, it } from "vitest";
import {
  shouldEmbedOpenXYOS,
  shouldFallbackToHostWorkspace,
} from "./orgLanding";

describe("shouldEmbedOpenXYOS", () => {
  it("embeds on FreeOS desktop even when identity has not claimed integrated", () => {
    expect(shouldEmbedOpenXYOS({ desktop: true, integrated: false })).toBe(
      true,
    );
    expect(shouldEmbedOpenXYOS({ desktop: true, integrated: null })).toBe(true);
  });

  it("embeds a non-desktop studio only when the host reports integrated", () => {
    expect(shouldEmbedOpenXYOS({ desktop: false, integrated: true })).toBe(
      true,
    );
    expect(shouldEmbedOpenXYOS({ desktop: false, integrated: false })).toBe(
      false,
    );
    expect(shouldEmbedOpenXYOS({ desktop: false, integrated: null })).toBe(
      false,
    );
  });
});

describe("shouldFallbackToHostWorkspace", () => {
  it("never uses the host org-ui as the desktop Org happy path", () => {
    expect(
      shouldFallbackToHostWorkspace({ desktop: true, integrated: false }),
    ).toBe(false);
    expect(
      shouldFallbackToHostWorkspace({ desktop: true, integrated: null }),
    ).toBe(false);
  });

  it("falls back to org-ui only for non-desktop non-integrated studio", () => {
    expect(
      shouldFallbackToHostWorkspace({ desktop: false, integrated: false }),
    ).toBe(true);
    expect(
      shouldFallbackToHostWorkspace({ desktop: false, integrated: true }),
    ).toBe(false);
  });
});

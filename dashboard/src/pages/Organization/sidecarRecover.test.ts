import { describe, expect, it } from "vitest";
import { shouldShowPreviewBlank, sidecarRecoverPhase } from "./sidecarRecover";

describe("sidecarRecoverPhase", () => {
  it("hides overlay when the local console is already up", () => {
    expect(
      sidecarRecoverPhase({
        sidecarUp: true,
        installReady: true,
        startAvailable: true,
        autoStarting: false,
        autoStartFailed: false,
      }),
    ).toBe("hidden");
  });

  it("never returns a recover/start-CTA phase", () => {
    expect(
      sidecarRecoverPhase({
        sidecarUp: false,
        installReady: true,
        startAvailable: true,
        autoStarting: false,
        autoStartFailed: false,
      }),
    ).toBe("opening");
    expect(
      sidecarRecoverPhase({
        sidecarUp: false,
        installReady: true,
        startAvailable: true,
        autoStarting: false,
        autoStartFailed: true,
      }),
    ).toBe("opening");
    expect(
      sidecarRecoverPhase({
        sidecarUp: false,
        installReady: false,
        startAvailable: false,
        autoStarting: false,
        autoStartFailed: false,
      }),
    ).toBe("opening");
  });
});

describe("shouldShowPreviewBlank", () => {
  it("stays quiet when livez is down or embed origin is allowed", () => {
    expect(shouldShowPreviewBlank({ sidecarUp: false, embedOk: false })).toBe(
      false,
    );
    expect(shouldShowPreviewBlank({ sidecarUp: true, embedOk: true })).toBe(
      false,
    );
    expect(shouldShowPreviewBlank({ sidecarUp: true, embedOk: null })).toBe(
      false,
    );
  });

  it("surfaces a blank-preview error when livez is up but self-origin fails", () => {
    expect(shouldShowPreviewBlank({ sidecarUp: true, embedOk: false })).toBe(
      true,
    );
  });
});

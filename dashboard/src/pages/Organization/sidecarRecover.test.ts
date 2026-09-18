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

  it("prompts restart when livez is down and auto-start is not in flight", () => {
    expect(
      sidecarRecoverPhase({
        sidecarUp: false,
        installReady: true,
        startAvailable: true,
        autoStarting: false,
        autoStartFailed: false,
      }),
    ).toBe("needsRestart");
    expect(
      sidecarRecoverPhase({
        sidecarUp: false,
        installReady: true,
        startAvailable: true,
        autoStarting: false,
        autoStartFailed: true,
      }),
    ).toBe("needsRestart");
    expect(
      sidecarRecoverPhase({
        sidecarUp: false,
        installReady: false,
        startAvailable: false,
        autoStarting: false,
        autoStartFailed: false,
      }),
    ).toBe("needsRestart");
  });

  it("keeps the opening phase while a silent auto-start is running", () => {
    expect(
      sidecarRecoverPhase({
        sidecarUp: false,
        installReady: true,
        startAvailable: true,
        autoStarting: true,
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

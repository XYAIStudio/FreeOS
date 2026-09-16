import { describe, expect, it } from "vitest";
import { sidecarRecoverPhase } from "./sidecarRecover";

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

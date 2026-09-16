import { describe, expect, it } from "vitest";
import { sidecarRecoverPhase } from "./sidecarRecover";

describe("sidecarRecoverPhase", () => {
  it("hides recover when the sidecar is already up", () => {
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

  it("auto-starts silently after a healthy install instead of showing 启动边车", () => {
    expect(
      sidecarRecoverPhase({
        sidecarUp: false,
        installReady: true,
        startAvailable: true,
        autoStarting: false,
        autoStartFailed: false,
      }),
    ).toBe("starting");
  });

  it("shows recover only after auto-start fails", () => {
    expect(
      sidecarRecoverPhase({
        sidecarUp: false,
        installReady: true,
        startAvailable: true,
        autoStarting: false,
        autoStartFailed: true,
      }),
    ).toBe("recover");
  });

  it("shows recover when there is no install-time runtime to start", () => {
    expect(
      sidecarRecoverPhase({
        sidecarUp: false,
        installReady: false,
        startAvailable: false,
        autoStarting: false,
        autoStartFailed: false,
      }),
    ).toBe("recover");
  });
});

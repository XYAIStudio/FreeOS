import { describe, expect, it, vi } from "vitest";
import {
  confirmSidecarLivez,
  isLivezHttpOk,
  probeSidecarLivez,
  shouldLoadSidecarFrame,
  sidecarLivezUrl,
  sidecarPreviewGate,
} from "./sidecarLivez";

describe("sidecarLivez", () => {
  it("builds the sidecar livez URL", () => {
    expect(sidecarLivezUrl("http://127.0.0.1:3780/")).toBe(
      "http://127.0.0.1:3780/api/health/livez",
    );
    expect(isLivezHttpOk(200)).toBe(true);
    expect(isLivezHttpOk(204)).toBe(true);
    expect(isLivezHttpOk(500)).toBe(false);
    expect(isLivezHttpOk(0)).toBe(false);
  });

  it("treats a live livez response as up", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await expect(
      probeSidecarLivez("http://127.0.0.1:3780", fetchImpl),
    ).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3780/api/health/livez",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("treats Failed to fetch / abort as down", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      probeSidecarLivez("http://127.0.0.1:3780", fetchImpl),
    ).resolves.toBe(false);
  });

  it("falls back to the FreeOS livez probe when the browser cannot reach the sidecar", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const apiProbe = vi.fn(async () => ({ reachable: true }));
    await expect(
      confirmSidecarLivez({
        origin: "http://127.0.0.1:3780",
        fetchImpl,
        apiProbe,
      }),
    ).resolves.toBe(true);
    expect(apiProbe).toHaveBeenCalled();
  });

  it("gates sidecar preview frames until livez is ok", () => {
    expect(
      shouldLoadSidecarFrame({
        url: "http://127.0.0.1:3780/",
        sidecarOrigin: "http://127.0.0.1:3780",
        livezOk: false,
      }),
    ).toBe(false);
    expect(
      shouldLoadSidecarFrame({
        url: "http://127.0.0.1:3780/login",
        sidecarOrigin: "http://127.0.0.1:3780",
        livezOk: true,
      }),
    ).toBe(true);
    expect(
      shouldLoadSidecarFrame({
        url: "https://github.com/XYAIStudio/openXYOS",
        sidecarOrigin: "http://127.0.0.1:3780",
        livezOk: false,
      }),
    ).toBe(true);
  });

  it("surfaces a restart gate instead of opening a dead login iframe", () => {
    expect(sidecarPreviewGate({ livezOk: false, restarting: false })).toBe(
      "needsRestart",
    );
    expect(sidecarPreviewGate({ livezOk: false, restarting: true })).toBe(
      "restarting",
    );
    expect(sidecarPreviewGate({ livezOk: true, restarting: false })).toBe(
      "open",
    );
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  loadSpeedResults,
  saveSpeedResult,
  speedResultKey,
} from "./localSpeedResults";

afterEach(() => {
  sessionStorage.clear();
});

describe("localSpeedResults", () => {
  it("round-trips the last speed result in sessionStorage", () => {
    const stored = saveSpeedResult("ollama", "tiny", {
      ok: true,
      latency_ms: 120,
      ttft_ms: 40,
      tokens_per_sec: 18.5,
    });
    expect(stored.name).toBe("tiny");
    const all = loadSpeedResults();
    expect(all[speedResultKey("ollama", "tiny")]).toMatchObject({
      ok: true,
      latency_ms: 120,
      ttft_ms: 40,
      tokens_per_sec: 18.5,
    });
  });
});

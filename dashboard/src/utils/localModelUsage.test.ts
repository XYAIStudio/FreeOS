import { describe, expect, it } from "vitest";
import { isLocalModelKey, splitLocalCloudTokens } from "./localModelUsage";

describe("localModelUsage", () => {
  it("treats ollama and gguf labels as local", () => {
    expect(isLocalModelKey("ollama/qwen2.5")).toBe(true);
    expect(isLocalModelKey("llama-3.gguf")).toBe(true);
    expect(isLocalModelKey("gpt-4o")).toBe(false);
  });

  it("splits bucket totals", () => {
    expect(
      splitLocalCloudTokens([
        { key: "ollama/qwen", total_tokens: 10 },
        { key: "gpt-4o", label: "GPT-4o", total_tokens: 30 },
      ]),
    ).toEqual({ local: 10, cloud: 30 });
  });
});

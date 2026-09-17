import { describe, expect, it } from "vitest";
import { findConfiguredProvider } from "./presetUtils";
import type { ProviderPreset, ProviderRow } from "./useProviders";

const ollamaPreset = {
  id: "ollama",
  name: "Ollama (Local)",
} as ProviderPreset;

function row(
  partial: Partial<ProviderRow> & Pick<ProviderRow, "name">,
): ProviderRow {
  return {
    id: 1,
    kind: "openai",
    base_url: null,
    api_key: null,
    models: [],
    note: null,
    enabled: true,
    ...partial,
  };
}

describe("findConfiguredProvider", () => {
  it("matches the Ollama preset by display name or id", () => {
    const named = row({ name: "Ollama (Local)" });
    expect(findConfiguredProvider(ollamaPreset, [named])).toEqual(named);
    const short = row({ name: "ollama" });
    expect(findConfiguredProvider(ollamaPreset, [short])).toEqual(short);
  });

  it("matches a local Ollama row that only shares the 11434 endpoint", () => {
    const local = row({
      name: "Desktop Llama",
      base_url: "http://127.0.0.1:11434/v1",
      api_key: "ollama",
    });
    expect(findConfiguredProvider(ollamaPreset, [local])).toEqual(local);
  });
});

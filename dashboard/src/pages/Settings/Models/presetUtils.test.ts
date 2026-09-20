import { describe, expect, it } from "vitest";
import {
  buildWizardPresetDisplay,
  defaultModelsPresetTab,
  defaultWizardPreset,
  findConfiguredProvider,
  isLocalBaseUrl,
  localPlaceholderApiKey,
} from "./presetUtils";
import type { ProviderPreset, ProviderRow } from "./useProviders";

const ollamaPreset = {
  id: "ollama",
  name: "Ollama (Local)",
} as ProviderPreset;

function preset(
  partial: Partial<ProviderPreset> & Pick<ProviderPreset, "id" | "name">,
): ProviderPreset {
  return {
    base_url: "",
    protocol: "openai",
    api_key_prefix: "",
    models: [],
    ...partial,
  };
}

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

describe("local-first wizard and settings helpers", () => {
  const ollama = preset({ id: "ollama", name: "Ollama (Local)" });
  const onnx = preset({ id: "onnx", name: "ONNX (Local)" });
  const openai = preset({ id: "openai", name: "OpenAI" });
  const deepseek = preset({ id: "deepseek", name: "DeepSeek" });

  it("defaults the wizard to Ollama when present", () => {
    expect(defaultWizardPreset([openai, ollama, onnx])).toEqual(ollama);
  });

  it("features Ollama before cloud brands and keeps ONNX in more", () => {
    const { featured, more } = buildWizardPresetDisplay([
      openai,
      deepseek,
      ollama,
      onnx,
    ]);
    expect(featured[0]).toEqual({ kind: "single", preset: ollama });
    expect(
      more.some((item) => item.kind === "single" && item.preset.id === "onnx"),
    ).toBe(true);
  });

  it("defaults the models preset tab to local when that tab exists", () => {
    expect(defaultModelsPresetTab({ showLocal: true, showCloud: true })).toBe(
      "local",
    );
    expect(defaultModelsPresetTab({ showLocal: false, showCloud: true })).toBe(
      "cloud",
    );
  });

  it("treats loopback OpenAI-compatible URLs as local and fills a placeholder key", () => {
    expect(isLocalBaseUrl("http://127.0.0.1:1234/v1")).toBe(true);
    expect(isLocalBaseUrl("http://localhost:8080/v1")).toBe(true);
    expect(isLocalBaseUrl("https://api.openai.com/v1")).toBe(false);
    expect(localPlaceholderApiKey("http://127.0.0.1:11434/v1", "")).toBe(
      "local",
    );
    expect(localPlaceholderApiKey("https://api.openai.com/v1", "")).toBe("");
  });
});

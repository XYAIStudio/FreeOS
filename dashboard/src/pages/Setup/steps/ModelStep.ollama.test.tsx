import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const probe = vi.fn();
const startOllama = vi.fn();

vi.mock("../../../api/request", () => ({
  request: vi.fn().mockResolvedValue([
    {
      id: "ollama",
      name: "Ollama (Local)",
      base_url: "http://localhost:11434/v1",
      protocol: "openai",
      api_key_prefix: "",
      models: [{ id: "qwen3:8b", name: "qwen3:8b" }],
    },
  ]),
}));

vi.mock("../../../api/modules/localModels", () => ({
  localModelsApi: {
    probe: (...args: unknown[]) => probe(...args),
    startOllama: (...args: unknown[]) => startOllama(...args),
  },
}));

vi.mock("../wizardClient", () => ({
  wizardApi: { testProvider: vi.fn() },
  wizardSession: { saveDraft: vi.fn() },
  resolveSetupProbeToken: vi.fn(),
}));

import ModelStep from "./ModelStep";

describe("ModelStep Ollama startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    probe
      .mockResolvedValueOnce({
        hardware: {
          ollama_installed: true,
          ollama_binary: true,
          ollama_reachable: false,
        },
        installed: [],
        recommended: [],
      })
      .mockResolvedValue({
        hardware: {
          ollama_installed: true,
          ollama_binary: true,
          ollama_reachable: true,
        },
        installed: [],
        recommended: [],
      });
    startOllama.mockResolvedValue({ ok: true, installed: true, running: true });
  });

  it("offers to start an installed Ollama and refreshes its status", async () => {
    render(
      <ModelStep
        detectLocal
        onBack={vi.fn()}
        onSkip={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    const button = await screen.findByText("models.localStartOllama");
    await userEvent.click(button);

    await waitFor(() => expect(startOllama).toHaveBeenCalledOnce());
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("models.localStartOllama")).toBeNull();
  });
});

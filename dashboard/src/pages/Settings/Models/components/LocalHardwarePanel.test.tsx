import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const probe = vi.fn();
const startOllama = vi.fn();
const ensureDeps = vi.fn();
const startScan = vi.fn();
const register = vi.fn();

vi.mock("../../../../api/modules/localModels", () => ({
  localModelsApi: {
    probe: (...args: unknown[]) => probe(...args),
    startOllama: (...args: unknown[]) => startOllama(...args),
    ensureDeps: (...args: unknown[]) => ensureDeps(...args),
    install: vi.fn(),
    startScan: (...args: unknown[]) => startScan(...args),
    getScan: vi.fn(),
    getLatestScan: vi.fn(),
    cancelScan: vi.fn(),
    register: (...args: unknown[]) => register(...args),
  },
}));

vi.mock("../../../../utils/desktopFolder", () => ({
  canPickDesktopFolder: () => false,
  pickDesktopFolder: async () => null,
}));

vi.mock("../../../../utils/antdMessage", () => ({
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { LocalHardwarePanel } from "./LocalHardwarePanel";

const installedStopped = {
  hardware: {
    os: "Windows",
    arch: "AMD64",
    cpu_count: 8,
    ram_gb: 16,
    gpu: "",
    ollama_binary: true,
    ollama_installed: true,
    ollama_reachable: false,
    ollama_path: "C:\\\\Ollama\\\\ollama.exe",
  },
  deps: [
    {
      id: "ollama_daemon",
      kind: "runtime",
      automatable: true,
      method: "start",
    },
  ],
  installed: [
    {
      name: "tiny",
      path: "D:\\\\models\\\\tiny.gguf",
      size: 2048,
      source: "gguf",
      registerable: true,
    },
  ],
  recommended: [{ id: "llama3.2:3b", reason: "3B", install: "ollama" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  probe.mockResolvedValue(installedStopped);
  startOllama.mockResolvedValue({ ok: true, installed: true, running: true });
  startScan.mockResolvedValue({
    job_id: "job-1",
    status: "completed",
    found: installedStopped.installed,
  });
});

describe("<LocalHardwarePanel />", () => {
  it("shows Start Ollama when the binary exists but the API is down", async () => {
    render(<LocalHardwarePanel />);
    await waitFor(() => expect(probe).toHaveBeenCalled());
    expect(screen.getByText("models.localStartOllama")).toBeInTheDocument();
    await userEvent.click(screen.getByText("models.localStartOllama"));
    await waitFor(() => expect(startOllama).toHaveBeenCalled());
  });

  it("lists discovered GGUF files with a register action", async () => {
    render(<LocalHardwarePanel />);
    await waitFor(() => expect(screen.getByText("tiny")).toBeInTheDocument());
    expect(screen.getByText("D:\\\\models\\\\tiny.gguf")).toBeInTheDocument();
    expect(screen.getByText("models.localRegister")).toBeInTheDocument();
  });

  it("starts a local weight search", async () => {
    render(<LocalHardwarePanel />);
    await waitFor(() => expect(probe).toHaveBeenCalled());
    await userEvent.click(screen.getByText("models.localSearchModels"));
    await waitFor(() => expect(startScan).toHaveBeenCalled());
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const probe = vi.fn();
const startOllama = vi.fn();
const ensureDeps = vi.fn();
const startScan = vi.fn();
const register = vi.fn();
const speedTest = vi.fn();
const setDefault = vi.fn();
const clearDefault = vi.fn();

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
    speedTest: (...args: unknown[]) => speedTest(...args),
    setDefault: (...args: unknown[]) => setDefault(...args),
    clearDefault: (...args: unknown[]) => clearDefault(...args),
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

function renderPanel(props: { onSaved?: () => void | Promise<void> } = {}) {
  return render(
    <MemoryRouter>
      <LocalHardwarePanel {...props} />
    </MemoryRouter>,
  );
}

describe("<LocalHardwarePanel />", () => {
  it("shows Start Ollama when the binary exists but the API is down", async () => {
    renderPanel();
    await waitFor(() => expect(probe).toHaveBeenCalled());
    expect(screen.getByText("models.localStartOllama")).toBeInTheDocument();
    await userEvent.click(screen.getByText("models.localStartOllama"));
    await waitFor(() => expect(startOllama).toHaveBeenCalled());
  });

  it("lists discovered GGUF files with a register action", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("tiny")).toBeInTheDocument());
    expect(screen.getByText("D:\\\\models\\\\tiny.gguf")).toBeInTheDocument();
    expect(screen.getByText("models.localRegister")).toBeInTheDocument();
  });

  it("starts a local weight search", async () => {
    renderPanel();
    await waitFor(() => expect(probe).toHaveBeenCalled());
    await userEvent.click(screen.getByText("models.localSearchModels"));
    await waitFor(() => expect(startScan).toHaveBeenCalled());
  });

  it("offers speed test and set-default on a registered model", async () => {
    probe.mockResolvedValue({
      ...installedStopped,
      hardware: { ...installedStopped.hardware, ollama_reachable: true },
      installed: [
        {
          name: "tiny",
          path: "",
          size: 2048,
          source: "ollama",
          registered: true,
          is_default: false,
        },
      ],
    });
    speedTest.mockResolvedValue({
      ok: true,
      latency_ms: 90,
      ttft_ms: 30,
      tokens_per_sec: 12,
    });
    setDefault.mockResolvedValue({ ok: true, name: "tiny" });
    renderPanel();
    await waitFor(() => expect(screen.getByText("tiny")).toBeInTheDocument());
    expect(screen.getByText("models.localSpeedTest")).toBeInTheDocument();
    expect(screen.getByText("models.localSetDefault")).toBeInTheDocument();
    await userEvent.click(screen.getByText("models.localSpeedTest"));
    await waitFor(() =>
      expect(speedTest).toHaveBeenCalledWith("tiny", expect.anything()),
    );
    await userEvent.click(screen.getByText("models.localSetDefault"));
    await waitFor(() => expect(setDefault).toHaveBeenCalledWith("tiny"));
  });

  it("shows a default badge and can clear it", async () => {
    probe.mockResolvedValue({
      ...installedStopped,
      installed: [
        {
          name: "tiny",
          path: "",
          size: 2048,
          source: "ollama",
          registered: true,
          is_default: true,
        },
      ],
    });
    clearDefault.mockResolvedValue({ ok: true });
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("models.localDefaultBadge")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByText("models.localClearDefault"));
    await waitFor(() => expect(clearDefault).toHaveBeenCalledWith("tiny"));
  });

  it("notifies the chat picker after a successful register", async () => {
    const onSaved = vi.fn();
    const heard = vi.fn();
    register.mockResolvedValue({ ok: true, name: "tiny" });
    window.addEventListener("octop:models-changed", heard);
    renderPanel({ onSaved });
    await waitFor(() => expect(screen.getByText("tiny")).toBeInTheDocument());
    await userEvent.click(screen.getByText("models.localRegister"));
    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(heard).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    window.removeEventListener("octop:models-changed", heard);
  });
});

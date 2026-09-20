import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const getAuthStatus = vi.fn();
const localSession = vi.fn();
const isDesktopShell = vi.fn();

vi.mock("../../api/modules/auth", () => ({
  authApi: {
    getAuthStatus: (...args: unknown[]) => getAuthStatus(...args),
    localSession: (...args: unknown[]) => localSession(...args),
  },
}));

vi.mock("../../utils/desktopShell", () => ({
  isDesktopShell: (...args: unknown[]) => isDesktopShell(...args),
}));

vi.mock("../../utils/locale", () => ({
  storeUiLocale: vi.fn(),
}));

vi.mock("../../i18n", () => ({
  ensureLocaleBundle: vi.fn(async () => undefined),
}));

vi.mock("../../api/modules/preferences", () => ({
  preferencesApi: { setLocale: vi.fn(async () => undefined) },
}));

vi.mock("../../components/BrandMark", () => ({
  default: () => <div>FreeOS</div>,
}));

vi.mock("./steps/ModelStep", () => ({
  default: ({
    onSkip,
    skipLabel,
    hideBack,
  }: {
    onSkip: () => void;
    skipLabel?: string;
    hideBack?: boolean;
  }) => (
    <div>
      <div>model step</div>
      {hideBack ? <div>no back</div> : <div>has back</div>}
      <button type="button" onClick={onSkip}>
        {skipLabel ?? "skip"}
      </button>
    </div>
  ),
}));

vi.mock("./steps/PasswordStep", () => ({
  default: () => <div>password step</div>,
}));

vi.mock("./steps/DatabaseStep", () => ({
  default: () => <div>database step</div>,
}));

vi.mock("./steps/AdminStep", () => ({
  default: () => <div>admin step</div>,
}));

vi.mock("./steps/FinishStep", () => ({
  default: () => <div>finish step</div>,
}));

import SetupPage from "./index";
import { isDesktopModelOnboardingDone } from "../../utils/desktopOnboarding";

function renderSetup() {
  return render(
    <MemoryRouter initialEntries={["/setup"]}>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/chat/:agentId" element={<div>first chat</div>} />
        <Route path="/chat" element={<div>workspace</div>} />
        <Route path="/projects" element={<div>conversation list</div>} />
        <Route path="/login" element={<div>login wall</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SetupPage desktop first-run", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    getAuthStatus.mockReset();
    localSession.mockReset();
    isDesktopShell.mockReset();
  });

  it("shows only the model step and can skip into the first chat", async () => {
    isDesktopShell.mockReturnValue(true);
    getAuthStatus.mockResolvedValue({
      setup_required: true,
      wizard_password_required: true,
      desktop: true,
      has_providers: false,
    });
    localSession.mockResolvedValue({
      access_token: "guest-token",
      user: { id: 1, username: "local", locale: "zh" },
    });

    renderSetup();

    expect(await screen.findByText("model step")).toBeInTheDocument();
    expect(screen.queryByText("password step")).toBeNull();
    expect(screen.queryByText("database step")).toBeNull();
    expect(screen.queryByText("admin step")).toBeNull();
    expect(screen.getByText("no back")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "wizard.model.skipToChat" }),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "wizard.model.skipToChat" }),
    );
    expect(await screen.findByText("first chat")).toBeInTheDocument();
    expect(isDesktopModelOnboardingDone()).toBe(true);
  });

  it("does not loop returning desktop users who already have a provider", async () => {
    isDesktopShell.mockReturnValue(true);
    getAuthStatus.mockResolvedValue({
      setup_required: false,
      wizard_password_required: false,
      desktop: true,
      has_providers: true,
    });

    renderSetup();

    expect(await screen.findByText("first chat")).toBeInTheDocument();
    expect(screen.queryByText("model step")).toBeNull();
    expect(screen.queryByText("conversation list")).toBeNull();
    expect(isDesktopModelOnboardingDone()).toBe(true);
  });

  it("keeps the server password wizard when not on desktop", async () => {
    isDesktopShell.mockReturnValue(false);
    getAuthStatus.mockResolvedValue({
      setup_required: true,
      wizard_password_required: true,
      desktop: false,
      has_providers: false,
    });

    renderSetup();

    expect(await screen.findByText("password step")).toBeInTheDocument();
    expect(screen.queryByText("model step")).toBeNull();
    await waitFor(() => expect(localSession).not.toHaveBeenCalled());
  });

  it("does not bounce a local guest to login after setup_required becomes false", async () => {
    isDesktopShell.mockReturnValue(false);
    getAuthStatus.mockResolvedValue({
      setup_required: false,
      wizard_password_required: false,
      desktop: false,
      has_providers: false,
    });
    localSession.mockResolvedValue({
      access_token: "guest-token",
      user: { id: 1, username: "local", locale: "zh" },
    });

    renderSetup();

    expect(await screen.findByText("model step")).toBeInTheDocument();
    expect(screen.queryByText("login wall")).toBeNull();
    expect(screen.queryByText("password step")).toBeNull();
  });
});

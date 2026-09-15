import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const localSession = vi.fn();
const getAuthStatus = vi.fn();
const getOidcStatus = vi.fn();

vi.mock("../../api/modules/auth", () => ({
  authApi: {
    localSession: (...args: unknown[]) => localSession(...args),
    getAuthStatus: (...args: unknown[]) => getAuthStatus(...args),
    getOidcStatus: (...args: unknown[]) => getOidcStatus(...args),
  },
}));

vi.mock("../../utils/locale", () => ({
  applyGuestLocale: vi.fn(async () => undefined),
  applyUserLocale: vi.fn(async () => undefined),
}));

vi.mock("../../components/AuthForm", () => ({
  default: () => <div>login form</div>,
}));

import LoginPage from "./index";
import { getAuthToken } from "../../api/request";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/chat" element={<div>usable app</div>} />
        <Route path="/setup" element={<div>setup wizard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage local session", () => {
  beforeEach(() => {
    localStorage.clear();
    localSession.mockReset();
    getAuthStatus.mockReset();
    getOidcStatus.mockReset();
  });

  it("skips the login wall when a local session is available", async () => {
    localSession.mockResolvedValue({
      access_token: "guest-token",
      token_type: "Bearer",
      expires_in: 3600,
      user: {
        id: 1,
        username: "local",
        role: "admin",
        display_name: "FreeOS",
        locale: "zh",
        is_local: true,
      },
      token: "guest-token",
    });

    renderLogin();

    expect(await screen.findByText("usable app")).toBeInTheDocument();
    expect(screen.queryByText("login form")).toBeNull();
    expect(getAuthToken()).toBe("guest-token");
    await waitFor(() => expect(localSession).toHaveBeenCalledOnce());
    expect(getAuthStatus).not.toHaveBeenCalled();
  });

  it("shows the form when a local session is not available", async () => {
    localSession.mockRejectedValue(new Error("interactive login required"));
    getAuthStatus.mockResolvedValue({ setup_required: false });
    getOidcStatus.mockResolvedValue({ enabled: false });

    renderLogin();

    expect(await screen.findByText("login form")).toBeInTheDocument();
    expect(screen.queryByText("usable app")).toBeNull();
  });
});

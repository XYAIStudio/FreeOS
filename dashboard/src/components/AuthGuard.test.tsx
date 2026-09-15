import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const localSession = vi.fn();
const getAuthStatus = vi.fn();
const me = vi.fn();

vi.mock("../api/modules/auth", () => ({
  authApi: {
    localSession: (...args: unknown[]) => localSession(...args),
    getAuthStatus: (...args: unknown[]) => getAuthStatus(...args),
    me: (...args: unknown[]) => me(...args),
  },
}));

vi.mock("../utils/locale", () => ({
  applyUserLocale: vi.fn(async () => undefined),
}));

vi.mock("../context/AuthPromptContext", () => ({
  AuthPromptProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import AuthGuard from "./AuthGuard";
import { getAuthToken } from "../api/request";

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/chat"]}>
      <Routes>
        <Route
          path="/chat"
          element={
            <AuthGuard>
              <div>usable app</div>
            </AuthGuard>
          }
        />
        <Route path="/login" element={<div>login wall</div>} />
        <Route path="/setup" element={<div>setup wizard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthGuard local session", () => {
  beforeEach(() => {
    localStorage.clear();
    localSession.mockReset();
    getAuthStatus.mockReset();
    me.mockReset();
  });

  it("opens the app without the login wall on first launch", async () => {
    getAuthStatus.mockResolvedValue({ setup_required: true });
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

    renderGuard();

    expect(await screen.findByText("usable app")).toBeInTheDocument();
    expect(screen.queryByText("login wall")).toBeNull();
    expect(getAuthToken()).toBe("guest-token");
    await waitFor(() => expect(localSession).toHaveBeenCalledOnce());
  });

  it("falls back to login when local session is unavailable", async () => {
    getAuthStatus.mockResolvedValue({ setup_required: false });
    localSession.mockRejectedValue(new Error("interactive login required"));

    renderGuard();

    expect(await screen.findByText("login wall")).toBeInTheDocument();
    expect(screen.queryByText("usable app")).toBeNull();
  });
});

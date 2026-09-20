import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const localSession = vi.fn();
const getAuthStatus = vi.fn();
const me = vi.fn();
const organizationIdentityStatus = vi.fn();

vi.mock("../api/modules/auth", () => ({
  authApi: {
    localSession: (...args: unknown[]) => localSession(...args),
    getAuthStatus: (...args: unknown[]) => getAuthStatus(...args),
    me: (...args: unknown[]) => me(...args),
    organizationIdentityStatus: (...args: unknown[]) =>
      organizationIdentityStatus(...args),
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
    sessionStorage.clear();
    localSession.mockReset();
    getAuthStatus.mockReset();
    me.mockReset();
    organizationIdentityStatus.mockReset();
    organizationIdentityStatus.mockResolvedValue({
      integrated: false,
      authority: "freeos",
    });
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

  it("sends the desktop first launch to model setup, not the login wall", async () => {
    getAuthStatus.mockResolvedValue({
      setup_required: true,
      has_providers: false,
      desktop: true,
    });
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

    render(
      <MemoryRouter initialEntries={["/chat?desktop=1"]}>
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
          <Route path="/setup" element={<div>model setup</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("model setup")).toBeInTheDocument();
    expect(screen.queryByText("login wall")).toBeNull();
    expect(screen.queryByText("usable app")).toBeNull();
    expect(getAuthToken()).toBe("guest-token");
  });

  it("sends a provisioned desktop guest to model setup", async () => {
    getAuthStatus.mockResolvedValue({
      setup_required: false,
      has_providers: false,
      desktop: true,
    });
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

    render(
      <MemoryRouter initialEntries={["/chat?desktop=1"]}>
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
          <Route path="/setup" element={<div>model setup</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("model setup")).toBeInTheDocument();
    expect(screen.queryByText("login wall")).toBeNull();
    expect(screen.queryByText("usable app")).toBeNull();
  });

  it("does not loop returning desktop users who already have a provider", async () => {
    getAuthStatus.mockResolvedValue({
      setup_required: false,
      has_providers: true,
      desktop: true,
    });
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

    render(
      <MemoryRouter initialEntries={["/chat?desktop=1"]}>
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
          <Route path="/setup" element={<div>model setup</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("usable app")).toBeInTheDocument();
    expect(screen.queryByText("model setup")).toBeNull();
    expect(screen.queryByText("login wall")).toBeNull();
  });

  it("opens the studio door even when the organization room is available", async () => {
    organizationIdentityStatus.mockResolvedValue({
      integrated: true,
      authority: "dual",
      studio: "freeos",
      room: "organization",
    });
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
  });

  it("never opens the login wall inside the desktop shell", async () => {
    getAuthStatus.mockResolvedValue({ setup_required: false });
    localSession.mockRejectedValue(new Error("interactive login required"));

    const view = render(
      <MemoryRouter initialEntries={["/chat?desktop=1"]}>
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

    await waitFor(() => expect(localSession).toHaveBeenCalled());
    expect(screen.queryByText("login wall")).toBeNull();
    expect(screen.queryByText("usable app")).toBeNull();
    view.unmount();
  });

  it("keeps retrying after the router drops ?desktop=1", async () => {
    sessionStorage.setItem("freeos:desktop-shell", "1");
    getAuthStatus.mockResolvedValue({ setup_required: false, desktop: false });
    localSession.mockRejectedValue(new Error("interactive login required"));

    const view = render(
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

    await waitFor(() => expect(localSession).toHaveBeenCalled());
    expect(screen.queryByText("login wall")).toBeNull();
    view.unmount();
  });
});

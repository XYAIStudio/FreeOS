import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationEntry from "./OrganizationEntry";
import { orgModuleApi } from "../../api/modules/orgModule";
import { isDesktopShell } from "../../utils/desktopShell";

vi.mock("../../api/modules/orgModule", () => ({
  orgModuleApi: {
    identityStatus: vi.fn(),
    probeLivez: vi.fn(),
    startSidecar: vi.fn(),
    restartSidecar: vi.fn(),
  },
}));

vi.mock("../../utils/desktopShell", () => ({
  isDesktopShell: vi.fn(),
}));

function renderEntry() {
  return render(
    <MemoryRouter initialEntries={["/organization"]}>
      <Routes>
        <Route path="/organization" element={<OrganizationEntry />} />
        <Route
          path="/organization/workspace"
          element={<div data-testid="org-ui-workspace">workspace</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OrganizationEntry", () => {
  beforeEach(() => {
    vi.mocked(isDesktopShell).mockReturnValue(false);
    vi.mocked(orgModuleApi.identityStatus).mockReset();
    vi.mocked(orgModuleApi.probeLivez).mockReset();
    vi.mocked(orgModuleApi.startSidecar).mockReset();
    vi.mocked(orgModuleApi.restartSidecar).mockReset();
    vi.mocked(orgModuleApi.probeLivez).mockResolvedValue({
      reachable: true,
      url: "http://127.0.0.1:3780",
      detail: "ok",
    });
    vi.mocked(orgModuleApi.startSidecar).mockResolvedValue({
      started: false,
      already: true,
      reachable: true,
    });
  });

  it("embeds openXYOS when desktop organization is integrated", async () => {
    vi.mocked(orgModuleApi.identityStatus).mockResolvedValue({
      integrated: true,
      authority: "organization",
    });
    renderEntry();
    expect(await screen.findByTestId("org-openxyos-frame")).toBeInTheDocument();
    expect(screen.getByTestId("org-openxyos-frame")).toHaveAttribute(
      "src",
      "/organization-app/dashboard?freeos_embed=1",
    );
    expect(screen.queryByTestId("org-native-workbench")).toBeNull();
    expect(screen.queryByTestId("org-ui-workspace")).toBeNull();
  });

  it("falls back to the host org-ui workspace only when not desktop and not integrated", async () => {
    vi.mocked(orgModuleApi.identityStatus).mockResolvedValue({
      integrated: false,
      authority: "studio",
    });
    renderEntry();
    expect(await screen.findByTestId("org-ui-workspace")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("keeps the openXYOS landing on FreeOS desktop even if identity is not integrated", async () => {
    vi.mocked(isDesktopShell).mockReturnValue(true);
    vi.mocked(orgModuleApi.identityStatus).mockResolvedValue({
      integrated: false,
      authority: "studio",
    });
    renderEntry();
    expect(await screen.findByTestId("org-openxyos-frame")).toBeInTheDocument();
    expect(screen.queryByTestId("org-ui-workspace")).toBeNull();
  });

  it("shows a restart overlay on desktop when the module runtime is down", async () => {
    vi.mocked(isDesktopShell).mockReturnValue(true);
    vi.mocked(orgModuleApi.identityStatus).mockResolvedValue({
      integrated: true,
      authority: "dual",
    });
    vi.mocked(orgModuleApi.probeLivez).mockResolvedValue({
      reachable: false,
      url: "http://127.0.0.1:3780",
      detail: "down",
    });
    vi.mocked(orgModuleApi.startSidecar).mockResolvedValue({
      started: false,
      already: false,
      reachable: false,
    });
    renderEntry();
    await waitFor(() => {
      expect(screen.getByTestId("org-sidecar-gate")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("org-ui-workspace")).toBeNull();
    expect(screen.queryByTestId("org-openxyos-frame")).toBeNull();
  });

  it("falls back to the host org-ui workspace when identity status fails", async () => {
    vi.mocked(orgModuleApi.identityStatus).mockRejectedValue(
      new Error("organization identity unavailable"),
    );
    renderEntry();
    expect(await screen.findByTestId("org-ui-workspace")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationEntry from "./OrganizationEntry";
import { orgModuleApi } from "../../api/modules/orgModule";

vi.mock("../../api/modules/orgModule", () => ({
  orgModuleApi: {
    identityStatus: vi.fn(),
  },
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
    vi.mocked(orgModuleApi.identityStatus).mockReset();
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
    expect(screen.queryByTestId("org-original-app-hint")).toBeNull();
  });

  it("falls back to the host org-ui workspace when not integrated", async () => {
    vi.mocked(orgModuleApi.identityStatus).mockResolvedValue({
      integrated: false,
      authority: "studio",
    });
    renderEntry();
    expect(await screen.findByTestId("org-ui-workspace")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.queryByTestId("org-native-workbench")).toBeNull();
  });
});

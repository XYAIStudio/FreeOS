import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationEntry from "./OrganizationEntry";

const identityStatus = vi.fn();

vi.mock("../../api/modules/orgModule", () => ({
  orgModuleApi: {
    identityStatus: (...args: unknown[]) => identityStatus(...args),
  },
}));

vi.mock("./index", () => ({
  default: () => <div data-testid="org-workbench">workbench</div>,
}));

describe("OrganizationEntry dual doors", () => {
  beforeEach(() => {
    identityStatus.mockReset();
  });

  it("keeps the in-host workbench when the room door is closed", async () => {
    identityStatus.mockResolvedValue({
      integrated: false,
      authority: "studio",
      studio: "freeos",
      room: null,
    });
    render(<OrganizationEntry />);
    expect(await screen.findByTestId("org-workbench")).toBeInTheDocument();
  });

  it("opens the organization room behind a soft door hint", async () => {
    identityStatus.mockResolvedValue({
      integrated: true,
      authority: "dual",
      studio: "freeos",
      room: "organization",
    });
    render(<OrganizationEntry />);
    expect(await screen.findByTestId("org-room-door-hint")).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector("iframe")).toHaveAttribute(
        "src",
        "/organization-app/dashboard?freeos_embed=1",
      );
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GovernancePage } from "./GovernancePage";
import type { OrgGovernanceClient } from "../../api/createClient";

function mockClient(): OrgGovernanceClient {
  return {
    pauses: vi.fn(async () => ({
      enabled: true,
      pauses: [
        {
          pause_id: "abc123",
          tool_name: "delete_employee",
          category: "delete",
          action: "delete",
          actor_id: "1",
          tenant_id: "default",
          args_digest: "deadbeef",
          reason: "default deny",
          status: "pending",
          created_at: 1_700_000_000,
          resolved_at: null,
          ttl_seconds: 1800,
        },
      ],
    })),
    audit: vi.fn(async () => ({
      events: [
        {
          audit_id: "a1",
          event: "check",
          tool_name: "delete_employee",
          result: "pending",
          reason: "default deny",
          pause_id: "abc123",
          ts: 1_700_000_000,
        },
      ],
    })),
    resolve: vi.fn(async () => ({
      status: "allow",
      execute: false,
      blocked: true,
      reason: "approved",
      pause_id: "abc123",
    })),
  };
}

const adminSession = {
  userId: 1,
  displayName: "Ada",
  role: "admin",
  isAdmin: true,
};

const memberSession = {
  userId: 2,
  displayName: "Mo",
  role: "user",
  isAdmin: false,
};

describe("GovernancePage", () => {
  it("renders the shared page without an iframe", async () => {
    const client = mockClient();
    render(
      <GovernancePage client={client} session={adminSession} locale="en" />,
    );
    expect(await screen.findByTestId("org-ui-governance")).toBeInTheDocument();
    expect(screen.getByText("Governance Engine")).toBeInTheDocument();
    expect(screen.getByText("delete_employee")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.pauses).toHaveBeenCalled();
    expect(client.audit).toHaveBeenCalled();
  });

  it("lets an admin approve through the injected client", async () => {
    const client = mockClient();
    render(
      <GovernancePage client={client} session={adminSession} locale="en" />,
    );
    fireEvent.click(await screen.findByTestId("org-gov-approve-abc123"));
    fireEvent.click(
      await screen.findByTestId("org-gov-confirm-approve-abc123"),
    );
    await waitFor(() => {
      expect(client.resolve).toHaveBeenCalledWith("abc123", true);
    });
  });

  it("hides resolve actions for non-admins", async () => {
    const client = mockClient();
    render(
      <GovernancePage client={client} session={memberSession} locale="en" />,
    );
    expect(await screen.findByTestId("org-ui-governance")).toBeInTheDocument();
    expect(screen.queryByTestId("org-gov-approve-abc123")).toBeNull();
    expect(screen.queryByTestId("org-gov-reject-abc123")).toBeNull();
    expect(
      screen.getByText("Approve and reject are limited to administrators."),
    ).toBeInTheDocument();
  });
});

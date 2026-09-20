import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspacePage } from "./WorkspacePage";
import type { OrgWorkspaceClient } from "../../api/createClient";

function mockClient(): OrgWorkspaceClient {
  return {
    overview: vi.fn(async () => ({
      enabled: true,
      runtime: "in_host",
      last_sync: "2026-09-19T00:00:00Z",
      freeos: {
        employees: 2,
        spawned_colleagues: 1,
        org_skills: 3,
        talent_available: 4,
        pending_pauses: 1,
      },
      openxyos: {
        modules: 12,
        tenant_id: "acme",
        governance: true,
      },
      catalog: [
        {
          key: "announcements",
          label: "Announcements",
          label_zh: "通知公告",
          description: "Notices",
          description_zh: "公告",
          locked: false,
        },
        {
          key: "chat",
          label: "Collaboration",
          label_zh: "沟通协作",
          description: "Chat",
          description_zh: "对话",
          locked: false,
        },
      ],
      module_toggles: { announcements: true, chat: true, reflections: false },
      governance: {
        pending_pauses: 1,
        enabled: true,
        href: "/organization/governance",
        pauses: [
          {
            pause_id: "p1",
            tool_name: "shell",
            category: "outbound",
            action: "exec",
            actor_id: "agent-1",
            tenant_id: "acme",
            args_digest: "abc",
            reason: "high risk",
            status: "pending",
            created_at: 1,
            resolved_at: null,
            ttl_seconds: 600,
          },
        ],
      },
    })),
    pauses: vi.fn(async () => ({ pauses: [], enabled: true })),
    resolve: vi.fn(async () => ({
      status: "approved",
      execute: true,
      blocked: false,
      reason: "ok",
    })),
  };
}

const admin = {
  userId: 1,
  displayName: "Ada",
  role: "admin",
  isAdmin: true,
};

const member = {
  userId: 2,
  displayName: "Mo",
  role: "user",
  isAdmin: false,
};

describe("WorkspacePage", () => {
  it("renders host overview without an iframe or chat module card", async () => {
    const client = mockClient();
    render(<WorkspacePage client={client} session={admin} locale="en" />);
    expect(await screen.findByTestId("org-ui-workspace")).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(
      screen.getByTestId("org-workspace-chat-boundary"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("org-workspace-metrics")).toHaveTextContent("2");
    expect(screen.getByTestId("org-workspace-pauses")).toBeInTheDocument();
    expect(screen.getByTestId("org-workspace-open-pauses")).toHaveAttribute(
      "href",
      "/organization/governance",
    );
    expect(screen.getByTestId("org-workspace-approve-p1")).toBeInTheDocument();
    expect(
      screen.getByTestId("org-workspace-open-announcements"),
    ).toHaveAttribute("href", "/organization/announcements");
    expect(screen.getByTestId("org-workspace-open-agents")).toHaveAttribute(
      "href",
      "/organization/agents",
    );
    expect(screen.queryByTestId("org-workspace-module-chat")).toBeNull();
    expect(screen.queryByTestId("org-workspace-module-reflections")).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.overview).toHaveBeenCalled();
  });

  it("hides governance and settings from non-admins", async () => {
    const client = mockClient();
    render(<WorkspacePage client={client} session={member} locale="en" />);
    await screen.findByTestId("org-ui-workspace");
    expect(screen.queryByTestId("org-workspace-module-governance")).toBeNull();
    expect(screen.queryByTestId("org-workspace-module-settings")).toBeNull();
    expect(
      screen.getByTestId("org-workspace-module-employees"),
    ).toBeInTheDocument();
  });

  it("approves a pending pause from the workspace banner", async () => {
    const client = mockClient();
    render(<WorkspacePage client={client} session={admin} locale="en" />);
    fireEvent.click(await screen.findByTestId("org-workspace-approve-p1"));
    await waitFor(() => {
      expect(client.resolve).toHaveBeenCalledWith("p1", true);
    });
  });
});

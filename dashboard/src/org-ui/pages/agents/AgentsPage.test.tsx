import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentsPage } from "./AgentsPage";
import type { OrgAgentsClient } from "../../api/createClient";

function mockClient(): OrgAgentsClient {
  return {
    snapshot: vi.fn(async () => ({
      scope: "org_module",
      tenant_id: "default",
      schema: "openxyos.agent-blueprint.v1",
      states: ["draft", "market"],
      next_states: { draft: ["market", "offboard"] },
      colleagues: [
        {
          slug: "policy-analyst",
          tenant_id: "default",
          name: "policy-analyst",
          lifecycle: "draft",
          workspace: "/tmp/policy-analyst",
          spawned: false,
          next: ["market", "offboard"],
        },
      ],
      stats: {
        total: 1,
        spawned: 0,
        by_lifecycle: { draft: 1, active: 0 },
      },
      host_surfaces: {
        experts: "/experts",
        personalization: "/personalization",
        employees: "/organization/employees",
        chat: "/chat",
        workbench: "/organization",
      },
      not_on_this_page: ["chat_runtime", "sidecar_agent_studio"],
      compile: "/api/org-module/blueprints/compile",
      transition: "/api/org-module/employees/transition",
      spawn: "/api/org-module/employees/spawn",
    })),
    compile: vi.fn(async () => ({
      slug: "policy-analyst",
      tenant_id: "default",
      workspace: "/tmp/policy-analyst",
    })),
    transition: vi.fn(async (slug, state) => ({
      slug,
      tenant_id: "default",
      name: slug,
      lifecycle: state,
      workspace: "/tmp/policy-analyst",
      spawned: false,
      next: [],
    })),
    spawn: vi.fn(async (slug) => ({
      agent_id: `org-${slug}`,
      slug,
      name: slug,
      tenant_id: "default",
      workspace: "/tmp/policy-analyst",
    })),
  };
}

const admin = {
  userId: 1,
  displayName: "Ada",
  role: "admin",
  isAdmin: true,
};

describe("AgentsPage", () => {
  it("renders host-native studio without iframe or chat composer", async () => {
    const client = mockClient();
    render(<AgentsPage client={client} session={admin} locale="en" />);
    expect(await screen.findByTestId("org-ui-agents")).toBeInTheDocument();
    expect(screen.getByText("Agent Studio")).toBeInTheDocument();
    expect(screen.getByTestId("org-agents-boundary")).toBeInTheDocument();
    expect(screen.getByTestId("org-agents-experts")).toHaveAttribute(
      "href",
      "/experts",
    );
    expect(screen.getByTestId("org-agents-personalization")).toHaveAttribute(
      "href",
      "/personalization",
    );
    expect(
      screen.getByTestId("org-agent-card-policy-analyst"),
    ).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.queryByPlaceholderText(/type a message/i)).toBeNull();
    expect(client.snapshot).toHaveBeenCalled();
  });

  it("compiles a blueprint and advances lifecycle through the injected client", async () => {
    const client = mockClient();
    render(<AgentsPage client={client} session={admin} locale="en" />);
    fireEvent.change(await screen.findByTestId("org-agents-name"), {
      target: { value: "Policy Analyst" },
    });
    fireEvent.change(screen.getByTestId("org-agents-positioning"), {
      target: { value: "Review drafts with evidence." },
    });
    fireEvent.click(screen.getByText("Risk alerts"));
    fireEvent.click(screen.getByTestId("org-agents-compile-submit"));
    await waitFor(() => {
      expect(client.compile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Policy Analyst",
          positioning: "Review drafts with evidence.",
          capabilities: ["Risk alerts"],
        }),
      );
    });
    fireEvent.click(
      screen.getByTestId("org-agent-transition-policy-analyst-market"),
    );
    await waitFor(() => {
      expect(client.transition).toHaveBeenCalledWith(
        "policy-analyst",
        "market",
      );
    });
    fireEvent.click(screen.getByTestId("org-agent-spawn-policy-analyst"));
    await waitFor(() => {
      expect(client.spawn).toHaveBeenCalledWith("policy-analyst");
    });
  });
});

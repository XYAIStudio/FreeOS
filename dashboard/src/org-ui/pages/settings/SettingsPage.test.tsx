import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import type { OrgSettingsClient } from "../../api/createClient";

function mockClient(): OrgSettingsClient {
  return {
    snapshot: vi.fn(async () => ({
      scope: "org_module",
      catalog: [
        {
          key: "settings",
          label: "Settings",
          label_zh: "系统设置",
          description: "Tenant, model, module, and user settings.",
          description_zh: "租户、模型、模块与用户设置",
          locked: true,
          delivery: "org_ui_slice",
          host_path: "/organization/settings",
        },
        {
          key: "chat",
          label: "Collaboration",
          label_zh: "沟通协作",
          description: "Human-agent chat.",
          description_zh: "人机协作",
          locked: false,
          delivery: "managed_node_iframe",
          host_path: "",
        },
      ],
      modules: { settings: true, chat: true },
      prefs: { name: "Acme", description: "Ops" },
      system_settings: {
        overview: "/system-settings",
        models: "/system-settings/models",
        users: "/system-settings/users",
      },
      not_on_this_page: ["llm_keys", "users"],
    })),
    savePrefs: vi.fn(async (body) => ({
      name: body.name ?? "",
      description: body.description ?? "",
    })),
    saveModules: vi.fn(async (updates) => ({
      settings: true,
      chat: updates.chat ?? true,
    })),
  };
}

const admin = {
  userId: 1,
  displayName: "Ada",
  role: "admin",
  isAdmin: true,
};

describe("SettingsPage", () => {
  it("renders org-module settings without an iframe or system settings form", async () => {
    const client = mockClient();
    render(<SettingsPage client={client} session={admin} locale="en" />);
    expect(await screen.findByTestId("org-ui-settings")).toBeInTheDocument();
    expect(screen.getByText("Organization settings")).toBeInTheDocument();
    expect(screen.getByTestId("org-settings-boundary")).toBeInTheDocument();
    expect(screen.getByTestId("org-settings-system")).toHaveAttribute(
      "href",
      "/system-settings",
    );
    expect(screen.getByTestId("org-settings-name")).toHaveValue("Acme");
    expect(screen.getByText("Always on")).toBeInTheDocument();
    expect(
      screen.getByTestId("org-settings-delivery-settings"),
    ).toHaveTextContent("Host page");
    expect(screen.getByTestId("org-settings-delivery-chat")).toHaveTextContent(
      "Original App",
    );
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.queryByText("API Key")).toBeNull();
    expect(client.snapshot).toHaveBeenCalled();
  });

  it("saves org prefs and catalog toggles through the injected client", async () => {
    const client = mockClient();
    render(<SettingsPage client={client} session={admin} locale="en" />);
    fireEvent.change(await screen.findByTestId("org-settings-name"), {
      target: { value: "Northwind" },
    });
    fireEvent.click(screen.getByTestId("org-settings-save-prefs"));
    await waitFor(() => {
      expect(client.savePrefs).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Northwind" }),
      );
    });
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => {
      expect(client.saveModules).toHaveBeenCalledWith({ chat: false });
    });
  });
});

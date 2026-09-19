import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrgChartPage } from "./OrgChartPage";
import type { OrgChartClient } from "../../api/createClient";

function mockClient(): OrgChartClient {
  return {
    tree: vi.fn(async () => []),
    listDepartments: vi.fn(async () => []),
    createDepartment: vi.fn(async (body) => ({
      id: 3,
      name: body.name || "HQ",
      parent_id: body.parent_id ?? null,
      sort_order: 0,
      children: [],
      employees: [],
    })),
    updateDepartment: vi.fn(),
    removeDepartment: vi.fn(),
    createEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    removeEmployee: vi.fn(),
  };
}

describe("OrgChartPage", () => {
  it("renders the shared page without an iframe", async () => {
    const client = mockClient();
    render(
      <OrgChartPage
        client={client}
        session={{
          userId: 1,
          displayName: "Ada",
          role: "admin",
          isAdmin: true,
        }}
        locale="en"
      />,
    );
    expect(await screen.findByTestId("org-ui-org-chart")).toBeInTheDocument();
    expect(screen.getByText("Organization chart")).toBeInTheDocument();
    expect(screen.getByTestId("org-chart-empty")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.tree).toHaveBeenCalled();
  });

  it("lets an admin add a root department through the injected client", async () => {
    const client = mockClient();
    render(
      <OrgChartPage
        client={client}
        session={{
          userId: 1,
          displayName: "Ada",
          role: "admin",
          isAdmin: true,
        }}
        locale="en"
      />,
    );
    fireEvent.click(await screen.findByTestId("org-chart-add-root"));
    fireEvent.change(screen.getByTestId("org-chart-dept-name"), {
      target: { value: "HQ" },
    });
    fireEvent.click(screen.getByTestId("org-chart-dept-submit"));
    await waitFor(() => {
      expect(client.createDepartment).toHaveBeenCalledWith(
        expect.objectContaining({ name: "HQ", parent_id: null }),
      );
    });
  });
});

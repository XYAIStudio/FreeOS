import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmployeeDetailPage } from "./EmployeeDetailPage";
import type { OrgEmployeesClient } from "../../api/createClient";

function mockClient(): OrgEmployeesClient {
  return {
    list: vi.fn(),
    get: vi.fn(async () => ({
      id: 4,
      name: "Ada",
      role: "Lead",
      description: "Builds the team",
      employee_type: "human",
      department_id: 1,
      department_name: "HQ",
      skills: "org,python",
      status: "active",
    })),
    stats: vi.fn(),
    listDepartments: vi.fn(async () => [
      { id: 1, name: "HQ", parent_id: null, sort_order: 0 },
    ]),
    create: vi.fn(),
    update: vi.fn(async (_id, body) => ({
      id: 4,
      name: body.name || "Ada",
      role: body.role || "",
      description: body.description || "",
      employee_type: body.employee_type || "human",
      department_id: body.department_id || 1,
      department_name: "HQ",
      skills: body.skills || "",
      status: "active",
    })),
    remove: vi.fn(),
  };
}

describe("EmployeeDetailPage", () => {
  it("renders directory detail without an iframe", async () => {
    const client = mockClient();
    render(
      <EmployeeDetailPage
        client={client}
        session={{
          userId: 1,
          displayName: "Ada",
          role: "admin",
          isAdmin: true,
        }}
        locale="en"
        employeeId={4}
      />,
    );
    expect(
      await screen.findByTestId("org-ui-employee-detail"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ada").length).toBeGreaterThan(0);
    expect(screen.getByText("Builds the team")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.get).toHaveBeenCalledWith(4);
  });

  it("lets an admin save edits through the injected client", async () => {
    const client = mockClient();
    render(
      <EmployeeDetailPage
        client={client}
        session={{
          userId: 1,
          displayName: "Ada",
          role: "admin",
          isAdmin: true,
        }}
        locale="en"
        employeeId={4}
      />,
    );
    fireEvent.click(await screen.findByTestId("org-employee-edit"));
    fireEvent.change(screen.getByTestId("org-employee-name"), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.click(screen.getByTestId("org-employee-save"));
    await waitFor(() => {
      expect(client.update).toHaveBeenCalledWith(
        4,
        expect.objectContaining({ name: "Ada Lovelace", department_id: 1 }),
      );
    });
  });
});

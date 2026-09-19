import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmployeesPage } from "./EmployeesPage";
import type { OrgEmployeesClient } from "../../api/createClient";

function mockClient(): OrgEmployeesClient {
  return {
    list: vi.fn(async () => []),
    get: vi.fn(),
    stats: vi.fn(async () => ({
      total: 0,
      ai: 0,
      human: 0,
      byDepartment: [],
      byRole: [],
    })),
    listDepartments: vi.fn(async () => [
      { id: 1, name: "HQ", parent_id: null, sort_order: 0 },
    ]),
    create: vi.fn(async (body) => ({
      id: 9,
      name: body.name || "Ada",
      role: body.role || "",
      employee_type: body.employee_type || "human",
      department_id: body.department_id || 1,
      status: "active",
    })),
    update: vi.fn(),
    remove: vi.fn(),
  };
}

describe("EmployeesPage", () => {
  it("renders the shared page without an iframe", async () => {
    const client = mockClient();
    render(
      <EmployeesPage
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
    expect(await screen.findByTestId("org-ui-employees")).toBeInTheDocument();
    expect(screen.getByText("Employees")).toBeInTheDocument();
    expect(screen.getByTestId("org-employees-empty")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.list).toHaveBeenCalled();
  });

  it("lets an admin create through the injected client", async () => {
    const client = mockClient();
    const onOpenEmployee = vi.fn();
    render(
      <EmployeesPage
        client={client}
        session={{
          userId: 1,
          displayName: "Ada",
          role: "admin",
          isAdmin: true,
        }}
        locale="en"
        onOpenEmployee={onOpenEmployee}
      />,
    );
    fireEvent.click(await screen.findByTestId("org-employees-create"));
    fireEvent.change(screen.getByTestId("org-employees-name"), {
      target: { value: "Ada" },
    });
    fireEvent.click(screen.getByTestId("org-employees-submit"));
    await waitFor(() => {
      expect(client.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Ada", department_id: 1 }),
      );
    });
  });
});

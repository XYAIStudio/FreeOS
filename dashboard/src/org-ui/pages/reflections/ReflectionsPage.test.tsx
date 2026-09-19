import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReflectionsPage } from "./ReflectionsPage";
import type { OrgReflectionsClient } from "../../api/createClient";

function mockClient(): OrgReflectionsClient {
  return {
    list: vi.fn(async () => [
      {
        id: 3,
        employee_id: 4,
        task_id: 1,
        reflection_type: "error_learning",
        success_factors: null,
        failure_reasons: "const dead zone",
        knowledge_gaps: null,
        improvement_plans: "re-read after edit",
        extracted_skills: null,
        learned_knowledge: null,
        importance_score: 90,
        created_at: "2026-09-19T00:00:00Z",
      },
    ]),
    stats: vi.fn(async () => ({
      total: 1,
      task_completion: 0,
      error_learning: 1,
      knowledge_capture: 0,
      improvement: 0,
    })),
    get: vi.fn(),
    create: vi.fn(async (body) => ({
      id: 9,
      employee_id: body.employee_id ?? 0,
      task_id: body.task_id ?? null,
      reflection_type: body.reflection_type || "task_completion",
      success_factors: body.success_factors || null,
      failure_reasons: body.failure_reasons || null,
      knowledge_gaps: body.knowledge_gaps || null,
      improvement_plans: body.improvement_plans || null,
      extracted_skills: body.extracted_skills || null,
      learned_knowledge: body.learned_knowledge || null,
      importance_score: body.importance_score ?? 50,
      created_at: "2026-09-19T00:00:00Z",
    })),
    remove: vi.fn(async () => undefined),
  };
}

const session = {
  userId: 1,
  displayName: "Ada",
  role: "admin",
  isAdmin: true,
};

describe("ReflectionsPage", () => {
  it("renders the shared page without an iframe", async () => {
    const client = mockClient();
    render(<ReflectionsPage client={client} session={session} locale="en" />);
    expect(await screen.findByTestId("org-ui-reflections")).toBeInTheDocument();
    expect(screen.getByText("Reflections")).toBeInTheDocument();
    expect(screen.getByText("const dead zone")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.list).toHaveBeenCalled();
  });

  it("lets a signed-in user create through the injected client", async () => {
    const client = mockClient();
    render(<ReflectionsPage client={client} session={session} locale="en" />);
    fireEvent.click(await screen.findByTestId("org-reflections-create"));
    fireEvent.change(screen.getByTestId("org-reflections-success"), {
      target: { value: "Tests first" },
    });
    fireEvent.click(screen.getByTestId("org-reflections-submit"));
    await waitFor(() => {
      expect(client.create).toHaveBeenCalledWith(
        expect.objectContaining({ success_factors: "Tests first" }),
      );
    });
  });
});

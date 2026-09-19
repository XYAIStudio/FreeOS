import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskDetailPage } from "./TaskDetailPage";
import type { OrgTasksClient } from "../../api/createClient";

function mockClient(): OrgTasksClient {
  return {
    list: vi.fn(),
    stats: vi.fn(),
    get: vi.fn(async () => ({
      id: 3,
      title: "Ship Tasks slice",
      description: "Host org tasks",
      status: "todo",
      priority: "high",
      creator_name: "Ada",
      created_at: "2026-09-19T00:00:00Z",
      subtasks: [
        { id: 1, task_id: 3, title: "Draft", completed: 0, sort_order: 1 },
      ],
      comments: [],
    })),
    create: vi.fn(),
    update: vi.fn(async (_id, body) => ({
      id: 3,
      title: body.title || "Ship Tasks slice",
      description: body.description || "",
      status: "todo",
      priority: body.priority || "high",
      subtasks: [],
      comments: [],
    })),
    remove: vi.fn(),
    transition: vi.fn(async (_id, to) => ({
      id: 3,
      title: "Ship Tasks slice",
      status: to,
      priority: "high",
      subtasks: [],
      comments: [],
    })),
    addSubtask: vi.fn(async () => ({
      id: 2,
      task_id: 3,
      title: "Review",
      completed: 0,
      sort_order: 2,
    })),
    updateSubtask: vi.fn(),
    removeSubtask: vi.fn(),
    addComment: vi.fn(async () => ({
      id: 8,
      task_id: 3,
      content: "Looks good",
      comment_type: "user",
      created_at: "2026-09-19T00:00:00Z",
    })),
  };
}

const session = {
  userId: 1,
  displayName: "Ada",
  role: "admin",
  isAdmin: true,
};

describe("TaskDetailPage", () => {
  it("renders task detail without an iframe or chat runtime", async () => {
    const client = mockClient();
    render(
      <TaskDetailPage
        client={client}
        session={session}
        locale="en"
        taskId={3}
      />,
    );
    expect(await screen.findByTestId("org-ui-task-detail")).toBeInTheDocument();
    expect(screen.getAllByText("Ship Tasks slice").length).toBeGreaterThan(0);
    expect(screen.getByText("Host org tasks")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Human notes on this work item. This is not agent chat.",
      ),
    ).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.get).toHaveBeenCalledWith(3);
  });

  it("saves edits and adds a comment through the injected client", async () => {
    const client = mockClient();
    render(
      <TaskDetailPage
        client={client}
        session={session}
        locale="en"
        taskId={3}
      />,
    );
    fireEvent.click(await screen.findByTestId("org-task-edit"));
    fireEvent.change(screen.getByTestId("org-task-title"), {
      target: { value: "Ship host Tasks" },
    });
    fireEvent.click(screen.getByTestId("org-task-save"));
    await waitFor(() => {
      expect(client.update).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ title: "Ship host Tasks" }),
      );
    });
    fireEvent.change(screen.getByTestId("org-task-comment-input"), {
      target: { value: "Looks good" },
    });
    fireEvent.click(screen.getByTestId("org-task-comment-add"));
    await waitFor(() => {
      expect(client.addComment).toHaveBeenCalledWith(3, "Looks good");
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TasksPage } from "./TasksPage";
import type { OrgTasksClient } from "../../api/createClient";

function mockClient(): OrgTasksClient {
  return {
    list: vi.fn(async () => [
      {
        id: 3,
        title: "Ship Tasks slice",
        description: "Host org tasks",
        status: "todo",
        priority: "high",
        subtask_count: 0,
        subtask_done: 0,
        comment_count: 0,
      },
    ]),
    stats: vi.fn(async () => ({
      total: 1,
      todo: 1,
      in_progress: 0,
      review: 0,
      done: 0,
    })),
    get: vi.fn(),
    create: vi.fn(async (body) => ({
      id: 9,
      title: body.title || "New",
      description: body.description || "",
      status: "todo",
      priority: body.priority || "medium",
    })),
    update: vi.fn(),
    remove: vi.fn(),
    transition: vi.fn(async (id, to) => ({
      id,
      title: "Ship Tasks slice",
      status: to,
      priority: "high",
    })),
    addSubtask: vi.fn(),
    updateSubtask: vi.fn(),
    removeSubtask: vi.fn(),
    addComment: vi.fn(),
  };
}

const session = {
  userId: 1,
  displayName: "Ada",
  role: "admin",
  isAdmin: true,
};

describe("TasksPage", () => {
  it("renders the shared page without an iframe", async () => {
    const client = mockClient();
    render(<TasksPage client={client} session={session} locale="en" />);
    expect(await screen.findByTestId("org-ui-tasks")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Ship Tasks slice")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.list).toHaveBeenCalled();
  });

  it("lets a signed-in user create through the injected client", async () => {
    const client = mockClient();
    const onOpenTask = vi.fn();
    render(
      <TasksPage
        client={client}
        session={session}
        locale="en"
        onOpenTask={onOpenTask}
      />,
    );
    fireEvent.click(await screen.findByTestId("org-tasks-create"));
    fireEvent.change(screen.getByTestId("org-tasks-title"), {
      target: { value: "Write tests" },
    });
    fireEvent.click(screen.getByTestId("org-tasks-submit"));
    await waitFor(() => {
      expect(client.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Write tests" }),
      );
    });
  });

  it("advances status from the list without opening chat", async () => {
    const client = mockClient();
    render(<TasksPage client={client} session={session} locale="en" />);
    fireEvent.click(await screen.findByTestId("org-task-next-3"));
    await waitFor(() => {
      expect(client.transition).toHaveBeenCalledWith(3, "in_progress");
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnnouncementPage } from "./AnnouncementPage";
import type { OrgAnnouncementsClient } from "../../api/createClient";

function mockClient(): OrgAnnouncementsClient {
  return {
    list: vi.fn(async () => ({ list: [], total: 0, page: 1, limit: 10 })),
    get: vi.fn(),
    readers: vi.fn(async () => ({ readers: [], count: 0 })),
    unread: vi.fn(async () => ({ count: 0 })),
    markRead: vi.fn(),
    markAllRead: vi.fn(async () => ({ marked: 0 })),
    create: vi.fn(async (body) => ({
      id: 9,
      title: body.title,
      content: body.content,
      type: body.type,
      priority: body.priority,
      is_pinned: body.is_pinned ? 1 : 0,
      published_at: "2026-09-19T00:00:00Z",
      expires_at: null,
    })),
    update: vi.fn(),
    remove: vi.fn(),
    togglePin: vi.fn(),
    pinned: vi.fn(async () => []),
  };
}

const admin = {
  userId: 1,
  displayName: "Ada",
  role: "admin",
  isAdmin: true,
};

describe("AnnouncementPage", () => {
  it("renders the shared page without an iframe", async () => {
    const client = mockClient();
    render(<AnnouncementPage client={client} session={admin} locale="en" />);
    expect(
      await screen.findByTestId("org-ui-announcements"),
    ).toBeInTheDocument();
    expect(screen.getByText("Announcements")).toBeInTheDocument();
    expect(screen.getByTestId("org-announcements-empty")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.list).toHaveBeenCalled();
  });

  it("lets an admin publish through the injected client", async () => {
    const client = mockClient();
    render(<AnnouncementPage client={client} session={admin} locale="en" />);
    fireEvent.click(await screen.findByTestId("org-announcements-publish"));
    fireEvent.change(screen.getByTestId("org-announcement-title"), {
      target: { value: "Hello" },
    });
    fireEvent.change(screen.getByTestId("org-announcement-content"), {
      target: { value: "World" },
    });
    fireEvent.click(screen.getByTestId("org-announcement-submit"));
    await waitFor(() => {
      expect(client.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Hello", content: "World" }),
      );
    });
  });

  it("shows the reader log when opening an announcement", async () => {
    const client = mockClient();
    vi.mocked(client.list).mockResolvedValue({
      list: [
        {
          id: 4,
          title: "Hello",
          content: "World",
          type: "notice",
          priority: "normal",
          is_pinned: 0,
          is_read: false,
          published_at: "2026-09-19T00:00:00Z",
          expires_at: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });
    vi.mocked(client.get).mockResolvedValue({
      id: 4,
      title: "Hello",
      content: "World",
      type: "notice",
      priority: "normal",
      is_pinned: 0,
      is_read: true,
      published_at: "2026-09-19T00:00:00Z",
      expires_at: null,
    });
    vi.mocked(client.readers).mockResolvedValue({
      readers: [
        { user_id: 1, user_name: "Ada", read_at: "2026-09-19T00:00:00Z" },
      ],
      count: 1,
    });
    render(<AnnouncementPage client={client} session={admin} locale="en" />);
    fireEvent.click(await screen.findByTestId("org-announcement-4"));
    expect(
      await screen.findByTestId("org-announcement-readers"),
    ).toHaveTextContent("Ada");
    expect(client.readers).toHaveBeenCalledWith(4);
  });
});

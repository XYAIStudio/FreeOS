import { describe, expect, it, vi } from "vitest";
import { createOrgApiClient } from "./createClient";

describe("createOrgApiClient", () => {
  it("calls the in-host announcements prefix and unwraps the envelope", async () => {
    const fetchJson = vi.fn(async (path: string) => {
      if (path.startsWith("/org-module/announcements?")) {
        return {
          success: true,
          data: {
            list: [{ id: 1, title: "Hi" }],
            total: 1,
            page: 1,
            limit: 10,
          },
        };
      }
      if (path === "/org-module/announcements/action/unread") {
        return { success: true, data: { count: 2 } };
      }
      throw new Error(`unexpected ${path}`);
    });
    const client = createOrgApiClient({ fetchJson });
    const listed = await client.announcements.list({
      page: 1,
      limit: 10,
      type: "all",
    });
    expect(listed.total).toBe(1);
    expect(listed.list[0]?.title).toBe("Hi");
    expect(await client.announcements.unread()).toEqual({ count: 2 });
    expect(fetchJson).toHaveBeenCalled();
  });

  it("throws the envelope error", async () => {
    const client = createOrgApiClient({
      fetchJson: async () => ({ success: false, error: "Permission denied" }),
    });
    await expect(
      client.announcements.create({
        title: "x",
        content: "y",
        type: "notice",
        priority: "normal",
        is_pinned: false,
        expires_at: null,
      }),
    ).rejects.toThrow("Permission denied");
  });
});

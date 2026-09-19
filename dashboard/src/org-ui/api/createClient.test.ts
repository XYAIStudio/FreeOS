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
      if (path === "/org-module/org/tree") {
        return {
          success: true,
          data: [{ id: 1, name: "HQ", parent_id: null, sort_order: 0 }],
        };
      }
      if (path === "/org-module/org/employees") {
        return {
          success: true,
          data: [
            {
              id: 4,
              name: "Ada",
              role: "Lead",
              department_id: 1,
              department_name: "HQ",
              employee_type: "human",
              status: "active",
            },
          ],
        };
      }
      if (path === "/org-module/governance/pauses") {
        return {
          pauses: [{ pause_id: "p1", status: "pending", tool_name: "delete" }],
          enabled: true,
        };
      }
      if (path === "/org-module/skills") {
        return {
          out_dir: "/tmp/org-skills",
          skills: [{ slug: "org-employees", module_key: "employees" }],
          catalog: [{ key: "employees", generated: true }],
          host_packages: [{ id: "pkg-1", name: "Ops", skill_count: 2 }],
        };
      }
      if (path === "/org-module/knowledge") {
        return {
          host_route: "/knowledge-bases",
          store: "host_knowledge_bases",
          capability: { feature_enabled: true, usable: true },
          bases: [{ id: "kb-1", name: "Policies" }],
          stats: { bases: 1, documents: 0, shared: 0, owned: 1 },
        };
      }
      if (path === "/org-module/tasks") {
        return {
          success: true,
          data: [{ id: 3, title: "Ship Tasks slice", status: "todo" }],
        };
      }
      if (path === "/org-module/reflections") {
        return {
          success: true,
          data: [
            {
              id: 2,
              reflection_type: "error_learning",
              failure_reasons: "const dead zone",
            },
          ],
        };
      }
      if (path === "/org-module/settings") {
        return {
          success: true,
          data: {
            scope: "org_module",
            catalog: [{ key: "settings", locked: true }],
            modules: { settings: true, chat: false },
            prefs: { name: "Acme", description: "" },
            system_settings: { overview: "/system-settings" },
            not_on_this_page: ["llm_keys"],
          },
        };
      }
      if (path === "/org-module/modules") {
        return { updates: { settings: true, chat: false } };
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
    expect((await client.org.tree())[0]?.name).toBe("HQ");
    expect((await client.employees.list())[0]?.name).toBe("Ada");
    expect((await client.governance.pauses()).pauses[0]?.pause_id).toBe("p1");
    expect((await client.skills.list()).skills[0]?.slug).toBe("org-employees");
    expect((await client.knowledge.list()).bases[0]?.name).toBe("Policies");
    expect((await client.tasks.list())[0]?.title).toBe("Ship Tasks slice");
    expect((await client.reflections.list())[0]?.failure_reasons).toBe(
      "const dead zone",
    );
    expect((await client.settings.snapshot()).prefs.name).toBe("Acme");
    expect(await client.settings.saveModules({ chat: false })).toEqual({
      settings: true,
      chat: false,
    });
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

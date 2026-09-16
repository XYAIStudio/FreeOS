import { describe, expect, it } from "vitest";
import {
  SIDEBAR_GROUPED_NAV_KEYS,
  buildNavSections,
  isGroupedNavKey,
} from "./sidebarNav";
import type { OctopUser } from "../api/modules/auth";
import en from "../locales/en.json";
import zh from "../locales/zh.json";

const adminUser = {
  id: 1,
  username: "admin",
  role: "admin",
  permissions: ["*"],
} as OctopUser;

describe("sidebarNav", () => {
  it("has no Capabilities / System Settings sidebar groups", () => {
    expect(SIDEBAR_GROUPED_NAV_KEYS).toEqual([]);
    expect(isGroupedNavKey("system-settings")).toBe(false);
    expect(isGroupedNavKey("personalization")).toBe(false);
  });

  it("is a single user-job primary list", () => {
    const sections = buildNavSections(adminUser, { mobileEnabled: true });
    expect(sections).toHaveLength(1);
    expect(sections[0].groupKey).toBeUndefined();
    expect(sections[0].placement).toBe("primary");
    expect(sections[0].items.map((i) => i.key)).toEqual([
      "chat",
      "experts",
      "models",
      "knowledge-bases",
      "organization",
      "personalization",
      "projects",
      "token-usage",
    ]);
  });

  it("hides models and knowledge when the user lacks those permissions", () => {
    const guest = {
      id: 2,
      username: "guest",
      role: "user",
      permissions: [],
    } as OctopUser;
    const keys = buildNavSections(guest).flatMap((s) =>
      s.items.map((i) => i.key),
    );
    expect(keys).not.toContain("models");
    expect(keys).not.toContain("knowledge-bases");
    expect(keys).not.toContain("system-settings");
    expect(keys).toContain("personalization");
    expect(keys).toContain("projects");
    expect(keys).toContain("chat");
    expect(keys).toContain("experts");
  });

  it("labels organization without the OS suffix", () => {
    expect(zh.nav.organization).toBe("组织");
    expect(en.nav.organization).toBe("Organization");
  });
});

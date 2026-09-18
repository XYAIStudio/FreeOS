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

  it("hides models and knowledge when a non-desktop user lacks those permissions", () => {
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

  it("shows models and knowledge for the first-run desktop guest", () => {
    const desktopGuest = {
      id: 3,
      username: "local",
      role: "user",
      permissions: [],
      is_local: true,
    } as OctopUser;
    const items = buildNavSections(desktopGuest).flatMap((s) => s.items);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("models");
    expect(keys).toContain("knowledge-bases");
    expect(items.find((i) => i.key === "chat")?.path).toBe("/projects");
    expect(items.find((i) => i.key === "projects")?.path).toBe(
      "/projects?view=projects",
    );
  });

  it("labels organization without the OS suffix", () => {
    expect(zh.nav.organization).toBe("组织");
    expect(en.nav.organization).toBe("Organization");
    expect(zh.organization.enableModule).toBe("启用组织模块");
    expect(zh.organization.manageOs).toBe("组织OS管理");
    expect(zh.organization.downloadSourceBar).toBe("下载最新源码");
    expect(zh.organization.downloadSource).toBe("下载最新 openXYOS 源码");
    expect(zh.organization.restartSidecar).toBe("重启 openXYOS 前后端服务");
    expect(zh.organization.restartSidecarCta).toBe("重启前后端服务");
    expect(zh.organization.restartOverlayTitle).toBe("正在重启前后端服务");
    expect(zh.organization.browserReload).toBe("刷新");
    expect(en.organization.enableModule).toBe("Enable organization module");
    expect(en.organization.manageOs).toBe("Organization OS");
    expect(en.organization.downloadSourceBar).toBe("Download latest source");
    expect(en.organization.downloadSource).toBe(
      "Download latest openXYOS source",
    );
    expect(en.organization.restartSidecar).toBe(
      "Restart openXYOS frontend and backend",
    );
    expect(en.organization.restartSidecarCta).toBe(
      "Restart frontend and backend",
    );
    expect(en.organization.restartOverlayTitle).toBe(
      "Restarting frontend and backend",
    );
    expect(en.organization.browserReload).toBe("Reload");
    expect(zh.chat.modelPickerManage).toBe("模型管理");
    expect(en.chat.modelPickerManage).toBe("Model management");
  });

  it("locks the employee / colleague / expert glossary", () => {
    expect(zh.organization.glossary).toContain("员工：已经编入某个部门");
    expect(zh.organization.glossary).toContain("同事：同一组织");
    expect(zh.organization.glossary).toContain("专家 / 智能助手");
    expect(zh.organization.assembleBody).toContain("员工");
    expect(zh.organization.assembleBody).toContain("同事");
    expect(zh.organization.assembleBody).not.toContain("出现在专家列表");
    expect(zh.organization.produceTitle).toContain("专家");
    expect(zh.chat.expertPicker).toContain("同事或智能助手");
    expect(zh.projects.groupMembers).toContain("同事或智能助手");
    expect(en.organization.glossary).toContain("Employees: already assigned");
    expect(en.organization.glossary).toContain("Colleagues: peers");
    expect(en.chat.expertPicker).toContain("colleagues or smart helpers");
  });
});

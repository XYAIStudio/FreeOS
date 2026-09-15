import { describe, expect, it } from "vitest";
import type { OctopUser } from "../../api/modules/auth";
import {
  allowedSystemSettingsTabs,
  canSeeSystemSettings,
  isSystemSettingsNavPath,
  systemSettingsPath,
} from "./tabs";

const adminUser = {
  id: 1,
  username: "admin",
  role: "admin",
  permissions: ["*"],
} as OctopUser;

describe("system settings tabs", () => {
  it("maps hub tabs to /system-settings and keeps fullscreen tools external", () => {
    expect(systemSettingsPath("users")).toBe("/system-settings/users");
    expect(systemSettingsPath("workbench")).toBe("/workbench");
    expect(systemSettingsPath("remote-desktop")).toBe("/remote-desktop");
  });

  it("treats old control/admin URLs as the system-settings nav item", () => {
    expect(isSystemSettingsNavPath("/system-settings/users")).toBe(true);
    expect(isSystemSettingsNavPath("/admin/users")).toBe(true);
    expect(isSystemSettingsNavPath("/workbench/terminal")).toBe(true);
    expect(isSystemSettingsNavPath("/chat")).toBe(false);
  });

  it("lists every former control and admin module for admins", () => {
    expect(
      allowedSystemSettingsTabs(adminUser, { mobileEnabled: true }),
    ).toEqual([
      "workbench",
      "remote-desktop",
      "acp",
      "users",
      "models",
      "storage",
      "plugins",
      "security",
      "advanced",
      "agent-config",
    ]);
  });

  it("hides the hub from guests without module permissions", () => {
    const guest = {
      id: 2,
      username: "guest",
      role: "user",
      permissions: [],
    } as OctopUser;
    expect(canSeeSystemSettings(guest)).toBe(false);
    expect(allowedSystemSettingsTabs(guest)).toEqual([]);
  });

  it("keeps desktop-only users on remote-desktop without admin tabs", () => {
    const desktopUser = {
      id: 3,
      username: "ops",
      role: "user",
      permissions: ["desktop"],
    } as OctopUser;
    expect(allowedSystemSettingsTabs(desktopUser)).toEqual([
      "remote-desktop",
      "agent-config",
    ]);
  });
});

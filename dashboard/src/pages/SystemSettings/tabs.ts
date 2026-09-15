import type { OctopUser } from "../../api/modules/auth";
import { navAllowed, userCan } from "../../utils/permissions";

export const SYSTEM_SETTINGS_TABS = [
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
] as const;

export type SystemSettingsTab = (typeof SYSTEM_SETTINGS_TABS)[number];

export const SYSTEM_SETTINGS_TAB_SET = new Set<string>(SYSTEM_SETTINGS_TABS);

/** Fullscreen tools stay on their existing routes; other tabs live under the hub. */
export const SYSTEM_SETTINGS_EXTERNAL_PATH: Partial<
  Record<SystemSettingsTab, string>
> = {
  workbench: "/workbench",
  "remote-desktop": "/remote-desktop",
};

export const SYSTEM_SETTINGS_LABEL_KEY: Record<SystemSettingsTab, string> = {
  workbench: "nav.workbench",
  "remote-desktop": "nav.remoteDesktop",
  acp: "nav.acp",
  users: "nav.adminUsers",
  models: "nav.models",
  storage: "nav.adminStorage",
  plugins: "nav.adminPlugins",
  security: "nav.security",
  advanced: "nav.adminAdvanced",
  "agent-config": "nav.agentConfig",
};

export function systemSettingsPath(tab: SystemSettingsTab): string {
  return SYSTEM_SETTINGS_EXTERNAL_PATH[tab] ?? `/system-settings/${tab}`;
}

export function isSystemSettingsNavPath(pathname: string): boolean {
  if (
    pathname === "/system-settings" ||
    pathname.startsWith("/system-settings/")
  ) {
    return true;
  }
  if (pathname === "/workbench" || pathname.startsWith("/workbench/")) {
    return true;
  }
  if (pathname === "/terminal" || pathname === "/remote-browser") {
    return true;
  }
  if (
    pathname === "/remote-desktop" ||
    pathname.startsWith("/remote-desktop/") ||
    pathname === "/remote-phone" ||
    pathname.startsWith("/remote-phone/") ||
    pathname === "/remote-android" ||
    pathname.startsWith("/remote-android/")
  ) {
    return true;
  }
  if (pathname === "/acp" || pathname.startsWith("/acp/")) {
    return true;
  }
  if (pathname === "/agent-config") {
    return true;
  }
  return pathname.startsWith("/admin/");
}

export function allowedSystemSettingsTabs(
  user: OctopUser | null,
  opts?: { mobileEnabled?: boolean },
): SystemSettingsTab[] {
  const tabs: SystemSettingsTab[] = [];
  if (navAllowed(user, "workbench")) {
    tabs.push("workbench");
  }
  if (
    userCan(user, "desktop") ||
    (opts?.mobileEnabled && userCan(user, "mobile"))
  ) {
    tabs.push("remote-desktop");
  }
  if (navAllowed(user, "acp")) {
    tabs.push("acp");
  }
  if (navAllowed(user, "admin-users")) {
    tabs.push("users");
  }
  if (navAllowed(user, "models")) {
    tabs.push("models");
  }
  if (navAllowed(user, "admin-storage")) {
    tabs.push("storage");
  }
  if (navAllowed(user, "admin-plugins")) {
    tabs.push("plugins");
  }
  if (navAllowed(user, "admin-security")) {
    tabs.push("security");
  }
  if (navAllowed(user, "admin-advanced")) {
    tabs.push("advanced");
  }
  if (tabs.length > 0) {
    tabs.push("agent-config");
  }
  return tabs;
}

export function canSeeSystemSettings(
  user: OctopUser | null,
  opts?: { mobileEnabled?: boolean },
): boolean {
  return allowedSystemSettingsTabs(user, opts).length > 0;
}

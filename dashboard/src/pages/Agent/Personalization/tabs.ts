import type { OctopUser } from "../../../api/modules/auth";
import { canSeeSystemSettings } from "../../SystemSettings/tabs";
import { navAllowed, userCan } from "../../../utils/permissions";

export const PERSONALIZATION_CORE_TABS = [
  "skills",
  "channels",
  "connectors",
  "skill-packages",
  "tools",
  "plugins",
  "subagents",
  "mbti",
  "memory",
] as const;

export const PERSONALIZATION_HOST_TABS = [
  "workbench",
  "remote-desktop",
  "acp",
  "users",
  "storage",
  "host-plugins",
  "security",
  "advanced",
  "agent-config",
] as const;

export const PERSONALIZATION_TABS = [
  ...PERSONALIZATION_CORE_TABS,
  ...PERSONALIZATION_HOST_TABS,
] as const;

export type PersonalizationTab = (typeof PERSONALIZATION_TABS)[number];

export function isPersonalizationTab(
  value: string,
): value is PersonalizationTab {
  return (PERSONALIZATION_TABS as readonly string[]).includes(value);
}

export function allowedPersonalizationTabs(
  user: OctopUser | null,
  opts?: { mobileEnabled?: boolean },
): PersonalizationTab[] {
  const tabs: PersonalizationTab[] = [
    "skills",
    "tools",
    "plugins",
    "subagents",
    "mbti",
    "memory",
  ];
  if (userCan(user, "channels")) tabs.splice(1, 0, "channels");
  if (navAllowed(user, "connectors"))
    tabs.splice(tabs.indexOf("tools"), 0, "connectors");
  if (navAllowed(user, "skill-packages")) {
    tabs.splice(tabs.indexOf("tools"), 0, "skill-packages");
  }
  if (navAllowed(user, "workbench")) tabs.push("workbench");
  if (
    userCan(user, "desktop") ||
    (opts?.mobileEnabled && userCan(user, "mobile"))
  ) {
    tabs.push("remote-desktop");
  }
  if (navAllowed(user, "acp")) tabs.push("acp");
  if (navAllowed(user, "admin-users")) tabs.push("users");
  if (navAllowed(user, "admin-storage")) tabs.push("storage");
  if (navAllowed(user, "admin-plugins")) tabs.push("host-plugins");
  if (navAllowed(user, "admin-security")) tabs.push("security");
  if (navAllowed(user, "admin-advanced")) tabs.push("advanced");
  if (canSeeSystemSettings(user, opts)) tabs.push("agent-config");
  return tabs.filter((tab, index, all) => all.indexOf(tab) === index);
}

export const SYSTEM_SETTINGS_TO_PERSONALIZATION: Record<string, string> = {
  workbench: "workbench",
  "remote-desktop": "remote-desktop",
  acp: "acp",
  users: "users",
  models: "/models",
  storage: "storage",
  plugins: "host-plugins",
  security: "security",
  advanced: "advanced",
  "agent-config": "agent-config",
};

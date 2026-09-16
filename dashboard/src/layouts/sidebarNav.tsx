import type { ReactNode } from "react";
import {
  MessageSquareText,
  Database,
  Activity,
  Sparkles,
  GraduationCap,
  Building2,
  FolderKanban,
  Cpu,
} from "lucide-react";
import type { OctopUser } from "../api/modules/auth";
import { navAllowed } from "../utils/permissions";
import {
  CONVERSATION_LIST_PATH,
  WORKSPACE_PROJECTS_PATH,
} from "./conversationHome";

export const EXPANDED_WIDTH = 220;
export const COLLAPSED_WIDTH = 56;

const iconSize = 16;
const iconStroke = 1.8;

export interface NavItem {
  key: string;
  path: string;
  icon: ReactNode;
  labelKey: string;
  badge?: string;
  children?: NavItem[];
}

export interface NavSection {
  /** When omitted, items render flat without a group header. */
  groupKey?: string;
  /** primary = middle list; footer = above the avatar. */
  placement?: "primary" | "footer";
  items: NavItem[];
}

/**
 * No separate Capabilities / System Settings sidebar groups.
 * Kept so rail helpers stay import-compatible.
 */
export const SIDEBAR_GROUPED_NAV_KEYS = [] as const;

const GROUPED_NAV_KEY_SET = new Set<string>(SIDEBAR_GROUPED_NAV_KEYS);

export function isGroupedNavKey(key: string): boolean {
  return GROUPED_NAV_KEY_SET.has(key);
}

export function buildNavSections(
  user: OctopUser | null,
  _opts?: { mobileEnabled?: boolean },
): NavSection[] {
  const items: NavItem[] = [
    {
      key: "chat",
      path: CONVERSATION_LIST_PATH,
      icon: <MessageSquareText size={iconSize} strokeWidth={iconStroke} />,
      labelKey: "nav.conversations",
    },
    {
      key: "experts",
      path: "/experts",
      icon: <GraduationCap size={iconSize} strokeWidth={iconStroke} />,
      labelKey: "nav.experts",
    },
  ];
  if (navAllowed(user, "models")) {
    items.push({
      key: "models",
      path: "/models",
      icon: <Cpu size={iconSize} strokeWidth={iconStroke} />,
      labelKey: "nav.models",
    });
  }
  if (navAllowed(user, "knowledge-bases")) {
    items.push({
      key: "knowledge-bases",
      path: "/knowledge-bases",
      icon: <Database size={iconSize} strokeWidth={iconStroke} />,
      labelKey: "nav.knowledgeBases",
    });
  }
  items.push({
    key: "organization",
    path: "/organization",
    icon: <Building2 size={iconSize} strokeWidth={iconStroke} />,
    labelKey: "nav.organization",
  });
  items.push({
    key: "personalization",
    path: "/personalization/skills",
    icon: <Sparkles size={iconSize} strokeWidth={iconStroke} />,
    labelKey: "nav.personalization",
  });
  items.push({
    key: "projects",
    path: WORKSPACE_PROJECTS_PATH,
    icon: <FolderKanban size={iconSize} strokeWidth={iconStroke} />,
    labelKey: "nav.workspace",
  });
  items.push({
    key: "token-usage",
    path: "/token-usage",
    icon: <Activity size={iconSize} strokeWidth={iconStroke} />,
    labelKey: "nav.tokenUsage",
  });
  return [{ placement: "primary", items }];
}

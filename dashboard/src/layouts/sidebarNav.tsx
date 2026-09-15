import type { ReactNode } from "react";
import {
  MessageSquareText,
  Timer,
  SlidersHorizontal,
  Waypoints,
  Link2,
  Database,
  Activity,
  Sparkles,
  Package,
  GraduationCap,
  Building2,
} from "lucide-react";
import type { OctopUser } from "../api/modules/auth";
import { canSeeSystemSettings } from "../pages/SystemSettings/tabs";
import { navAllowed } from "../utils/permissions";

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
}

export interface NavSection {
  /** When omitted, items render flat without a group header. */
  groupKey?: string;
  items: NavItem[];
}

/**
 * Catalog of nav item keys that live under the Capabilities group.
 * Permission-independent — used for pane/route helpers; visibility still
 * comes from {@link buildNavSections}.
 */
export const SIDEBAR_GROUPED_NAV_KEYS = [
  "personalization",
  "channels",
  "connectors",
  "skill-packages",
  "knowledge-bases",
] as const;

const GROUPED_NAV_KEY_SET = new Set<string>(SIDEBAR_GROUPED_NAV_KEYS);

export function isGroupedNavKey(key: string): boolean {
  return GROUPED_NAV_KEY_SET.has(key);
}

export function buildNavSections(
  user: OctopUser | null,
  opts?: { mobileEnabled?: boolean },
): NavSection[] {
  const sections: NavSection[] = [
    {
      items: [
        {
          key: "chat",
          path: "/chat",
          icon: <MessageSquareText size={iconSize} strokeWidth={iconStroke} />,
          labelKey: "nav.chat",
        },
        {
          key: "experts",
          path: "/experts",
          icon: <GraduationCap size={iconSize} strokeWidth={iconStroke} />,
          labelKey: "nav.experts",
        },
        {
          key: "organization",
          path: "/organization",
          icon: <Building2 size={iconSize} strokeWidth={iconStroke} />,
          labelKey: "nav.organization",
        },
        {
          key: "tasks",
          path: "/tasks",
          icon: <Timer size={iconSize} strokeWidth={iconStroke} />,
          labelKey: "nav.tasks",
        },
        {
          key: "token-usage",
          path: "/token-usage",
          icon: <Activity size={iconSize} strokeWidth={iconStroke} />,
          labelKey: "nav.tokenUsage",
        },
        ...(canSeeSystemSettings(user, { mobileEnabled: opts?.mobileEnabled })
          ? [
              {
                key: "system-settings",
                path: "/system-settings",
                icon: (
                  <SlidersHorizontal size={iconSize} strokeWidth={iconStroke} />
                ),
                labelKey: "nav.systemSettings",
              } satisfies NavItem,
            ]
          : []),
      ],
    },
  ];

  const settingsItems: NavItem[] = [
    {
      key: "personalization",
      path: "/personalization/skills",
      icon: <Sparkles size={iconSize} strokeWidth={iconStroke} />,
      labelKey: "nav.personalization",
    },
  ];
  if (navAllowed(user, "channels")) {
    settingsItems.push({
      key: "channels",
      path: "/personalization/channels",
      icon: <Waypoints size={iconSize} strokeWidth={iconStroke} />,
      labelKey: "nav.channels",
    });
  }
  if (navAllowed(user, "connectors")) {
    settingsItems.push({
      key: "connectors",
      path: "/connectors",
      icon: <Link2 size={iconSize} strokeWidth={iconStroke} />,
      labelKey: "nav.connectors",
    });
  }
  if (navAllowed(user, "skill-packages")) {
    settingsItems.push({
      key: "skill-packages",
      path: "/skill-packages",
      icon: <Package size={iconSize} strokeWidth={iconStroke} />,
      labelKey: "nav.skillPackages",
    });
  }
  if (navAllowed(user, "knowledge-bases")) {
    settingsItems.push({
      key: "knowledge-bases",
      path: "/knowledge-bases",
      icon: <Database size={iconSize} strokeWidth={iconStroke} />,
      labelKey: "nav.knowledgeBases",
    });
  }
  if (settingsItems.length > 0) {
    sections.push({ groupKey: "nav.capabilities", items: settingsItems });
  }
  return sections;
}

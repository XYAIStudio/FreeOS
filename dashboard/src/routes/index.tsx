import { lazy } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isSystemSettingsNavPath } from "../pages/SystemSettings/tabs";

// Lazy-loaded pages — Common
const ExpertsPage = lazy(() => import("../pages/Experts"));
const CronJobsPage = lazy(() => import("../pages/Control/CronJobs"));
const ConnectorsPage = lazy(() => import("../pages/Agent/Connectors"));
const SkillPackagesPage = lazy(() => import("../pages/SkillPackages"));
const KnowledgeBasesPage = lazy(() => import("../pages/KnowledgeBases"));
const PersonalizationPage = lazy(
  () => import("../pages/Agent/Personalization"),
);
const TokenUsagePage = lazy(() => import("../pages/Control/TokenUsage"));

// Lazy-loaded pages — Control
const RemoteDesktopPage = lazy(() => import("../pages/Control/RemoteDesktop"));

const OrganizationPage = lazy(() => import("../pages/Organization"));
const SystemSettingsPage = lazy(() => import("../pages/SystemSettings"));

// Misc
const PwaDebugPage = lazy(() => import("../pages/PwaDebug"));
const NotFoundPage = lazy(() => import("../components/NotFoundPage"));

function RedirectPreserveSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  /** When true, the route uses a wrapper component instead of a plain element */
  useWrapper?: boolean;
}

export const pathToKey: Record<string, string> = {
  "/chat": "chat",
  // Common
  "/experts": "experts",
  "/organization": "organization",
  "/tasks": "tasks",
  "/connectors": "connectors",
  "/skill-packages": "skill-packages",
  "/knowledge-bases": "knowledge-bases",
  "/acp": "system-settings",
  "/personalization": "personalization",
  "/personalization/skills": "personalization",
  "/personalization/tools": "personalization",
  "/personalization/plugins": "personalization",
  "/personalization/subagents": "personalization",
  "/personalization/channels": "channels",
  "/personalization/mbti": "personalization",
  "/personalization/memory": "personalization",
  "/skills": "personalization",
  "/token-usage": "token-usage",
  "/agent-config": "system-settings",
  "/system-settings": "system-settings",
  // Control
  "/channels": "channels",
  "/workbench": "system-settings",
  "/workbench/terminal": "system-settings",
  "/workbench/browser": "system-settings",
  "/terminal": "system-settings",
  "/remote-browser": "system-settings",
  "/remote-desktop": "system-settings",
  "/remote-desktop/desktop": "system-settings",
  "/remote-desktop/phone": "system-settings",
  "/remote-desktop/phone/screen": "system-settings",
  "/remote-desktop/phone/shell": "system-settings",
  "/remote-phone": "system-settings",
  "/remote-android": "system-settings",
  "/subagents": "personalization",
  "/mbti": "personalization",
  "/memory": "personalization",
  // Admin
  "/admin/models": "system-settings",
  "/admin/users": "system-settings",
  "/admin/backend": "system-settings",
  "/admin/plugins": "system-settings",
  "/admin/advanced": "system-settings",
  "/admin/security": "system-settings",
  "/system-settings/acp": "system-settings",
  "/system-settings/users": "system-settings",
  "/system-settings/models": "system-settings",
  "/system-settings/storage": "system-settings",
  "/system-settings/plugins": "system-settings",
  "/system-settings/security": "system-settings",
  "/system-settings/advanced": "system-settings",
  "/system-settings/agent-config": "system-settings",
  "/system-settings/workbench": "system-settings",
  "/system-settings/remote-desktop": "system-settings",
};

/**
 * Pages that should fill the entire content area without padding/scroll wrapper.
 */
export const FULLSCREEN_PATHS = new Set([
  "/workbench",
  "/workbench/terminal",
  "/workbench/browser",
  "/chat",
  "/remote-desktop",
  "/remote-desktop/desktop",
  "/remote-desktop/phone",
  "/remote-desktop/phone/screen",
  "/remote-desktop/phone/shell",
  "/remote-phone",
]);

/**
 * Pages that provide their own compact mobile header.
 */
export const SELF_HEADER_PATHS = new Set<string>([]);

/** Mobile-only fullscreen pages (custom header + no content padding). */
export const MOBILE_FULLSCREEN_PATHS = new Set<string>([]);

export function isWorkbenchPath(pathname: string): boolean {
  return pathname === "/workbench" || pathname.startsWith("/workbench/");
}

export function isRemoteDesktopPath(pathname: string): boolean {
  return (
    pathname === "/remote-desktop" || pathname.startsWith("/remote-desktop/")
  );
}

export function isPersonalizationPath(pathname: string): boolean {
  return (
    pathname === "/personalization" || pathname.startsWith("/personalization/")
  );
}

export function resolveSelectedKey(pathname: string): string {
  if (pathToKey[pathname]) return pathToKey[pathname];
  if (pathname.startsWith("/chat/")) return "chat";
  if (pathname.startsWith("/personalization/")) return "personalization";
  if (isSystemSettingsNavPath(pathname)) return "system-settings";
  return "";
}

export const routeConfigs: RouteConfig[] = [
  // Chat (handled via ChatWithKey wrapper in MainLayout)
  { path: "/chat", element: null, useWrapper: true },
  { path: "/chat/:agentId", element: null, useWrapper: true },
  { path: "/chat/:agentId/:threadId", element: null, useWrapper: true },

  // Common
  { path: "/experts", element: <ExpertsPage /> },
  { path: "/organization", element: <OrganizationPage /> },
  { path: "/tasks", element: <CronJobsPage /> },
  { path: "/connectors", element: <ConnectorsPage /> },
  { path: "/skill-packages", element: <SkillPackagesPage /> },
  { path: "/knowledge-bases", element: <KnowledgeBasesPage /> },
  { path: "/personalization/*", element: <PersonalizationPage /> },
  {
    path: "/skills",
    element: <RedirectPreserveSearch to="/personalization/skills" />,
  },
  { path: "/token-usage", element: <TokenUsagePage /> },
  { path: "/system-settings/*", element: <SystemSettingsPage /> },

  // Control (RequirePermission via pathPermissionKeys in MainLayout)
  {
    path: "/acp",
    element: <RedirectPreserveSearch to="/system-settings/acp" />,
  },
  {
    path: "/channels",
    element: <RedirectPreserveSearch to="/personalization/channels" />,
  },
  // Workbench (terminal + browser) is keep-alive mounted in MainLayout.
  { path: "/workbench", element: null },
  { path: "/workbench/terminal", element: null },
  { path: "/workbench/browser", element: null },
  {
    path: "/terminal",
    element: <RedirectPreserveSearch to="/workbench/terminal" />,
  },
  {
    path: "/remote-browser",
    element: <RedirectPreserveSearch to="/workbench/browser" />,
  },
  { path: "/remote-desktop", element: <RemoteDesktopPage /> },
  { path: "/remote-desktop/desktop", element: <RemoteDesktopPage /> },
  { path: "/remote-desktop/phone", element: <RemoteDesktopPage /> },
  { path: "/remote-desktop/phone/screen", element: <RemoteDesktopPage /> },
  { path: "/remote-desktop/phone/shell", element: <RemoteDesktopPage /> },
  {
    path: "/remote-phone",
    element: <RedirectPreserveSearch to="/remote-desktop/phone" />,
  },
  {
    path: "/remote-android",
    element: <Navigate to="/remote-desktop/phone" replace />,
  },
  {
    path: "/subagents",
    element: <RedirectPreserveSearch to="/personalization/subagents" />,
  },
  {
    path: "/mbti",
    element: <RedirectPreserveSearch to="/personalization/mbti" />,
  },
  {
    path: "/memory",
    element: <RedirectPreserveSearch to="/personalization/memory" />,
  },
  { path: "/workspace", element: <Navigate to="/experts" replace /> },

  // Settings / admin — folded into System Settings (old URLs still work)
  {
    path: "/admin/models",
    element: <RedirectPreserveSearch to="/system-settings/models" />,
  },
  {
    path: "/admin/users",
    element: <RedirectPreserveSearch to="/system-settings/users" />,
  },
  {
    path: "/admin/sso",
    element: <Navigate to="/system-settings/users?tab=sso" replace />,
  },
  {
    path: "/admin/shared-models",
    element: <Navigate to="/system-settings/models" replace />,
  },
  {
    path: "/models",
    element: <Navigate to="/system-settings/models" replace />,
  },
  {
    path: "/admin/backend",
    element: <RedirectPreserveSearch to="/system-settings/storage" />,
  },
  {
    path: "/admin/audit",
    element: <Navigate to="/system-settings/security?tab=audit" replace />,
  },
  {
    path: "/admin/agents",
    element: <Navigate to="/system-settings/users" replace />,
  },
  {
    path: "/admin/plugins",
    element: <RedirectPreserveSearch to="/system-settings/plugins" />,
  },
  {
    path: "/admin/advanced",
    element: <RedirectPreserveSearch to="/system-settings/advanced" />,
  },
  {
    path: "/admin/security",
    element: <RedirectPreserveSearch to="/system-settings/security" />,
  },
  {
    path: "/admin/voice",
    element: <Navigate to="/system-settings/models?tab=voice" replace />,
  },
  {
    path: "/admin/updates",
    element: <Navigate to="/system-settings/advanced?tab=updates" replace />,
  },

  // Legacy redirects — keeps old bookmarks working
  {
    path: "/admin/storage",
    element: <Navigate to="/system-settings/storage" replace />,
  },
  { path: "/orca/cron", element: <Navigate to="/tasks" replace /> },
  { path: "/orca/channels", element: <Navigate to="/channels" replace /> },
  {
    path: "/orca/admin/users",
    element: <Navigate to="/system-settings/users" replace />,
  },
  {
    path: "/orca/admin/audit",
    element: <Navigate to="/system-settings/security?tab=audit" replace />,
  },
  { path: "/octop/cron", element: <Navigate to="/tasks" replace /> },
  { path: "/octop/channels", element: <Navigate to="/channels" replace /> },
  {
    path: "/octop/admin/users",
    element: <Navigate to="/system-settings/users" replace />,
  },
  {
    path: "/octop/admin/audit",
    element: <Navigate to="/system-settings/security?tab=audit" replace />,
  },
  {
    path: "/advanced-settings",
    element: <Navigate to="/system-settings/advanced" replace />,
  },
  {
    path: "/environments",
    element: <Navigate to="/system-settings/advanced" replace />,
  },
  {
    path: "/agent-config",
    element: <RedirectPreserveSearch to="/system-settings/agent-config" />,
  },
  {
    path: "/updates",
    element: <Navigate to="/system-settings/advanced?tab=updates" replace />,
  },
  {
    path: "/plugins",
    element: <Navigate to="/system-settings/plugins" replace />,
  },
  { path: "/sessions", element: <Navigate to="/chat" replace /> },
  { path: "/cron-jobs", element: <Navigate to="/tasks" replace /> },

  // Misc
  { path: "/pwa-debug", element: <PwaDebugPage /> },
  { path: "/", element: <Navigate to="/chat" replace /> },
  { path: "*", element: <NotFoundPage /> },
];

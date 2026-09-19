import { lazy } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { SYSTEM_SETTINGS_TO_PERSONALIZATION } from "../pages/Agent/Personalization/tabs";
import { isSystemSettingsNavPath } from "../pages/SystemSettings/tabs";
import ChatIndexRedirect from "../layouts/ChatIndexRedirect";
import { resolveWorkspaceNavKey } from "../layouts/conversationHome";

// Lazy-loaded pages — Common
const ExpertsPage = lazy(() => import("../pages/Experts"));
const KnowledgeBasesPage = lazy(() => import("../pages/KnowledgeBases"));
const PersonalizationPage = lazy(
  () => import("../pages/Agent/Personalization"),
);
const TokenUsagePage = lazy(() => import("../pages/Control/TokenUsage"));
const ModelsPage = lazy(() => import("../pages/Settings/Models"));

// Lazy-loaded pages — Control
const RemoteDesktopPage = lazy(() => import("../pages/Control/RemoteDesktop"));

const OrganizationPage = lazy(() => import("../pages/Organization"));
const OrganizationAnnouncementsPage = lazy(
  () => import("../pages/Organization/announcements"),
);
const OrganizationChartPage = lazy(() => import("../pages/Organization/org"));
const OrganizationEmployeesPage = lazy(
  () => import("../pages/Organization/employees"),
);
const OrganizationEmployeeDetailPage = lazy(
  () => import("../pages/Organization/employees/detail"),
);
const OrganizationSkillsPage = lazy(
  () => import("../pages/Organization/skills"),
);
const OrganizationGovernancePage = lazy(
  () => import("../pages/Organization/governance"),
);
const OrganizationKnowledgePage = lazy(
  () => import("../pages/Organization/knowledge"),
);
const OrganizationTasksPage = lazy(() => import("../pages/Organization/tasks"));
const OrganizationTaskDetailPage = lazy(
  () => import("../pages/Organization/tasks/detail"),
);
const OrganizationReflectionsPage = lazy(
  () => import("../pages/Organization/reflections"),
);
const OrganizationSettingsPage = lazy(
  () => import("../pages/Organization/settings"),
);
const OrganizationAgentsPage = lazy(
  () => import("../pages/Organization/agents"),
);
const OrganizationWorkspacePage = lazy(
  () => import("../pages/Organization/workspace"),
);
const ProjectsPage = lazy(() => import("../pages/Projects"));

// Misc
const PwaDebugPage = lazy(() => import("../pages/PwaDebug"));
const NotFoundPage = lazy(() => import("../components/NotFoundPage"));

function RedirectPreserveSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

function TasksToProjects() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("view", "tasks");
  const qs = params.toString();
  return (
    <Navigate to={`/projects${qs ? `?${qs}` : ""}${location.hash}`} replace />
  );
}

function SystemSettingsToPersonalization() {
  const location = useLocation();
  const tab =
    location.pathname.replace(/^\/system-settings\/?/, "").split("/")[0] || "";
  const mapped = SYSTEM_SETTINGS_TO_PERSONALIZATION[tab];
  if (mapped?.startsWith("/")) {
    return (
      <Navigate to={`${mapped}${location.search}${location.hash}`} replace />
    );
  }
  return (
    <Navigate
      to={`/personalization/${mapped || "skills"}${location.search}${
        location.hash
      }`}
      replace
    />
  );
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
  "/organization/announcements": "organization",
  "/organization/org": "organization",
  "/organization/employees": "organization",
  "/organization/skills": "organization",
  "/organization/governance": "organization",
  "/organization/knowledge": "organization",
  "/organization/tasks": "organization",
  "/organization/reflections": "organization",
  "/organization/settings": "organization",
  "/organization/agents": "organization",
  "/organization/workspace": "organization",
  "/projects": "projects",
  "/tasks": "projects",
  "/connectors": "personalization",
  "/skill-packages": "personalization",
  "/knowledge-bases": "knowledge-bases",
  "/models": "models",
  "/acp": "personalization",
  "/personalization": "personalization",
  "/personalization/skills": "personalization",
  "/personalization/tools": "personalization",
  "/personalization/plugins": "personalization",
  "/personalization/subagents": "personalization",
  "/personalization/channels": "personalization",
  "/personalization/connectors": "personalization",
  "/personalization/skill-packages": "personalization",
  "/personalization/mbti": "personalization",
  "/personalization/memory": "personalization",
  "/personalization/workbench": "personalization",
  "/personalization/remote-desktop": "personalization",
  "/personalization/acp": "personalization",
  "/personalization/users": "personalization",
  "/personalization/storage": "personalization",
  "/personalization/host-plugins": "personalization",
  "/personalization/security": "personalization",
  "/personalization/advanced": "personalization",
  "/personalization/agent-config": "personalization",
  "/skills": "personalization",
  "/token-usage": "token-usage",
  "/agent-config": "personalization",
  "/system-settings": "personalization",
  // Control
  "/channels": "personalization",
  "/workbench": "personalization",
  "/workbench/terminal": "personalization",
  "/workbench/browser": "personalization",
  "/terminal": "personalization",
  "/remote-browser": "personalization",
  "/remote-desktop": "personalization",
  "/remote-desktop/desktop": "personalization",
  "/remote-desktop/phone": "personalization",
  "/remote-desktop/phone/screen": "personalization",
  "/remote-desktop/phone/shell": "personalization",
  "/remote-phone": "personalization",
  "/remote-android": "personalization",
  "/subagents": "personalization",
  "/mbti": "personalization",
  "/memory": "personalization",
  // Admin
  "/admin/models": "models",
  "/admin/users": "personalization",
  "/admin/backend": "personalization",
  "/admin/plugins": "personalization",
  "/admin/advanced": "personalization",
  "/admin/security": "personalization",
  "/system-settings/acp": "personalization",
  "/system-settings/users": "personalization",
  "/system-settings/models": "models",
  "/system-settings/storage": "personalization",
  "/system-settings/plugins": "personalization",
  "/system-settings/security": "personalization",
  "/system-settings/advanced": "personalization",
  "/system-settings/agent-config": "personalization",
  "/system-settings/workbench": "personalization",
  "/system-settings/remote-desktop": "personalization",
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

export function resolveSelectedKey(pathname: string, search = ""): string {
  const workspaceKey = resolveWorkspaceNavKey(pathname, search);
  if (workspaceKey) return workspaceKey;
  if (pathToKey[pathname]) return pathToKey[pathname];
  if (pathname.startsWith("/organization/")) return "organization";
  if (pathname.startsWith("/personalization/")) return "personalization";
  if (pathname === "/models" || pathname.startsWith("/models/"))
    return "models";
  if (isSystemSettingsNavPath(pathname)) {
    if (pathname.includes("/models")) return "models";
    return "personalization";
  }
  return "";
}

export const routeConfigs: RouteConfig[] = [
  // Chat canvas; bare /chat deep-links to the shared workspace 对话 list
  { path: "/chat", element: <ChatIndexRedirect /> },
  { path: "/chat/:agentId", element: null, useWrapper: true },
  { path: "/chat/:agentId/:threadId", element: null, useWrapper: true },

  // Common
  { path: "/experts", element: <ExpertsPage /> },
  { path: "/organization", element: <OrganizationPage /> },
  {
    path: "/organization/announcements",
    element: <OrganizationAnnouncementsPage />,
  },
  {
    path: "/organization/org",
    element: <OrganizationChartPage />,
  },
  {
    path: "/organization/employees",
    element: <OrganizationEmployeesPage />,
  },
  {
    path: "/organization/employees/:id",
    element: <OrganizationEmployeeDetailPage />,
  },
  {
    path: "/organization/skills",
    element: <OrganizationSkillsPage />,
  },
  {
    path: "/organization/governance",
    element: <OrganizationGovernancePage />,
  },
  {
    path: "/organization/knowledge",
    element: <OrganizationKnowledgePage />,
  },
  {
    path: "/organization/tasks",
    element: <OrganizationTasksPage />,
  },
  {
    path: "/organization/tasks/:id",
    element: <OrganizationTaskDetailPage />,
  },
  {
    path: "/organization/reflections",
    element: <OrganizationReflectionsPage />,
  },
  {
    path: "/organization/settings",
    element: <OrganizationSettingsPage />,
  },
  {
    path: "/organization/agents",
    element: <OrganizationAgentsPage />,
  },
  {
    path: "/organization/workspace",
    element: <OrganizationWorkspacePage />,
  },
  { path: "/projects", element: <ProjectsPage /> },
  { path: "/tasks", element: <TasksToProjects /> },
  {
    path: "/connectors",
    element: <RedirectPreserveSearch to="/personalization/connectors" />,
  },
  {
    path: "/skill-packages",
    element: <RedirectPreserveSearch to="/personalization/skill-packages" />,
  },
  { path: "/knowledge-bases", element: <KnowledgeBasesPage /> },
  { path: "/personalization/*", element: <PersonalizationPage /> },
  {
    path: "/skills",
    element: <RedirectPreserveSearch to="/personalization/skills" />,
  },
  { path: "/token-usage", element: <TokenUsagePage /> },
  { path: "/models", element: <ModelsPage /> },
  { path: "/system-settings/*", element: <SystemSettingsToPersonalization /> },

  // Control (RequirePermission via pathPermissionKeys in MainLayout)
  {
    path: "/acp",
    element: <RedirectPreserveSearch to="/personalization/acp" />,
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
    element: <RedirectPreserveSearch to="/models" />,
  },
  {
    path: "/admin/users",
    element: <RedirectPreserveSearch to="/personalization/users" />,
  },
  {
    path: "/admin/sso",
    element: <Navigate to="/personalization/users?tab=sso" replace />,
  },
  {
    path: "/admin/shared-models",
    element: <Navigate to="/models" replace />,
  },
  {
    path: "/admin/backend",
    element: <RedirectPreserveSearch to="/personalization/storage" />,
  },
  {
    path: "/admin/audit",
    element: <Navigate to="/personalization/security?tab=audit" replace />,
  },
  {
    path: "/admin/agents",
    element: <Navigate to="/personalization/users" replace />,
  },
  {
    path: "/admin/plugins",
    element: <RedirectPreserveSearch to="/personalization/host-plugins" />,
  },
  {
    path: "/admin/advanced",
    element: <RedirectPreserveSearch to="/personalization/advanced" />,
  },
  {
    path: "/admin/security",
    element: <RedirectPreserveSearch to="/personalization/security" />,
  },
  {
    path: "/admin/voice",
    element: <Navigate to="/models?tab=voice" replace />,
  },
  {
    path: "/admin/updates",
    element: <Navigate to="/personalization/advanced?tab=updates" replace />,
  },

  // Legacy redirects — keeps old bookmarks working
  {
    path: "/admin/storage",
    element: <Navigate to="/personalization/storage" replace />,
  },
  {
    path: "/orca/cron",
    element: <Navigate to="/projects?view=tasks" replace />,
  },
  { path: "/orca/channels", element: <Navigate to="/channels" replace /> },
  {
    path: "/orca/admin/users",
    element: <Navigate to="/personalization/users" replace />,
  },
  {
    path: "/orca/admin/audit",
    element: <Navigate to="/personalization/security?tab=audit" replace />,
  },
  {
    path: "/octop/cron",
    element: <Navigate to="/projects?view=tasks" replace />,
  },
  { path: "/octop/channels", element: <Navigate to="/channels" replace /> },
  {
    path: "/octop/admin/users",
    element: <Navigate to="/personalization/users" replace />,
  },
  {
    path: "/octop/admin/audit",
    element: <Navigate to="/personalization/security?tab=audit" replace />,
  },
  {
    path: "/advanced-settings",
    element: <Navigate to="/personalization/advanced" replace />,
  },
  {
    path: "/environments",
    element: <Navigate to="/personalization/advanced" replace />,
  },
  {
    path: "/agent-config",
    element: <RedirectPreserveSearch to="/personalization/agent-config" />,
  },
  {
    path: "/updates",
    element: <Navigate to="/personalization/advanced?tab=updates" replace />,
  },
  {
    path: "/plugins",
    element: <Navigate to="/personalization/host-plugins" replace />,
  },
  { path: "/sessions", element: <Navigate to="/projects" replace /> },
  { path: "/cron-jobs", element: <Navigate to="/tasks" replace /> },

  // Misc
  { path: "/pwa-debug", element: <PwaDebugPage /> },
  { path: "/", element: <Navigate to="/projects" replace /> },
  { path: "*", element: <NotFoundPage /> },
];

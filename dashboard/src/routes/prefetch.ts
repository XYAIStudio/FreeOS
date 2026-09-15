/** Map sidebar paths to their lazy route chunks for hover prefetch. */
const ROUTE_PREFETCHERS: Record<string, () => Promise<unknown>> = {
  "/chat": () => import("../pages/Chat"),
  "/experts": () => import("../pages/Experts"),
  "/tasks": () => import("../pages/Control/CronJobs"),
  "/connectors": () => import("../pages/Agent/Connectors"),
  "/skill-packages": () => import("../pages/SkillPackages"),
  "/knowledge-bases": () => import("../pages/KnowledgeBases"),
  "/skills": () => import("../pages/Agent/Personalization"),
  "/token-usage": () => import("../pages/Control/TokenUsage"),
  "/channels": () => import("../pages/Agent/Personalization"),
  "/workbench": () => import("../pages/Control/Workbench"),
  "/workbench/browser": () => import("../pages/Control/Workbench"),
  "/workbench/terminal": () => import("../pages/Control/Workbench"),
  "/remote-desktop": () => import("../pages/Control/RemoteDesktop"),
  "/remote-desktop/desktop": () => import("../pages/Control/RemoteDesktop"),
  "/remote-desktop/phone": () => import("../pages/Control/RemoteDesktop"),
  "/remote-phone": () => import("../pages/Control/RemoteDesktop"),
  "/remote-android": () => import("../pages/Control/RemoteDesktop"),
  "/acp": () => import("../pages/SystemSettings"),
  "/system-settings": () => import("../pages/SystemSettings"),
  "/personalization": () => import("../pages/Agent/Personalization"),
  "/personalization/skills": () => import("../pages/Agent/Personalization"),
  "/personalization/tools": () => import("../pages/Agent/Personalization"),
  "/personalization/subagents": () => import("../pages/Agent/Personalization"),
  "/personalization/channels": () => import("../pages/Agent/Personalization"),
  "/personalization/mbti": () => import("../pages/Agent/Personalization"),
  "/personalization/memory": () => import("../pages/Agent/Personalization"),
  "/subagents": () => import("../pages/Agent/Personalization"),
  "/mbti": () => import("../pages/Agent/Personalization"),
  "/memory": () => import("../pages/Agent/Personalization"),
  "/admin/models": () => import("../pages/SystemSettings"),
  "/admin/users": () => import("../pages/SystemSettings"),
  "/admin/backend": () => import("../pages/SystemSettings"),
  "/admin/plugins": () => import("../pages/SystemSettings"),
  "/admin/security": () => import("../pages/SystemSettings"),
  "/admin/advanced": () => import("../pages/SystemSettings"),
  "/agent-config": () => import("../pages/SystemSettings"),
};

export function prefetchRoute(path: string): void {
  const load = ROUTE_PREFETCHERS[path];
  if (load) void load();
}

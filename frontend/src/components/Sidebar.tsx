import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Building2, MessageSquare, ListTodo, Target, DollarSign, BarChart3, Brain, Package, BookOpen, Settings, ChevronLeft, Activity, Gauge, Shield, Workflow, Users, ShieldCheck, FileText, Landmark, HardHat, Megaphone, Clock, Receipt, BookMarked } from "lucide-react";
import { useAuthStore } from "../stores/auth";
import { useModuleSettingsStore } from "../stores/modules";
import type { TenantModuleKey } from "../config/modules";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
  moduleKey?: TenantModuleKey;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
  comingSoon?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { path: "/", icon: LayoutDashboard, label: "工作台" },
  { path: "/announcements", icon: Megaphone, label: "通知公告", moduleKey: "announcements" },
  { path: "/org", icon: Building2, label: "组织架构", moduleKey: "organization" },
  { path: "/employees", icon: Users, label: "员工管理", moduleKey: "employees" },
  { path: "/skills", icon: Package, label: "技能插件", moduleKey: "skills" },
  { path: "/chat", icon: MessageSquare, label: "沟通协作", moduleKey: "chat" },
  { path: "/tasks", icon: ListTodo, label: "任务管理", moduleKey: "tasks" },
  { path: "/workflows", icon: Workflow, label: "流程管理", moduleKey: "workflows" },
  { path: "/contracts", icon: FileText, label: "合同管理", moduleKey: "contracts" },
  { path: "", icon: HardHat, label: "工程管理", comingSoon: true },
  { path: "/assets", icon: Landmark, label: "资产管理", moduleKey: "assets" },
  { path: "/attendance", icon: Clock, label: "考勤管理", moduleKey: "attendance" },
  { path: "/expense", icon: Receipt, label: "费用报销", moduleKey: "expenses" },
  { path: "/daily-report", icon: BookMarked, label: "工作记录", moduleKey: "work_records" },
  { path: "/goals", icon: Target, label: "目标管理", moduleKey: "goals" },
  { path: "/budgets", icon: DollarSign, label: "预算管理", moduleKey: "budgets" },
  { path: "/performance", icon: BarChart3, label: "绩效评估", moduleKey: "performance" },
  { path: "/efficiency", icon: Gauge, label: "效能仪表板", moduleKey: "efficiency" },
  { path: "/reflections", icon: Brain, label: "反思引擎", moduleKey: "reflections" },
  { path: "/knowledge", icon: BookOpen, label: "知识库", moduleKey: "knowledge" },
];

const BOTTOM_NAV: NavItem[] = [
  { path: "/governance", icon: Shield, label: "治理引擎", moduleKey: "governance", requireAdmin: true },
  { path: "/audit", icon: Activity, label: "审计追溯", moduleKey: "audit", requireSuperAdmin: true },
  { path: "/admin", icon: ShieldCheck, label: "管理控制台", requireSuperAdmin: true },
  { path: "/settings", icon: Settings, label: "系统设置", requireAdmin: true },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
}

export default function Sidebar({ collapsed, mobileOpen, onToggle, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const modules = useModuleSettingsStore(state => state.modules);

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const isSuperAdmin = user?.role === "super_admin";

  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile for responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && !collapsed) {
        onToggle();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [collapsed, onToggle]);

  // On mobile, always show text regardless of collapsed state
  const showText = !collapsed || isMobile;

  // Close mobile drawer on navigation
  const handleNav = (path: string, comingSoon?: boolean) => {
    if (comingSoon) {
      alert("该模块正在开发中，敬请期待");
      return;
    }
    navigate(path);
    if (window.innerWidth < 768) onMobileClose();
  };

  const widthClass = collapsed ? "w-56 md:w-16" : "w-56 md:w-56";

  const sidebarContent = (
    <aside className={`relative flex flex-col ${widthClass} h-screen bg-bg-card border-r border-border shrink-0 transition-all duration-200`}>
      {/* Collapse toggle - desktop only */}
      <button onClick={onToggle}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-bg-card border border-border items-center justify-center text-text-muted hover:text-primary hover:border-primary z-20 shadow-sm transition-colors"
        title={collapsed ? "展开侧边栏" : "折叠侧边栏"}>
        <ChevronLeft size={12} className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
      </button>

      <div className={`flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-4"} py-3 border-b border-border`}>
        <div className="w-10 h-10 rounded bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">XY</div>
        {showText && (
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-text truncate">雄元智脑XYOS</h1>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-auto">
        {MAIN_NAV.map((item) => {
          if (item.moduleKey && !modules[item.moduleKey]) return null;
          const active = item.path && (item.path === "/" ? location.pathname === "/" : location.pathname === item.path || location.pathname.startsWith(item.path));
          return (
            <button key={item.label} onClick={() => handleNav(item.path, item.comingSoon)}
              className={`w-full flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2 rounded text-sm transition-all ${active ? "bg-primary text-white shadow-sm" : "text-text-muted hover:bg-bg hover:text-text"}`}
              title={collapsed ? item.label : undefined}>
              <item.icon size={16} className="shrink-0" />
              {showText && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="px-2 pb-3 space-y-1">
        {BOTTOM_NAV.map((item) => {
          if (item.moduleKey && !modules[item.moduleKey]) return null;
          if (item.requireSuperAdmin && !isSuperAdmin) return null;
          if (item.requireAdmin && !isAdmin) return null;
          const active = location.pathname === item.path;
          return (
            <button key={item.path} onClick={() => handleNav(item.path)}
              className={`w-full flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2 rounded text-sm transition-all ${active ? "bg-primary text-white shadow-sm" : "text-text-muted hover:bg-bg hover:text-text"}`}
              title={collapsed ? item.label : undefined}>
              <item.icon size={16} className="shrink-0" />
              {showText && <span>{item.label}</span>}
              {showText && isSuperAdmin && item.path === "/settings" && <span className="ml-auto text-[9px] px-2 py-1 rounded bg-red-100 text-red-600 font-medium">SA</span>}
            </button>
          );
        })}
      </div>

      {user && (
        <div className={`${collapsed ? "px-2" : "px-3"} py-3 border-t border-border`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
            <div className={`w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold shrink-0 ${user.role === "super_admin" ? "bg-red-500" : user.role === "admin" ? "bg-orange-500" : "bg-primary"}`}
              title={collapsed ? user.nickname : undefined}>
              {user.nickname?.[0] || "U"}
            </div>
            {showText && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{user.nickname}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{user.role === "super_admin" ? "超级管理员" : user.role === "admin" ? "管理员" : "用户"}</p>
                </div>
                <button onClick={logout} className="text-text-muted hover:text-danger text-xs px-2 py-1 rounded hover:bg-bg" title="退出">⏻</button>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <>
      {/* Mobile overlay drawer */}
      <div className={`md:hidden fixed inset-y-0 left-0 z-50 w-56 transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarContent}
      </div>
      {/* Desktop inline sidebar */}
      <div className="hidden md:block shrink-0">
        {sidebarContent}
      </div>
    </>
  );
}

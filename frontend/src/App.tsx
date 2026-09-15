import { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "./stores/auth";
import { authFetch } from "./api/authFetch";
import { useThemeStore } from "./stores/theme";
import { useModuleSettingsStore } from "./stores/modules";
import type { TenantModuleKey } from "./config/modules";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Footer from "./components/Footer";

// 非登录页面（首屏不需要懒加载）
import AuthPage from "./pages/AuthPage";
import DemoPage from "./pages/OpenHomePage";
import UserAgreementPage from "./pages/UserAgreementPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";

// 登录后页面按路由懒加载
const Dashboard = lazy(() => import("./pages/Dashboard"));
const OrgChart = lazy(() => import("./pages/OrgChart"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const TaskDetailPage = lazy(() => import("./pages/TaskDetailPage"));
const GoalPage = lazy(() => import("./pages/GoalPage"));
const BudgetPage = lazy(() => import("./pages/BudgetPage"));
const RoutinePage = lazy(() => import("./pages/RoutinePage"));
const PerformancePage = lazy(() => import("./pages/PerformancePage"));
const ReflectionPage = lazy(() => import("./pages/ReflectionPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));
const EmployeeDetailPage = lazy(() => import("./pages/EmployeeDetailPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const AuditTrailPage = lazy(() => import("./pages/AuditTrailPage"));
const EfficiencyDashboard = lazy(() => import("./pages/EfficiencyDashboard"));
const GovernancePage = lazy(() => import("./pages/GovernancePage"));
const WorkflowPage = lazy(() => import("./pages/WorkflowPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ContractPage = lazy(() => import("./pages/ContractPage"));
const AssetPage = lazy(() => import("./pages/AssetPage"));
const AssetDetailPage = lazy(() => import("./pages/AssetDetailPage"));
const AssetCountPage = lazy(() => import("./pages/AssetCountPage"));
const AssetDashboard = lazy(() => import("./pages/AssetDashboard"));
const AssetVehicleExpensePage = lazy(() => import("./pages/AssetVehicleExpensePage"));
const AssetProcurementPage = lazy(() => import("./pages/AssetProcurementPage"));
const AnnouncementPage = lazy(() => import("./pages/AnnouncementPage"));
const CustomerServicePage = lazy(() => import("./pages/CustomerServicePage"));
const ElectricityMarketPage = lazy(() => import("./pages/ElectricityMarketPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const LeavePage = lazy(() => import("./pages/LeavePage"));
const ExpensePage = lazy(() => import("./pages/ExpensePage"));
const DailyReportPage = lazy(() => import("./pages/DailyReportPage"));

const MODULE_ROUTES: Array<{ prefix: string; moduleKey: TenantModuleKey }> = [
  { prefix: "/announcements", moduleKey: "announcements" },
  { prefix: "/org", moduleKey: "organization" },
  { prefix: "/employees", moduleKey: "employees" },
  { prefix: "/skills", moduleKey: "skills" },
  { prefix: "/chat", moduleKey: "chat" },
  { prefix: "/tasks", moduleKey: "tasks" },
  { prefix: "/workflows", moduleKey: "workflows" },
  { prefix: "/contracts", moduleKey: "contracts" },
  { prefix: "/assets", moduleKey: "assets" },
  { prefix: "/attendance", moduleKey: "attendance" },
  { prefix: "/leave", moduleKey: "attendance" },
  { prefix: "/expense", moduleKey: "expenses" },
  { prefix: "/daily-report", moduleKey: "work_records" },
  { prefix: "/goals", moduleKey: "goals" },
  { prefix: "/budgets", moduleKey: "budgets" },
  { prefix: "/performance", moduleKey: "performance" },
  { prefix: "/efficiency", moduleKey: "efficiency" },
  { prefix: "/reflections", moduleKey: "reflections" },
  { prefix: "/knowledge", moduleKey: "knowledge" },
  { prefix: "/governance", moduleKey: "governance" },
  { prefix: "/audit", moduleKey: "audit" },
];

function moduleForPath(pathname: string): TenantModuleKey | undefined {
  return MODULE_ROUTES.find(route => pathname === route.prefix || pathname.startsWith(route.prefix + "/"))?.moduleKey;
}

/** 懒加载包装器 */
function LazyFallback() {
  return <div className="flex items-center justify-center h-40 text-text-muted animate-[pulse_1.5s_infinite]">加载中...</div>;
}

export default function App() {
  const { user, loading, init } = useAuthStore();
  const { init: initTheme } = useThemeStore();
  const modules = useModuleSettingsStore(state => state.modules);
  const moduleTenantId = useModuleSettingsStore(state => state.tenantId);
  const moduleError = useModuleSettingsStore(state => state.error);
  const loadModules = useModuleSettingsStore(state => state.load);
  const resetModules = useModuleSettingsStore(state => state.reset);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { init(); initTheme(); }, [init, initTheme]);

  useEffect(() => {
    if (user) void loadModules();
    else resetModules();
  }, [user?.tenant_id, loadModules, resetModules]);

  // Page view tracking
  useEffect(() => {
    if (user) {
      authFetch("/api/admin/visitor-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "page_view",
          tenant_id: user.tenant_id,
          user_id: user.id,
          page_path: location.pathname,
          referrer: document.referrer || null,
        }),
      }).catch(() => {});
    }
  }, [location.pathname, user]);

  if (loading || (user && !moduleError && moduleTenantId !== user.tenant_id)) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="text-text-muted animate-[pulse_1.5s_infinite]">加载中...</div>
      </div>
    );
  }

  if (user && moduleError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 bg-bg text-text">
        <p className="text-sm font-medium">模块配置加载失败</p>
        <p className="text-xs text-text-muted">{moduleError}</p>
        <button onClick={() => void loadModules()} className="px-4 py-2 text-sm rounded bg-primary text-white">重新加载</button>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<DemoPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/user-agreement" element={<UserAgreementPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const requiredModule = moduleForPath(location.pathname);
  if (requiredModule && !modules[requiredModule]) return <Navigate to="/" replace />;

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Mobile backdrop overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileSidebarOpen(false)} />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        <main className="flex-1 overflow-auto bg-bg">
          <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/org" element={<OrgChart />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
            <Route path="/goals" element={<GoalPage />} />
            <Route path="/budgets" element={<BudgetPage />} />
            <Route path="/routines" element={<RoutinePage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/reflections" element={<ReflectionPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/audit" element={user.role === "super_admin" ? <Suspense fallback={<LazyFallback />}><AuditTrailPage /></Suspense> : <Navigate to="/" replace />} />
            <Route path="/efficiency" element={<EfficiencyDashboard />} />
            <Route path="/governance" element={user.role !== "user" ? <Suspense fallback={<LazyFallback />}><GovernancePage /></Suspense> : <Navigate to="/" replace />} />
            <Route path="/workflows" element={<WorkflowPage />} />
            <Route path="/announcements" element={<AnnouncementPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/expense" element={<ExpensePage />} />
            <Route path="/daily-report" element={<DailyReportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/contracts" element={<ContractPage />} />
            <Route path="/assets" element={<Suspense fallback={<LazyFallback />}><AssetPage /></Suspense>} />
            <Route path="/assets/count" element={<Suspense fallback={<LazyFallback />}><AssetCountPage /></Suspense>} />
            <Route path="/assets/dashboard" element={<Suspense fallback={<LazyFallback />}><AssetDashboard /></Suspense>} />
            <Route path="/assets/vehicles" element={<Suspense fallback={<LazyFallback />}><AssetVehicleExpensePage /></Suspense>} />
            <Route path="/assets/procurement" element={<Suspense fallback={<LazyFallback />}><AssetProcurementPage /></Suspense>} />
            <Route path="/assets/:id" element={<Suspense fallback={<LazyFallback />}><AssetDetailPage /></Suspense>} />
            <Route path="/admin" element={user.role === "super_admin" ? <Suspense fallback={<LazyFallback />}><AdminPage /></Suspense> : <Navigate to="/" replace />} />
            <Route path="/customers" element={<Suspense fallback={<LazyFallback />}><CustomerServicePage /></Suspense>} />
            <Route path="/electricity" element={<Suspense fallback={<LazyFallback />}><ElectricityMarketPage /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
}

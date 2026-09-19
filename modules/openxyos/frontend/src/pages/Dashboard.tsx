import { useEffect, useState } from "react";
import {
  Users, Building2, Package, MessageSquare, ListTodo, TrendingUp, Activity,
  FileText, Landmark, Target, DollarSign, Workflow, BarChart3,
  Gauge, BookOpen, Brain, Shield, Search, ArrowRight, Bot, Clock, ChevronRight,
} from "lucide-react";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";
import { useNavigate } from "react-router-dom";
import { useLocale } from "../i18n";

interface ModuleData {
  org: { departments: number; totalEmployees: number; aiEmployees: number; humanEmployees: number };
  skills: { skills: number; plugins: number; talent: number };
  chat: { chats: number; messages: number };
  tasks: { total: number; todo: number; in_progress: number; review: number; done: number; completionRate: number };
  contracts: { total: number; active: number; activeValue: number; paymentsOverdue: number };
  assets: { total: number; totalValue: number; inUse: number; idle: number; alerts: number };
  goals: { total: number; active: number; completed: number };
  budgets: { total: number; totalAmount: number };
  workflows: { total: number; active: number };
  performance: { reviews: number; avgScore: number };
  efficiency: { routines: number; active: number };
  knowledge: { notes: number };
  reflections: { total: number };
  governance: { rules: number };
  audit: { logs: number };
}

interface ActivitiesItem {
  action?: string; details?: string;
  user_name?: string; employee_name?: string;
  created_at?: string;
}

interface PerformanceItem {
  id: number; name: string; role: string; avatar_emoji: string;
  employee_type: string; completed: number; active: number; total: number;
}

function fmtCurrency(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + "万";
  return v.toLocaleString();
}

function fmtValue(v: number): string {
  if (v >= 100000000) return (v / 100000000).toFixed(1) + "亿";
  if (v >= 10000) return (v / 10000).toFixed(1) + "万";
  return v.toLocaleString();
}

function ModuleCard({
  icon: Icon, title, path, color, bg, metrics, alert,
}: {
  icon: any; title: string; path: string; color: string; bg: string;
  metrics: { label: string; value: string | number; highlight?: boolean }[];
  alert?: number;
}) {
  const nav = useNavigate();
  return (
    <div
      onClick={() => nav(path)}
      className="group bg-bg-card border border-border rounded-lg px-4 py-3.5 cursor-pointer
        hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5
        transition-all duration-200 relative overflow-hidden"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-xs font-semibold text-text flex-1">{title}</span>
        <ChevronRight size={14} className="text-text-muted/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
        {alert != null && alert > 0 && (
          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-danger text-white text-[10px] flex items-center justify-center font-bold animate-[pulse_2s_infinite]">{alert}</span>
        )}
      </div>
      <div className="space-y-1">
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">{m.label}</span>
            <span className={`font-semibold ${m.highlight ? "text-primary" : "text-text"}`}>{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const { t, locale, isEnglish } = useLocale();
  const [modules, setModules] = useState<ModuleData | null>(null);
  const [activities, setActivities] = useState<ActivitiesItem[]>([]);
  const [performance, setPerformance] = useState<PerformanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modRes, actRes, perfRes] = await Promise.all([
          authFetch("/api/dashboard/modules").then(r => r.json()),
          authFetch("/api/dashboard/activities?limit=5").then(r => r.json()),
          authFetch("/api/dashboard/employee-performance").then(r => r.json()),
        ]);
        if (modRes.success) setModules(modRes.data);
        if (actRes.success) setActivities(actRes.data);
        if (perfRes.success) setPerformance(perfRes.data);
      } catch { /* silent */ }
      setLoading(false);
    };
    fetchData();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 6 ? t("夜深了", "Good night") : hour < 12 ? t("早上好", "Good morning") : hour < 18 ? t("下午好", "Good afternoon") : t("晚上好", "Good evening");

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-text-muted">
      <Activity size={20} className="animate-spin mr-2" />{t("加载中...", "Loading...")}
    </div>
  );

  const m = modules;
  if (!m) return <div className="p-5 text-text-muted text-sm">{t("数据加载失败，请刷新页面", "Unable to load data. Refresh the page.")}</div>;

  const displayCurrency = (value: number) => isEnglish ? new Intl.NumberFormat("en-US", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value) : "¥" + fmtCurrency(value);

  const topPerformers = performance
    .filter(e => e.employee_type === "ai")
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  return (
    <div className="p-4 md:p-5 max-w-[1440px] mx-auto space-y-4 animate-[fadeIn_0.3s_ease]">
      {/* === Greeting Banner === */}
      <section className="bg-bg-card border border-border px-5 py-4 rounded-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded bg-primary-bg text-primary text-[10px] font-semibold border border-primary-light">{t("系统", "System")}</span>
              <span className="flex items-center gap-1 text-text-muted text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-[pulse_2s_infinite]" />{t("运行中", "Running")}
              </span>
            </div>
            <h1 className="text-lg font-bold text-text">{greeting}{locale === "en" ? ", " : "，"}{user?.nickname || t("用户", "User")}</h1>
            <p className="text-xs text-text-muted mt-0.5">
              {t("AI赋能下的人机共融企业管理效能增强管理系统 · ", "AI-native human-machine organizational workspace · ")}{m.org.aiEmployees}{t("位AI员工正在为您工作", " AI employees are working for you")}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center"><div className="text-xl font-bold text-primary">{m.org.totalEmployees}</div><div className="text-[10px] text-text-muted">{t("总员工", "Total employees")}</div></div>
            <div className="text-center"><div className="text-xl font-bold text-success">{m.tasks.done}</div><div className="text-[10px] text-text-muted">{t("已完成任务", "Completed tasks")}</div></div>
            <div className="text-center"><div className="text-xl font-bold text-accent">{m.tasks.completionRate}%</div><div className="text-[10px] text-text-muted">{t("完成率", "Completion rate")}</div></div>
          </div>
        </div>
      </section>

      {/* === Module Cockpit Grid === */}
      <div className="space-y-3">
        {/* Row 1: 组织人事 */}
        <div>
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">{t("组织人事", "Organization & people")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <ModuleCard
              icon={Building2} title={t("组织架构", "Organization")} path="/org"
              color="#0033FF" bg="#F1F5FF"
              metrics={[
                { label: t("部门数", "Departments"), value: m.org.departments },
                { label: t("总员工", "Total employees"), value: m.org.totalEmployees, highlight: true },
                { label: t("AI员工", "AI employees"), value: m.org.aiEmployees },
              ]}
            />
            <ModuleCard
              icon={Users} title={t("员工管理", "People")} path="/employees"
              color="#3A5FE0" bg="#EEF2FF"
              metrics={[
                { label: t("人类员工", "Human employees"), value: m.org.humanEmployees },
                { label: t("AI员工", "AI employees"), value: m.org.aiEmployees },
                { label: t("在职率", "Active rate"), value: Math.round((m.org.totalEmployees / (m.org.totalEmployees + 1)) * 100) + "%" },
              ]}
            />
            <ModuleCard
              icon={BarChart3} title={t("绩效评估", "Performance")} path="/performance"
              color="#4B74FA" bg="#E8EEFF"
              metrics={[
                { label: t("评估次数", "Reviews"), value: m.performance.reviews },
                { label: t("均分", "Average score"), value: m.performance.avgScore + (isEnglish ? "" : "分"), highlight: true },
                { label: t("上次周期", "Latest cycle"), value: "2026-Q2" },
              ]}
            />
            <ModuleCard
              icon={Package} title={t("技能插件", "Skills & plugins")} path="/skills"
              color="#0F5BD8" bg="#EFF6FF"
              metrics={[
                { label: t("技能库", "Skills"), value: m.skills.skills },
                { label: t("插件", "Plugins"), value: m.skills.plugins },
                { label: t("人才池", "Talent pool"), value: m.skills.talent, highlight: true },
              ]}
            />
          </div>
        </div>

        {/* Row 2: 协同办公 */}
        <div>
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">{t("协同办公", "Collaboration")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <ModuleCard
              icon={ListTodo} title={t("任务管理", "Tasks")} path="/tasks"
              color="#0033FF" bg="#F1F5FF"
              metrics={[
                { label: t("待办", "To do"), value: m.tasks.todo },
                { label: t("进行中", "In progress"), value: m.tasks.in_progress },
                { label: t("已完成", "Completed"), value: m.tasks.done, highlight: true },
                { label: t("完成率", "Completion"), value: m.tasks.completionRate + "%" },
              ]}
            />
            <ModuleCard
              icon={MessageSquare} title={t("沟通协作", "Collaboration")} path="/chat"
              color="#3A5FE0" bg="#EEF2FF"
              metrics={[
                { label: t("群聊", "Groups"), value: m.chat.chats },
                { label: t("消息", "Messages"), value: fmtValue(m.chat.messages), highlight: true },
              ]}
            />
            <ModuleCard
              icon={Workflow} title={t("流程管理", "Workflows")} path="/workflows"
              color="#4B74FA" bg="#E8EEFF"
              metrics={[
                { label: t("流程总数", "Workflows"), value: m.workflows.total },
                { label: t("运行中", "Active"), value: m.workflows.active, highlight: true },
              ]}
            />
            <ModuleCard
              icon={Target} title={t("目标管理", "Goals")} path="/goals"
              color="#0F5BD8" bg="#EFF6FF"
              metrics={[
                { label: t("总目标", "Total goals"), value: m.goals.total },
                { label: t("进行中", "In progress"), value: m.goals.active },
                { label: t("已完成", "Completed"), value: m.goals.completed, highlight: true },
              ]}
            />
          </div>
        </div>

        {/* Row 3: 资源管理 */}
        <div>
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">{t("资源管理", "Resources")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <ModuleCard
              icon={Landmark} title={t("资产管理", "Assets")} path="/assets"
              color="#0033FF" bg="#F1F5FF"
              metrics={[
                { label: t("总资产", "Total assets"), value: isEnglish ? `${m.assets.total} assets` : m.assets.total + "件" },
                { label: t("在用", "In use"), value: m.assets.inUse },
                { label: t("闲置", "Idle"), value: m.assets.idle },
                { label: t("资产总值", "Asset value"), value: displayCurrency(m.assets.totalValue), highlight: true },
              ]}
              alert={m.assets.alerts > 0 ? m.assets.alerts : undefined}
            />
            <ModuleCard
              icon={FileText} title={t("合同管理", "Contracts")} path="/contracts"
              color="#3A5FE0" bg="#EEF2FF"
              metrics={[
                { label: t("合同总数", "Total contracts"), value: m.contracts.total },
                { label: t("生效中", "Active"), value: m.contracts.active, highlight: true },
                { label: t("合同价值", "Contract value"), value: displayCurrency(m.contracts.activeValue) },
              ]}
              alert={m.contracts.paymentsOverdue > 0 ? m.contracts.paymentsOverdue : undefined}
            />
            <ModuleCard
              icon={DollarSign} title={t("预算管理", "Budgets")} path="/budgets"
              color="#4B74FA" bg="#E8EEFF"
              metrics={[
                { label: t("预算项", "Budget items"), value: m.budgets.total },
                { label: t("总预算", "Total budget"), value: displayCurrency(m.budgets.totalAmount), highlight: true },
              ]}
            />
            <ModuleCard
              icon={Gauge} title={t("效能仪表板", "Efficiency")} path="/efficiency"
              color="#0F5BD8" bg="#EFF6FF"
              metrics={[
                { label: t("例行事务", "Routines"), value: m.efficiency.routines, highlight: true },
                { label: t("已启用", "Enabled"), value: m.efficiency.active },
                { label: t("启用率", "Enabled rate"), value: m.efficiency.routines > 0 ? Math.round((m.efficiency.active / m.efficiency.routines) * 100) + "%" : "0%" },
              ]}
            />
          </div>
        </div>

        {/* Row 4: 智能分析 & 系统管理 */}
        <div>
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">{t("智能分析与系统", "Intelligence & system")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <ModuleCard
              icon={BookOpen} title={t("知识库", "Knowledge base")} path="/knowledge"
              color="#0033FF" bg="#F1F5FF"
              metrics={[
                { label: t("知识笔记", "Knowledge notes"), value: m.knowledge.notes, highlight: true },
              ]}
            />
            <ModuleCard
              icon={Brain} title={t("反思引擎", "Reflection engine")} path="/reflections"
              color="#3A5FE0" bg="#EEF2FF"
              metrics={[
                { label: t("反思记录", "Reflections"), value: m.reflections.total, highlight: true },
              ]}
            />
            <ModuleCard
              icon={Shield} title={t("治理引擎", "Governance engine")} path="/governance"
              color="#4B74FA" bg="#E8EEFF"
              metrics={[
                { label: t("治理规则", "Governance rules"), value: m.governance.rules, highlight: true },
              ]}
            />
            <ModuleCard
              icon={Search} title={t("审计追溯", "Audit trail")} path="/audit"
              color="#0F5BD8" bg="#EFF6FF"
              metrics={[
                { label: t("审计日志", "Audit records"), value: m.audit.logs, highlight: true },
              ]}
            />
          </div>
        </div>
      </div>

      {/* === Bottom Section: AI Performance + Recent Activities === */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* AI员工效能 */}
        <div className="lg:col-span-7">
          <section className="bg-bg-card border border-border px-5 py-4 rounded-lg h-full">
            <div className="flex items-center gap-2 mb-4">
              <Bot size={14} className="text-accent" />
              <h3 className="text-sm font-semibold text-text">{t("AI员工效能排行", "AI employee performance")}</h3>
            </div>
            <div className="space-y-2">
              {topPerformers.map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg">
                  <div className="w-9 h-9 rounded-full bg-primary-bg flex items-center justify-center text-sm font-bold text-primary">
                    {emp.avatar_emoji || emp.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text">{emp.name}</span>
                      <span className="text-[10px] text-text-muted bg-bg-card px-1.5 py-0.5 rounded">{emp.role}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-success">✓ {emp.completed}</span>
                      <span className="text-[10px] text-warning">⏳ {emp.active}</span>
                    </div>
                  </div>
                  <div className="w-16 bg-bg-card rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${emp.total > 0 ? (emp.completed / emp.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-text w-8 text-right">
                    {emp.total > 0 ? Math.round((emp.completed / emp.total) * 100) : 0}%
                  </span>
                </div>
              ))}
              {topPerformers.length === 0 && (
                <p className="text-xs text-text-muted text-center py-4">{t("暂无AI员工数据", "No AI employee data yet")}</p>
              )}
            </div>
          </section>
        </div>

        {/* 最近活动 */}
        <div className="lg:col-span-5">
          <section className="bg-bg-card border border-border px-5 py-4 rounded-lg h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-info" />
                <h3 className="text-sm font-semibold text-text">{t("最近活动", "Recent activity")}</h3>
              </div>
              <span className="text-[10px] text-text-muted">{t("实时更新", "Live updates")}</span>
            </div>
            <div className="space-y-3">
              {activities.length === 0 && (
                <p className="text-xs text-text-muted text-center py-6">{t("暂无活动记录", "No recent activity")}</p>
              )}
              {activities.map((act, idx) => (
                <div key={idx} className="flex items-start gap-2.5 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text leading-relaxed">{act.details || act.action || t("系统操作", "System activity")}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {act.user_name || act.employee_name || t("系统", "System")}
                      {act.created_at && ` · ${act.created_at.replace("T", " ").substring(0, 16)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

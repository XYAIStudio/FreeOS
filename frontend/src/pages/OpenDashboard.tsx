import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, Bell, BookOpen, Bot, Brain, Building2, ChevronRight, ListTodo,
  MessageSquare, Package, Settings, Shield, Users,
} from "lucide-react";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";
import { OpenModuleKey, useOpenModules } from "../open-modules";
import { useLocale } from "../i18n";

interface Overview {
  employees: { total: number; ai: number; human: number };
  tasks: { total: number; todo: number; in_progress: number; review: number; done: number };
  chats: number;
  messages: number;
  knowledge: number;
  metrics: { completionRate: number; activeRate: number; aiUtilization: number };
}

const entries: Array<{ key: OpenModuleKey; path: string; icon: typeof Users; zh: string; en: string }> = [
  { key: "announcements", path: "/announcements", icon: Bell, zh: "发布、阅读与追踪组织通知", en: "Publish, read, and track organization announcements" },
  { key: "organization", path: "/org", icon: Building2, zh: "集团、公司、部门和岗位关系", en: "Groups, companies, departments, and roles in one hierarchy" },
  { key: "employees", path: "/employees", icon: Users, zh: "人类员工、AI 员工与人才市场", en: "People, AI employees, and the talent market" },
  { key: "skills", path: "/skills", icon: Package, zh: "技能目录、插件与能力装配", en: "Skill catalog, plugins, and capability assembly" },
  { key: "chat", path: "/chat", icon: MessageSquare, zh: "人机单聊、群聊与实时协作", en: "Human–AI messages, groups, and live collaboration" },
  { key: "agents", path: "/agents", icon: Bot, zh: "创建顾问智能体并进入人才市场", en: "Create consultant agents and enter the talent market" },
  { key: "tasks", path: "/tasks", icon: ListTodo, zh: "任务分派、状态流转与验收", en: "Task assignment, progress, and acceptance" },
  { key: "knowledge", path: "/knowledge", icon: BookOpen, zh: "资料上传、解析与知识沉淀", en: "Upload, parse, and retain organizational knowledge" },
  { key: "reflections", path: "/reflections", icon: Brain, zh: "复盘协作过程并沉淀经验", en: "Review collaboration and capture lessons learned" },
  { key: "governance", path: "/governance", icon: Shield, zh: "人工复核、策略与审计边界", en: "Human review, policies, and audit boundaries" },
  { key: "settings", path: "/settings", icon: Settings, zh: "租户、模型、模块与用户设置", en: "Tenant, model, module, and user settings" },
];

const englishModuleLabels: Record<OpenModuleKey, string> = {
  workspace: "Workspace", announcements: "Announcements", organization: "Organization",
  employees: "Human–AI resources", skills: "Skills & plugins", chat: "Collaboration",
  agents: "Agent Studio", tasks: "Tasks", knowledge: "Knowledge base",
  reflections: "Reflection engine", governance: "Governance engine", settings: "System settings",
};

export default function OpenDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const enabled = useOpenModules(state => state.modules);
  const labels = useOpenModules(state => state.labels);
  const { isEnglish, t, formatNumber } = useLocale();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    authFetch("/api/dashboard/overview")
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || t("工作台数据加载失败", "Unable to load workspace data"));
        if (alive) setOverview(result.data);
      })
      .catch(reason => alive && setError(reason instanceof Error ? reason.message : t("工作台数据加载失败", "Unable to load workspace data")));
    return () => { alive = false; };
  }, [t]);

  const hour = new Date().getHours();
  const greeting = isEnglish
    ? (hour < 6 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening")
    : (hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好");
  const visibleEntries = entries.filter(item => enabled[item.key] && (!item.key.match(/governance|settings/) || user?.role === "admin" || user?.role === "super_admin"));
  const stats = useMemo(() => overview ? [
    [t("组织成员", "Organization members"), overview.employees.total, isEnglish ? `${formatNumber(overview.employees.human)} people · ${formatNumber(overview.employees.ai)} AI` : `${formatNumber(overview.employees.human)} 人类 · ${formatNumber(overview.employees.ai)} AI`],
    [t("任务进展", "Task progress"), overview.tasks.total, isEnglish ? `${formatNumber(overview.tasks.in_progress)} in progress · ${formatNumber(overview.tasks.done)} done` : `${formatNumber(overview.tasks.in_progress)} 进行中 · ${formatNumber(overview.tasks.done)} 完成`],
    [t("协作会话", "Collaboration sessions"), overview.chats, isEnglish ? `${formatNumber(overview.messages)} messages` : `${formatNumber(overview.messages)} 条消息`],
    [t("知识沉淀", "Knowledge retained"), overview.knowledge, isEnglish ? `${t("任务完成率", "Task completion")} ${overview.metrics.completionRate}%` : `任务完成率 ${overview.metrics.completionRate}%`],
  ] : [], [formatNumber, isEnglish, overview, t]);

  return <div className="max-w-[1320px] mx-auto p-4 md:p-6 space-y-5 animate-[fadeIn_.3s_ease]">
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-bg-card p-6 md:p-8">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
      <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs text-primary mb-3"><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> {t("openXYOS 正在运行", "openXYOS is running")}</div>
          <h1 className="text-2xl md:text-3xl font-bold text-text">{greeting}{isEnglish ? ", " : "，"}{user?.nickname || t("用户", "there")}</h1>
          <p className="text-sm text-text-muted mt-2">{t("人机协作 · 人工确认 · 审计留痕", "Human–AI collaboration · human confirmation · audit trail")}</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-text-muted">
          {(isEnglish ? ["Organization", "Agents", "Collaboration", "Audit"] : ["组织", "智能体", "协作", "审计"]).map((node, index) => <span key={node} className="flex items-center gap-2"><b className="min-w-8 h-8 px-2 rounded-full border border-primary/30 grid place-items-center text-primary not-italic">{node}</b>{index < 3 && <i className="w-6 h-px bg-primary/35" />}</span>)}
        </div>
      </div>
    </section>

    {error ? <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{error}</div> : !overview ?
      <div className="h-32 grid place-items-center text-text-muted"><Activity className="animate-spin mr-2" size={18} />{t("加载组织数据…", "Loading organization data…")}</div> :
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(([title, value, note]) => <article key={String(title)} className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted">{title}</p><strong className="block text-2xl text-text mt-2">{formatNumber(Number(value))}</strong><small className="text-xs text-text-muted">{note}</small>
        </article>)}
      </section>}

    <section>
      <div className="flex items-end justify-between mb-3"><div><p className="text-xs text-primary font-mono">CORE MODULES</p><h2 className="text-lg font-bold text-text mt-1">{t("当前租户能力", "Enabled capabilities")}</h2></div><span className="text-xs text-text-muted">{isEnglish ? `${formatNumber(visibleEntries.length + 1)} modules enabled` : `${formatNumber(visibleEntries.length + 1)} 个模块已启用`}</span></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleEntries.map(({ key, path, icon: Icon, zh, en }) => <button key={key} onClick={() => navigate(path)} className="group text-left rounded-xl border border-border bg-bg-card p-4 hover:border-primary/35 hover:-translate-y-0.5 transition-all">
          <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-lg bg-primary/10 text-primary grid place-items-center"><Icon size={19} /></span><div className="flex-1"><h3 className="text-sm font-semibold text-text">{isEnglish ? englishModuleLabels[key] : labels[key]}</h3><p className="text-xs text-text-muted mt-1">{isEnglish ? en : zh}</p></div><ChevronRight size={16} className="text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" /></div>
        </button>)}
      </div>
    </section>
  </div>;
}

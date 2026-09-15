import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, Store, Search, ChevronRight, Building2, Briefcase, Bot, User, ArrowRightLeft, UserCheck, Sparkles, Filter, X, Plus } from "lucide-react";
import { useAuthStore } from "../stores/auth";
import { authFetch } from "../api/authFetch";
import Avatar from "../components/Avatar";
import { useLocale } from "../i18n";

interface Employee {
  id: number;
  name: string;
  role: string;
  employee_type: string;
  agent_type: string;
  avatar_emoji: string;
  avatar_url?: string;
  department_id: number;
  skills: string;
  employment_category: string;
  status: string;
  position_sequence?: string;
}

interface TalentItem {
  id: number;
  talent_type: string;
  name: string;
  avatar_emoji: string;
  skills: string;
  category: string;
  description: string;
  rating: number;
  source: string;
  experience_years?: number;
  expected_salary?: string;
  agent_type?: string;
  capabilities?: string;
  token_cost_per_k?: string;
  provider?: string;
}

interface CatStats {
  internal: number;
  internalAI: number;
  internalHuman: number;
  reserve: number;
  reserveAI: number;
  reserveHuman: number;
}

interface TalentStats {
  total: number;
  ai: number;
  human: number;
}

type TabKey = "internal" | "reserve" | "talent";

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const { t } = useLocale();

  const [activeTab, setActiveTab] = useState<TabKey>("internal");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [talentPool, setTalentPool] = useState<TalentItem[]>([]);
  const [catStats, setCatStats] = useState<CatStats | null>(null);
  const [talentStats, setTalentStats] = useState<TalentStats | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(false);

  // Create employee modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "", role: "", employee_type: "ai", agent_type: "", skills: "",
    avatar_emoji: "🤖", department_id: "", employment_category: "internal", description: "", email: ""
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [skillsList, setSkillsList] = useState<any[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);

  useEffect(() => {
    loadCatStats();
    loadDepartments();
    loadSkills();
  }, []);

  useEffect(() => {
    if (activeTab === "internal" || activeTab === "reserve") loadEmployees();
    if (activeTab === "talent") loadTalent();
  }, [activeTab, filterType]);

  async function loadCatStats() {
    try {
      const r = await authFetch("/api/employees/stats/by-category");
      if (r.ok) {
        const j = await r.json();
        if (j.success) setCatStats(j.data);
      }
      const tr = await authFetch("/api/talent/stats");
      if (tr.ok) {
        const tj = await tr.json();
        if (tj.success) setTalentStats(tj.data);
      }
    } catch (e) { /* ignore */ }
  }

  async function loadDepartments() {
    try {
      const r = await authFetch("/api/org/tree");
      if (r.ok) {
        const j = await r.json();
        if (j.success && j.data) {
          const depts: any[] = [];
          function walk(nodes: any[]) {
            for (const n of nodes) {
              // Org tree nodes are departments (have children + employees)
              if (n.id && n.name && n.children !== undefined) {
                depts.push({ id: n.id, name: n.name });
                if (n.children) walk(n.children);
              }
            }
          }
          walk(j.data);
          setDepartments(depts);
        }
      }
    } catch (e) { /* ignore */ }
  }

  async function loadSkills() {
    try {
      const r = await authFetch("/api/skills");
      if (r.ok) {
        const j = await r.json();
        if (j.success) setSkillsList(j.data || []);
      }
    } catch (e) { /* ignore */ }
  }

  async function handleCreate() {
    if (!createForm.name.trim()) return alert(t("请输入姓名", "Enter a name"));
    const skillNames = selectedSkills
      .map(id => skillsList.find((s: any) => s.id === id)?.name)
      .filter(Boolean)
      .join(",");
    try {
      const r = await authFetch("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          ...createForm,
          skills: skillNames,
          department_id: createForm.department_id ? Number(createForm.department_id) : null,
          agent_type: createForm.employee_type === "ai" ? createForm.agent_type : null,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        if (j.success) {
          setShowCreate(false);
          setCreateForm({ name: "", role: "", employee_type: "ai", agent_type: "", skills: "", avatar_emoji: "🤖", department_id: "", employment_category: "internal", description: "", email: "" });
          setSelectedSkills([]);
          loadEmployees();
          loadCatStats();
          if (j.data?.id) navigate(`/employees/${j.data.id}`);
        }
      } else {
        alert(t("创建失败", "Employee creation failed"));
      }
    } catch (e) {
      alert(t("创建失败", "Employee creation failed"));
    }
  }

  async function loadEmployees() {
    setLoading(true);
    try {
      let url = `/api/employees?category=${activeTab}`;
      if (filterType) url += `&type=${filterType}`;
      const r = await authFetch(url);
      if (r.ok) {
        const j = await r.json();
        if (j.success) setEmployees(j.data || []);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  async function loadTalent() {
    setLoading(true);
    try {
      let url = "/api/talent";
      if (filterType) url += `?type=${filterType}`;
      const r = await authFetch(url);
      if (r.ok) {
        const j = await r.json();
        if (j.success) setTalentPool(j.data || []);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  async function handleOnboard(empId: number) {
    const dept = prompt(t("请输入部门ID（1=CEO办公室, 5=产品研发中心, 10=运营中心...）", "Enter a department ID (for example: 1, 5, or 10)..."));
    const role = prompt(t("请输入岗位名称（如：前端工程师）", "Enter a job title (for example: Frontend engineer)"));
    try {
      const r = await authFetch(`/api/employees/${empId}/onboard`, {
        method: "POST",
        body: JSON.stringify({ department_id: dept ? Number(dept) : undefined, role: role || undefined }),
      });
      if (r.ok) { loadEmployees(); loadCatStats(); }
    } catch (e) { alert(t("入职失败", "Onboarding failed")); }
  }

  async function handleReserve(empId: number) {
    if (!confirm(t("确认将该员工转入备选库？部门信息将被清除。", "Move this employee to the reserve pool? Their department assignment will be cleared."))) return;
    try {
      const r = await authFetch(`/api/employees/${empId}/reserve`, { method: "PUT" });
      if (r.ok) { loadEmployees(); loadCatStats(); }
    } catch (e) { alert(t("操作失败", "Operation failed")); }
  }

  async function handleRecruit(talentId: number) {
    if (!confirm(t("确认招募该人才？将加入备选员工库。", "Recruit this talent into the reserve employee pool?"))) return;
    try {
      const r = await authFetch(`/api/talent/${talentId}/recruit`, { method: "POST" });
      if (r.ok) { loadTalent(); loadCatStats(); }
    } catch (e) { alert(t("招募失败", "Recruitment failed")); }
  }

  const filteredEmployees = search
    ? employees.filter(e => e.name.includes(search) || (e.role || "").includes(search) || (e.skills || "").includes(search))
    : employees;

  const filteredTalent = search
    ? talentPool.filter(t => t.name.includes(search) || (t.skills || "").includes(search) || (t.category || "").includes(search))
    : talentPool;

  const tabs: { key: TabKey; label: string; icon: any; count?: number }[] = [
    { key: "internal", label: t("内部员工", "Internal employees"), icon: Users, count: catStats?.internal },
    { key: "reserve", label: t("备选员工", "Reserve employees"), icon: UserCheck, count: catStats?.reserve },
    { key: "talent", label: t("人才市场", "Talent market"), icon: Store, count: talentStats?.total },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">{t("人机资源", "Human–AI resources")}</h1>
          <p className="text-sm text-text-muted mt-1">{t("人机共融 · 三类管理 · 全生命周期", "Human–AI collaboration · three talent pools · full lifecycle")}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
            <Plus size={16} />
            {t("新建员工", "New employee")}
          </button>
        )}
      </div>

      {/* Stats Bar */}
      {catStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label={t("内部员工", "Internal employees")} count={catStats.internal} sub={t("🤖AI " + catStats.internalAI + "  👤人 " + catStats.internalHuman, "🤖 AI " + catStats.internalAI + "  👤 Human " + catStats.internalHuman)} color="blue" />
          <StatCard label={t("备选员工", "Reserve employees")} count={catStats.reserve} sub={t("🤖AI " + catStats.reserveAI + "  👤人 " + catStats.reserveHuman, "🤖 AI " + catStats.reserveAI + "  👤 Human " + catStats.reserveHuman)} color="amber" />
          <StatCard label={t("人才市场", "Talent market")} count={talentStats?.total || 0} sub={t("🤖AI " + (talentStats?.ai || 0) + "  👤人 " + (talentStats?.human || 0), "🤖 AI " + (talentStats?.ai || 0) + "  👤 Human " + (talentStats?.human || 0))} color="green" />
          <StatCard label={t("总人力", "Total workforce")} count={(catStats.internal + catStats.reserve + (talentStats?.total || 0))} sub={t("内部+备选+市场", "Internal + reserve + market")} color="purple" />
          <StatCard label={t("AI占比", "AI share")} count={Math.round(((catStats.internalAI + catStats.reserveAI + (talentStats?.ai || 0)) / (catStats.internal + catStats.reserve + (talentStats?.total || 0) || 1)) * 100)} sub={t("全人力中AI比例(%)", "Share of total workforce (%)")} color="cyan" />
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex items-center gap-1 mb-4 border-b border-border pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch(""); setFilterType(""); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-[1px] ${
              activeTab === tab.key
                ? "text-primary border-primary bg-primary/5"
                : "text-text-muted border-transparent hover:text-text hover:bg-bg-hover"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-bg text-text-muted"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text" placeholder={activeTab === "talent" ? t("搜索人才/技能...", "Search talent or skills...") : t("搜索员工姓名/职位/技能...", "Search employee, role, or skills...")}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-card border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
              <X size={14} />
            </button>
          )}
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary">
          <option value="">{t("全部类型", "All types")}</option>
          <option value="ai">{t("AI员工", "AI employees")}</option>
          <option value="human">{t("人类员工", "Human employees")}</option>
        </select>
        {(search || filterType) && (
          <button onClick={() => { setSearch(""); setFilterType(""); }} className="flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors">
            <X size={14} /> {t("清除筛选", "Clear filters")}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-text-muted text-sm">{t("加载中...", "Loading...")}</div>
        ) : activeTab === "talent" ? (
          <TalentGrid talents={filteredTalent} onRecruit={handleRecruit} isAdmin={isAdmin} />
        ) : (
          <EmployeeList
            employees={filteredEmployees}
            isInternal={activeTab === "internal"}
            isAdmin={isAdmin}
            onView={(id) => navigate(`/employees/${id}`)}
            onOnboard={handleOnboard}
            onReserve={handleReserve}
          />
        )}
      </div>

      {/* Create Employee Modal */}
      {showCreate && (
        <CreateEmployeeModal
          form={createForm}
          departments={departments}
          skillsList={skillsList}
          selectedSkills={selectedSkills}
          onSkillToggle={(id) => setSelectedSkills(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
          onChange={(f) => setCreateForm(f)}
          onCancel={() => { setShowCreate(false); setSelectedSkills([]); }}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}

// ===== Sub-Components =====

function StatCard({ label, count, sub, color }: { label: string; count: number; sub: string; color: string }) {
  const borders: Record<string, string> = { blue: "border-l-blue-500", amber: "border-l-amber-500", green: "border-l-green-500", purple: "border-l-purple-500", cyan: "border-l-cyan-500" };
  return (
    <div className={`bg-bg-card border border-border border-l-4 ${borders[color] || "border-l-primary"} rounded-lg p-3`}>
      <div className="text-2xl font-bold text-text">{count}</div>
      <div className="text-xs font-medium text-text mt-0.5">{label}</div>
      <div className="text-[10px] text-text-muted mt-0.5">{sub}</div>
    </div>
  );
}

function EmployeeList({ employees, isInternal, isAdmin, onView, onOnboard, onReserve }: {
  employees: Employee[]; isInternal: boolean; isAdmin: boolean;
  onView: (id: number) => void; onOnboard: (id: number) => void; onReserve: (id: number) => void;
}) {
  const { t } = useLocale();
  if (employees.length === 0) {
    return <div className="text-center py-16 text-text-muted text-sm">{isInternal ? t("暂无内部员工", "No internal employees") : t("暂无备选员工", "No reserve employees")}</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {employees.map(emp => (
        <div key={emp.id}
          className="group bg-bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
          onClick={() => onView(emp.id)}>
          <div className="flex items-start gap-3">
            <Avatar id={emp.id} name={emp.name} size={36} className="flex-shrink-0" customSrc={emp.avatar_url || undefined} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-text text-sm truncate">{emp.name}</h3>
                {emp.employee_type === "ai" ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-500 rounded-full flex-shrink-0">AI</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full flex-shrink-0">{t("人类", "Human")}</span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5 truncate">{emp.role || t("未分配岗位", "No role assigned")}</p>
              {emp.position_sequence && (
                <p className="text-[10px] text-text-muted mt-0.5">{emp.position_sequence}</p>
              )}
              {emp.skills && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {emp.skills.split(",").slice(0, 3).map((s, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-bg rounded-full text-text-muted">{s.trim()}</span>
                  ))}
                  {emp.skills.split(",").length > 3 && (
                    <span className="text-[10px] text-text-muted">+{emp.skills.split(",").length - 3}</span>
                  )}
                </div>
              )}
            </div>
            <ChevronRight size={16} className="text-text-muted group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
          </div>

          {/* Admin Actions */}
          {isAdmin && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
              {!isInternal ? (
                <button onClick={() => onOnboard(emp.id)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                  <UserCheck size={12} /> {t("入职", "Onboard")}
                </button>
              ) : (
                <button onClick={() => onReserve(emp.id)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-border text-text-muted rounded-lg text-xs hover:border-amber-500/50 hover:text-amber-500 transition-colors">
                  <ArrowRightLeft size={12} /> {t("转入备选", "Move to reserve")}
                </button>
              )}
              <button onClick={() => onView(emp.id)}
                className="flex items-center justify-center gap-1 px-2 py-1.5 border border-border text-text-muted rounded-lg text-xs hover:border-primary/50 hover:text-primary transition-colors">
                {t("详情", "Details")}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TalentGrid({ talents, onRecruit, isAdmin }: { talents: TalentItem[]; onRecruit: (id: number) => void; isAdmin: boolean }) {
  const { t } = useLocale();
  if (talents.length === 0) {
    return <div className="text-center py-16 text-text-muted text-sm">{t("暂无可用人才", "No available talent")}</div>;
  }

  const humanTalents = talents.filter(t => t.talent_type === "human");
  const aiTalents = talents.filter(t => t.talent_type === "ai");

  return (
    <div className="space-y-8">
      {/* AI 智能体 */}
      {aiTalents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bot size={16} className="text-purple-500" />
            <h3 className="text-sm font-semibold text-text">AI {t("智能体", "agents")}</h3>
            <span className="text-xs text-text-muted">({aiTalents.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {aiTalents.map(t => (
              <TalentCard key={t.id} talent={t} onRecruit={onRecruit} isAdmin={isAdmin} />
            ))}
          </div>
        </div>
      )}

      {/* 人类人才 */}
      {humanTalents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <User size={16} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-text">{t("人类人才", "Human talent")}</h3>
            <span className="text-xs text-text-muted">({humanTalents.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {humanTalents.map(t => (
              <TalentCard key={t.id} talent={t} onRecruit={onRecruit} isAdmin={isAdmin} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TalentCard({ talent, onRecruit, isAdmin }: { talent: TalentItem; onRecruit: (id: number) => void; isAdmin: boolean }) {
  const { t } = useLocale();
  const stars = "⭐".repeat(Math.round(talent.rating));
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3 mb-3">
        <Avatar id={talent.id || talent.name} name={talent.name} size={36} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-text text-sm truncate">{talent.name}</h4>
          <p className="text-xs text-text-muted">{talent.category || talent.agent_type || ""}</p>
          <div className="text-xs text-amber-500 mt-0.5">{stars} {talent.rating}</div>
        </div>
        {talent.talent_type === "ai" ? (
          <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-500 rounded-full flex-shrink-0">AI</span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full flex-shrink-0">{t("人类", "Human")}</span>
        )}
      </div>

      <p className="text-xs text-text-muted mb-3 line-clamp-2">{talent.description || talent.capabilities || ""}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {(talent.skills || "").split(",").slice(0, 4).map((s, i) => (
          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-bg rounded-full text-text-muted">{s.trim()}</span>
        ))}
      </div>

      {/* Human-specific info */}
      {talent.talent_type === "human" && (
        <div className="text-[10px] text-text-muted space-y-0.5 mb-3">
          {talent.experience_years && <div>{t("经验：", "Experience: ")}{talent.experience_years}{t("年", " years")}</div>}
          {talent.expected_salary && <div>{t("期望薪资：", "Expected salary: ")}{talent.expected_salary}</div>}
        </div>
      )}

      {/* AI-specific info */}
      {talent.talent_type === "ai" && (
        <div className="text-[10px] text-text-muted space-y-0.5 mb-3">
          {talent.token_cost_per_k && <div>{t("Token成本：", "Token cost: ")}{talent.token_cost_per_k}/K</div>}
          {talent.provider && <div>{t("提供商：", "Provider: ")}{talent.provider}</div>}
        </div>
      )}

      {isAdmin && (
        <button onClick={() => onRecruit(talent.id)}
          className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary hover:text-white transition-colors">
          <UserPlus size={13} /> {t("招募", "Recruit")}
        </button>
      )}
    </div>
  );
}

// ===== Create Employee Modal =====
function CreateEmployeeModal({ form, departments, skillsList, selectedSkills, onSkillToggle, onChange, onCancel, onSubmit }: {
  form: any; departments: any[]; skillsList: any[]; selectedSkills: number[]; onSkillToggle: (id: number) => void;
  onChange: (f: any) => void; onCancel: () => void; onSubmit: () => void;
}) {
  const { t } = useLocale();
  const agentTypes = [
    { value: "frontend_dev", label: t("前端工程师", "Frontend engineer") },
    { value: "backend_dev", label: t("后端工程师", "Backend engineer") },
    { value: "fullstack_dev", label: t("全栈工程师", "Full-stack engineer") },
    { value: "qa_engineer", label: t("测试工程师", "QA engineer") },
    { value: "product_manager", label: t("产品经理", "Product manager") },
    { value: "tech_architect", label: t("技术架构师", "Technical architect") },
    { value: "data_engineer", label: t("数据工程师", "Data engineer") },
    { value: "bi_analyst", label: t("BI分析师", "BI analyst") },
    { value: "ai_engineer", label: t("AI工程师", "AI engineer") },
    { value: "devops_engineer", label: t("DevOps工程师", "DevOps engineer") },
    { value: "sre_engineer", label: t("SRE工程师", "SRE engineer") },
    { value: "security_engineer", label: t("安全工程师", "Security engineer") },
    { value: "customer_success", label: t("客户成功", "Customer success") },
    { value: "sales_manager", label: t("商务经理", "Sales manager") },
    { value: "hr_manager", label: t("HR经理", "HR manager") },
    { value: "finance_manager", label: t("财务经理", "Finance manager") },
    { value: "presales_architect", label: t("售前架构师", "Solutions architect") },
    { value: "strategy_executive", label: t("战略执行", "Strategy execution") },
    { value: "newmedia_ops", label: t("新媒体运营", "New media operations") },
    { value: "ecommerce_ops", label: t("电商运营", "E-commerce operations") },
    { value: "knowledge", label: t("知识管理", "Knowledge management") },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-text">{t("新建员工", "New employee")}</h2>
          <button onClick={onCancel} className="text-text-muted hover:text-text"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Type Toggle */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-2 block">{t("员工类型", "Employee type")}</label>
            <div className="flex gap-2">
              <button onClick={() => onChange({ ...form, employee_type: "ai" })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  form.employee_type === "ai" ? "bg-purple-500/10 text-purple-500 border border-purple-500/30" : "bg-bg border border-border text-text-muted"
                }`}>
                <Bot size={16} /> {t("AI员工", "AI employee")}
              </button>
              <button onClick={() => onChange({ ...form, employee_type: "human", agent_type: "" })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  form.employee_type === "human" ? "bg-blue-500/10 text-blue-500 border border-blue-500/30" : "bg-bg border border-border text-text-muted"
                }`}>
                <User size={16} /> {t("人类员工", "Human employee")}
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">{t("姓名", "Name")} *</label>
            <input type="text" value={form.name} onChange={e => onChange({ ...form, name: e.target.value })}
              placeholder={t("输入员工姓名", "Enter employee name")} className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">{t("岗位/职位", "Role / title")}</label>
            <input type="text" value={form.role} onChange={e => onChange({ ...form, role: e.target.value })}
              placeholder={t("如：前端工程师、产品经理", "For example: Frontend engineer, Product manager")} className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
          </div>

          {/* Email - Human only */}
          {form.employee_type === "human" && (
            <div>
              <label className="text-xs font-medium text-text-muted mb-1 block">{t("邮箱", "Email")} *</label>
              <input type="email" value={form.email || ""} onChange={e => onChange({ ...form, email: e.target.value })}
                placeholder={t("员工登录邮箱", "Employee sign-in email")} className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
              <p className="text-[10px] text-text-muted mt-1">{t("自动创建系统账号，默认密码 emp123456", "A system account is created automatically. Default password: emp123456")}</p>
            </div>
          )}

          {/* Department */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">{t("所属部门", "Department")}</label>
            <select value={form.department_id} onChange={e => onChange({ ...form, department_id: e.target.value })}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary">
              <option value="">{t("未分配", "Unassigned")}</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* AI Agent Type */}
          {form.employee_type === "ai" && (
            <div>
              <label className="text-xs font-medium text-text-muted mb-1 block">{t("AI智能体类型", "AI agent type")}</label>
              <select value={form.agent_type} onChange={e => onChange({ ...form, agent_type: e.target.value })}
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary">
                <option value="">{t("选择类型", "Select a type")}</option>
                {agentTypes.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Skills - Multi Select */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">{t("技能（多选）", "Skills (multiple)")}</label>
            {selectedSkills.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedSkills.map(id => {
                  const s = skillsList.find((sk: any) => sk.id === id);
                  return s ? (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                      {s.icon || "📦"} {s.name}
                      <button onClick={() => onSkillToggle(id)} className="hover:text-red-500"><X size={10} /></button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <div className="max-h-36 overflow-y-auto bg-bg border border-border rounded-lg p-2">
              {skillsList.slice(0, 50).map((s: any) => (
                <label key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-bg-hover text-xs ${
                  selectedSkills.includes(s.id) ? "bg-primary/5 text-primary font-medium" : "text-text-muted"
                }`}>
                  <input type="checkbox" checked={selectedSkills.includes(s.id)}
                    onChange={() => onSkillToggle(s.id)} className="rounded accent-primary" />
                  <span>{s.icon || "📦"}</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-[10px] text-text-muted">{s.category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">{t("岗位职责描述", "Responsibilities")}</label>
            <textarea value={form.description || ""} onChange={e => onChange({ ...form, description: e.target.value })}
              placeholder={t("描述该岗位的核心职责、工作内容、任职要求等...", "Describe core responsibilities, work scope, and requirements...")}
              rows={3}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary resize-none" />
          </div>

          {/* 职业头像（自动分配） */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">{t("职业头像", "Professional avatar")}</label>
            <div className="flex items-center gap-3 p-3 bg-bg rounded-lg border border-border">
              <Avatar id={form.name || 'new'} name={form.name} size={36} />
              <p className="text-xs text-text-muted">{t("系统自动分配职业男女头像，无需手动选择", "A professional avatar is assigned automatically; no manual selection is needed.")}</p>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">{t("雇佣类型", "Employment category")}</label>
            <select value={form.employment_category} onChange={e => onChange({ ...form, employment_category: e.target.value })}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary">
              <option value="internal">{t("内部员工（直接入职）", "Internal employee (onboarded)")}</option>
              <option value="reserve">{t("备选员工（储备库）", "Reserve employee (talent pool)")}</option>
            </select>
          </div>
        </div>

        <div className="sticky bottom-0 bg-bg-card border-t border-border px-6 py-4 flex gap-3 rounded-b-2xl">
          <button onClick={onCancel}
            className="flex-1 py-2.5 border border-border text-text rounded-lg text-sm font-medium hover:bg-bg-hover transition-colors">
            {t("取消", "Cancel")}
          </button>
          <button onClick={onSubmit}
            className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            {t("创建员工", "Create employee")}
          </button>
        </div>
      </div>
    </div>
  );
}

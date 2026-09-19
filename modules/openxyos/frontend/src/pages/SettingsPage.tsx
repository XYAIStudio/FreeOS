import { useState, useEffect, useCallback } from "react";
import { Settings, Building2, Bot, Shield, Users, Save, Trash2, Plus, X, GitBranch, RotateCcw, History, Cpu, Download, Upload, HardDrive, AlertTriangle, RefreshCw, Clock, LayoutGrid } from "lucide-react";
import { authFetch } from "../api/authFetch";
import { EXPERIENCE_MODELS } from "../llm-providers";
import { useAuthStore } from "../stores/auth";
import Avatar from "../components/Avatar";
import ModuleManagementTab from "../components/OpenModuleManagementTab";
import { useLocale } from "../i18n";

interface CompanySettings { name: string; settings: Record<string, string>; }
interface AIConfig { llm_api_key: string; llm_api_base: string; llm_model: string; ai_reply_enabled: string; ai_reply_delay: string; }
interface Role { id: number; name: string; permissions: string; }
interface ConfigVersion { id: number; config_type: string; config_key: string; config_value: string | null; version: number; change_reason: string | null; status: string; created_at: string; }

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { t } = useLocale();
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [tab, setTab] = useState<"company" | "modules" | "ai" | "users" | "database">("company");
  const [configVersions, setConfigVersions] = useState<ConfigVersion[]>([]);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [newConfig, setNewConfig] = useState({ config_type: "ai", config_key: "", config_value: "", change_reason: "" });
  const [company, setCompany] = useState<CompanySettings>({ name: "", settings: {} });
  const [aiConfig, setAiConfig] = useState<AIConfig>({ llm_api_key: "", llm_api_base: "", llm_model: "", ai_reply_enabled: "true", ai_reply_delay: "2000" });
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", nickname: "", role: "user" });
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [airGapMode, setAirGapMode] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [companyRes, aiRes, rolesRes, usersRes, configRes, regRes] = await Promise.all([
        authFetch("/api/settings/company").then(r => r.json()),
        isSuperAdmin ? authFetch("/api/settings/ai").then(r => r.json()) : Promise.resolve({ success: false }),
        authFetch("/api/settings/roles").then(r => r.json()),
        isAdmin ? authFetch("/api/settings/users").then(r => r.json()) : Promise.resolve({ success: false }),
        authFetch("/api/config-versions").then(r => r.json()),
        isAdmin ? authFetch("/api/settings/registration").then(r => r.json()) : Promise.resolve({ success: false }),
      ]);
      if (companyRes.success) setCompany(companyRes.data);
      if (aiRes.success) setAiConfig(prev => ({ ...prev, ...aiRes.data }));
      if (rolesRes.success) setRoles(rolesRes.data);
      if (usersRes.success) setUsers(usersRes.data);
      if (configRes.success) setConfigVersions(configRes.data || []);
      if (regRes.success) setRegistrationEnabled(regRes.data.enabled);
      // 空中模式
      try {
        const airRes = await authFetch("/api/settings/air-gap").then(r => r.json());
        if (airRes.success) setAirGapMode(airRes.data.airGapMode);
      } catch {}
    } catch {}
    setLoading(false);
  };

  const saveCompany = async () => {
    setSaving(true);
    await authFetch("/api/settings/company", { method: "PUT", body: JSON.stringify({ name: company.name, settings: company.settings }) });
    setMessage(t("公司设置已保存", "Company settings saved")); setTimeout(() => setMessage(""), 3000); setSaving(false);
  };

  const saveRegistration = async () => {
    setSaving(true);
    const r = await authFetch("/api/settings/registration", { method: "PUT", body: JSON.stringify({ enabled: registrationEnabled }) });
    const d = await r.json();
    if (d.success) setMessage(t("注册设置已保存", "Registration settings saved")); else setMessage(t("保存失败: ", "Save failed: ") + (d.error || ""));
    setTimeout(() => setMessage(""), 3000); setSaving(false);
  };

  const saveAI = async () => {
    setSaving(true);
    const r = await authFetch("/api/settings/ai", { method: "PUT", body: JSON.stringify({ configs: aiConfig }) });
    const d = await r.json();
    if (d.success) setMessage(t("AI配置已保存", "AI configuration saved")); else setMessage(t("保存失败: ", "Save failed: ") + (d.error || ""));
    setTimeout(() => setMessage(""), 3000); setSaving(false);
  };

  const deleteRole = async (id: number) => {
    if (!confirm(t("确定删除此角色？", "Delete this role?"))) return;
    await authFetch(`/api/settings/roles/${id}`, { method: "DELETE" });
    setRoles(prev => prev.filter(r => r.id !== id));
  };

  const addUser = async () => {
    if (!newUser.email || !newUser.password) return;
    const r = await authFetch("/api/settings/users", { method: "POST", body: JSON.stringify(newUser) });
    const d = await r.json();
    if (d.success) { setShowAddUser(false); setNewUser({ email: "", password: "", nickname: "", role: "user" }); fetchData(); }
    else alert(d.error || t("创建失败", "Creation failed"));
  };

  const deleteUser = async (id: number) => {
    if (!confirm(t("确定删除此用户？", "Delete this user?"))) return;
    const r = await authFetch(`/api/settings/users/${id}`, { method: "DELETE" });
    const d = await r.json();
    if (d.success) setUsers(prev => prev.filter(u => u.id !== id));
    else alert(d.error || t("删除失败", "Deletion failed"));
  };

  const updateUserRole = async (id: number, role: string) => {
    const r = await authFetch(`/api/settings/users/${id}`, { method: "PUT", body: JSON.stringify({ role }) });
    const d = await r.json();
    if (d.success) fetchData();
    else alert(d.error || t("更新失败", "Update failed"));
  };

  const tabs = [
    { id: "company", label: t("公司设置", "Company") , icon: Building2 },
    ...(isAdmin ? [{ id: "modules", label: t("模块管理", "Modules"), icon: LayoutGrid }] : []),
    { id: "ai", label: t("AI大模型", "AI Models"), icon: Cpu },
    ...(isAdmin ? [{ id: "users", label: t("用户管理", "People"), icon: Users }] : []),
    ...(isSuperAdmin ? [{ id: "database", label: t("数据库管理", "Database"), icon: HardDrive }] : []),
  ];

  const addConfigVersion = async () => {
    if (!newConfig.config_key.trim()) return;
    await authFetch("/api/config-versions", {
      method: "POST",
      body: JSON.stringify(newConfig),
    });
    setNewConfig({ config_type: "ai", config_key: "", config_value: "", change_reason: "" });
    setShowAddConfig(false);
    fetchData();
  };

  const rollbackConfig = async (id: number) => {
    if (!confirm(t("确定回滚到此版本？", "Roll back to this version?"))) return;
    await authFetch(`/api/config-versions/rollback/${id}`, { method: "POST" });
    fetchData();
  };

  const deleteConfigVersion = async (id: number) => {
    if (!confirm(t("确定删除此版本？", "Delete this version?"))) return;
    await authFetch(`/api/config-versions/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-text-muted"><Settings size={20} className="animate-spin mr-2" />{t("加载中...", "Loading...")}</div>;

  const inputCls = "w-full px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary";
  const btnCls = "flex items-center gap-2 px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:opacity-90 disabled:opacity-50";

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-card">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-primary" />
          <h1 className="text-base font-bold text-text">{t("系统设置", "System Settings")}</h1>
          <span className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary font-medium">{isSuperAdmin ? t("超级管理员", "Super administrator") : t("管理员", "Administrator")}</span>
        </div>
        {message && <span className="text-[11px] text-success bg-success/10 px-3 py-1 rounded font-medium">{message}</span>}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-40 border-r border-border bg-bg-card p-2 space-y-1">
          {tabs.map(tabOption => (
            <button key={tabOption.id} onClick={() => setTab(tabOption.id as any)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-all ${tab === tabOption.id ? "bg-primary text-white" : "text-text-muted hover:bg-bg hover:text-text"}`}>
              <tabOption.icon size={14} /><span>{tabOption.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5">
          {tab === "company" && (
            <div className="max-w-lg space-y-4">
              <h2 className="text-sm font-semibold text-text">{t("公司信息", "Company information")}</h2>
              <div><label className="block text-xs font-medium text-text mb-2">{t("公司名称", "Company name")}</label><input type="text" value={company.name} onChange={e => setCompany(prev => ({ ...prev, name: e.target.value }))} className={inputCls} /></div>
              <button onClick={saveCompany} disabled={saving} className={btnCls}><Save size={14} /> {saving ? t("保存中...", "Saving...") : t("保存设置", "Save settings")}</button>

              {isAdmin && (
                <>
                  <div className="border-t border-border pt-4 mt-4">
                    <h2 className="text-sm font-semibold text-text mb-3">{t("用户注册设置", "User registration")}</h2>
                    <div className="flex items-center justify-between p-3 bg-bg-card border border-border rounded">
                      <div>
                        <p className="text-xs font-medium text-text">{t("开放用户注册", "Open registration")}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">{t("关闭后新用户将无法自行注册账号", "When disabled, new users cannot register their own accounts.")}</p>
                      </div>
                      <button
                        onClick={() => setRegistrationEnabled(!registrationEnabled)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${registrationEnabled ? 'bg-primary' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${registrationEnabled ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    <button onClick={saveRegistration} disabled={saving} className={`${btnCls} mt-3`}>
                      <Save size={14} /> {saving ? t("保存中...", "Saving...") : t("保存注册设置", "Save registration settings")}
                    </button>
                  </div>
                </>
              )}

              {/* 空中模式开关 */}
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center justify-between p-3 bg-bg border border-border rounded-lg">
                  <div>
                    <div className="text-xs font-semibold text-text">{t("🛡️ 空中模式（私有化策略）", "🛡️ Air-gap mode (private deployment policy)")}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {airGapMode ? t("已开启：仅允许白名单内模型端点，外部AI服务被拦截", "Enabled: only allowlisted model endpoints are available; external AI services are blocked.") : t("已关闭：允许访问所有已配置的AI服务", "Disabled: all configured AI services are available.")}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const newMode = !airGapMode;
                      const res = await authFetch("/api/settings/air-gap", {
                        method: "POST",
                        body: JSON.stringify({ enabled: newMode }),
                      }).then(r => r.json());
                      if (res.success) {
                        setAirGapMode(newMode);
                        setMessage(newMode ? t("空中模式已开启", "Air-gap mode enabled") : t("空中模式已关闭", "Air-gap mode disabled"));
                        setTimeout(() => setMessage(""), 3000);
                      }
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      airGapMode ? "bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20" 
                                 : "bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20"
                    }`}>
                    {airGapMode ? t("关闭空中模式", "Disable air-gap mode") : t("开启空中模式", "Enable air-gap mode")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "modules" && isAdmin && user && <ModuleManagementTab currentTenantId={user.tenant_id} isSuperAdmin={isSuperAdmin} />}

          {tab === "ai" && <LLMSettingsTab />}

          {tab === "users" && isAdmin && <UserManagementTab />}

          {tab === "database" && isSuperAdmin && <DatabaseManagementTab />}

        </div>
      </div>

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddUser(false)}>
          <div className="bg-bg-card shadow-xl w-80 p-5 rounded" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold">{t("添加用户", "Add user")}</h2>
              <button onClick={() => setShowAddUser(false)} className="text-text-muted hover:text-text p-1 rounded hover:bg-bg"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-text mb-1.5">{t("邮箱", "Email")}</label><input type="email" placeholder={t("请输入邮箱", "Enter email")} value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-text mb-1.5">{t("昵称", "Nickname")}</label><input type="text" placeholder={t("请输入昵称", "Enter nickname")} value={newUser.nickname} onChange={e => setNewUser(p => ({ ...p, nickname: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-text mb-1.5">{t("密码", "Password")}</label><input type="password" placeholder={t("请输入密码", "Enter password")} value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-text mb-1.5">{t("角色", "Role")}</label>
                <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} className={inputCls}>
                  <option value="user">{t("普通用户", "User")}</option><option value="admin">{t("管理员", "Administrator")}</option>{isSuperAdmin && <option value="super_admin">{t("超级管理员", "Super administrator")}</option>}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddUser(false)} className="px-3 py-2 text-xs text-text-muted hover:bg-bg rounded">{t("取消", "Cancel")}</button>
              <button onClick={addUser} className="px-3 py-2 bg-primary text-white text-xs rounded font-medium hover:opacity-90">{t("创建", "Create")}</button>
            </div>
          </div>
        </div>
      )}

      {showAddConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddConfig(false)}>
          <div className="bg-bg-card shadow-xl w-96 p-5 rounded" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold">{t("新建配置版本", "New configuration version")}</h2>
              <button onClick={() => setShowAddConfig(false)} className="text-text-muted hover:text-text p-1 rounded hover:bg-bg"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-text mb-1.5">{t("配置类型", "Configuration type")}</label>
                <select value={newConfig.config_type} onChange={e => setNewConfig(p => ({ ...p, config_type: e.target.value }))} className={inputCls}>
                  <option value="ai">{t("AI配置", "AI configuration")}</option><option value="system">{t("系统配置", "System configuration")}</option><option value="ui">{t("界面配置", "Interface configuration")}</option><option value="security">{t("安全配置", "Security configuration")}</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-text mb-1.5">{t("配置键", "Configuration key")}</label><input type="text" placeholder={t("如 llm_api_key", "e.g. llm_api_key")} value={newConfig.config_key} onChange={e => setNewConfig(p => ({ ...p, config_key: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-text mb-1.5">{t("配置值", "Configuration value")}</label><textarea placeholder={t("JSON格式", "JSON format")} value={newConfig.config_value} onChange={e => setNewConfig(p => ({ ...p, config_value: e.target.value }))} rows={3} className={`${inputCls} font-mono text-[11px]`} /></div>
              <div><label className="block text-xs font-medium text-text mb-1.5">{t("变更原因", "Reason for change")}</label><input type="text" placeholder={t("可选", "Optional")} value={newConfig.change_reason} onChange={e => setNewConfig(p => ({ ...p, change_reason: e.target.value }))} className={inputCls} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddConfig(false)} className="px-3 py-2 text-xs text-text-muted hover:bg-bg rounded">{t("取消", "Cancel")}</button>
              <button onClick={addConfigVersion} className="px-3 py-2 bg-primary text-white text-xs rounded font-medium hover:opacity-90">{t("保存", "Save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 用户管理（员工管理）Tab =====
function UserManagementTab() {
  const { t } = useLocale();
  const [emps, setEmps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const navigate = (window as any).__navigate;

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await authFetch("/api/employees?category=internal");
      if (r.ok) { const j = await r.json(); if (j.success) setEmps(j.data || []); }
    } catch(e){}
    setLoading(false);
  }

  async function saveEdit() {
    try {
      const r = await authFetch(`/api/employees/${editId}`, { method: "PUT", body: JSON.stringify(editForm) });
      if (r.ok) { setEditId(null); load(); }
    } catch(e){ alert(t("保存失败", "Save failed")); }
  }

  async function deleteEmp(id: number, type: string) {
    if (type === "ai") { alert(t("AI员工不可删除，只能修改信息", "AI employees cannot be deleted; edit their information instead.")); return; }
    if (!confirm(t("确定删除该员工？此操作不可撤销。", "Delete this employee? This action cannot be undone."))) return;
    try {
      const r = await authFetch(`/api/employees/${id}`, { method: "DELETE" });
      if (r.ok) load();
    } catch(e){ alert(t("删除失败", "Deletion failed")); }
  }

  if (loading) return <div className="text-text-muted text-xs py-8 text-center">{t("加载中...", "Loading...")}</div>;

  const humans = emps.filter(e => e.employee_type === "human");
  const ais = emps.filter(e => e.employee_type === "ai");

  const inputCls = "w-full px-2.5 py-1.5 text-xs bg-bg border border-border rounded focus:outline-none focus:border-primary";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Human Employees */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">{t("👤 人类员工", "👤 Human employees")} ({humans.length})</h2>
          <a
            href={
              import.meta.env.VITE_FREEOS_ORG_INTEGRATED === "true"
                ? "/organization-app/employees"
                : "/employees"
            }
            className="text-xs text-primary hover:underline"
          >
            + {t("新增员工", "Add employee")}
          </a>
        </div>
        <div className="bg-bg-card border border-border rounded overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-bg">
              <th className="px-3 py-2 text-left text-[11px] font-medium text-text-muted">{t("员工", "Employee")}</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-text-muted">{t("邮箱", "Email")}</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-text-muted">{t("部门/岗位", "Department / role")}</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-text-muted">{t("技能", "Skills")}</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-text-muted">{t("操作", "Actions")}</th>
            </tr></thead>
            <tbody>
              {humans.map(e => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-bg">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar id={e.id} name={e.name} size={20} customSrc={e.avatar_url || undefined} />
                      <div>
                        <div className="text-xs font-medium text-text">{e.name}</div>
                        <div className="text-[10px] text-text-muted">{e.role || t("未分配", "Unassigned")}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-text-muted">{e.email || "-"}</td>
                  <td className="px-3 py-2 text-[11px] text-text-muted">{e.department_name || t("未分配", "Unassigned")} / {e.position_sequence || ""}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(e.skills || "").split(",").filter(Boolean).slice(0, 3).map((s: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-bg rounded text-text-muted">{s.trim()}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      <button onClick={() => { setEditId(e.id); setEditForm({ name: e.name, role: e.role, skills: e.skills, description: e.description }); }}
                        className="text-[11px] text-primary hover:underline px-2 py-1">{t("编辑", "Edit")}</button>
                      <button onClick={() => deleteEmp(e.id, e.employee_type)}
                        className="text-[11px] text-red-500 hover:underline px-2 py-1">{t("删除", "Delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {humans.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-xs text-text-muted">{t("暂无人类员工", "No human employees yet")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Employees */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">{t("🤖 AI员工", "🤖 AI employees")} ({ais.length})</h2>
          <span className="text-[10px] text-text-muted">{t("不可删除，仅可修改", "Cannot be deleted; can be edited")}</span>
        </div>
        <div className="bg-bg-card border border-border rounded overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-bg">
              <th className="px-3 py-2 text-left text-[11px] font-medium text-text-muted">{t("员工", "Employee")}</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-text-muted">{t("智能体类型", "Agent type")}</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-text-muted">{t("部门/岗位", "Department / role")}</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-text-muted">{t("技能", "Skills")}</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-text-muted">{t("操作", "Actions")}</th>
            </tr></thead>
            <tbody>
              {ais.map(e => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-bg">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar id={e.id} name={e.name} size={20} customSrc={e.avatar_url || undefined} />
                      <div>
                        <div className="text-xs font-medium text-text">{e.name}</div>
                        <div className="text-[10px] text-text-muted">{e.role || t("未分配", "Unassigned")}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-text-muted">{e.agent_type || "-"}</td>
                  <td className="px-3 py-2 text-[11px] text-text-muted">{e.department_name || t("未分配", "Unassigned")} / {e.position_sequence || ""}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(e.skills || "").split(",").filter(Boolean).slice(0, 3).map((s: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-bg rounded text-text-muted">{s.trim()}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => { setEditId(e.id); setEditForm({ name: e.name, role: e.role, skills: e.skills, description: e.description, agent_type: e.agent_type }); }}
                      className="text-[11px] text-primary hover:underline px-2 py-1">{t("编辑", "Edit")}</button>
                  </td>
                </tr>
              ))}
              {ais.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-xs text-text-muted">{t("暂无AI员工", "No AI employees yet")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditId(null)}>
          <div className="bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-text">{t("编辑员工", "Edit employee")}</h3>
              <button onClick={() => setEditId(null)} className="text-text-muted hover:text-text"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-[11px] font-medium text-text-muted mb-1">{t("姓名", "Name")}</label>
                <input value={editForm.name || ""} onChange={e => setEditForm({...editForm, name: e.target.value})} className={inputCls} /></div>
              <div><label className="block text-[11px] font-medium text-text-muted mb-1">{t("岗位", "Role")}</label>
                <input value={editForm.role || ""} onChange={e => setEditForm({...editForm, role: e.target.value})} className={inputCls} /></div>
              <div><label className="block text-[11px] font-medium text-text-muted mb-1">{t("技能（逗号分隔）", "Skills (comma-separated)")}</label>
                <input value={editForm.skills || ""} onChange={e => setEditForm({...editForm, skills: e.target.value})} className={inputCls} /></div>
              <div><label className="block text-[11px] font-medium text-text-muted mb-1">{t("岗位描述", "Role description")}</label>
                <textarea value={editForm.description || ""} onChange={e => setEditForm({...editForm, description: e.target.value})} rows={3} className={inputCls} /></div>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button onClick={() => setEditId(null)} className="px-4 py-2 text-xs text-text-muted hover:bg-bg rounded">{t("取消", "Cancel")}</button>
              <button onClick={saveEdit} className="px-4 py-2 text-xs bg-primary text-white rounded hover:bg-primary/90">{t("保存", "Save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== AI大模型设置 Tab =====
function LLMSettingsTab() {
  const { t } = useLocale();
  const [cfg, setCfg] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const r = await authFetch("/api/settings/ai");
      if (r.ok) { const j = await r.json(); if (j.success) setCfg(j.data || {}); }
    } catch(e){}
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = { ...cfg };
      delete payload.llm_api_key_configured;
      if (!payload.llm_api_key) delete payload.llm_api_key;
      const r = await authFetch("/api/settings/ai", { method: "PUT", body: JSON.stringify(payload) });
      if (r.ok) { setMsg(t("保存成功", "Saved")); setTimeout(() => setMsg(""), 2000); }
    } catch(e){ setMsg(t("保存失败", "Save failed")); }
    setSaving(false);
  }

  function applyPreset(preset: any) {
    setCfg((prev: any) => ({ ...prev, ...preset }));
  }

  const presets = EXPERIENCE_MODELS.map(item => ({
    name: item.name,
    provider: item.provider,
    base: item.baseUrl,
    model: item.model,
  }));

  const inputCls = "w-full px-2.5 py-1.5 text-xs bg-bg border border-border rounded focus:outline-none focus:border-primary";

  if (loading) return <div className="text-text-muted text-xs py-8 text-center">{t("加载中...", "Loading...")}</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">{t("快速配置 · 主流大模型", "Quick setup · popular models")}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {presets.map(p => (
            <button key={p.name} onClick={() => applyPreset({ llm_api_base: p.base, llm_model: p.model })}
              className={`text-left p-3 border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors ${
                cfg.llm_api_base === p.base ? "border-primary bg-primary/5" : "border-border"
              }`}>
              <div className="text-xs font-semibold text-text">{p.name}</div>
              <div className="text-[10px] text-text-muted mt-0.5">{p.provider}</div>
              <code className="text-[9px] text-text-muted mt-1 block truncate">{p.model}</code>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text">{t("自定义配置", "Custom configuration")}</h3>
        <div><label className="block text-[11px] font-medium text-text-muted mb-1">API Base URL</label>
          <input type="text" value={cfg.llm_api_base || ""} onChange={e => setCfg((p: any) => ({ ...p, llm_api_base: e.target.value }))}
            placeholder="https://api.openai.com/v1" className={inputCls} /></div>
        <div><label className="flex items-center justify-between text-[11px] font-medium text-text-muted mb-1"><span>API Key</span>{cfg.llm_api_key_configured === "true" && !cfg.llm_api_key && <em className="not-italic text-green-500">{t("已配置，留空不修改", "Configured; leave blank to keep unchanged")}</em>}</label>
          <input type="password" value={cfg.llm_api_key || ""} onChange={e => setCfg((p: any) => ({ ...p, llm_api_key: e.target.value }))}
            placeholder="sk-xxxxxx / tp-xxxxxx" className={inputCls} /></div>
        <div><label className="block text-[11px] font-medium text-text-muted mb-1">{t("模型名称", "Model name")}</label>
          <input type="text" value={cfg.llm_model || ""} onChange={e => setCfg((p: any) => ({ ...p, llm_model: e.target.value }))}
            placeholder="deepseek-chat / qwen-max / gpt-4o" className={inputCls} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-[11px] font-medium text-text-muted mb-1">{t("AI自动回复", "AI auto-reply")}</label>
            <select value={cfg.ai_reply_enabled || "true"} onChange={e => setCfg((p: any) => ({ ...p, ai_reply_enabled: e.target.value }))}
              className={inputCls}><option value="true">{t("启用", "Enabled")}</option><option value="false">{t("禁用", "Disabled")}</option></select></div>
          <div><label className="block text-[11px] font-medium text-text-muted mb-1">{t("回复延迟 (ms)", "Reply delay (ms)")}</label>
            <input type="number" value={cfg.ai_reply_delay || "2000"} onChange={e => setCfg((p: any) => ({ ...p, ai_reply_delay: e.target.value }))}
              className={inputCls} /></div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
            <Save size={13} /> {saving ? t("保存中...", "Saving...") : t("保存配置", "Save configuration")}
          </button>
          {msg && <span className="text-xs text-green-500">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

// ===== 数据库管理 Tab（仅超级管理员） =====
function DatabaseManagementTab() {
  const { t, locale } = useLocale();
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  useEffect(() => { loadInfo(); loadBackups(); }, []);

  async function loadInfo() {
    try {
      const r = await authFetch("/api/settings/database/info");
      if (r.ok) { const j = await r.json(); if (j.success) setDbInfo(j.data); }
    } catch {}
    setLoading(false);
  }

  async function loadBackups() {
    try {
      const r = await authFetch("/api/settings/database/backups");
      if (r.ok) { const j = await r.json(); if (j.success) setBackups(j.data || []); }
    } catch {}
  }

  async function handleBackup() {
    setBackingUp(true); setMessage("");
    try {
      const r = await authFetch("/api/settings/database/backup", { method: "POST" });
      const j = await r.json();
      if (j.success) {
        setMessage(t("备份成功：", "Backup created: ") + j.data.filename + " (" + j.data.size_human + ")");
        loadInfo(); loadBackups();
      } else setMessage(t("备份失败: ", "Backup failed: ") + (j.error || ""));
    } catch { setMessage(t("备份请求失败", "Backup request failed")); }
    setBackingUp(false);
    setTimeout(() => setMessage(""), 5000);
  }

  async function handleRestore(filename: string) {
    if (!confirm(t("⚠️ 确定要从 ", "⚠️ Restore the database from ") + filename + t("？\n\n当前数据库将被覆盖，建议先手动创建备份。", "?\n\nThe current database will be overwritten. Create a manual backup first."))) return;
    setRestoring(true); setMessage("");
    try {
      const r = await authFetch("/api/settings/database/restore", {
        method: "POST",
        body: JSON.stringify({ filename }),
      });
      const j = await r.json();
      if (j.success) {
        setMessage(t("恢复成功！安全回滚点: ", "Restore succeeded. Safety rollback point: ") + j.data.safety_backup + t("。建议重启后端服务。", ". Restart the backend service to apply it."));
        loadInfo();
      } else setMessage(t("恢复失败: ", "Restore failed: ") + (j.error || ""));
    } catch { setMessage(t("恢复请求失败", "Restore request failed")); }
    setRestoring(false); setRestoreTarget(null);
    setTimeout(() => setMessage(""), 8000);
  }

  async function handleDelete(filename: string) {
    if (!confirm(t("确定删除备份文件 ", "Delete backup file ") + filename + "?")) return;
    try {
      await authFetch(`/api/settings/database/backups/${encodeURIComponent(filename)}`, { method: "DELETE" });
      setBackups(prev => prev.filter(b => b.filename !== filename));
      loadInfo();
    } catch {}
  }

  if (loading) return <div className="text-text-muted text-xs py-8 text-center">{t("加载数据库信息...", "Loading database information...")}</div>;

  const inputCls = "w-full px-2.5 py-1.5 text-xs bg-bg border border-border rounded focus:outline-none focus:border-primary";

  return (
    <div className="max-w-3xl space-y-6">
      {/* 数据库概览卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-text-muted mb-2"><HardDrive size={14} /><span className="text-[11px]">{t("引擎", "Engine")}</span></div>
          <div className="text-sm font-bold">{dbInfo?.dialect || "-"}</div>
          <div className="text-[10px] text-text-muted mt-1">SQLite (sql.js)</div>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-text-muted mb-2"><GitBranch size={14} /><span className="text-[11px]">{t("数据表", "Tables")}</span></div>
          <div className="text-sm font-bold">{dbInfo?.table_count || 0}</div>
          <div className="text-[10px] text-text-muted mt-1">{dbInfo?.total_rows || 0} {t("行记录", "rows")}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-text-muted mb-2"><Upload size={14} /><span className="text-[11px]">{t("文件大小", "File size")}</span></div>
          <div className="text-sm font-bold">{dbInfo?.file_size_human || "-"}</div>
          <div className="text-[10px] text-text-muted mt-1">{dbInfo?.file_size_bytes || 0} bytes</div>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-text-muted mb-2"><Clock size={14} /><span className="text-[11px]">{t("备份数量", "Backups")}</span></div>
          <div className="text-sm font-bold">{dbInfo?.backups_count || 0}</div>
          <div className="text-[10px] text-text-muted mt-1">{dbInfo?.latest_backup ? new Date(dbInfo.latest_backup).toLocaleDateString(locale) : t("无", "None")}</div>
        </div>
      </div>

      {/* 操作按钮区 */}
      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2"><Shield size={15} /><span>{t("数据库操作", "Database operations")}</span></h3>

        <div className="flex gap-3">
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Download size={13} /> {backingUp ? t("备份中...", "Backing up...") : t("立即备份", "Create backup")}
          </button>
          {message && (
            <span className={`text-[11px] px-3 py-1.5 rounded ${message.toLowerCase().includes(t("失败", "failed").toLowerCase()) ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"} flex items-center gap-1`}>
              {message}
            </span>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-[11px] text-amber-700 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span><strong>{t("安全提示：", "Safety notice:")}</strong>{t("恢复操作会覆盖当前数据库，系统会自动在恢复前创建安全快照。生产环境建议先手动备份再执行恢复。", "Restoring overwrites the current database. The system creates a safety snapshot first; create a manual backup before restoring production data.")}</span>
          </p>
        </div>
      </div>

      {/* 备份列表 */}
      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2"><History size={15} /><span>{t("备份历史", "Backup history")}</span></h3>
          <button onClick={() => { loadBackups(); loadInfo(); }} className="text-[11px] text-primary hover:underline flex items-center gap-1">
            <RefreshCw size={12} /> {t("刷新", "Refresh")}
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-xs">
            <HardDrive size={32} className="mx-auto mb-2 opacity-30" />
            <p>{t("暂无备份", "No backups yet")}</p>
            <p className="mt-1">{t("点击上方「立即备份」创建第一个备份", "Use “Create backup” above to create the first backup.")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-text-muted">
                <th className="text-left py-2 px-3 font-medium">{t("文件名", "Filename")}</th>
                <th className="text-right py-2 px-3 font-medium">{t("大小", "Size")}</th>
                <th className="text-left py-2 px-3 font-medium">{t("创建时间", "Created")}</th>
                <th className="text-right py-2 px-3 font-medium">{t("操作", "Actions")}</th>
              </tr></thead>
              <tbody>
                {backups.map((b, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-bg transition-colors">
                    <td className="py-2.5 px-3 font-mono text-text">{b.filename}</td>
                    <td className="py-2.5 px-3 text-right text-text-muted whitespace-nowrap">{b.size_human || formatFileSize(b.size)}</td>
                    <td className="py-2.5 px-3 text-text-muted whitespace-nowrap">{new Date(b.created_at || b.modified_at).toLocaleString(locale)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => { setRestoreTarget(b.filename); handleRestore(b.filename); }}
                          disabled={restoring && restoreTarget === b.filename}
                          className="text-[11px] text-orange-600 hover:bg-orange-50 px-2 py-1 rounded hover:text-orange-700 disabled:opacity-50"
                        >
                          {restoring && restoreTarget === b.filename ? t("恢复中...", "Restoring...") : t("恢复", "Restore")}
                        </button>
                        <button
                          onClick={() => handleDelete(b.filename)}
                          className="text-[11px] text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                        >{t("删除", "Delete")}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 表统计（可折叠） */}
      {dbInfo?.table_stats && Object.keys(dbInfo.table_stats).length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text mb-3">{t("表详情", "Table details")}</h3>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {Object.entries(dbInfo.table_stats).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between bg-bg rounded px-3 py-1.5 text-[11px]">
                <code className="text-text-muted truncate mr-2">{name}</code>
                <span className="font-semibold text-text shrink-0">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Edit3, LoaderCircle, Lock, RefreshCw, Save, X } from "lucide-react";
import { authFetch } from "../api/authFetch";
import { OpenModuleSetting, useOpenModules } from "../open-modules";
import { useLocale } from "../i18n";

interface Props { currentTenantId: number; isSuperAdmin: boolean }
const EN: Record<string, { label: string; description: string }> = {
  workspace: { label: "Workspace", description: "Your primary landing space for organization operations." },
  announcements: { label: "Announcements", description: "Publish and track organization notices." },
  organization: { label: "Organization", description: "Model groups, departments, positions, and reporting lines." },
  employees: { label: "Human–AI resources", description: "Manage human employees, AI employees, and the talent market." },
  skills: { label: "Skills & plugins", description: "Install capabilities and connect extensible tools." },
  chat: { label: "Collaboration", description: "Human–AI direct messages and group collaboration." },
  agents: { label: "Agent Studio", description: "Create governed AI assistants for organizational roles." },
  tasks: { label: "Tasks", description: "Plan, assign, and review collaborative work." },
  knowledge: { label: "Knowledge base", description: "Upload, manage, and reuse organizational knowledge." },
  reflections: { label: "Reflection engine", description: "Capture lessons and improve collaboration." },
  governance: { label: "Governance engine", description: "Configure human review, policies, and audit boundaries." },
  settings: { label: "System settings", description: "Configure tenant, models, modules, and people." },
};

export default function OpenModuleManagementTab({ currentTenantId, isSuperAdmin }: Props) {
  const reload = useOpenModules(s => s.load);
  const { isEnglish, t } = useLocale();
  const [tenants, setTenants] = useState<any[]>([]);
  const [selected, setSelected] = useState(currentTenantId);
  const [tenantName, setTenantName] = useState("");
  const [modules, setModules] = useState<OpenModuleSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const localized = (item: OpenModuleSetting) => isEnglish ? (EN[item.key] || { label: item.label, description: item.description }) : { label: item.label, description: item.description };
  const load = useCallback(async (id: number) => {
    setLoading(true); setError("");
    try {
      const response = await authFetch(`/api/module-settings?tenant_id=${id}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || t("加载失败", "Unable to load modules"));
      setModules(result.data.modules); setTenantName(result.data.tenant.name);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("加载失败", "Unable to load modules")); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void load(selected); }, [selected, load]);
  useEffect(() => {
    if (!isSuperAdmin) return;
    void authFetch("/api/admin/tenants").then(response => response.json()).then(result => { if (result.success) setTenants(result.data || []); }).catch(() => {});
  }, [isSuperAdmin]);

  const save = async (payload: unknown, key: string, success: string) => {
    setSaving(key); setError(""); setMessage("");
    try {
      const response = await authFetch("/api/module-settings", { method: "PUT", body: JSON.stringify({ tenant_id: selected, ...payload as object }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || t("保存失败", "Unable to save module settings"));
      setModules(result.data.modules); setMessage(success);
      if (selected === currentTenantId) await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("保存失败", "Unable to save module settings")); }
    finally { setSaving(null); }
  };
  const toggle = (item: OpenModuleSetting) => {
    const title = localized(item).label;
    void save({ updates: { [item.key]: !item.enabled } }, item.key, isEnglish ? `${title} ${item.enabled ? "disabled" : "enabled"}` : `${item.label}已${item.enabled ? "关闭" : "开启"}`);
  };
  const saveName = (item: OpenModuleSetting) => void save({ labels: { [item.key]: draft } }, item.key, isEnglish ? `${localized(item).label} renamed to ${draft.trim()}` : `${item.defaultLabel}已改名为${draft.trim()}`).then(() => setEditing(null));

  return <div className="max-w-5xl space-y-4">
    <div><h2 className="text-sm font-semibold">{t("租户模块管理", "Tenant module management")}</h2><p className="text-xs text-text-muted mt-1">{t("开关会同步控制侧栏与路由；显示名称按租户保存，不修改模块代码标识。", "Module switches control the sidebar and routes together. Display names are saved per tenant without changing module identifiers.")}</p></div>
    {isSuperAdmin ? <label className="block max-w-sm text-xs">{t("管理租户", "Manage tenant")}<select value={selected} onChange={event => setSelected(Number(event.target.value))} className="mt-2 w-full px-3 py-2 border border-border rounded bg-bg-card">{tenants.length ? tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.status}</option>) : <option value={currentTenantId}>{tenantName || t("当前租户", "Current tenant")}</option>}</select></label> : <div className="flex gap-2 text-xs text-text-muted"><Building2 size={14}/>{t("正在管理：", "Managing:")}<b className="text-text">{tenantName}</b></div>}
    {message && <div className="text-xs text-success bg-success/10 px-3 py-2 rounded flex gap-2"><Check size={14}/>{message}</div>}
    {error && <div className="text-xs text-danger bg-danger/10 px-3 py-2 rounded flex justify-between">{error}<button onClick={() => void load(selected)} aria-label={t("重试", "Retry")}><RefreshCw size={13}/></button></div>}
    {loading ? <div className="h-40 grid place-items-center text-xs text-text-muted"><span className="flex gap-2"><LoaderCircle size={16} className="animate-spin"/>{t("加载模块配置…", "Loading module configuration…")}</span></div> : <div className="grid md:grid-cols-2 gap-3">{modules.map(item => {
      const copy = localized(item);
      return <div key={item.key} className="p-4 bg-bg-card border border-border rounded-lg"><div className="flex items-start gap-3"><div className="flex-1 min-w-0">{editing === item.key ? <div className="flex gap-2"><input autoFocus value={draft} onChange={event => setDraft(event.target.value)} maxLength={20} className="min-w-0 flex-1 px-2 py-1 border border-primary rounded bg-bg text-sm"/><button onClick={() => saveName(item)} disabled={saving !== null} className="p-1.5 bg-primary text-white rounded" aria-label={t("保存", "Save")}><Save size={14}/></button><button onClick={() => setEditing(null)} className="p-1.5 border border-border rounded" aria-label={t("取消", "Cancel")}><X size={14}/></button></div> : <div className="flex items-center gap-2"><p className="text-sm font-medium">{copy.label}</p><button onClick={() => { setEditing(item.key); setDraft(item.label); }} className="text-text-muted hover:text-primary" title={t("编辑显示名称", "Edit display name")}><Edit3 size={13}/></button><span className={`text-[10px] px-2 py-0.5 rounded ${item.enabled ? "bg-success/10 text-success" : "bg-bg text-text-muted"}`}>{item.enabled ? t("已开启", "Enabled") : t("已关闭", "Disabled")}</span></div>}<p className="text-[11px] text-text-muted mt-2">{copy.description}</p><code className="text-[10px] text-text-muted">@openxyos/{item.key}</code></div>{item.locked ? <span className="w-11 h-6 rounded-full bg-primary/20 text-primary grid place-items-center" title={t("基础模块始终保留", "Foundation module is always available")}><Lock size={13}/></span> : <button role="switch" aria-checked={item.enabled} disabled={saving !== null} onClick={() => toggle(item)} className={`relative w-11 h-6 rounded-full ${item.enabled ? "bg-primary" : "bg-gray-300"}`} aria-label={isEnglish ? `${copy.label}: ${item.enabled ? "enabled" : "disabled"}` : `${copy.label}：${item.enabled ? "已开启" : "已关闭"}`}><span className={`absolute top-.5 left-.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${item.enabled ? "translate-x-5" : ""}`}>{saving === item.key && <LoaderCircle size={12} className="animate-spin m-1 text-primary"/>}</span></button>}</div></div>;
    })}</div>}
    <div className="text-[11px] text-text-muted border-t border-border pt-3">{t("工作台与系统设置是恢复和管理入口，始终保留；其名称仍可编辑。模块开关不会提升用户权限。", "Workspace and System settings are recovery and management entry points, so they remain available. Their names can still be edited. Module switches never grant extra user permissions.")}</div>
  </div>;
}

import { useCallback, useEffect, useState } from "react";
import { Building2, LoaderCircle, RefreshCw } from "lucide-react";
import { authFetch } from "../api/authFetch";
import { useModuleSettingsStore, TenantModuleSetting } from "../stores/modules";

interface TenantSummary {
  id: number;
  name: string;
  status: string;
}

interface ModuleManagementTabProps {
  currentTenantId: number;
  isSuperAdmin: boolean;
}

export default function ModuleManagementTab({ currentTenantId, isSuperAdmin }: ModuleManagementTabProps) {
  const reloadCurrentModules = useModuleSettingsStore(state => state.load);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState(currentTenantId);
  const [tenantName, setTenantName] = useState("");
  const [modules, setModules] = useState<TenantModuleSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadModules = useCallback(async (tenantId: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch(`/api/module-settings?tenant_id=${tenantId}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "模块配置加载失败");
      setModules(result.data.modules);
      setTenantName(result.data.tenant.name);
    } catch (loadError) {
      setModules([]);
      setError(loadError instanceof Error ? loadError.message : "模块配置加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModules(selectedTenantId);
  }, [selectedTenantId, loadModules]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void authFetch("/api/admin/tenants")
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "租户列表加载失败");
        setTenants(result.data);
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : "租户列表加载失败"));
  }, [isSuperAdmin]);

  async function toggleModule(module: TenantModuleSetting) {
    setSavingKey(module.key);
    setError("");
    setMessage("");
    try {
      const response = await authFetch("/api/module-settings", {
        method: "PUT",
        body: JSON.stringify({ tenant_id: selectedTenantId, updates: { [module.key]: !module.enabled } }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "模块设置保存失败");
      setModules(result.data.modules);
      setMessage(`${module.label}已${module.enabled ? "关闭" : "开启"}`);
      if (selectedTenantId === currentTenantId) await reloadCurrentModules();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "模块设置保存失败");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-text">租户模块管理</h2>
        <p className="text-xs text-text-muted mt-1">关闭模块后，该租户所有用户的左侧导航项会立即消失，直接访问对应地址也会返回工作台。</p>
      </div>

      {isSuperAdmin ? (
        <label className="block max-w-sm">
          <span className="text-xs font-medium text-text">管理租户</span>
          <select
            value={selectedTenantId}
            onChange={event => setSelectedTenantId(Number(event.target.value))}
            className="mt-2 w-full px-3 py-2 border border-border rounded bg-bg-card text-sm outline-none focus:border-primary"
          >
            {tenants.length === 0 ? <option value={currentTenantId}>{tenantName || "当前租户"}</option> : null}
            {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.status}</option>)}
          </select>
        </label>
      ) : (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Building2 size={14} />正在管理：<span className="font-medium text-text">{tenantName || "当前租户"}</span>
        </div>
      )}

      {message ? <div className="text-xs text-success bg-success/10 px-3 py-2 rounded">{message}</div> : null}
      {error ? (
        <div className="flex items-center justify-between gap-3 text-xs text-danger bg-danger/10 px-3 py-2 rounded">
          <span>{error}</span>
          <button onClick={() => void loadModules(selectedTenantId)} className="flex items-center gap-1 font-medium"><RefreshCw size={12} />重试</button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-xs text-text-muted"><LoaderCircle size={16} className="animate-spin mr-2" />加载模块配置...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {modules.map(module => {
            const saving = savingKey === module.key;
            return (
              <div key={module.key} className="flex items-center justify-between gap-4 p-4 bg-bg-card border border-border rounded-lg">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text">{module.label}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${module.enabled ? "bg-success/10 text-success" : "bg-bg text-text-muted"}`}>
                      {module.enabled ? "已开启" : "已关闭"}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">{module.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={module.enabled}
                  aria-label={`${module.label}模块`}
                  disabled={savingKey !== null}
                  onClick={() => void toggleModule(module)}
                  className={`relative w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50 ${module.enabled ? "bg-primary" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${module.enabled ? "translate-x-5" : ""}`}>
                    {saving ? <LoaderCircle size={12} className="animate-spin m-1 text-primary" /> : null}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[11px] text-text-muted border-t border-border pt-3">
        工作台、系统设置和管理入口属于基础能力，始终保留。模块开关不会提升用户权限；例如审计追溯仍仅对超级管理员显示。
      </div>
    </div>
  );
}

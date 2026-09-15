import { useState, useEffect, useCallback } from "react";
import { GitBranch, Plus, RefreshCw, RotateCcw, Trash2, History, Settings } from "lucide-react";
import { authFetch } from "../api/authFetch";

interface ConfigVersion {
  id: number; config_type: string; config_key: string;
  config_value: string | null; version: number;
  change_reason: string | null; status: string; created_at: string;
}

interface ConfigStats {
  by_type: { config_type: string; count: number; latest_version: number }[];
  recent_changes: ConfigVersion[];
}

export default function ConfigVersionPage() {
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [stats, setStats] = useState<ConfigStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [newConfig, setNewConfig] = useState({
    config_type: "ai", config_key: "", config_value: "", change_reason: ""
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, sRes] = await Promise.all([
        authFetch(`/api/config-versions${filterType ? `?type=${filterType}` : ""}`).then(r => r.json()),
        authFetch("/api/config-versions/stats").then(r => r.json()),
      ]);
      if (vRes.success) setVersions(vRes.data || []);
      if (sRes.success) setStats(sRes.data);
    } catch {}
    setLoading(false);
  }, [filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!newConfig.config_key.trim()) return;
    await authFetch("/api/config-versions", {
      method: "POST",
      body: JSON.stringify(newConfig),
    });
    setNewConfig({ config_type: "ai", config_key: "", config_value: "", change_reason: "" });
    setShowCreate(false);
    fetchData();
  };

  const handleRollback = async (id: number) => {
    if (!confirm("确定回滚到此版本？")) return;
    await authFetch(`/api/config-versions/rollback/${id}`, { method: "POST" });
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此版本？")) return;
    await authFetch(`/api/config-versions/${id}`, { method: "DELETE" });
    fetchData();
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") return <span className="text-xs px-2 py-0.5 bg-success/10 text-success [border-radius:1.5px]">当前</span>;
    return <span className="text-xs px-2 py-0.5 bg-text-muted/10 text-text-muted [border-radius:1.5px]">历史</span>;
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <GitBranch size={20} className="text-info" />
          <h1 className="text-lg font-semibold">配置版本</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 text-text-muted hover:text-text hover:bg-surface rounded-lg">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-sm [border-radius:1.5px]">
            <Plus size={14} /> 新建版本
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="px-4 py-3 border-b border-border/30 bg-surface/30">
          <div className="flex flex-col gap-2 max-w-xl">
            <div className="flex gap-2">
              <select value={newConfig.config_type} onChange={e => setNewConfig(p => ({ ...p, config_type: e.target.value }))}
                className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]">
                <option value="ai">AI配置</option>
                <option value="system">系统配置</option>
                <option value="ui">界面配置</option>
                <option value="security">安全配置</option>
              </select>
              <input value={newConfig.config_key} onChange={e => setNewConfig(p => ({ ...p, config_key: e.target.value }))}
                placeholder="配置键" className="flex-1 px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
            </div>
            <textarea value={newConfig.config_value} onChange={e => setNewConfig(p => ({ ...p, config_value: e.target.value }))}
              placeholder="配置值（JSON格式）" rows={3} className="px-3 py-2 bg-bg border border-border/50 text-sm resize-none font-mono [border-radius:1.5px]" />
            <input value={newConfig.change_reason} onChange={e => setNewConfig(p => ({ ...p, change_reason: e.target.value }))}
              placeholder="变更原因" className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-primary text-white text-sm [border-radius:1.5px]">保存</button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-text-muted text-sm hover:bg-surface [border-radius:1.5px]">取消</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted">加载中...</div>
        ) : (
          <div className="space-y-6">
            {/* 统计概览 */}
            {stats && stats.by_type.length > 0 && (
              <div className="bg-bg-card border border-border/30 p-4 [border-radius:1.5px]">
                <div className="flex items-center gap-2 mb-3">
                  <Settings size={16} className="text-primary" />
                  <h2 className="text-sm font-medium">配置概览</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {stats.by_type.map(t => (
                    <div key={t.config_type} className="text-center p-3 bg-surface/30 [border-radius:1.5px]">
                      <div className="text-lg font-bold text-primary">{t.count}</div>
                      <div className="text-xs text-text-muted">{t.config_type}</div>
                      <div className="text-[10px] text-text-muted">最新v{t.latest_version}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 过滤器 */}
            <div className="flex gap-2">
              {["", "ai", "system", "ui", "security"].map(type => (
                <button key={type} onClick={() => setFilterType(type)}
                  className={`px-3 py-1 text-xs [border-radius:1.5px] ${filterType === type ? "bg-primary text-white" : "bg-surface text-text-muted hover:bg-surface/80"}`}>
                  {type || "全部"}
                </button>
              ))}
            </div>

            {/* 版本列表 */}
            <div className="space-y-2">
              {versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-text-muted">
                  <GitBranch size={32} className="mb-2 opacity-30" />
                  <span>暂无配置版本</span>
                </div>
              ) : (
                versions.map(v => (
                  <div key={v.id} className="bg-bg-card border border-border/30 p-4 [border-radius:1.5px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <History size={14} className="text-text-muted" />
                          <span className="text-sm font-medium">v{v.version}</span>
                        </div>
                        {getStatusBadge(v.status)}
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary [border-radius:1.5px]">{v.config_type}</span>
                        <span className="text-sm font-mono">{v.config_key}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {v.status !== "active" && (
                          <button onClick={() => handleRollback(v.id)} title="回滚"
                            className="p-1.5 text-text-muted hover:text-warning hover:bg-surface rounded">
                            <RotateCcw size={14} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(v.id)} title="删除"
                          className="p-1.5 text-text-muted hover:text-danger hover:bg-surface rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {v.config_value && (
                      <pre className="mt-2 p-2 bg-surface/30 text-xs font-mono text-text-muted overflow-auto max-h-20 [border-radius:1.5px]">
                        {v.config_value}
                      </pre>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                      {v.change_reason && <span>原因: {v.change_reason}</span>}
                      <span>{new Date(v.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

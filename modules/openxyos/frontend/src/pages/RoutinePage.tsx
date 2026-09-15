import { useState, useEffect, useCallback } from "react";
import { Repeat, Plus, RefreshCw, Play, Pause, Clock, CheckCircle, XCircle } from "lucide-react";
import { authFetch } from "../api/authFetch";

interface Routine {
  id: number; name: string; description: string; routine_type: string;
  cron_expression: string | null; interval_minutes: number | null;
  assigned_to: number | null; assigned_type: string; status: string;
  last_run_at: string | null; next_run_at: string | null;
}

interface RoutineLog {
  id: number; routine_id: number; routine_name?: string;
  status: string; result: string | null; error: string | null;
  started_at: string; completed_at: string | null;
}

const ROUTINE_TYPES: Record<string, string> = {
  task: "任务生成", report: "报告生成", cleanup: "数据清理", sync: "数据同步", custom: "自定义",
};
const ROUTINE_TYPE_COLORS: Record<string, string> = {
  task: "bg-primary/10 text-primary", report: "bg-success/10 text-success",
  cleanup: "bg-warning/10 text-warning", sync: "bg-accent/10 text-accent", custom: "bg-info/10 text-info",
};

export default function RoutinePage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"routines" | "logs">("routines");
  const [newRoutine, setNewRoutine] = useState({
    name: "", description: "", routine_type: "task", interval_minutes: 60, assigned_type: "ai"
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, lRes] = await Promise.all([
        authFetch("/api/routines").then(r => r.json()),
        authFetch("/api/routines/logs?limit=20").then(r => r.json()),
      ]);
      if (rRes.success) setRoutines(rRes.data || []);
      if (lRes.success) setLogs(lRes.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!newRoutine.name.trim()) return;
    await authFetch("/api/routines", {
      method: "POST",
      body: JSON.stringify(newRoutine),
    });
    setNewRoutine({ name: "", description: "", routine_type: "task", interval_minutes: 60, assigned_type: "ai" });
    setShowCreate(false);
    fetchData();
  };

  const handleToggle = async (routine: Routine) => {
    const newStatus = routine.status === "active" ? "paused" : "active";
    await authFetch(`/api/routines/${routine.id}`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus }),
    });
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此例行任务？")) return;
    await authFetch(`/api/routines/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleExecute = async (id: number) => {
    await authFetch(`/api/routines/${id}/execute`, { method: "POST" });
    fetchData();
  };

  const formatInterval = (minutes: number | null) => {
    if (!minutes) return "-";
    if (minutes < 60) return `${minutes}分钟`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}小时`;
    return `${Math.floor(minutes / 1440)}天`;
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Repeat size={20} className="text-accent" />
          <h1 className="text-lg font-semibold">例行任务</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 text-text-muted hover:text-text hover:bg-surface rounded-lg">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-sm [border-radius:1.5px]">
            <Plus size={14} /> 新建任务
          </button>
        </div>
      </div>

      {/* Tab切换 */}
      <div className="flex border-b border-border/30">
        <button onClick={() => setActiveTab("routines")}
          className={`px-4 py-2 text-sm ${activeTab === "routines" ? "text-primary border-b-2 border-primary" : "text-text-muted"}`}>
          任务列表
        </button>
        <button onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 text-sm ${activeTab === "logs" ? "text-primary border-b-2 border-primary" : "text-text-muted"}`}>
          执行日志
        </button>
      </div>

      {showCreate && (
        <div className="px-4 py-3 border-b border-border/30 bg-surface/30">
          <div className="flex flex-col gap-2 max-w-xl">
            <input value={newRoutine.name} onChange={e => setNewRoutine(p => ({ ...p, name: e.target.value }))}
              placeholder="任务名称" className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
            <input value={newRoutine.description} onChange={e => setNewRoutine(p => ({ ...p, description: e.target.value }))}
              placeholder="描述（可选）" className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
            <div className="flex gap-2">
              <select value={newRoutine.routine_type} onChange={e => setNewRoutine(p => ({ ...p, routine_type: e.target.value }))}
                className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]">
                <option value="task">任务生成</option>
                <option value="report">报告生成</option>
                <option value="cleanup">数据清理</option>
                <option value="sync">数据同步</option>
                <option value="custom">自定义</option>
              </select>
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-muted">每</span>
                <input type="number" value={newRoutine.interval_minutes} onChange={e => setNewRoutine(p => ({ ...p, interval_minutes: Number(e.target.value) }))}
                  className="w-20 px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
                <span className="text-sm text-text-muted">分钟</span>
              </div>
              <button onClick={handleCreate} className="px-4 py-2 bg-primary text-white text-sm [border-radius:1.5px]">创建</button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-text-muted text-sm hover:bg-surface [border-radius:1.5px]">取消</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted">加载中...</div>
        ) : activeTab === "routines" ? (
          <div className="space-y-3">
            {routines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-text-muted">
                <Repeat size={32} className="mb-2 opacity-30" />
                <span>暂无例行任务</span>
              </div>
            ) : (
              routines.map(routine => (
                <div key={routine.id} className="bg-bg-card border border-border/30 p-4 [border-radius:1.5px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 [border-radius:1.5px] ${ROUTINE_TYPE_COLORS[routine.routine_type]}`}>
                        {ROUTINE_TYPES[routine.routine_type]}
                      </span>
                      <span className="text-sm font-medium">{routine.name}</span>
                      {routine.description && <span className="text-xs text-text-muted">{routine.description}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleExecute(routine.id)} title="立即执行"
                        className="p-1.5 text-text-muted hover:text-primary hover:bg-surface rounded">
                        <Play size={14} />
                      </button>
                      <button onClick={() => handleToggle(routine)} title={routine.status === "active" ? "暂停" : "启用"}
                        className={`p-1.5 rounded ${routine.status === "active" ? "text-success hover:text-warning" : "text-text-muted hover:text-success"}`}>
                        {routine.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button onClick={() => handleDelete(routine.id)} title="删除"
                        className="p-1.5 text-text-muted hover:text-danger hover:bg-surface rounded">
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                    <span className="flex items-center gap-1"><Clock size={12} /> 每{formatInterval(routine.interval_minutes)}</span>
                    <span>执行者: {routine.assigned_type === "ai" ? "AI" : "人类"}</span>
                    {routine.last_run_at && <span>上次执行: {new Date(routine.last_run_at).toLocaleString()}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-text-muted">
                <Clock size={32} className="mb-2 opacity-30" />
                <span>暂无执行记录</span>
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 px-3 py-2 bg-bg-card border border-border/30 [border-radius:1.5px]">
                  {log.status === "success" ? (
                    <CheckCircle size={14} className="text-success" />
                  ) : (
                    <XCircle size={14} className="text-danger" />
                  )}
                  <span className="text-sm font-medium">{(log as any).routine_name || `任务#${log.routine_id}`}</span>
                  <span className="text-xs text-text-muted">{log.result || log.error || "-"}</span>
                  <span className="text-xs text-text-muted ml-auto">{new Date(log.started_at).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

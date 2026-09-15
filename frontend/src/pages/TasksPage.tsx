import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ListTodo, Plus, RefreshCw, Search, Filter, ChevronDown, Bot, MessageSquare, Paperclip, CheckCircle } from "lucide-react";
import { authFetch } from "../api/authFetch";
import Avatar from "../components/Avatar";
import { useLocale } from "../i18n";

interface Task {
  id: number; title: string; status: string; priority: string;
  assignee_name?: string; assignee_avatar?: string; assignee_avatar_url?: string; description?: string;
  created_at: string; subtask_count?: number; subtask_done?: number; comment_count?: number;
}

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-info/10 text-info", in_progress: "bg-warning/10 text-warning",
  review: "bg-accent/10 text-accent", done: "bg-success/10 text-success",
};
const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-danger", high: "text-warning", medium: "text-info", low: "text-text-muted",
};

export default function TasksPage() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterPriority) params.append("priority", filterPriority);
      if (searchQuery) params.append("search", searchQuery);

      const [tRes, sRes] = await Promise.all([
        authFetch(`/api/tasks?${params.toString()}`).then(r => r.json()),
        authFetch("/api/tasks/stats").then(r => r.json()),
      ]);
      if (tRes.success) setTasks(tRes.data || []);
      if (sRes.success) setStats(sRes.data);
    } catch {}
    setLoading(false);
  }, [filterStatus, filterPriority, searchQuery]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await authFetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: newTitle,
        description: newDescription,
        priority: newPriority,
      }),
    });
    setNewTitle("");
    setNewDescription("");
    setNewPriority("medium");
    setShowCreate(false);
    fetchTasks();
  };

  const handleTransition = async (id: number, to: string) => {
    await authFetch(`/api/tasks/${id}/transition`, { method: "POST", body: JSON.stringify({ to }) });
    fetchTasks();
  };

  const statusLabel = (status: string) => ({ todo: t("待办", "To do"), in_progress: t("进行中", "In progress"), review: t("评审中", "In review"), done: t("已完成", "Done") }[status] || status);
  const statusFilters = [
    { value: "all", label: t("全部", "All"), count: stats?.total || 0 },
    { value: "todo", label: t("待办", "To do"), count: stats?.todo || 0 },
    { value: "in_progress", label: t("进行中", "In progress"), count: stats?.in_progress || 0 },
    { value: "review", label: t("评审中", "In review"), count: stats?.review || 0 },
    { value: "done", label: t("已完成", "Done"), count: stats?.done || 0 },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-card">
        <div>
          <h1 className="text-lg font-bold text-text">{t("任务管理", "Task management")}</h1>
          {stats && (
            <p className="text-xs text-text-muted mt-0.5">
              {t("总计 " + (stats.total || 0) + " 个任务 · " + (stats.in_progress || 0) + " 进行中 · " + (stats.done || 0) + " 已完成", (stats.total || 0) + " total · " + (stats.in_progress || 0) + " in progress · " + (stats.done || 0) + " done")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchTasks} className="p-2 rounded-md hover:bg-bg-card text-text-muted" title={t("刷新", "Refresh")}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-sm font-medium hover:opacity-90">
            <Plus size={16} /> {t("创建任务", "Create task")}
          </button>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-border bg-bg-card">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t("搜索任务...", "Search tasks...")}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${
              showFilters ? "border-primary bg-primary-bg text-primary" : "border-border text-text-muted hover:bg-bg"
            }`}
          >
            <Filter size={14} />
            {t("筛选", "Filter")}
            <ChevronDown size={12} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{t("状态:", "Status:")}</span>
              <div className="flex gap-1">
                {statusFilters.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFilterStatus(f.value)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                      filterStatus === f.value
                        ? "bg-primary text-white"
                        : "bg-bg text-text-muted hover:bg-bg-card"
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{t("优先级:", "Priority:")}</span>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="px-2.5 py-1 border border-border rounded-md text-xs outline-none focus:border-primary"
              >
                <option value="">{t("全部", "All")}</option>
                <option value="critical">{t("紧急", "Critical")}</option>
                <option value="high">{t("高", "High")}</option>
                <option value="medium">{t("中", "Medium")}</option>
                <option value="low">{t("低", "Low")}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-text-muted">
            <RefreshCw size={20} className="animate-spin mr-2" /> {t("加载中...", "Loading...")}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
            <ListTodo size={48} className="mb-3 opacity-30" />
            <p className="text-sm">{t("暂无任务", "No tasks yet")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <div
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-bg-card border border-transparent hover:border-border transition-all cursor-pointer group"
              >
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
                  {statusLabel(task.status)}
                </span>
                <span className={`text-[10px] font-bold ${PRIORITY_COLORS[task.priority]}`}>
                  {task.priority === "critical" ? "!!" : task.priority === "high" ? "!" : ""}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text truncate block">{task.title}</span>
                  <div className="flex items-center gap-3 mt-1">
                    {(task.subtask_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-text-muted">
                        <CheckCircle size={10} />
                        {task.subtask_done}/{task.subtask_count}
                      </span>
                    )}
                    {(task.comment_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-text-muted">
                        <MessageSquare size={10} />
                        {task.comment_count}
                      </span>
                    )}
                  </div>
                </div>
                {task.assignee_name && (
                  <div className="flex items-center gap-1.5">
                    <Avatar id={task.id} name={task.assignee_name} size={20} customSrc={task.assignee_avatar_url || undefined} />
                    <span className="text-[10px] text-text-muted">{task.assignee_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {task.status === "todo" && (
                    <button
                      onClick={e => { e.stopPropagation(); handleTransition(task.id, "in_progress"); }}
                      className="text-[10px] px-2 py-1 bg-warning/10 text-warning rounded hover:opacity-80"
                    >{t("执行", "Start")}</button>
                  )}
                  {task.status === "in_progress" && (
                    <button
                      onClick={e => { e.stopPropagation(); handleTransition(task.id, "review"); }}
                      className="text-[10px] px-2 py-1 bg-accent/10 text-accent rounded hover:opacity-80"
                    >{t("提交", "Submit")}</button>
                  )}
                  {task.status === "review" && (
                    <button
                      onClick={e => { e.stopPropagation(); handleTransition(task.id, "done"); }}
                      className="text-[10px] px-2 py-1 bg-success/10 text-success rounded hover:opacity-80"
                    >{t("通过", "Approve")}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-bg-card rounded-xl shadow-xl p-6 w-[500px]" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold mb-4">{t("创建新任务", "Create a task")}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">{t("任务标题", "Task title")}</label>
                <input
                  autoFocus
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder={t("输入任务标题...", "Enter a task title...")}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">{t("任务描述", "Description")}</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder={t("描述任务详情...", "Describe the task...")}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">{t("优先级", "Priority")}</label>
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none focus:border-primary"
                >
                  <option value="low">{t("低优先级", "Low")}</option>
                  <option value="medium">{t("中优先级", "Medium")}</option>
                  <option value="high">{t("高优先级", "High")}</option>
                  <option value="critical">{t("紧急", "Critical")}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text">{t("取消", "Cancel")}</button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
              >{t("创建任务", "Create task")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Target, Plus, ChevronRight, ChevronDown, Link as LinkIcon, Trash2, Edit2, RefreshCw } from "lucide-react";
import { authFetch } from "../api/authFetch";

interface Goal {
  id: number; title: string; description: string; goal_type: string;
  status: string; progress: number; cycle: string;
  parent_id: number | null; owner_id: number | null;
  start_date: string; end_date: string; children?: Goal[];
}

const GOAL_TYPES: Record<string, string> = {
  company: "公司级", department: "部门级", personal: "个人级",
};
const GOAL_TYPE_COLORS: Record<string, string> = {
  company: "bg-primary/10 text-primary", department: "bg-accent/10 text-accent", personal: "bg-success/10 text-success",
};
const STATUS_LABELS: Record<string, string> = {
  active: "进行中", completed: "已完成", paused: "已暂停", cancelled: "已取消",
};

export default function GoalPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [newGoal, setNewGoal] = useState({ title: "", description: "", goal_type: "company", cycle: "Q2-2026" });

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/goals/tree").then(r => r.json());
      if (res.success) setGoals(res.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleCreate = async () => {
    if (!newGoal.title.trim()) return;
    await authFetch("/api/goals", {
      method: "POST",
      body: JSON.stringify(newGoal),
    });
    setNewGoal({ title: "", description: "", goal_type: "company", cycle: "Q2-2026" });
    setShowCreate(false);
    fetchGoals();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此目标？")) return;
    await authFetch(`/api/goals/${id}`, { method: "DELETE" });
    fetchGoals();
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderGoal = (goal: Goal, level: number = 0) => {
    const isExpanded = expandedIds.has(goal.id);
    const hasChildren = goal.children && goal.children.length > 0;

    return (
      <div key={goal.id} style={{ marginLeft: level * 24 }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 hover:bg-surface/50">
          {hasChildren ? (
            <button onClick={() => toggleExpand(goal.id)} className="text-text-muted hover:text-text">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : <div className="w-4" />}

          <Target size={16} className="text-primary" />
          <span className="flex-1 text-sm font-medium">{goal.title}</span>

          <span className={`text-xs px-2 py-0.5 [border-radius:1.5px] ${GOAL_TYPE_COLORS[goal.goal_type] || ""}`}>
            {GOAL_TYPES[goal.goal_type]}
          </span>

          <div className="w-24 h-1.5 bg-border/30 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${goal.progress}%` }} />
          </div>
          <span className="text-xs text-text-muted w-10 text-right">{goal.progress}%</span>

          <button onClick={() => handleDelete(goal.id)} className="text-text-muted hover:text-danger p-1">
            <Trash2 size={14} />
          </button>
        </div>

        {isExpanded && hasChildren && goal.children!.map(child => renderGoal(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Target size={20} className="text-primary" />
          <h1 className="text-lg font-semibold">目标管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchGoals} className="p-2 text-text-muted hover:text-text hover:bg-surface rounded-lg">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-sm [border-radius:1.5px]">
            <Plus size={14} /> 新建目标
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="px-4 py-3 border-b border-border/30 bg-surface/30">
          <div className="flex flex-col gap-2 max-w-xl">
            <input value={newGoal.title} onChange={e => setNewGoal(p => ({ ...p, title: e.target.value }))}
              placeholder="目标名称" className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
            <textarea value={newGoal.description} onChange={e => setNewGoal(p => ({ ...p, description: e.target.value }))}
              placeholder="目标描述（可选）" rows={2} className="px-3 py-2 bg-bg border border-border/50 text-sm resize-none [border-radius:1.5px]" />
            <div className="flex gap-2">
              <select value={newGoal.goal_type} onChange={e => setNewGoal(p => ({ ...p, goal_type: e.target.value }))}
                className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]">
                <option value="company">公司级</option>
                <option value="department">部门级</option>
                <option value="personal">个人级</option>
              </select>
              <input value={newGoal.cycle} onChange={e => setNewGoal(p => ({ ...p, cycle: e.target.value }))}
                placeholder="周期 如 Q2-2026" className="flex-1 px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
              <button onClick={handleCreate} className="px-4 py-2 bg-primary text-white text-sm [border-radius:1.5px]">创建</button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-text-muted text-sm hover:bg-surface [border-radius:1.5px]">取消</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted">加载中...</div>
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-muted">
            <Target size={32} className="mb-2 opacity-30" />
            <span>暂无目标</span>
          </div>
        ) : (
          <div className="border-b border-border/30">
            {goals.map(g => renderGoal(g))}
          </div>
        )}
      </div>
    </div>
  );
}

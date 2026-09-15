import { useState, useEffect, useCallback } from "react";
import { DollarSign, Plus, RefreshCw, AlertTriangle, CheckCircle, TrendingUp, BarChart3 } from "lucide-react";
import { authFetch } from "../api/authFetch";

interface Budget {
  id: number; name: string; budget_type: string; limit_amount: number;
  used_amount: number; cycle: string; alert_threshold: number; status: string;
  usage_percent?: number; is_alert?: boolean; is_exceeded?: boolean;
}

interface TokenStats {
  period: string; input_tokens: number; output_tokens: number;
  total_tokens: number; total_cost: number; request_count: number;
}

const BUDGET_TYPES: Record<string, string> = {
  token: "Token额度", cost: "费用预算", request: "请求数限制",
};
const BUDGET_TYPE_COLORS: Record<string, string> = {
  token: "bg-primary/10 text-primary", cost: "bg-success/10 text-success", request: "bg-accent/10 text-accent",
};

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [stats, setStats] = useState<TokenStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newBudget, setNewBudget] = useState({ name: "", budget_type: "token", limit_amount: 1000000, alert_threshold: 80, cycle: "monthly" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        authFetch("/api/budgets/alerts").then(r => r.json()),
        authFetch("/api/budgets/usage/stats?period=monthly").then(r => r.json()),
      ]);
      if (bRes.success) setBudgets(bRes.data || []);
      if (sRes.success) setStats(sRes.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!newBudget.name.trim()) return;
    await authFetch("/api/budgets", {
      method: "POST",
      body: JSON.stringify(newBudget),
    });
    setNewBudget({ name: "", budget_type: "token", limit_amount: 1000000, alert_threshold: 80, cycle: "monthly" });
    setShowCreate(false);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此预算？")) return;
    await authFetch(`/api/budgets/${id}`, { method: "DELETE" });
    fetchData();
  };

  const getUsageColor = (budget: Budget) => {
    if (budget.is_exceeded) return "bg-danger";
    if (budget.is_alert) return "bg-warning";
    return "bg-primary";
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <DollarSign size={20} className="text-success" />
          <h1 className="text-lg font-semibold">预算管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 text-text-muted hover:text-text hover:bg-surface rounded-lg">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-sm [border-radius:1.5px]">
            <Plus size={14} /> 新建预算
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="px-4 py-3 border-b border-border/30 bg-surface/30">
          <div className="flex flex-col gap-2 max-w-xl">
            <input value={newBudget.name} onChange={e => setNewBudget(p => ({ ...p, name: e.target.value }))}
              placeholder="预算名称" className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
            <div className="flex gap-2">
              <select value={newBudget.budget_type} onChange={e => setNewBudget(p => ({ ...p, budget_type: e.target.value }))}
                className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]">
                <option value="token">Token额度</option>
                <option value="cost">费用预算</option>
                <option value="request">请求数限制</option>
              </select>
              <input type="number" value={newBudget.limit_amount} onChange={e => setNewBudget(p => ({ ...p, limit_amount: Number(e.target.value) }))}
                placeholder="预算额度" className="flex-1 px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
              <input type="number" value={newBudget.alert_threshold} onChange={e => setNewBudget(p => ({ ...p, alert_threshold: Number(e.target.value) }))}
                placeholder="预警阈值%" className="w-24 px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
            </div>
            <div className="flex gap-2">
              <select value={newBudget.cycle} onChange={e => setNewBudget(p => ({ ...p, cycle: e.target.value }))}
                className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]">
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
                <option value="yearly">每年</option>
              </select>
              <button onClick={handleCreate} className="px-4 py-2 bg-primary text-white text-sm [border-radius:1.5px]">创建</button>
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
            {/* 预算卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgets.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center h-40 text-text-muted">
                  <DollarSign size={32} className="mb-2 opacity-30" />
                  <span>暂无预算</span>
                </div>
              ) : (
                budgets.map(budget => (
                  <div key={budget.id} className="bg-bg-card border border-border/30 p-4 [border-radius:1.5px]">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs px-2 py-0.5 [border-radius:1.5px] ${BUDGET_TYPE_COLORS[budget.budget_type]}`}>
                        {BUDGET_TYPES[budget.budget_type]}
                      </span>
                      {budget.is_exceeded ? (
                        <AlertTriangle size={16} className="text-danger" />
                      ) : budget.is_alert ? (
                        <AlertTriangle size={16} className="text-warning" />
                      ) : (
                        <CheckCircle size={16} className="text-success" />
                      )}
                    </div>
                    <h3 className="text-sm font-medium mb-2">{budget.name}</h3>
                    <div className="w-full h-2 bg-border/30 rounded-full overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all ${getUsageColor(budget)}`}
                        style={{ width: `${Math.min(100, budget.usage_percent || 0)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>{budget.used_amount.toLocaleString()} / {budget.limit_amount.toLocaleString()}</span>
                      <span>{budget.usage_percent || 0}%</span>
                    </div>
                    <button onClick={() => handleDelete(budget.id)}
                      className="mt-3 text-xs text-text-muted hover:text-danger">删除</button>
                  </div>
                ))
              )}
            </div>

            {/* Token使用统计 */}
            {stats.length > 0 && (
              <div className="bg-bg-card border border-border/30 p-4 [border-radius:1.5px]">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} className="text-primary" />
                  <h2 className="text-sm font-medium">Token使用统计</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left py-2 text-text-muted font-medium">周期</th>
                        <th className="text-right py-2 text-text-muted font-medium">输入Token</th>
                        <th className="text-right py-2 text-text-muted font-medium">输出Token</th>
                        <th className="text-right py-2 text-text-muted font-medium">总Token</th>
                        <th className="text-right py-2 text-text-muted font-medium">费用</th>
                        <th className="text-right py-2 text-text-muted font-medium">请求数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map(s => (
                        <tr key={s.period} className="border-b border-border/20">
                          <td className="py-2">{s.period}</td>
                          <td className="text-right py-2">{s.input_tokens.toLocaleString()}</td>
                          <td className="text-right py-2">{s.output_tokens.toLocaleString()}</td>
                          <td className="text-right py-2 font-medium">{s.total_tokens.toLocaleString()}</td>
                          <td className="text-right py-2 text-success">¥{s.total_cost.toFixed(2)}</td>
                          <td className="text-right py-2">{s.request_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

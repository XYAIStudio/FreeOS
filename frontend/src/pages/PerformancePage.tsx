import { useState, useEffect, useCallback } from "react";
import { BarChart3, Plus, RefreshCw, TrendingUp, Award, Users, Bot } from "lucide-react";
import { authFetch } from "../api/authFetch";

interface PerformanceReview {
  id: number; employee_id: number; employee_type: string; review_period: string;
  overall_score: number; task_completion_score: number; quality_score: number;
  efficiency_score: number; collaboration_score: number; innovation_score: number;
  review_notes: string | null; status: string;
}

interface PerformanceSummary {
  latest_review: PerformanceReview | null;
  metrics: any[];
  task_stats: any;
  completion_rate: number;
}

export default function PerformancePage() {
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [newReview, setNewReview] = useState({
    employee_id: 0, employee_type: "ai", review_period: "2026-Q2",
    task_completion_score: 0, quality_score: 0, efficiency_score: 0,
    collaboration_score: 0, innovation_score: 0, review_notes: ""
  });

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/performance/reviews").then(r => r.json());
      if (res.success) setReviews(res.data || []);
    } catch {}
    setLoading(false);
  }, []);

  const fetchSummary = useCallback(async (employeeId: number) => {
    try {
      const res = await authFetch(`/api/performance/employee/${employeeId}/summary`).then(r => r.json());
      if (res.success) setSummary(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);
  useEffect(() => { if (selectedEmployee) fetchSummary(selectedEmployee); }, [selectedEmployee, fetchSummary]);

  const handleCreate = async () => {
    if (!newReview.employee_id) return;
    const overall = Math.round(
      newReview.task_completion_score * 0.4 +
      newReview.quality_score * 0.3 +
      newReview.efficiency_score * 0.3
    );
    await authFetch("/api/performance/reviews", {
      method: "POST",
      body: JSON.stringify({ ...newReview, overall_score: overall }),
    });
    setNewReview({
      employee_id: 0, employee_type: "ai", review_period: "2026-Q2",
      task_completion_score: 0, quality_score: 0, efficiency_score: 0,
      collaboration_score: 0, innovation_score: 0, review_notes: ""
    });
    setShowCreate(false);
    fetchReviews();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-danger";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "优秀";
    if (score >= 80) return "良好";
    if (score >= 60) return "合格";
    return "待改进";
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-warning" />
          <h1 className="text-lg font-semibold">绩效评估</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchReviews} className="p-2 text-text-muted hover:text-text hover:bg-surface rounded-lg">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-sm [border-radius:1.5px]">
            <Plus size={14} /> 新建评估
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="px-4 py-3 border-b border-border/30 bg-surface/30">
          <div className="flex flex-col gap-2 max-w-xl">
            <div className="flex gap-2">
              <input type="number" value={newReview.employee_id || ""} onChange={e => setNewReview(p => ({ ...p, employee_id: Number(e.target.value) }))}
                placeholder="员工ID" className="w-24 px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
              <select value={newReview.employee_type} onChange={e => setNewReview(p => ({ ...p, employee_type: e.target.value }))}
                className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]">
                <option value="ai">AI员工</option>
                <option value="human">人类员工</option>
              </select>
              <input value={newReview.review_period} onChange={e => setNewReview(p => ({ ...p, review_period: e.target.value }))}
                placeholder="评估周期 如 2026-Q2" className="flex-1 px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-text-muted">任务完成 (40%)</label>
                <input type="number" min="0" max="100" value={newReview.task_completion_score}
                  onChange={e => setNewReview(p => ({ ...p, task_completion_score: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
              </div>
              <div>
                <label className="text-xs text-text-muted">质量 (30%)</label>
                <input type="number" min="0" max="100" value={newReview.quality_score}
                  onChange={e => setNewReview(p => ({ ...p, quality_score: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
              </div>
              <div>
                <label className="text-xs text-text-muted">效率 (30%)</label>
                <input type="number" min="0" max="100" value={newReview.efficiency_score}
                  onChange={e => setNewReview(p => ({ ...p, efficiency_score: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
              </div>
            </div>
            <textarea value={newReview.review_notes} onChange={e => setNewReview(p => ({ ...p, review_notes: e.target.value }))}
              placeholder="评估备注（可选）" rows={2} className="px-3 py-2 bg-bg border border-border/50 text-sm resize-none [border-radius:1.5px]" />
            <div className="flex gap-2">
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
            {/* 评估列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center h-40 text-text-muted">
                  <BarChart3 size={32} className="mb-2 opacity-30" />
                  <span>暂无评估记录</span>
                </div>
              ) : (
                reviews.map(review => (
                  <div key={review.id} onClick={() => setSelectedEmployee(review.employee_id)}
                    className={`bg-bg-card border p-4 [border-radius:1.5px] cursor-pointer transition-all ${selectedEmployee === review.employee_id ? "border-primary" : "border-border/30 hover:border-border"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {review.employee_type === "ai" ? <Bot size={16} className="text-primary" /> : <Users size={16} className="text-success" />}
                        <span className="text-sm font-medium">员工 #{review.employee_id}</span>
                      </div>
                      <span className="text-xs text-text-muted">{review.review_period}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-2xl font-bold ${getScoreColor(review.overall_score)}`}>{review.overall_score}</span>
                      <span className="text-xs text-text-muted">{getScoreLabel(review.overall_score)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-text-muted">完成</div>
                        <div className="font-medium">{review.task_completion_score}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-text-muted">质量</div>
                        <div className="font-medium">{review.quality_score}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-text-muted">效率</div>
                        <div className="font-medium">{review.efficiency_score}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 员工绩效详情 */}
            {summary && (
              <div className="bg-bg-card border border-border/30 p-4 [border-radius:1.5px]">
                <div className="flex items-center gap-2 mb-4">
                  <Award size={16} className="text-primary" />
                  <h2 className="text-sm font-medium">员工 #{selectedEmployee} 绩效详情</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-surface/30 [border-radius:1.5px]">
                    <div className="text-2xl font-bold text-primary">{summary.completion_rate}%</div>
                    <div className="text-xs text-text-muted mt-1">任务完成率</div>
                  </div>
                  <div className="text-center p-3 bg-surface/30 [border-radius:1.5px]">
                    <div className="text-2xl font-bold text-success">{summary.task_stats?.completed || 0}</div>
                    <div className="text-xs text-text-muted mt-1">已完成任务</div>
                  </div>
                  <div className="text-center p-3 bg-surface/30 [border-radius:1.5px]">
                    <div className="text-2xl font-bold text-warning">{summary.task_stats?.total || 0}</div>
                    <div className="text-xs text-text-muted mt-1">总任务数</div>
                  </div>
                  <div className="text-center p-3 bg-surface/30 [border-radius:1.5px]">
                    <div className="text-2xl font-bold text-accent">{summary.metrics?.length || 0}</div>
                    <div className="text-xs text-text-muted mt-1">绩效指标</div>
                  </div>
                </div>
                {summary.latest_review && (
                  <div className="mt-4 pt-4 border-t border-border/30">
                    <div className="text-xs text-text-muted mb-2">最近评估: {summary.latest_review.review_period}</div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-primary" />
                        <span className="text-sm">总分: <strong>{summary.latest_review.overall_score}</strong></span>
                      </div>
                      <span className="text-xs text-text-muted">{summary.latest_review.review_notes || "无备注"}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

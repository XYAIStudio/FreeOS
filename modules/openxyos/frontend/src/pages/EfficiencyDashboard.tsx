import { useState, useEffect } from "react";
import { authFetch } from "../api/authFetch";
import { BarChart3, TrendingUp, Users, CheckCircle, Brain, DollarSign, Shield, RefreshCw, Activity, Target, Zap, Award, MessageSquare, PieChart } from "lucide-react";

interface DashboardData {
  latest: {
    task_completion_rate: number;
    collaboration_efficiency: number;
    knowledge_sediment_rate: number;
    cost_saving_rate: number;
    governance_coverage_rate: number;
    total_tasks: number;
    completed_tasks: number;
    total_agents: number;
    active_agents: number;
    metric_date: string;
  } | null;
  trends: any[];
  deptEfficiency: { dept_name: string; emp_count: number; task_count: number; done_count: number }[];
  taskStatusDist: { status: string; count: number }[];
  agentPerformance: { name: string; role: string; completed_tasks: number; total_tasks: number; message_count: number }[];
  chatStats: { chat_count: number; active_users: number };
}

const METRIC_CARDS = [
  { key: "task_completion_rate", label: "任务完成率", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", suffix: "%", desc: "目标 >90%" },
  { key: "collaboration_efficiency", label: "协作效能", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10", suffix: "h", desc: "平均任务耗时" },
  { key: "knowledge_sediment_rate", label: "知识沉淀率", icon: Brain, color: "text-purple-500", bg: "bg-purple-500/10", suffix: "%", desc: "目标 >30%" },
  { key: "cost_saving_rate", label: "成本节省率", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10", suffix: "%", desc: "目标 >80%" },
  { key: "governance_coverage_rate", label: "治理覆盖率", icon: Shield, color: "text-amber-500", bg: "bg-amber-500/10", suffix: "%", desc: "目标 >95%" },
];

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-500",
  review: "bg-amber-500",
  done: "bg-green-500",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "待办",
  in_progress: "进行中",
  review: "审核中",
  done: "已完成",
};

export default function EfficiencyDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [trendDays, setTrendDays] = useState(7);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/efficiency/dashboard");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) { console.error("获取效能数据失败:", err); }
    finally { setLoading(false); }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      await authFetch("/api/efficiency/calculate", { method: "POST" });
      await fetchData();
    } catch (err) { console.error("计算效能失败:", err); }
    finally { setCalculating(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted animate-pulse">加载中...</div>
      </div>
    );
  }

  const latest = data?.latest;
  const deptData = data?.deptEfficiency || [];
  const trends = data?.trends || [];
  const taskStatus = data?.taskStatusDist || [];
  const agentPerf = data?.agentPerformance || [];
  const chatStats = data?.chatStats;

  // 计算总任务数用于状态分布
  const totalTasksForStatus = taskStatus.reduce((sum, s) => sum + s.count, 0);

  // 获取趋势数据（最近N天）
  const recentTrends = trends.slice(0, trendDays).reverse();

  // 计算最大值用于图表
  const maxTaskCount = Math.max(...deptData.map(d => d.task_count), 1);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-card">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" />
          <h1 className="text-base font-bold text-text">组织效能仪表板</h1>
          <span className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary font-medium">P11</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">数据日期：{latest?.metric_date || "暂无数据"}</span>
          <button onClick={handleCalculate} disabled={calculating}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text border border-border rounded hover:bg-bg transition-colors disabled:opacity-50">
            <RefreshCw size={12} className={calculating ? "animate-spin" : ""} />
            {calculating ? "计算中..." : "重新计算"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {/* 五大效能指标 */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {METRIC_CARDS.map((card) => {
            const value = latest ? (latest as any)[card.key] : 0;
            const isGood = card.key === "collaboration_efficiency" 
              ? value < 2 
              : value >= (card.key === "knowledge_sediment_rate" ? 30 : card.key === "governance_coverage_rate" ? 95 : card.key === "cost_saving_rate" ? 80 : 90);
            return (
              <div key={card.key} className="bg-bg-card border border-border rounded-lg p-4 hover:shadow-sm transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded ${card.bg} flex items-center justify-center`}>
                    <card.icon size={16} className={card.color} />
                  </div>
                  <span className="text-xs text-text-muted">{card.label}</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className={`text-2xl font-bold ${card.color}`}>{value}</span>
                  <span className="text-xs text-text-muted mb-1">{card.suffix}</span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {isGood ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600">达标</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">待提升</span>
                  )}
                  <span className="text-[10px] text-text-muted">{card.desc}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* 概览统计 */}
          <div className="bg-bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
              <PieChart size={14} /> 概览统计
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg rounded p-3 text-center">
                <div className="text-xl font-bold text-text">{latest?.total_tasks || 0}</div>
                <div className="text-[10px] text-text-muted">总任务</div>
              </div>
              <div className="bg-bg rounded p-3 text-center">
                <div className="text-xl font-bold text-green-500">{latest?.completed_tasks || 0}</div>
                <div className="text-[10px] text-text-muted">已完成</div>
              </div>
              <div className="bg-bg rounded p-3 text-center">
                <div className="text-xl font-bold text-purple-500">{latest?.total_agents || 0}</div>
                <div className="text-[10px] text-text-muted">AI员工</div>
              </div>
              <div className="bg-bg rounded p-3 text-center">
                <div className="text-xl font-bold text-blue-500">{chatStats?.chat_count || 0}</div>
                <div className="text-[10px] text-text-muted">协作会话</div>
              </div>
            </div>
          </div>

          {/* 任务状态分布 */}
          <div className="bg-bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
              <Target size={14} /> 任务状态分布
            </h3>
            {taskStatus.length === 0 ? (
              <div className="text-center py-4 text-text-muted text-xs">暂无数据</div>
            ) : (
              <div className="space-y-2">
                {taskStatus.map((item) => {
                  const percent = totalTasksForStatus > 0 ? Math.round((item.count / totalTasksForStatus) * 100) : 0;
                  return (
                    <div key={item.status} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[item.status] || "bg-gray-400"}`} />
                      <span className="text-xs text-text w-16">{STATUS_LABELS[item.status] || item.status}</span>
                      <div className="flex-1 h-4 bg-bg rounded-full overflow-hidden">
                        <div className={`h-full ${STATUS_COLORS[item.status] || "bg-gray-400"} rounded-full`}
                          style={{ width: `${percent}%` }} />
                      </div>
                      <span className="text-xs text-text-muted w-12 text-right">{item.count} ({percent}%)</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 协作概况 */}
          <div className="bg-bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
              <MessageSquare size={14} /> 协作概况
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">活跃会话数</span>
                <span className="text-sm font-bold text-blue-500">{chatStats?.chat_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">参与用户数</span>
                <span className="text-sm font-bold text-green-500">{chatStats?.active_users || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">平均任务耗时</span>
                <span className="text-sm font-bold text-amber-500">{latest?.collaboration_efficiency || 0}h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">知识沉淀率</span>
                <span className="text-sm font-bold text-purple-500">{latest?.knowledge_sediment_rate || 0}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* 部门效能 */}
          <div className="bg-bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
              <Users size={14} /> 部门任务效能
            </h3>
            {deptData.length === 0 ? (
              <div className="text-center py-4 text-text-muted text-xs">暂无部门数据</div>
            ) : (
              <div className="space-y-2">
                {deptData.slice(0, 8).map((dept) => {
                  const rate = dept.task_count > 0 ? Math.round((dept.done_count / dept.task_count) * 100) : 0;
                  return (
                    <div key={dept.dept_name} className="flex items-center gap-2">
                      <div className="w-24 text-xs text-text truncate">{dept.dept_name}</div>
                      <div className="flex-1 h-5 bg-bg rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-500"
                          style={{ width: `${rate}%` }} />
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-text-muted w-12 text-right">{dept.done_count}/{dept.task_count}</span>
                        <span className="font-medium text-primary w-8 text-right">{rate}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI员工效能排名 */}
          <div className="bg-bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
              <Award size={14} /> AI员工效能排名
            </h3>
            {agentPerf.length === 0 ? (
              <div className="text-center py-4 text-text-muted text-xs">暂无数据</div>
            ) : (
              <div className="space-y-2">
                {agentPerf.slice(0, 8).map((agent, idx) => {
                  const rate = agent.total_tasks > 0 ? Math.round((agent.completed_tasks / agent.total_tasks) * 100) : 0;
                  return (
                    <div key={agent.name} className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                        idx === 0 ? "bg-amber-100 text-amber-600" : 
                        idx === 1 ? "bg-gray-100 text-gray-600" : 
                        idx === 2 ? "bg-orange-100 text-orange-600" : "bg-bg text-text-muted"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-text truncate">{agent.name}</div>
                        <div className="text-[10px] text-text-muted truncate">{agent.role}</div>
                      </div>
                      <div className="text-[10px] text-text-muted">{agent.completed_tasks}/{agent.total_tasks}</div>
                      <span className="text-xs font-medium text-primary w-8 text-right">{rate}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 趋势图 */}
        {recentTrends.length > 0 && (
          <div className="bg-bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <TrendingUp size={14} /> 效能趋势
              </h3>
              <div className="flex items-center gap-2">
                {[7, 14, 30].map((days) => (
                  <button key={days} onClick={() => setTrendDays(days)}
                    className={`px-2 py-1 text-[10px] rounded ${trendDays === days ? "bg-primary text-white" : "bg-bg text-text-muted hover:text-text"}`}>
                    {days}天
                  </button>
                ))}
              </div>
            </div>
            
            {/* 趋势图表 */}
            <div className="flex items-end gap-1 h-40 mb-3">
              {recentTrends.map((day, idx) => {
                const metrics = [
                  { key: "task_completion_rate", color: "bg-green-500" },
                  { key: "knowledge_sediment_rate", color: "bg-purple-500" },
                  { key: "cost_saving_rate", color: "bg-emerald-500" },
                  { key: "governance_coverage_rate", color: "bg-amber-500" },
                ];
                const maxVal = 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex gap-0.5 items-end" style={{ height: "120px" }}>
                      {metrics.map((m) => {
                        const val = (day as any)[m.key] || 0;
                        const height = (val / maxVal) * 100;
                        return (
                          <div key={m.key} className={`flex-1 ${m.color} rounded-t opacity-80 hover:opacity-100 transition-opacity`}
                            style={{ height: `${height}%` }}
                            title={`${m.key}: ${val}%`} />
                        );
                      })}
                    </div>
                    <div className="text-[9px] text-text-muted">{day.metric_date?.slice(5)}</div>
                  </div>
                );
              })}
            </div>
            
            {/* 图例 */}
            <div className="flex items-center gap-4 justify-center">
              <div className="flex items-center gap-1"><div className="w-3 h-2 bg-green-500 rounded" /><span className="text-[10px] text-text-muted">完成率</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 bg-purple-500 rounded" /><span className="text-[10px] text-text-muted">沉淀率</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 bg-emerald-500 rounded" /><span className="text-[10px] text-text-muted">节省率</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 bg-amber-500 rounded" /><span className="text-[10px] text-text-muted">治理率</span></div>
            </div>

            {/* 趋势表格 */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="text-left py-2 px-2">日期</th>
                    <th className="text-right py-2 px-2">完成率</th>
                    <th className="text-right py-2 px-2">耗时(h)</th>
                    <th className="text-right py-2 px-2">沉淀率</th>
                    <th className="text-right py-2 px-2">节省率</th>
                    <th className="text-right py-2 px-2">治理率</th>
                    <th className="text-right py-2 px-2">任务</th>
                    <th className="text-right py-2 px-2">员工</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrends.slice(0, 7).map((row: any) => (
                    <tr key={row.metric_date} className="border-b border-border/50 hover:bg-bg">
                      <td className="py-1.5 px-2 text-text">{row.metric_date}</td>
                      <td className="py-1.5 px-2 text-right text-green-500">{row.task_completion_rate}%</td>
                      <td className="py-1.5 px-2 text-right text-blue-500">{row.collaboration_efficiency}h</td>
                      <td className="py-1.5 px-2 text-right text-purple-500">{row.knowledge_sediment_rate}%</td>
                      <td className="py-1.5 px-2 text-right text-emerald-500">{row.cost_saving_rate}%</td>
                      <td className="py-1.5 px-2 text-right text-amber-500">{row.governance_coverage_rate}%</td>
                      <td className="py-1.5 px-2 text-right text-text-muted">{row.completed_tasks}/{row.total_tasks}</td>
                      <td className="py-1.5 px-2 text-right text-text-muted">{row.active_agents}/{row.total_agents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

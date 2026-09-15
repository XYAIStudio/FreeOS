import { useState, useEffect } from "react";
import { Search, MessageSquare, Activity, Bot, Calendar, Filter, ChevronLeft, ChevronRight, Clock, User, Cpu, Download, RefreshCw, BarChart3, TrendingUp, CheckCircle, XCircle, AlertTriangle, FileText, Eye, X } from "lucide-react";
import { authFetch } from "../api/authFetch";

interface ChatArchive {
  id: number;
  tenant_id: number;
  chat_id: number;
  message_id: number;
  sender_type: string;
  sender_id: number;
  sender_name: string;
  content: string;
  message_type: string;
  metadata: string;
  created_at: string;
  archived_at: string;
}

interface OrgBehavior {
  id: number;
  tenant_id: number;
  actor_type: string;
  actor_id: number;
  actor_name: string;
  action_type: string;
  action_detail: string;
  target_type: string;
  target_id: number;
  target_name: string;
  before_state: string;
  after_state: string;
  context: string;
  governance_rule: string;
  governance_result: string;
  created_at: string;
}

interface AgentBehavior {
  id: number;
  tenant_id: number;
  agent_id: number;
  agent_name: string;
  behavior_type: string;
  behavior_detail: string;
  input_context: string;
  output_result: string;
  token_used: number;
  duration_ms: number;
  success: number;
  error_message: string;
  created_at: string;
}

interface StatsOverview {
  totals: { chat: number; behavior: number; agent: number; all: number };
  today: { chat: number; behavior: number; agent: number; all: number };
  agentStats: { tokenTotal: number; successRate: number };
  recentBehaviors: any[];
}

interface DailyTrend {
  date: string;
  chat: number;
  behavior: number;
  agent: number;
  total: number;
}

export default function AuditTrailPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "chat" | "behavior" | "agent" | "timeline">("overview");
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [trend, setTrend] = useState<DailyTrend[]>([]);
  const [chatData, setChatData] = useState<ChatArchive[]>([]);
  const [behaviorData, setBehaviorData] = useState<OrgBehavior[]>([]);
  const [agentData, setAgentData] = useState<AgentBehavior[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [senderType, setSenderType] = useState("");
  const [actionType, setActionType] = useState("");
  const [behaviorType, setBehaviorType] = useState("");
  const [detailModal, setDetailModal] = useState<{ type: string; data: any } | null>(null);

  const limit = 20;

  useEffect(() => {
    if (activeTab === "overview") {
      fetchStats();
      fetchTrend();
    } else if (activeTab === "timeline") {
      fetchTimeline();
    } else {
      fetchData();
    }
  }, [activeTab, page]);

  const fetchStats = async () => {
    try {
      const res = await authFetch("/api/audit/stats/overview");
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error("获取统计失败:", err);
    }
  };

  const fetchTrend = async () => {
    try {
      const res = await authFetch("/api/audit/stats/trend?days=7");
      const data = await res.json();
      if (data.success) setTrend(data.data);
    } catch (err) {
      console.error("获取趋势失败:", err);
    }
  };

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      params.append("limit", "100");
      const res = await authFetch(`/api/audit/behaviors/timeline?${params}`);
      const data = await res.json();
      if (data.success) setTimelineData(data.data || []);
    } catch (err) {
      console.error("获取时间线失败:", err);
    }
    setLoading(false);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "chat") {
        const params = new URLSearchParams();
        if (keyword) params.append("keyword", keyword);
        if (senderType) params.append("sender_type", senderType);
        if (dateFrom) params.append("date_from", dateFrom);
        if (dateTo) params.append("date_to", dateTo);
        params.append("page", page.toString());
        params.append("limit", limit.toString());
        const res = await authFetch(`/api/audit/chat/search?${params}`);
        const data = await res.json();
        if (data.success) {
          setChatData(data.data || []);
          setTotal(data.total || 0);
        }
      } else if (activeTab === "behavior") {
        const params = new URLSearchParams();
        if (actionType) params.append("action_type", actionType);
        if (dateFrom) params.append("date_from", dateFrom);
        if (dateTo) params.append("date_to", dateTo);
        params.append("page", page.toString());
        params.append("limit", limit.toString());
        const res = await authFetch(`/api/audit/behaviors?${params}`);
        const data = await res.json();
        if (data.success) {
          setBehaviorData(data.data || []);
          setTotal(data.total || 0);
        }
      } else {
        const params = new URLSearchParams();
        if (behaviorType) params.append("behavior_type", behaviorType);
        if (dateFrom) params.append("date_from", dateFrom);
        if (dateTo) params.append("date_to", dateTo);
        params.append("page", page.toString());
        params.append("limit", limit.toString());
        const res = await authFetch(`/api/audit/agents/0/behaviors?${params}`);
        const data = await res.json();
        if (data.success) {
          setAgentData(data.data || []);
          setTotal(data.total || 0);
        }
      }
    } catch (err) {
      console.error("获取审计数据失败:", err);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    setPage(1);
    if (activeTab === "timeline") {
      fetchTimeline();
    } else {
      fetchData();
    }
  };

  const handleExport = () => {
    let csvContent = "";
    let filename = "";

    if (activeTab === "chat") {
      csvContent = "ID,会话ID,发送者类型,发送者名称,内容,消息类型,创建时间\n";
      chatData.forEach(row => {
        csvContent += `${row.id},${row.chat_id},${row.sender_type},"${row.sender_name}","${row.content.replace(/"/g, '""')}",${row.message_type},${row.created_at}\n`;
      });
      filename = `聊天记录_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (activeTab === "behavior") {
      csvContent = "ID,行为者类型,行为者名称,行为类型,行为详情,目标名称,治理结果,创建时间\n";
      behaviorData.forEach(row => {
        csvContent += `${row.id},${row.actor_type},"${row.actor_name}",${row.action_type},"${row.action_detail.replace(/"/g, '""')}","${row.target_name || ''}",${row.governance_result || ''},${row.created_at}\n`;
      });
      filename = `组织行为_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (activeTab === "agent") {
      csvContent = "ID,AI员工名称,行为类型,行为详情,Token消耗,耗时(ms),成功,错误信息,创建时间\n";
      agentData.forEach(row => {
        csvContent += `${row.id},"${row.agent_name}",${row.behavior_type},"${row.behavior_detail.replace(/"/g, '""')}",${row.token_used || 0},${row.duration_ms || 0},${row.success ? '是' : '否'},"${row.error_message || ''}",${row.created_at}\n`;
      });
      filename = `AI行为_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("zh-CN");
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const getSenderTypeLabel = (type: string) => {
    const labels: Record<string, string> = { user: "用户", employee: "AI员工", system: "系统" };
    return labels[type] || type;
  };

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      task: "任务", chat: "聊天", approval: "审批", decision: "决策", config: "配置",
      create: "创建", update: "更新", delete: "删除", assign: "分配", approve: "批准"
    };
    return labels[type] || type;
  };

  const getBehaviorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      heartbeat: "心跳", task: "任务", chat: "聊天", reflection: "反思", skill: "技能"
    };
    return labels[type] || type;
  };

  const getTimelineIcon = (sourceType: string) => {
    switch (sourceType) {
      case "chat": return <MessageSquare size={14} className="text-blue-500" />;
      case "behavior": return <Activity size={14} className="text-green-500" />;
      case "agent": return <Bot size={14} className="text-purple-500" />;
      default: return <FileText size={14} className="text-gray-500" />;
    }
  };

  const tabs = [
    { key: "overview", label: "概览", icon: BarChart3 },
    { key: "chat", label: "聊天记录", icon: MessageSquare },
    { key: "behavior", label: "组织行为", icon: Activity },
    { key: "agent", label: "AI行为", icon: Bot },
    { key: "timeline", label: "时间线", icon: Clock },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-card">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-primary" />
          <h1 className="text-base font-bold text-text">审计追溯中心</h1>
          <span className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-600 font-medium">P10</span>
          <span className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary font-medium">超级管理员</span>
        </div>
        <div className="flex items-center gap-2">
          {activeTab !== "overview" && (
            <button onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text border border-border rounded hover:bg-bg transition-colors">
              <Download size={12} />
              导出CSV
            </button>
          )}
          <button onClick={() => { fetchStats(); fetchTrend(); fetchData(); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text border border-border rounded hover:bg-bg transition-colors">
            <RefreshCw size={12} />
            刷新
          </button>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="flex border-b border-border bg-bg-card">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key as any); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-primary border-b-2 border-primary"
                : "text-text-muted hover:text-text"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 概览面板 */}
      {activeTab === "overview" && stats && (
        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                  <MessageSquare size={16} className="text-blue-600" />
                </div>
                <span className="text-xs text-text-muted">聊天记录</span>
              </div>
              <div className="text-2xl font-bold text-text">{formatNumber(stats.totals.chat)}</div>
              <div className="text-xs text-text-muted mt-1">今日 +{stats.today.chat}</div>
            </div>
            <div className="bg-bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center">
                  <Activity size={16} className="text-green-600" />
                </div>
                <span className="text-xs text-text-muted">组织行为</span>
              </div>
              <div className="text-2xl font-bold text-text">{formatNumber(stats.totals.behavior)}</div>
              <div className="text-xs text-text-muted mt-1">今日 +{stats.today.behavior}</div>
            </div>
            <div className="bg-bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-purple-100 flex items-center justify-center">
                  <Bot size={16} className="text-purple-600" />
                </div>
                <span className="text-xs text-text-muted">AI行为</span>
              </div>
              <div className="text-2xl font-bold text-text">{formatNumber(stats.totals.agent)}</div>
              <div className="text-xs text-text-muted mt-1">今日 +{stats.today.agent}</div>
            </div>
            <div className="bg-bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-amber-100 flex items-center justify-center">
                  <Cpu size={16} className="text-amber-600" />
                </div>
                <span className="text-xs text-text-muted">Token消耗</span>
              </div>
              <div className="text-2xl font-bold text-text">{formatNumber(stats.agentStats.tokenTotal)}</div>
              <div className="text-xs text-text-muted mt-1">成功率 {stats.agentStats.successRate}%</div>
            </div>
          </div>

          {/* 7天趋势 */}
          <div className="bg-bg-card border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-text">7天趋势</h3>
            </div>
            <div className="flex items-end gap-2 h-32">
              {trend.map((day, idx) => {
                const maxVal = Math.max(...trend.map(d => d.total), 1);
                const height = (day.total / maxVal) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-text-muted">{day.total}</div>
                    <div className="w-full flex flex-col gap-0.5" style={{ height: `${height}%` }}>
                      <div className="w-full bg-blue-500 rounded-t" style={{ flex: day.chat }} />
                      <div className="w-full bg-green-500" style={{ flex: day.behavior }} />
                      <div className="w-full bg-purple-500 rounded-b" style={{ flex: day.agent }} />
                    </div>
                    <div className="text-[10px] text-text-muted">{day.date.slice(5)}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded" /><span className="text-[10px] text-text-muted">聊天</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded" /><span className="text-[10px] text-text-muted">组织行为</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-500 rounded" /><span className="text-[10px] text-text-muted">AI行为</span></div>
            </div>
          </div>

          {/* 最近行为 */}
          <div className="bg-bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-bold text-text mb-3">最近行为</h3>
            <div className="space-y-2">
              {stats.recentBehaviors.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs">暂无行为记录</div>
              ) : (
                stats.recentBehaviors.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <Activity size={12} className="text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-text">{item.actor_name}</span>
                      <span className="text-xs text-text-muted mx-1">{getActionTypeLabel(item.action_type)}</span>
                      <span className="text-xs text-text-muted truncate">{item.action_detail}</span>
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0">{formatDate(item.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 搜索筛选（非概览模式） */}
      {activeTab !== "overview" && (
        <div className="p-4 border-b border-border bg-bg-card">
          <div className="flex flex-wrap gap-3">
            {activeTab === "chat" && (
              <>
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                      placeholder="搜索聊天内容..."
                      className="w-full pl-9 pr-3 py-2 border border-border rounded text-sm outline-none focus:border-primary"
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                  </div>
                </div>
                <select value={senderType} onChange={(e) => setSenderType(e.target.value)}
                  className="px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary">
                  <option value="">所有发送者</option>
                  <option value="user">用户</option>
                  <option value="employee">AI员工</option>
                  <option value="system">系统</option>
                </select>
              </>
            )}
            {activeTab === "behavior" && (
              <select value={actionType} onChange={(e) => setActionType(e.target.value)}
                className="px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary">
                <option value="">所有行为</option>
                <option value="task">任务</option>
                <option value="chat">聊天</option>
                <option value="approval">审批</option>
                <option value="decision">决策</option>
                <option value="config">配置</option>
              </select>
            )}
            {activeTab === "agent" && (
              <select value={behaviorType} onChange={(e) => setBehaviorType(e.target.value)}
                className="px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary">
                <option value="">所有类型</option>
                <option value="heartbeat">心跳</option>
                <option value="task">任务</option>
                <option value="chat">聊天</option>
                <option value="reflection">反思</option>
                <option value="skill">技能</option>
              </select>
            )}
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-text-muted" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary" />
              <span className="text-text-muted">至</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary" />
            </div>
            <button onClick={handleSearch}
              className="px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:opacity-90">
              搜索
            </button>
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-text-muted">
            <div className="animate-spin mr-2">⏳</div>
            加载中...
          </div>
        ) : (
          <>
            {/* 聊天记录 */}
            {activeTab === "chat" && (
              <div className="space-y-3">
                {chatData.length === 0 ? (
                  <div className="text-center py-12 text-text-muted">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                    <p>暂无聊天记录</p>
                  </div>
                ) : (
                  chatData.map((item) => (
                    <div key={item.id} className="bg-bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            item.sender_type === "user" ? "bg-blue-500 text-white" : 
                            item.sender_type === "employee" ? "bg-green-500 text-white" : "bg-gray-500 text-white"
                          }`}>
                            {item.sender_type === "user" ? "U" : item.sender_type === "employee" ? "AI" : "S"}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-text">{item.sender_name}</div>
                            <div className="text-xs text-text-muted">{getSenderTypeLabel(item.sender_type)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDetailModal({ type: "chat", data: item })}
                            className="p-1 text-text-muted hover:text-primary rounded hover:bg-bg transition-colors">
                            <Eye size={14} />
                          </button>
                          <div className="text-xs text-text-muted flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(item.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-text ml-10 line-clamp-3">{item.content}</div>
                      <div className="mt-2 ml-10 flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 bg-bg rounded text-text-muted">会话ID: {item.chat_id}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-bg rounded text-text-muted">消息ID: {item.message_id}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 组织行为 */}
            {activeTab === "behavior" && (
              <div className="space-y-3">
                {behaviorData.length === 0 ? (
                  <div className="text-center py-12 text-text-muted">
                    <Activity size={48} className="mx-auto mb-4 opacity-50" />
                    <p>暂无组织行为记录</p>
                  </div>
                ) : (
                  behaviorData.map((item) => (
                    <div key={item.id} className="bg-bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            item.actor_type === "user" ? "bg-blue-500 text-white" : 
                            item.actor_type === "employee" ? "bg-green-500 text-white" : "bg-gray-500 text-white"
                          }`}>
                            {item.actor_type === "user" ? "U" : item.actor_type === "employee" ? "AI" : "S"}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-text">{item.actor_name}</div>
                            <div className="text-xs text-text-muted">{getSenderTypeLabel(item.actor_type)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDetailModal({ type: "behavior", data: item })}
                            className="p-1 text-text-muted hover:text-primary rounded hover:bg-bg transition-colors">
                            <Eye size={14} />
                          </button>
                          <div className="text-xs text-text-muted flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(item.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="ml-10">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded">
                            {getActionTypeLabel(item.action_type)}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded">
                            {getActionTypeLabel(item.action_detail)}
                          </span>
                        </div>
                        {item.target_name && (
                          <div className="text-sm text-text">目标: <span className="font-medium">{item.target_name}</span></div>
                        )}
                        {item.governance_result && (
                          <div className="mt-2 text-xs text-text-muted">治理结果: {item.governance_result}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* AI行为 */}
            {activeTab === "agent" && (
              <div className="space-y-3">
                {agentData.length === 0 ? (
                  <div className="text-center py-12 text-text-muted">
                    <Bot size={48} className="mx-auto mb-4 opacity-50" />
                    <p>暂无AI行为记录</p>
                  </div>
                ) : (
                  agentData.map((item) => (
                    <div key={item.id} className="bg-bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">AI</div>
                          <div>
                            <div className="text-sm font-medium text-text">{item.agent_name}</div>
                            <div className="text-xs text-text-muted">AI员工</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDetailModal({ type: "agent", data: item })}
                            className="p-1 text-text-muted hover:text-primary rounded hover:bg-bg transition-colors">
                            <Eye size={14} />
                          </button>
                          <div className="text-xs text-text-muted flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(item.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="ml-10">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">
                            {getBehaviorTypeLabel(item.behavior_type)}
                          </span>
                          {item.success ? (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded flex items-center gap-1"><CheckCircle size={10} />成功</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded flex items-center gap-1"><XCircle size={10} />失败</span>
                          )}
                        </div>
                        <div className="text-sm text-text line-clamp-2">{item.behavior_detail}</div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-text-muted">
                          {item.token_used && <span className="flex items-center gap-1"><Cpu size={10} />Token: {formatNumber(item.token_used)}</span>}
                          {item.duration_ms && <span>耗时: {item.duration_ms}ms</span>}
                        </div>
                        {item.error_message && (
                          <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded flex items-center gap-1">
                            <AlertTriangle size={12} />
                            错误: {item.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 时间线 */}
            {activeTab === "timeline" && (
              <div className="relative pl-6">
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
                {timelineData.length === 0 ? (
                  <div className="text-center py-12 text-text-muted">
                    <Clock size={48} className="mx-auto mb-4 opacity-50" />
                    <p>暂无时间线数据</p>
                  </div>
                ) : (
                  timelineData.map((item, idx) => (
                    <div key={idx} className="relative mb-4">
                      <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-bg-card border-2 border-border flex items-center justify-center">
                        {getTimelineIcon(item.source_type)}
                      </div>
                      <div className="bg-bg-card border border-border rounded-lg p-3 ml-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-text">{item.actor_name}</span>
                          <span className="text-[10px] text-text-muted">{formatDate(item.created_at)}</span>
                        </div>
                        <div className="text-xs text-text-muted line-clamp-2">{item.description}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 分页 */}
      {activeTab !== "overview" && activeTab !== "timeline" && Math.ceil(total / limit) > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-bg-card">
          <div className="text-xs text-text-muted">
            第 {page} / {Math.ceil(total / limit)} 页，共 {total} 条
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="p-2 rounded border border-border hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(Math.min(Math.ceil(total / limit), page + 1))} disabled={page === Math.ceil(total / limit)}
              className="p-2 rounded border border-border hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDetailModal(null)}>
          <div className="bg-bg-card border border-border rounded-lg w-[600px] max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-text">
                {detailModal.type === "chat" ? "聊天记录详情" : detailModal.type === "behavior" ? "组织行为详情" : "AI行为详情"}
              </h3>
              <button onClick={() => setDetailModal(null)} className="text-text-muted hover:text-text">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              {detailModal.type === "chat" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                      {detailModal.data.sender_type === "user" ? "U" : "AI"}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text">{detailModal.data.sender_name}</div>
                      <div className="text-xs text-text-muted">{getSenderTypeLabel(detailModal.data.sender_type)}</div>
                    </div>
                  </div>
                  <div className="bg-bg p-3 rounded text-sm text-text whitespace-pre-wrap">{detailModal.data.content}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">会话ID:</span> {detailModal.data.chat_id}</div>
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">消息ID:</span> {detailModal.data.message_id}</div>
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">消息类型:</span> {detailModal.data.message_type}</div>
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">创建时间:</span> {formatDate(detailModal.data.created_at)}</div>
                  </div>
                </div>
              )}
              {detailModal.type === "behavior" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                      {detailModal.data.actor_type === "user" ? "U" : "AI"}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text">{detailModal.data.actor_name}</div>
                      <div className="text-xs text-text-muted">{getSenderTypeLabel(detailModal.data.actor_type)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">行为类型:</span> {getActionTypeLabel(detailModal.data.action_type)}</div>
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">行为详情:</span> {detailModal.data.action_detail}</div>
                    {detailModal.data.target_name && <div className="bg-bg p-2 rounded"><span className="text-text-muted">目标:</span> {detailModal.data.target_name}</div>}
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">创建时间:</span> {formatDate(detailModal.data.created_at)}</div>
                  </div>
                  {detailModal.data.before_state && (
                    <div className="bg-bg p-2 rounded text-xs">
                      <span className="text-text-muted">变更前:</span>
                      <pre className="mt-1 text-text text-[11px] whitespace-pre-wrap">{detailModal.data.before_state}</pre>
                    </div>
                  )}
                  {detailModal.data.after_state && (
                    <div className="bg-bg p-2 rounded text-xs">
                      <span className="text-text-muted">变更后:</span>
                      <pre className="mt-1 text-text text-[11px] whitespace-pre-wrap">{detailModal.data.after_state}</pre>
                    </div>
                  )}
                </div>
              )}
              {detailModal.type === "agent" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">AI</div>
                    <div>
                      <div className="text-sm font-medium text-text">{detailModal.data.agent_name}</div>
                      <div className="text-xs text-text-muted">AI员工</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">行为类型:</span> {getBehaviorTypeLabel(detailModal.data.behavior_type)}</div>
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">状态:</span> {detailModal.data.success ? "成功" : "失败"}</div>
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">Token消耗:</span> {detailModal.data.token_used || 0}</div>
                    <div className="bg-bg p-2 rounded"><span className="text-text-muted">耗时:</span> {detailModal.data.duration_ms || 0}ms</div>
                    <div className="bg-bg p-2 rounded col-span-2"><span className="text-text-muted">创建时间:</span> {formatDate(detailModal.data.created_at)}</div>
                  </div>
                  <div className="bg-bg p-2 rounded text-xs">
                    <span className="text-text-muted">行为详情:</span>
                    <pre className="mt-1 text-text text-[11px] whitespace-pre-wrap">{detailModal.data.behavior_detail}</pre>
                  </div>
                  {detailModal.data.input_context && (
                    <div className="bg-bg p-2 rounded text-xs">
                      <span className="text-text-muted">输入上下文:</span>
                      <pre className="mt-1 text-text text-[11px] whitespace-pre-wrap">{detailModal.data.input_context}</pre>
                    </div>
                  )}
                  {detailModal.data.output_result && (
                    <div className="bg-bg p-2 rounded text-xs">
                      <span className="text-text-muted">输出结果:</span>
                      <pre className="mt-1 text-text text-[11px] whitespace-pre-wrap">{detailModal.data.output_result}</pre>
                    </div>
                  )}
                  {detailModal.data.error_message && (
                    <div className="bg-red-50 p-2 rounded text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      错误: {detailModal.data.error_message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

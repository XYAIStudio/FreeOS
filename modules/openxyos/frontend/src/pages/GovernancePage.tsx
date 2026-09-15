import { useState, useEffect } from "react";
import { authFetch } from "../api/authFetch";
import { useLocale } from "../i18n";
import { Shield, Network, FileText, History, Plus, Save, Trash2, BarChart3, CheckCircle, XCircle, Clock, RefreshCw, Eye, TrendingUp, Zap } from "lucide-react";

const TABS = [
  { key: "overview", label: "概览", icon: BarChart3 },
  { key: "permissions", label: "权限矩阵", icon: Shield },
  { key: "comm-rules", label: "通信规则", icon: Network },
  { key: "templates", label: "流程模板", icon: FileText },
  { key: "logs", label: "治理日志", icon: History },
];

const ROLE_LEVELS = [
  { level: 1, name: "L1 决策层", desc: "董事长/CEO", enName: "L1 Decision", enDesc: "Chair / CEO" },
  { level: 2, name: "L2 经营层", desc: "VP/高管", enName: "L2 Operations", enDesc: "VP / Executive" },
  { level: 3, name: "L3 管理层", desc: "总监/经理", enName: "L3 Management", enDesc: "Director / Manager" },
  { level: 4, name: "L4 执行层", desc: "主管/组长", enName: "L4 Execution", enDesc: "Supervisor / Team lead" },
  { level: 5, name: "L5 基础层", desc: "普通员工/AI", enName: "L5 Foundation", enDesc: "Staff / AI" },
];

const roleName = (role: typeof ROLE_LEVELS[number], isEnglish: boolean) => isEnglish ? role.enName : role.name;
const roleDescription = (role: typeof ROLE_LEVELS[number], isEnglish: boolean) => isEnglish ? role.enDesc : role.desc;

const PERMISSION_TYPES = ["command", "view", "approve", "dispatch", "report", "create", "update", "delete", "assign"];

export default function GovernancePage() {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<any>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [commRules, setCommRules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState<{ type: string; data: any } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, permRes, commRes, tplRes, logRes] = await Promise.all([
        authFetch("/api/governance/stats"),
        authFetch("/api/governance/permissions"),
        authFetch("/api/governance/comm-rules"),
        authFetch("/api/governance/templates"),
        authFetch("/api/governance/logs"),
      ]);
      const [statsJson, permJson, commJson, tplJson, logJson] = await Promise.all([
        statsRes.json(), permRes.json(), commRes.json(), tplRes.json(), logRes.json(),
      ]);
      if (statsJson.success) setStats(statsJson.data);
      if (permJson.success) setPermissions(permJson.data);
      if (commJson.success) setCommRules(commJson.data);
      if (tplJson.success) setTemplates(tplJson.data);
      if (logJson.success) setLogs(logJson.data);
    } catch (err) { console.error("获取治理数据失败:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSavePermissions = async (rules: any[]) => {
    try {
      await authFetch("/api/governance/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      await fetchData();
    } catch (err) { console.error("保存权限失败:", err); }
  };

  const handleSaveCommRules = async (rules: any[]) => {
    try {
      await authFetch("/api/governance/comm-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      await fetchData();
    } catch (err) { console.error("保存通信规则失败:", err); }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm(t("确定删除此流程模板？", "Delete this process template?"))) return;
    try {
      await authFetch(`/api/governance/templates/${id}`, { method: "DELETE" });
      await fetchData();
    } catch (err) { console.error("删除模板失败:", err); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-text-muted animate-pulse">{t("加载中...", "Loading...")}</div></div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-card">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-primary" />
          <h1 className="text-base font-bold text-text">{t("治理引擎", "Governance Engine")}</h1>
          <span className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary font-medium">P12</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData()}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text border border-border rounded hover:bg-bg transition-colors">
            <RefreshCw size={12} />
            {t("刷新", "Refresh")}
          </button>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="flex border-b border-border bg-bg-card">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-primary border-b-2 border-primary"
                : "text-text-muted hover:text-text"
            }`}>
            <tab.icon size={14} />
            {t(tab.label, ({"概览":"Overview","权限矩阵":"Permission matrix","通信规则":"Communication rules","流程模板":"Process templates","治理日志":"Governance logs"} as Record<string,string>)[tab.label] || tab.label)}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-5">
        {activeTab === "overview" && stats && <OverviewTab stats={stats} />}
        {activeTab === "permissions" && <PermissionsTab data={permissions} onSave={handleSavePermissions} />}
        {activeTab === "comm-rules" && <CommRulesTab data={commRules} onSave={handleSaveCommRules} />}
        {activeTab === "templates" && <TemplatesTab data={templates} onDelete={handleDeleteTemplate} />}
        {activeTab === "logs" && <LogsTab data={logs} onDetail={setDetailModal} />}
      </div>

      {/* 详情弹窗 */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDetailModal(null)}>
          <div className="bg-bg-card border border-border rounded-lg w-[500px] max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-text">{t("治理日志详情", "Governance log details")}</h3>
              <button onClick={() => setDetailModal(null)} className="text-text-muted hover:text-text">
                <XCircle size={16} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh] space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-bg p-2 rounded"><span className="text-text-muted">ID:</span> {detailModal.data.id}</div>
                <div className="bg-bg p-2 rounded"><span className="text-text-muted">{t("时间:", "Time:")}</span> {detailModal.data.created_at}</div>
                <div className="bg-bg p-2 rounded"><span className="text-text-muted">{t("操作者类型:", "Actor type:")}</span> {detailModal.data.actor_type}</div>
                <div className="bg-bg p-2 rounded"><span className="text-text-muted">{t("操作者ID:", "Actor ID:")}</span> {detailModal.data.actor_id}</div>
                <div className="bg-bg p-2 rounded"><span className="text-text-muted">{t("操作者层级:", "Actor level:")}</span> L{detailModal.data.actor_level || "-"}</div>
                <div className="bg-bg p-2 rounded"><span className="text-text-muted">{t("结果:", "Result:")}</span>
                  <span className={`ml-1 font-bold ${detailModal.data.result === "allow" ? "text-green-500" : detailModal.data.result === "deny" ? "text-red-500" : "text-amber-500"}`}>
                    {detailModal.data.result}
                  </span>
                </div>
              </div>
              {detailModal.data.permission_check && (
                <div className="bg-bg p-2 rounded text-xs">
                  <span className="text-text-muted">{t("权限校验:", "Permission check:")}</span>
                  <div className="mt-1 text-text">{detailModal.data.permission_check}</div>
                </div>
              )}
              {detailModal.data.comm_rule_check && (
                <div className="bg-bg p-2 rounded text-xs">
                  <span className="text-text-muted">{t("通信规则校验:", "Communication check:")}</span>
                  <div className="mt-1 text-text">{detailModal.data.comm_rule_check}</div>
                </div>
              )}
              {detailModal.data.process_check && (
                <div className="bg-bg p-2 rounded text-xs">
                  <span className="text-text-muted">{t("流程校验:", "Process check:")}</span>
                  <div className="mt-1 text-text">{detailModal.data.process_check}</div>
                </div>
              )}
              {detailModal.data.reason && (
                <div className="bg-bg p-2 rounded text-xs">
                  <span className="text-text-muted">{t("原因:", "Reason:")}</span>
                  <div className="mt-1 text-text">{detailModal.data.reason}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 概览Tab
function OverviewTab({ stats }: { stats: any }) {
  const { t, isEnglish } = useLocale();
  const { overview, actionStats, levelStats, recentTrend } = stats;
  const maxTrend = Math.max(...recentTrend.map((t: any) => t.total), 1);

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
              <Shield size={16} className="text-blue-600" />
            </div>
            <span className="text-xs text-text-muted">{t("总治理次数", "Total governance actions")}</span>
          </div>
          <div className="text-2xl font-bold text-text">{overview.totalLogs}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center">
              <CheckCircle size={16} className="text-green-600" />
            </div>
            <span className="text-xs text-text-muted">{t("通过率", "Approval rate")}</span>
          </div>
          <div className="text-2xl font-bold text-green-500">{overview.allowRate}%</div>
          <div className="text-xs text-text-muted mt-1">{overview.allowedLogs} / {overview.totalLogs}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center">
              <XCircle size={16} className="text-red-600" />
            </div>
            <span className="text-xs text-text-muted">{t("拒绝次数", "Denied")}</span>
          </div>
          <div className="text-2xl font-bold text-red-500">{overview.deniedLogs}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-amber-100 flex items-center justify-center">
              <Clock size={16} className="text-amber-600" />
            </div>
            <span className="text-xs text-text-muted">{t("待审批", "Pending approval")}</span>
          </div>
          <div className="text-2xl font-bold text-amber-500">{overview.pendingLogs}</div>
        </div>
      </div>

      {/* 规则统计 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-text-muted mb-1">{t("权限规则数", "Permission rules")}</div>
          <div className="text-xl font-bold text-primary">{overview.permCount}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-text-muted mb-1">{t("通信规则数", "Communication rules")}</div>
          <div className="text-xl font-bold text-blue-500">{overview.commRuleCount}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-text-muted mb-1">{t("流程模板数", "Process templates")}</div>
          <div className="text-xl font-bold text-purple-500">{overview.templateCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 按操作类型统计 */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
            <Zap size={14} /> {t("按操作类型统计", "By action type")}
          </h3>
          {actionStats.length === 0 ? (
            <div className="text-center py-4 text-text-muted text-xs">{t("暂无数据", "No data")}</div>
          ) : (
            <div className="space-y-2">
              {actionStats.map((item: any) => {
                const rate = item.count > 0 ? Math.round((item.allowed / item.count) * 100) : 0;
                return (
                  <div key={item.action} className="flex items-center gap-2">
                    <div className="w-20 text-xs text-text truncate">{item.action || t("未分类", "Unclassified")}</div>
                    <div className="flex-1 h-4 bg-bg rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-xs text-text-muted w-16 text-right">{isEnglish ? `${item.count} events (${rate}%)` : `${item.count}次 (${rate}%)`}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 按层级统计 */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
            <TrendingUp size={14} /> {t("按角色层级统计", "By role level")}
          </h3>
          {levelStats.length === 0 ? (
            <div className="text-center py-4 text-text-muted text-xs">{t("暂无数据", "No data")}</div>
          ) : (
            <div className="space-y-2">
              {levelStats.map((item: any) => {
                const rate = item.count > 0 ? Math.round((item.allowed / item.count) * 100) : 0;
                const role = ROLE_LEVELS.find(r => r.level === item.actor_level);
                const levelName = role ? roleName(role, isEnglish) : `L${item.actor_level}`;
                return (
                  <div key={item.actor_level} className="flex items-center gap-2">
                    <div className="w-20 text-xs text-text truncate">{levelName}</div>
                    <div className="flex-1 h-4 bg-bg rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-xs text-text-muted w-16 text-right">{item.count}次 ({rate}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 7天趋势 */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
          <BarChart3 size={14} /> {t("7天治理趋势", "7-day governance trend")}
        </h3>
        <div className="flex items-end gap-2 h-32">
          {recentTrend.map((day: any, idx: number) => {
            const height = (day.total / maxTrend) * 100;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-text-muted">{day.total}</div>
                <div className="w-full flex flex-col gap-0.5" style={{ height: `${height}%` }}>
                  <div className="w-full bg-green-500 rounded-t" style={{ flex: day.allowed }} />
                  <div className="w-full bg-red-500 rounded-b" style={{ flex: day.denied }} />
                </div>
                <div className="text-[10px] text-text-muted">{day.date.slice(5)}</div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 justify-center">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded" /><span className="text-[10px] text-text-muted">{t("通过", "Allowed")}</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded" /><span className="text-[10px] text-text-muted">{t("拒绝", "Denied")}</span></div>
        </div>
      </div>
    </div>
  );
}

// 权限矩阵Tab
function PermissionsTab({ data, onSave }: { data: any[]; onSave: (r: any[]) => void }) {
  const { t, isEnglish } = useLocale();
  const [editData, setEditData] = useState<any[]>([]);

  useEffect(() => { setEditData([...data]); }, [data]);

  const handleToggle = (roleLevel: number, permType: string) => {
    const idx = editData.findIndex((r) => r.role_level === roleLevel && r.permission_type === permType);
    if (idx >= 0) {
      setEditData(editData.filter((_, i) => i !== idx));
    } else {
      setEditData([...editData, { role_level: roleLevel, permission_type: permType, scope: "any", target_type: "both" }]);
    }
  };

  const hasPermission = (level: number, type: string) => editData.some((r) => r.role_level === level && r.permission_type === type);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-muted">{t("点击单元格切换权限状态（9种原子权限 × 5个层级）", "Click a cell to toggle permissions (9 atomic permissions × 5 levels)")}</p>
        <button onClick={() => onSave(editData)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:opacity-90">
          <Save size={14} /> {t("保存", "Save")}
        </button>
      </div>
      <div className="overflow-x-auto bg-bg-card border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">{t("角色层级", "Role level")}</th>
              {PERMISSION_TYPES.map((p) => (
                <th key={p} className="text-center py-3 px-2 text-text-muted font-medium text-xs">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_LEVELS.map((role) => (
              <tr key={role.level} className="border-b border-border/50 hover:bg-bg">
                <td className="py-3 px-4">
                  <div className="font-medium text-text">{roleName(role, isEnglish)}</div>
                  <div className="text-xs text-text-muted">{roleDescription(role, isEnglish)}</div>
                </td>
                {PERMISSION_TYPES.map((p) => (
                  <td key={p} className="text-center py-3 px-2">
                    <button onClick={() => handleToggle(role.level, p)}
                      className={`w-8 h-8 rounded text-xs font-bold transition-all ${hasPermission(role.level, p) ? "bg-green-500 text-white" : "bg-bg border border-border text-text-muted hover:border-primary"}`}>
                      {hasPermission(role.level, p) ? "✓" : ""}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 通信规则Tab
function CommRulesTab({ data, onSave }: { data: any[]; onSave: (r: any[]) => void }) {
  const { t, isEnglish } = useLocale();
  const [editData, setEditData] = useState<any[]>([]);

  useEffect(() => { setEditData([...data]); }, [data]);

  const handleToggle = (sender: number, receiver: number, commType: string) => {
    const idx = editData.findIndex((r) => r.sender_level === sender && r.receiver_level === receiver && r.comm_type === commType);
    if (idx >= 0) {
      const updated = [...editData];
      updated[idx] = { ...updated[idx], is_allowed: updated[idx].is_allowed ? 0 : 1 };
      setEditData(updated);
    } else {
      setEditData([...editData, { sender_level: sender, receiver_level: receiver, comm_type: commType, is_allowed: 1, require_approval: 0 }]);
    }
  };

  const getRule = (sender: number, receiver: number, type: string) => editData.find((r) => r.sender_level === sender && r.receiver_level === receiver && r.comm_type === type);

  const commTypes = ["direct", "delegate", "escalate"];
  const commTypeLabels: Record<string, string> = { direct: t("直接通信", "Direct"), delegate: t("委托通信", "Delegate"), escalate: t("上报通信", "Escalate") };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-muted">{t("跨层级通信规则配置（5×5矩阵 × 3种通信类型）", "Cross-level communication rules (5×5 matrix × 3 communication types)")}</p>
        <button onClick={() => onSave(editData)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:opacity-90">
          <Save size={14} /> {t("保存", "Save")}
        </button>
      </div>
      {commTypes.map((type) => (
        <div key={type} className="mb-6">
          <h3 className="text-sm font-semibold text-text mb-3">{commTypeLabels[type]}</h3>
          <div className="overflow-x-auto bg-bg-card border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4 text-text-muted font-medium text-xs">{t("发送方 ↓ → 接收方 →", "Sender ↓ → Receiver →")}</th>
                  {ROLE_LEVELS.map((r) => (
                    <th key={r.level} className="text-center py-2 px-2 text-text-muted font-medium text-xs">{roleName(r, isEnglish)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_LEVELS.map((sender) => (
                  <tr key={sender.level} className="border-b border-border/50">
                    <td className="py-2 px-4 text-xs font-medium text-text">{roleName(sender, isEnglish)}</td>
                    {ROLE_LEVELS.map((receiver) => {
                      const rule = getRule(sender.level, receiver.level, type);
                      const allowed = rule ? rule.is_allowed : true;
                      return (
                        <td key={receiver.level} className="text-center py-2 px-2">
                          <button onClick={() => handleToggle(sender.level, receiver.level, type)}
                            className={`w-8 h-8 rounded text-xs font-bold transition-all ${allowed ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}>
                            {allowed ? "✓" : "✗"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// 流程模板Tab
function TemplatesTab({ data, onDelete }: { data: any[]; onDelete: (id: number) => void }) {
  const { t } = useLocale();
  return (
    <div>
      {data.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p>{t("暂无流程模板", "No process templates")}</p>
          <p className="text-xs mt-2">{t("系统将自动创建默认模板", "Default templates will be created automatically")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((tpl) => (
            <div key={tpl.id} className="bg-bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-primary" />
                  <h3 className="font-medium text-text text-sm">{tpl.name}</h3>
                  {tpl.is_default ? (
                    <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded">{t("默认", "Default")}</span>
                  ) : null}
                </div>
                <button onClick={() => onDelete(tpl.id)}
                  className="p-1 text-text-muted hover:text-red-500 rounded hover:bg-bg transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-xs text-text-muted mb-2">{tpl.description || t("无描述", "No description")}</p>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="px-2 py-0.5 bg-bg rounded text-text-muted">{t("类型: ", "Type: ")}{tpl.template_type}</span>
                <span className="px-2 py-0.5 bg-bg rounded text-text-muted">{t("创建: ", "Created: ")}{tpl.created_at?.slice(0, 10)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 治理日志Tab
function LogsTab({ data, onDetail }: { data: any[]; onDetail: (modal: { type: string; data: any }) => void }) {
  const { t } = useLocale();
  const resultColor = (r: string) => r === "allow" ? "text-green-500" : r === "deny" ? "text-red-500" : "text-amber-500";
  const resultBg = (r: string) => r === "allow" ? "bg-green-100" : r === "deny" ? "bg-red-100" : "bg-amber-100";

  return (
    <div>
      {data.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <History size={48} className="mx-auto mb-4 opacity-30" />
          <p>{t("暂无治理日志", "No governance logs")}</p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="text-left py-3 px-4">{t("时间", "Time")}</th>
                <th className="text-left py-3 px-4">{t("操作者", "Actor")}</th>
                <th className="text-left py-3 px-4">{t("层级", "Level")}</th>
                <th className="text-left py-3 px-4">{t("操作", "Action")}</th>
                <th className="text-left py-3 px-4">{t("目标", "Target")}</th>
                <th className="text-center py-3 px-4">{t("结果", "Result")}</th>
                <th className="text-center py-3 px-4">{t("操作", "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-bg">
                  <td className="py-2 px-4 text-xs text-text-muted">{log.created_at?.slice(0, 19)}</td>
                  <td className="py-2 px-4 text-xs">{log.actor_type} #{log.actor_id}</td>
                  <td className="py-2 px-4 text-xs">L{log.actor_level || "-"}</td>
                  <td className="py-2 px-4 text-xs">{log.permission_check || "-"}</td>
                  <td className="py-2 px-4 text-xs">{log.target_type} #{log.target_id || "-"}</td>
                  <td className="py-2 px-4 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${resultBg(log.result)} ${resultColor(log.result)}`}>
                      {log.result}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-center">
                    <button onClick={() => onDetail({ type: "log", data: log })}
                      className="p-1 text-text-muted hover:text-primary rounded hover:bg-bg transition-colors">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

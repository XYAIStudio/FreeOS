import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Upload, FileText, Download, Search, ChevronDown, ChevronUp, X, Check, AlertTriangle, Clock, Edit3, Trash2, Settings, TrendingUp, TrendingDown, Calendar, Lock, BarChart3 } from "lucide-react";
import { authFetch } from "../api/authFetch";

interface Contract {
  id: number; tenant_id: number; title: string; contract_no: string;
  party_a: string; party_b: string; direction: string; our_side: string;
  contract_type: string; amount: number; collected_paid: number; currency: string;
  start_date: string | null; end_date: string | null; status: string;
  sign_date: string | null; key_terms: string | null;
  alert_days: number; file_path: string | null; file_type: string | null;
  remarks: string | null;
  payment_count: number; pending_count: number;
  created_at: string; updated_at: string;
}

interface Payment {
  id: number; contract_id: number; payment_no: number;
  label: string; amount: number; paid: number; paid_date: string | null;
  due_date: string | null; completion_condition: string | null;
  condition_met: number; remarks: string | null;
}

interface AlertConfig {
  default_alert_days: number; enable_feishu: number; feishu_webhook: string | null;
  level1_days?: number; level2_days?: number; level3_days?: number; level4_days?: number;
  enable_multi_level?: number;
}

interface Stats {
  total: number; pendingReview: number;
  receivable: { total: number; done: number };
  payable: { total: number; done: number };
  expiringCount: number;
}

interface PaymentAlert {
  id: number; contract_id: number; contract_no: string; contract_title: string;
  payment_no: number; label: string; amount: number; paid: number;
  paid_date: string | null; due_date: string | null;
  direction: string; party_b: string | null;
  days_left: number; alert_count: number;
}

// Phase 4: 多级预警
interface MultiLevelAlertItem {
  id: number; contract_id: number; contract_no: string; contract_title: string;
  direction: string; party_b: string;
  label: string; amount: number; due_date: string;
  days_left: number; alert_count: number;
  alert_level: number; level_label: string;
  last_escalated_at: string | null; escalation_count: number;
}

interface MultiLevelAlertResult {
  level1: MultiLevelAlertItem[]; level2: MultiLevelAlertItem[];
  level3: MultiLevelAlertItem[]; level4: MultiLevelAlertItem[];
  summary: { total: number; critical: number; urgent: number; warning: number; info: number };
}

interface EscalationRecord {
  id: number; payment_id: number; contract_id: number;
  alert_level: number; level_label: string; message: string | null; created_at: string;
}

// Phase 5: 甘特图 + 仪表盘
interface GanttPayment { id: number; label: string; amount: number; due_date: string | null; paid: number; }
interface GanttProgress { id: number; stage_name: string; planned_date: string | null; actual_date: string | null; review_status: string; }
interface GanttContract {
  contract_id: number; contract_no: string; title: string; direction: string; party_b: string;
  amount: number; status: string; start_date: string | null; end_date: string | null;
  payments: GanttPayment[]; progress_nodes: GanttProgress[];
}

interface DashboardData {
  overview: { total: number; active: number; expired: number; signed: number; newThisMonth: number };
  financial: { totalReceivable: number; collected: number; totalPayable: number; paid: number };
  typeDistribution: { contract_type: string; count: number; amount: number }[];
  amountTrend: { month: string; receivable: number; payable: number }[];
  alertSummary: { critical: number; urgent: number; warning: number; info: number };
  upcomingTop5: { id: number; title: string; contract_no: string; direction: string; days_left: number; due_date: string }[];
}

interface Clause {
  id: number; contract_id: number; clause_type: string;
  clause_title: string; clause_content: string;
  sort_order: number; is_critical: number; ai_confidence: number;
}

const CLAUSE_TYPE_LABELS: Record<string, string> = {
  payment_condition: "付款条件", delivery: "交付节点", acceptance: "验收标准",
  breach: "违约责任", warranty: "质保条款", confidentiality: "保密条款",
  ip: "知识产权", termination: "合同终止", other: "其他条款",
};

interface Progress {
  id: number; contract_id: number; stage_name: string;
  planned_date: string | null; actual_date: string | null;
  acceptance_criteria: string | null; attachments: string;
  submitter_id: number | null; submitted_at: string | null;
  reviewer_id: number | null; reviewed_at: string | null;
  review_status: string; review_comment: string | null;
  completion_ratio: number; linked_payment_ids: string;
  sort_order: number;
}

// Phase 3
interface ApprovalRecord {
  id: number; contract_id: number; step_order: number;
  approver_id: number | null; approver_name?: string;
  approver_position_level_id: number | null; position_level_name?: string;
  status: string; comment: string | null; approved_at: string | null;
}

interface ApprovalRule {
  id: number; rule_name: string;
  min_amount: number | null; max_amount: number | null;
  contract_type: string | null; direction: string | null;
  approval_chain_json: string; is_active: number;
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "待审核", approved: "已通过", rejected: "已驳回",
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "待审批", approved: "已通过", rejected: "已驳回",
};

const CONTRACT_TYPES: Record<string, string> = {
  sales: "销售合同", purchase: "采购合同", employment: "劳动合同",
  lease: "租赁合同", nda: "保密协议", other: "其他",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿", review: "审批中", approved: "已审批",
  signed: "已签署", active: "执行中", expired: "已到期", terminated: "已终止",
};

// Phase 3: 审批规则管理面板
function ApprovalRulesPanel({ onClose }: { onClose: () => void }) {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ rule_name: "", min_amount: "", max_amount: "", contract_type: "", direction: "", chain_text: "" });
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<any>(null);

  const fetchRules = async () => {
    try {
      const r = await authFetch("/api/contracts/approval/rules");
      const d = await r.json();
      if (d.success) setRules(d.data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const addRule = async () => {
    let chain: any[];
    try { chain = JSON.parse(form.chain_text || "[]"); } catch { alert("审批链格式错误，请输入JSON数组"); return; }
    const r = await authFetch("/api/contracts/approval/rules", {
      method: "POST",
      body: JSON.stringify({
        rule_name: form.rule_name,
        min_amount: form.min_amount ? parseFloat(form.min_amount) : null,
        max_amount: form.max_amount ? parseFloat(form.max_amount) : null,
        contract_type: form.contract_type || null,
        direction: form.direction || null,
        approval_chain_json: JSON.stringify(chain),
      }),
    });
    const d = await r.json();
    if (d.success) { fetchRules(); setAdding(false); setForm({ rule_name: "", min_amount: "", max_amount: "", contract_type: "", direction: "", chain_text: "" }); }
    else alert(d.error || "添加失败");
  };

  const deleteRule = async (id: number) => {
    if (!confirm("确认删除此审批规则？")) return;
    await authFetch(`/api/contracts/approval/rules/${id}`, { method: "DELETE" });
    fetchRules();
  };

  const handleParse = async (file: File) => {
    setParsing(true); setParseResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await authFetch("/api/contracts/approval/rules/parse", { method: "POST", body: fd });
      const d = await r.json();
      if (d.success) { setParseResult(d.data); }
      else alert(d.error || "解析失败");
    } catch { alert("解析失败"); }
    setParsing(false);
  };

  const confirmParse = async () => {
    if (!parseResult?.rules?.length) return;
    const r = await authFetch("/api/contracts/approval/rules/confirm", {
      method: "POST", body: JSON.stringify({ rules: parseResult.rules }),
    });
    const d = await r.json();
    if (d.success) { fetchRules(); setParseResult(null); alert(`已导入${d.data?.count || 0}条规则`); }
    else alert(d.error || "入库失败");
  };

  const chainPreview = (json: string) => {
    try { const c = JSON.parse(json); return c.map((s: any) => s.position_level_name || s.description || `职级ID:${s.position_level_id}`).join(" → "); }
    catch { return json; }
  };

  const getChainExample = () => {
    return JSON.stringify([
      { position_level_id: 1, description: "部门经理审批" },
      { position_level_id: 2, description: "COO审批" },
    ], null, 2);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Lock size={16} /> 审批规则引擎</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg"><X size={18} /></button>
        </div>

        {/* AI 解析上传 */}
        <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-xs text-blue-700 font-medium mb-2">📄 AI 解析审批权限表</p>
          <div className="flex gap-2">
            <label className="flex-1">
              <input type="file" accept=".pdf,.docx,.txt,.png,.jpg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleParse(f); }} />
              <span className="block text-center text-xs px-3 py-2 rounded-lg border border-dashed border-blue-300 bg-white text-blue-600 hover:bg-blue-50 cursor-pointer">{parsing ? "解析中..." : "点击上传权限表"}</span>
            </label>
          </div>
          {parseResult && (
            <div className="mt-2 p-2 bg-white rounded-lg text-xs">
              <p className="font-medium mb-1">解析结果（{parseResult.rules?.length || 0}条规则）</p>
              {parseResult.rules?.slice(0, 3).map((r: any, i: number) => (
                <div key={i} className="text-[11px] text-text-muted truncate">{r.rule_name}: {r.min_amount ?? "不限"}~{r.max_amount ?? "不限"}万 → {chainPreview(r.approval_chain_json)}</div>
              ))}
              {(parseResult.rules?.length || 0) > 3 && <p className="text-[10px] text-text-muted">...等{parseResult.rules.length - 3}条</p>}
              <button onClick={confirmParse} className="mt-2 text-[10px] px-3 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 w-full">确认导入</button>
            </div>
          )}
        </div>

        {/* 现有规则列表 */}
        <h3 className="text-sm font-medium mb-2">现有规则</h3>
        {loading ? <p className="text-xs text-text-muted py-4 text-center">加载中...</p> :
          rules.length === 0 ? <p className="text-xs text-text-muted py-4 text-center">暂无审批规则</p> :
          <div className="space-y-2 mb-4">
            {rules.map(r => (
              <div key={r.id} className="bg-bg rounded-lg p-2.5 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{r.rule_name}</span>
                  <button onClick={() => deleteRule(r.id)} className="text-[9px] px-1.5 py-0.5 rounded text-red-500 hover:bg-red-50">删除</button>
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {r.min_amount != null ? `${r.min_amount}万` : "0"} ~ {r.max_amount != null ? `${r.max_amount}万` : "不限"}
                  {r.contract_type && ` · ${CONTRACT_TYPES[r.contract_type] || r.contract_type}`}
                  {r.direction && ` · ${r.direction === "receivable" ? "收款" : "付款"}`}
                </div>
                <div className="text-[10px] text-primary mt-0.5">审批链: {chainPreview(r.approval_chain_json)}</div>
              </div>
            ))}
          </div>
        }

        {/* 添加新规则 */}
        {adding ? (
          <div className="border border-border rounded-xl p-3 space-y-2">
            <input placeholder="规则名称" className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-bg" value={form.rule_name} onChange={e => setForm({ ...form, rule_name: e.target.value })} />
            <div className="flex gap-2">
              <input type="number" placeholder="金额下限(万)" className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-bg" value={form.min_amount} onChange={e => setForm({ ...form, min_amount: e.target.value })} />
              <input type="number" placeholder="金额上限(万)" className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-bg" value={form.max_amount} onChange={e => setForm({ ...form, max_amount: e.target.value })} />
            </div>
            <select className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-bg" value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value })}>
              <option value="">不限类型</option>
              {Object.entries(CONTRACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-bg" value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
              <option value="">不限方向</option>
              <option value="receivable">收款</option>
              <option value="payable">付款</option>
            </select>
            <div>
              <textarea placeholder={`审批链JSON，例:\n${getChainExample()}`} className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-bg h-24 font-mono" value={form.chain_text} onChange={e => setForm({ ...form, chain_text: e.target.value })} />
              <p className="text-[9px] text-text-muted mt-0.5">position_level_id 对应系统中的职级ID（可从组织架构查看）</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-xl border border-border text-sm">取消</button>
              <button onClick={addRule} className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90">保存</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full py-2 rounded-xl border border-dashed border-border text-xs text-text-muted hover:border-primary/50 hover:text-primary flex items-center justify-center gap-1">
            <Plus size={12} /> 添加审批规则
          </button>
        )}
      </div>
    </div>
  );
}

export default function ContractPage() {
  // State
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showPayments, setShowPayments] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [progressList, setProgressList] = useState<Progress[]>([]);
  const [approvalRecords, setApprovalRecords] = useState<ApprovalRecord[]>([]);
  const [showApprovalRules, setShowApprovalRules] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [ourSide, setOurSide] = useState<"party_a" | "party_b">("party_a");
  const [alertDays, setAlertDays] = useState(7);
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState<any>(null);
  const [parseStep, setParseStep] = useState<"" | "uploading" | "parsing" | "done">("");

  // Alert config state
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({ default_alert_days: 7, enable_feishu: 0, feishu_webhook: "" });

  // Create/Edit form state
  const [editForm, setEditForm] = useState<any>({});
  const [editMode, setEditMode] = useState<"create" | "edit" | null>(null);

  // Stats state
  const [statsPeriod, setStatsPeriod] = useState("this_month");
  const [statsCustomStart, setStatsCustomStart] = useState("");
  const [statsCustomEnd, setStatsCustomEnd] = useState("");
  const [statsData, setStatsData] = useState<any>(null);
  const [statsDetails, setStatsDetails] = useState<any[]>([]);
  const [statsTab, setStatsTab] = useState<"all" | "receivable" | "payable">("all");

  // Alert Dashboard state
  const [showDashboard, setShowDashboard] = useState(false);
  const [upcomingAlerts, setUpcomingAlerts] = useState<PaymentAlert[]>([]);
  const [overdueAlerts, setOverdueAlerts] = useState<PaymentAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  // Phase 4: 多级预警
  const [multiLevelAlerts, setMultiLevelAlerts] = useState<MultiLevelAlertResult | null>(null);
  const [showEscalation, setShowEscalation] = useState<{ paymentId: number; label: string } | null>(null);
  const [escalationHistory, setEscalationHistory] = useState<EscalationRecord[]>([]);

  // Phase 5: 甘特图 + 仪表盘
  const [showGantt, setShowGantt] = useState(false);
  const [ganttData, setGanttData] = useState<GanttContract[]>([]);
  const [ganttFilter, setGanttFilter] = useState<string>("");
  const [showContractDashboard, setShowContractDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===== Data Fetching =====
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (directionFilter) params.set("direction", directionFilter);
      if (search) params.set("search", search);
      const r = await authFetch(`/api/contracts?${params}`);
      const d = await r.json();
      if (d.success) setContracts(d.data || []);
    } catch { }
    setLoading(false);
  }, [statusFilter, directionFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const r = await authFetch("/api/contracts/stats");
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch { }
  }, []);

  const fetchAlertConfig = useCallback(async () => {
    try {
      const r = await authFetch("/api/contracts/alerts/config");
      const d = await r.json();
      if (d.success) setAlertConfig(d.data);
    } catch { }
  }, []);

  const fetchPayments = useCallback(async (contractId: number) => {
    try {
      const r = await authFetch(`/api/contracts/${contractId}/payments`);
      const d = await r.json();
      if (d.success) setPayments(d.data || []);
    } catch { setPayments([]); }
  }, []);

  const fetchClauses = useCallback(async (contractId: number) => {
    try {
      const r = await authFetch(`/api/contracts/${contractId}/clauses`);
      const d = await r.json();
      if (d.success) setClauses(d.data || []);
    } catch { setClauses([]); }
  }, []);

  const fetchProgress = useCallback(async (contractId: number) => {
    try {
      const r = await authFetch(`/api/contracts/${contractId}/progress`);
      const d = await r.json();
      if (d.success) setProgressList(d.data || []);
    } catch { setProgressList([]); }
  }, []);

  const submitProgress = async (progressId: number) => {
    const ratio = parseFloat(prompt("完成比例 (%):") || "100");
    if (isNaN(ratio)) return;
    await authFetch(`/api/contracts/${selectedContract!.id}/progress/${progressId}/submit`, {
      method: "PUT", body: JSON.stringify({ completion_ratio: ratio, actual_date: new Date().toISOString().split("T")[0] }),
    });
    fetchProgress(selectedContract!.id);
  };

  const reviewProgress = async (progressId: number, approved: boolean) => {
    const comment = approved ? "" : prompt("驳回原因（可选）:") || "";
    await authFetch(`/api/contracts/${selectedContract!.id}/progress/${progressId}/review`, {
      method: "PUT", body: JSON.stringify({ approved, comment }),
    });
    fetchProgress(selectedContract!.id);
    fetchContracts(); fetchStats();
  };

  // Phase 3: 审批
  const fetchApprovalRecords = useCallback(async (contractId: number) => {
    try {
      const r = await authFetch(`/api/contracts/${contractId}/approval`);
      const d = await r.json();
      if (d.success) setApprovalRecords(d.data || []);
    } catch { setApprovalRecords([]); }
  }, []);

  const submitForApproval = async (contractId: number) => {
    if (!confirm("确认提交该合同进入审批流程？")) return;
    try {
      const r = await authFetch(`/api/contracts/${contractId}/approval/submit`, { method: "POST" });
      const d = await r.json();
      if (d.success) {
        setApprovalRecords(d.data || []);
        fetchContracts(); fetchStats();
        alert(`已提交审批，共${d.data?.length || 0}步审批链`);
      } else { alert(d.error || "提交失败"); }
    } catch { alert("提交审批失败"); }
  };

  const approveContractStep = async (recordId: number, approved: boolean) => {
    const comment = approved ? "" : prompt("驳回原因:") || "";
    try {
      const r = await authFetch(`/api/contracts/${selectedContract!.id}/approval/${recordId}`, {
        method: "PUT", body: JSON.stringify({ approved, comment }),
      });
      const d = await r.json();
      if (d.success) {
        fetchApprovalRecords(selectedContract!.id);
        fetchContracts(); fetchStats();
        if (d.data?.allDone) alert("审批已全部通过！");
        else if (!approved) alert("已驳回，合同退回草稿状态");
      } else { alert(d.error || "操作失败"); }
    } catch { alert("操作失败"); }
  };

  const fetchStatsData = useCallback(async () => {
    try {
      let params = `period=${statsPeriod}`;
      if (statsPeriod === "custom") {
        if (!statsCustomStart || !statsCustomEnd) return;
        params = `start=${statsCustomStart}&end=${statsCustomEnd}`;
      }
      const r = await authFetch(`/api/contracts/payments/stats?${params}`);
      const d = await r.json();
      if (d.success) {
        setStatsData(d.data.stats);
        setStatsDetails(d.data.details || []);
      }
    } catch { }
  }, [statsPeriod, statsCustomStart, statsCustomEnd]);

  // Alert Dashboard data fetching
  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const [upRes, ovRes, mlRes] = await Promise.all([
        authFetch("/api/contracts/alerts/upcoming"),
        authFetch("/api/contracts/alerts/overdue"),
        authFetch("/api/contracts/alerts/multi-level"),
      ]);
      const upData = await upRes.json();
      const ovData = await ovRes.json();
      const mlData = await mlRes.json();
      if (upData.success) setUpcomingAlerts(upData.data || []);
      if (ovData.success) setOverdueAlerts(ovData.data || []);
      if (mlData.success) setMultiLevelAlerts(mlData.data);
    } catch { }
    setLoadingAlerts(false);
  }, []);

  // Phase 4: 获取升级历史
  const fetchEscalationHistory = useCallback(async (paymentId: number) => {
    try {
      const r = await authFetch(`/api/contracts/alerts/escalations/${paymentId}`);
      const d = await r.json();
      if (d.success) setEscalationHistory(d.data || []);
    } catch { }
  }, []);

  // Phase 5: 获取甘特图数据
  const fetchGanttData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (ganttFilter) params.set("direction", ganttFilter);
      const r = await authFetch(`/api/contracts/gantt?${params.toString()}`);
      const d = await r.json();
      if (d.success) setGanttData(d.data || []);
    } catch { }
  }, [ganttFilter]);

  // Phase 5: 获取仪表盘数据
  const fetchDashboardData = useCallback(async () => {
    try {
      const r = await authFetch("/api/contracts/dashboard");
      const d = await r.json();
      if (d.success) setDashboardData(d.data);
    } catch { }
  }, []);

  useEffect(() => { fetchContracts(); fetchStats(); }, [fetchContracts, fetchStats]);
  useEffect(() => { if (showAlertConfig) fetchAlertConfig(); }, [showAlertConfig]);
  useEffect(() => { if (showStats) fetchStatsData(); }, [showStats, fetchStatsData]);
  useEffect(() => { if (showDashboard) fetchAlerts(); }, [showDashboard, fetchAlerts]);
  useEffect(() => { if (showGantt) fetchGanttData(); }, [showGantt, fetchGanttData]);
  useEffect(() => { if (showContractDashboard) fetchDashboardData(); }, [showContractDashboard, fetchDashboardData]);

  // ===== Actions =====
  const openEditForm = (contract?: Contract) => {
    if (contract) {
      setEditForm({
        id: contract.id, title: contract.title, party_a: contract.party_a, party_b: contract.party_b,
        direction: contract.direction, our_side: contract.our_side, contract_type: contract.contract_type,
        amount: contract.amount / 10000, start_date: contract.start_date || "", end_date: contract.end_date || "",
        status: contract.status, alert_days: contract.alert_days, remarks: contract.remarks || "",
      });
      setEditMode("edit");
    } else {
      setEditForm({
        title: "", party_a: "雄元科技", party_b: "", direction: "payable", our_side: "party_a",
        contract_type: "other", amount: 0, start_date: "", end_date: "", status: "draft",
        alert_days: 7, remarks: "",
      });
      setEditMode("create");
    }
  };

  const saveContract = async () => {
    try {
      const body = { ...editForm, amount: (editForm.amount || 0) * 10000 };
      if (editMode === "create") {
        await authFetch("/api/contracts", { method: "POST", body: JSON.stringify(body) });
      } else {
        await authFetch(`/api/contracts/${editForm.id}`, { method: "PUT", body: JSON.stringify(body) });
      }
      setEditMode(null);
      fetchContracts(); fetchStats();
    } catch { }
  };

  const deleteContract = async (id: number) => {
    if (!confirm("确定删除此合同？")) return;
    try {
      await authFetch(`/api/contracts/${id}`, { method: "DELETE" });
      fetchContracts(); fetchStats();
    } catch { }
  };

  // ===== Upload Flow =====
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setUploadFile(f);
  };

  const startUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setParseStep("uploading");
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("our_side", ourSide);
      form.append("alert_days", String(alertDays));
      setParseStep("parsing");
      const r = await authFetch("/api/contracts/upload", { method: "POST", body: form });
      const d = await r.json();
      if (d.success) {
        setParseResult(d.data);
        setParseStep("done");
      }
    } catch { setParseStep(""); }
    setUploading(false);
  };

  const confirmUpload = async () => {
    if (!parseResult) return;
    try {
      await authFetch("/api/contracts/upload/confirm", {
        method: "POST",
        body: JSON.stringify({
          contractInfo: parseResult.contractInfo,
          payments: parseResult.payments,
          file_path: parseResult.file_path,
          file_type: parseResult.file_type,
          our_side: parseResult.our_side,
          direction: parseResult.direction,
          alert_days: alertDays,
        }),
      });
      setShowUpload(false);
      setUploadFile(null);
      setParseResult(null);
      setParseStep("");
      fetchContracts(); fetchStats();
    } catch { }
  };

  const markPaid = async (paymentId: number) => {
    const date = prompt("请输入实际收/付日期 (YYYY-MM-DD):", new Date().toISOString().split("T")[0]);
    if (!date) return;
    try {
      await authFetch(`/api/contracts/${selectedContract!.id}/payments/${paymentId}/pay`, {
        method: "POST", body: JSON.stringify({ paid_date: date }),
      });
      fetchPayments(selectedContract!.id);
      fetchContracts(); fetchStats();
    } catch { }
  };

  const saveAlertConfig = async () => {
    try {
      await authFetch("/api/contracts/alerts/config", {
        method: "PUT", body: JSON.stringify(alertConfig),
      });
      setShowAlertConfig(false);
    } catch { }
  };

  // Export
  const exportFile = (format: "xlsx" | "csv") => {
    let params = `period=${statsPeriod}`;
    if (statsPeriod === "custom") params = `start=${statsCustomStart}&end=${statsCustomEnd}`;
    const token = localStorage.getItem("token");
    const url = `/api/contracts/payments/export/${format}?${params}`;
    const a = document.createElement("a");
    a.href = url;
    // Use fetch to get blob with auth
    fetch(url, { headers: token ? { "Authorization": `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const u = URL.createObjectURL(blob);
        a.href = u;
        a.download = `合同进度款明细.${format}`;
        a.click();
        URL.revokeObjectURL(u);
      });
  };

  // ===== Render Helpers =====
  const fmtMoney = (amount: number) => {
    if (Math.abs(amount) >= 10000) return `¥${(amount / 10000).toFixed(1)}万`;
    return `¥${amount.toFixed(0)}`;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-600", review: "bg-yellow-100 text-yellow-700",
      approved: "bg-blue-100 text-blue-700", signed: "bg-green-100 text-green-700",
      active: "bg-emerald-100 text-emerald-700", expired: "bg-red-100 text-red-600",
      terminated: "bg-gray-200 text-gray-500",
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || ""}`}>{STATUS_LABELS[status] || status}</span>;
  };

  // Phase 4: 渲染多级预警条目
  const renderAlertItem = (a: MultiLevelAlertItem, isCritical: boolean) => {
    const isOverdue = a.days_left < 0;
    const isLevel4 = a.alert_level === 4;
    const levelColors: Record<number, string> = {
      4: "border-l-red-500 bg-red-50/30", 3: "border-l-amber-400 bg-amber-50/20",
      2: "border-l-yellow-400 bg-yellow-50/10", 1: "border-l-blue-300",
    };
    const levelBadges: Record<number, string> = {
      4: "bg-red-500 text-white", 3: "bg-amber-400 text-black",
      2: "bg-yellow-300 text-yellow-900", 1: "bg-blue-200 text-blue-700",
    };
    return (
      <div key={`mlalert-${a.id}`} className={`border-l-2 ${levelColors[a.alert_level] || ''} rounded-lg p-3 hover:bg-bg transition-colors group`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${a.alert_level === 4 ? 'bg-red-100' : a.alert_level === 3 ? 'bg-amber-100' : a.alert_level === 2 ? 'bg-yellow-100' : 'bg-blue-100'}`}>
            {a.alert_level === 4 ? '🔴' : a.alert_level === 3 ? '🟠' : a.alert_level === 2 ? '🟡' : '🟢'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">{a.contract_title}</div>
            <div className="text-xs text-text-muted mt-0.5">{a.label}</div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className={`text-sm font-bold ${a.direction === 'outbound' ? 'text-green-600' : 'text-red-600'}`}>{fmtMoney(a.amount)}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${levelBadges[a.alert_level]}`}>{isOverdue ? `逾期${Math.abs(a.days_left)}天` : `${a.days_left}天后`}</span>
              <span className="text-[11px] text-text-muted font-mono">{a.contract_no}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${a.direction === 'outbound' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{a.direction === 'outbound' ? '应收' : '应付'}</span>
              <span className="text-[11px] text-text-muted">{a.due_date}</span>
              {a.escalation_count > 0 && (
                <button onClick={() => { setShowEscalation({ paymentId: a.id, label: `${a.contract_title} · ${a.label}` }); fetchEscalationHistory(a.id); }}
                  className="text-[10px] text-primary underline hover:text-primary/80">升级×{a.escalation_count}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===== Render =====
  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 shrink-0">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <FileText size={20} className="text-primary" /> 合同管理
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowDashboard(true); }} className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1 ${(upcomingAlerts.length > 0 || overdueAlerts.length > 0) ? 'border-red-300 text-red-600 bg-red-50 hover:bg-red-100' : 'border-border hover:bg-bg-card'}`}>
            <AlertTriangle size={12} /> 预警中心{((upcomingAlerts.length || 0) + (overdueAlerts.length || 0)) > 0 ? ` (${upcomingAlerts.length + overdueAlerts.length})` : ''}
          </button>
          <button onClick={() => setShowStats(true)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-bg-card flex items-center gap-1">
            <TrendingUp size={12} /> 统计导出
          </button>
          <button onClick={() => setShowAlertConfig(true)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-bg-card flex items-center gap-1">
            <Settings size={12} /> 预警设置
          </button>
          <button onClick={() => setShowApprovalRules(true)} className="px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 flex items-center gap-1">
            <Lock size={12} /> 审批规则
          </button>
          <button onClick={() => setShowGantt(true)} className="px-3 py-1.5 text-xs rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 flex items-center gap-1">
            <Calendar size={12} /> 甘特图
          </button>
          <button onClick={() => setShowContractDashboard(true)} className="px-3 py-1.5 text-xs rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 flex items-center gap-1">
            <BarChart3 size={12} /> 仪表盘
          </button>
          <button onClick={() => setShowUpload(true)} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 flex items-center gap-1">
            <Upload size={12} /> 上传合同
          </button>
          <button onClick={() => openEditForm()} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 flex items-center gap-1">
            <Plus size={12} /> 新建合同
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="flex gap-3 px-4 py-2 border-b border-border/20 text-xs shrink-0 overflow-x-auto">
          <div className="shrink-0"><span className="text-text-muted">总计</span> <span className="font-semibold">{stats.total}</span></div>
          <div className="shrink-0"><span className="text-text-muted">待审批</span> <span className="font-semibold text-yellow-600">{stats.pendingReview}</span></div>
          <div className="shrink-0"><span className="text-text-muted">📥应收</span> <span className="font-semibold text-green-600">{fmtMoney(stats.receivable.total)}</span> <span className="text-text-muted">(待收{fmtMoney(stats.receivable.total - stats.receivable.done)})</span></div>
          <div className="shrink-0"><span className="text-text-muted">📤应付</span> <span className="font-semibold text-orange-600">{fmtMoney(stats.payable.total)}</span> <span className="text-text-muted">(待付{fmtMoney(stats.payable.total - stats.payable.done)})</span></div>
          <div className="shrink-0"><span className="text-text-muted">⚠️近期到期</span> <span className="font-semibold text-red-600">{stats.expiringCount}</span></div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20 shrink-0 overflow-x-auto">
        {["", "draft", "review", "approved", "signed", "active", "expired"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${statusFilter === s ? "bg-primary text-white" : "bg-bg-card text-text-muted hover:text-text"}`}>
            {s ? STATUS_LABELS[s] : "全部"}
          </button>
        ))}
        <span className="text-border">|</span>
        {["", "receivable", "payable"].map(d => (
          <button key={d} onClick={() => setDirectionFilter(d)} className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${directionFilter === d ? "bg-primary text-white" : "bg-bg-card text-text-muted hover:text-text"}`}>
            {d === "receivable" ? "📥 收款" : d === "payable" ? "📤 付款" : "全部"}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..." className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-border bg-bg-card w-40" />
        </div>
      </div>

      {/* Contract List */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center text-text-muted py-12">加载中...</div>
        ) : contracts.length === 0 ? (
          <div className="text-center text-text-muted py-12">
            <FileText size={48} className="mx-auto mb-3 opacity-30" />
            <p>暂无合同</p>
            <p className="text-xs mt-1">上传 PDF/DOCX 合同文档或手动创建</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {contracts.map(c => (
              <div key={c.id} className="bg-bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => { setSelectedContract(c); fetchPayments(c.id); setShowDetail(true); }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${c.direction === "receivable" ? "" : ""}`}>{c.direction === "receivable" ? "📥" : "📤"}</span>
                    <span className="text-xs text-text-muted font-mono">{c.contract_no}</span>
                    {c.file_path && <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">🤖 AI解析</span>}
                  </div>
                  {statusBadge(c.status)}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm">{c.title || "未命名合同"}</h3>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>{c.party_a} {c.direction === "receivable" ? "←" : "→"} {c.party_b}</span>
                  <span className="font-semibold text-text">{fmtMoney(c.amount)}</span>
                  {c.start_date && <span>{c.start_date} ~ {c.end_date || "—"}</span>}
                </div>
                {c.payment_count > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-text-muted">进度款:</span>
                    <span className="text-green-600">{c.payment_count - c.pending_count}期已完成</span>
                    {c.pending_count > 0 && <span className="text-orange-600">{c.pending_count}期待处理</span>}
                  </div>
                )}
                <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEditForm(c)} className="text-xs px-2 py-1 rounded border border-border hover:bg-bg">编辑</button>
                  <button onClick={() => { setSelectedContract(c); fetchPayments(c.id); fetchClauses(c.id); fetchProgress(c.id); fetchApprovalRecords(c.id); setShowPayments(true); }} className="text-xs px-2 py-1 rounded border border-border hover:bg-bg">进度款</button>
                  {c.status === "draft" && (
                    <button onClick={() => submitForApproval(c.id)} className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50">提交审批</button>
                  )}
                  {c.status === "review" && (
                    <span className="text-[10px] px-2 py-1 rounded bg-amber-50 text-amber-600 border border-amber-200">审批中</span>
                  )}
                  <button onClick={() => deleteContract(c.id)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Upload Modal ===== */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!uploading) { setShowUpload(false); setParseResult(null); setParseStep(""); setUploadFile(null); } }}>
          <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">上传合同文档</h2>
              <button onClick={() => { setShowUpload(false); setParseResult(null); setParseStep(""); setUploadFile(null); }} className="p-1 rounded hover:bg-bg"><X size={18} /></button>
            </div>

            {!parseResult ? (
              <>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center mb-4" onClick={() => fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleFileSelect} className="hidden" />
                  {uploadFile ? (
                    <div className="flex items-center gap-2 justify-center">
                      <FileText size={20} className="text-primary" />
                      <span className="text-sm font-medium">{uploadFile.name}</span>
                      <button onClick={() => setUploadFile(null)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="text-text-muted">
                      <Upload size={32} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">点击选择或拖拽 PDF / DOCX 文件</p>
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="text-xs text-text-muted block mb-1">本方身份</label>
                  <div className="flex gap-2">
                    <button onClick={() => setOurSide("party_a")} className={`flex-1 py-2 rounded-lg text-sm border ${ourSide === "party_a" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>甲方（我方）→ 📥收款</button>
                    <button onClick={() => setOurSide("party_b")} className={`flex-1 py-2 rounded-lg text-sm border ${ourSide === "party_b" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>乙方（我方）→ 📤付款</button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-text-muted block mb-1">预警提前天数</label>
                  <input type="number" value={alertDays} onChange={e => setAlertDays(parseInt(e.target.value) || 7)} className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm" min={1} max={90} />
                </div>

                <button onClick={startUpload} disabled={!uploadFile || uploading} className="w-full py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 disabled:opacity-50">
                  {uploading ? (parseStep === "parsing" ? "AI分析中..." : "上传中...") : "开始AI智能解析"}
                </button>
                {parseStep === "parsing" && <p className="text-xs text-text-muted text-center mt-2">AI正在提取合同信息与收/付款节点...</p>}
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-medium text-green-700 flex items-center gap-1"><Check size={16} /> AI解析完成 (置信度: {Math.round(parseResult.confidence * 100)}%)</p>
                </div>

                {parseResult.contractInfo && (
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex gap-2"><span className="text-text-muted w-16 shrink-0">名称:</span><input className="flex-1 border border-border rounded px-2 py-0.5 bg-bg text-sm" defaultValue={parseResult.contractInfo.title || ""} onChange={e => { const r = { ...parseResult }; r.contractInfo.title = e.target.value; setParseResult(r); }} /></div>
                    <div className="flex gap-2"><span className="text-text-muted w-16 shrink-0">对方:</span><input className="flex-1 border border-border rounded px-2 py-0.5 bg-bg text-sm" defaultValue={parseResult.our_side === "party_a" ? parseResult.contractInfo.party_b : parseResult.contractInfo.party_a || ""} onChange={e => { const r = { ...parseResult }; if (parseResult.our_side === "party_a") r.contractInfo.party_b = e.target.value; else r.contractInfo.party_a = e.target.value; setParseResult(r); }} /></div>
                    <div className="flex gap-2"><span className="text-text-muted w-16 shrink-0">金额:</span><input className="flex-1 border border-border rounded px-2 py-0.5 bg-bg text-sm" type="number" defaultValue={parseResult.contractInfo.amount || ""} onChange={e => { const r = { ...parseResult }; r.contractInfo.amount = parseFloat(e.target.value); setParseResult(r); }} /><span className="text-xs text-text-muted">万元</span></div>
                    <div className="flex gap-2"><span className="text-text-muted w-16 shrink-0">日期:</span><input className="flex-1 border border-border rounded px-2 py-0.5 bg-bg text-sm" defaultValue={parseResult.contractInfo.start_date || ""} placeholder="起始日期" onChange={e => { const r = { ...parseResult }; r.contractInfo.start_date = e.target.value; setParseResult(r); }} /><span className="text-xs text-text-muted">~</span><input className="flex-1 border border-border rounded px-2 py-0.5 bg-bg text-sm" defaultValue={parseResult.contractInfo.end_date || ""} placeholder="截止日期" onChange={e => { const r = { ...parseResult }; r.contractInfo.end_date = e.target.value; setParseResult(r); }} /></div>
                  </div>
                )}

                {parseResult.payments?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-text-muted mb-2">识别到 {parseResult.payments.length} 个收/付款节点:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {parseResult.payments.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-bg rounded-lg px-3 py-2">
                          <span className="font-medium">{p.label || `第${i + 1}期`}</span>
                          <span className="text-text-muted">¥{p.amount}万</span>
                          <span className="text-text-muted">{p.due_date}</span>
                          {p.condition && <span className="text-text-muted truncate max-w-[120px]">条件: {p.condition}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parseResult.risks?.length > 0 && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <p className="text-xs font-medium text-yellow-700 flex items-center gap-1"><AlertTriangle size={12} /> 风险提示:</p>
                    {parseResult.risks.map((r: string, i: number) => <p key={i} className="text-xs text-yellow-600 mt-1">• {r}</p>)}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => { setParseResult(null); setParseStep(""); setUploadFile(null); }} className="flex-1 py-2 rounded-xl border border-border text-sm">重新上传</button>
                  <button onClick={confirmUpload} className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90">确认入库</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Create/Edit Modal ===== */}
      {editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditMode(null)}>
          <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editMode === "create" ? "新建合同" : "编辑合同"}</h2>
            <div className="space-y-3 text-sm">
              <div><label className="text-xs text-text-muted">合同名称</label><input className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} /></div>
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-xs text-text-muted">甲方</label><input className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={editForm.party_a} onChange={e => setEditForm({ ...editForm, party_a: e.target.value })} /></div>
                <div className="flex-1"><label className="text-xs text-text-muted">乙方</label><input className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={editForm.party_b} onChange={e => setEditForm({ ...editForm, party_b: e.target.value })} /></div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-xs text-text-muted">方向</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={editForm.direction} onChange={e => setEditForm({ ...editForm, direction: e.target.value })}>
                    <option value="payable">📤 付款</option><option value="receivable">📥 收款</option>
                  </select>
                </div>
                <div className="flex-1"><label className="text-xs text-text-muted">类型</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={editForm.contract_type} onChange={e => setEditForm({ ...editForm, contract_type: e.target.value })}>
                    {Object.entries(CONTRACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-xs text-text-muted">金额（万元）</label><input type="number" className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })} /></div>
                <div className="flex-1"><label className="text-xs text-text-muted">预警天数</label><input type="number" className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={editForm.alert_days} onChange={e => setEditForm({ ...editForm, alert_days: parseInt(e.target.value) })} /></div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-xs text-text-muted">起始日期</label><input type="date" className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={editForm.start_date} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} /></div>
                <div className="flex-1"><label className="text-xs text-text-muted">截止日期</label><input type="date" className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={editForm.end_date} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} /></div>
              </div>
              <div><label className="text-xs text-text-muted">备注</label><textarea className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" rows={2} value={editForm.remarks} onChange={e => setEditForm({ ...editForm, remarks: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditMode(null)} className="flex-1 py-2 rounded-xl border border-border text-sm">取消</button>
              <button onClick={saveContract} className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Payments Drawer ===== */}
      {showPayments && selectedContract && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowPayments(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md bg-bg-card border-l border-border shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{selectedContract.direction === "receivable" ? "📥 收款" : "📤 付款"}进度</h3>
                <button onClick={() => setShowPayments(false)} className="p-1 rounded hover:bg-bg"><X size={18} /></button>
              </div>
              <p className="text-xs text-text-muted mb-3">{selectedContract.title} | {fmtMoney(selectedContract.amount)}</p>

              <button onClick={() => {
                const label = prompt("付款标签（如：首付款、验收款）:");
                if (!label) return;
                const amount = parseFloat(prompt("金额（元）:") || "0");
                if (!amount) return;
                const dueDate = prompt("计划日期 (YYYY-MM-DD):");
                const condition = prompt("完成条件（可选）:") || "";
                authFetch(`/api/contracts/${selectedContract.id}/payments`, {
                  method: "POST", body: JSON.stringify({ label, amount, due_date: dueDate, completion_condition: condition }),
                }).then(() => fetchPayments(selectedContract.id)).then(() => fetchContracts()).catch(() => { });
              }} className="w-full py-2 mb-3 rounded-lg border border-dashed border-border text-xs text-text-muted hover:border-primary/50 hover:text-primary">
                + 添加收/付款节点
              </button>

              {payments.length === 0 ? (
                <p className="text-center text-text-muted text-xs py-4">暂无进度款节点</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p, i) => (
                    <div key={`pay-${p.id}`} className={`bg-bg rounded-xl p-3 border ${p.paid ? "border-green-200" : "border-border"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">#{p.payment_no} {p.label || "未命名"}</span>
                        <span className="text-sm font-semibold">{fmtMoney(p.amount)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span>📅 {p.due_date || "未设定"}</span>
                        {p.paid ? (
                          <span className="text-green-600 flex items-center gap-1"><Check size={12} /> 已完成 {p.paid_date}</span>
                        ) : (
                          <span className="text-orange-600 flex items-center gap-1"><Clock size={12} /> 待{selectedContract?.direction === "receivable" ? "收" : "付"}</span>
                        )}
                      </div>
                      {p.completion_condition && <p className="text-xs text-text-muted mt-1">条件: {p.completion_condition}</p>}
                      {!p.paid && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => markPaid(p.id)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">标记已收/付</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Phase 1: 合同条款节点展示 */}
              <div className="mt-5 pt-4 border-t border-border">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">📋 条款节点</h4>
                {clauses.length === 0 ? (
                  <p className="text-center text-text-muted text-xs py-2">暂无AI解析的条款节点</p>
                ) : (
                  <div className="space-y-2">
                    {clauses.map((cl, i) => (
                      <div key={`clause-${cl.id ?? i}`} className={`bg-bg rounded-lg p-2.5 border ${cl.is_critical ? "border-red-200 bg-red-50/30" : "border-border"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {CLAUSE_TYPE_LABELS[cl.clause_type] || cl.clause_type}
                          </span>
                          {cl.is_critical === 1 && (
                            <span className="text-[9px] px-1 py-0.5 rounded-full bg-red-500/10 text-red-600 font-medium">关键条款</span>
                          )}
                        </div>
                        {cl.clause_title && <p className="text-xs font-medium text-text mb-0.5">{cl.clause_title}</p>}
                        {cl.clause_content && <p className="text-[11px] text-text-muted leading-relaxed line-clamp-3">{cl.clause_content}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Phase 2: 进度验收展示 */}
              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">✅ 进度验收</h4>
                  <button onClick={() => {
                    const name = prompt("阶段名称（如：初验/中验/终验）:");
                    if (!name) return;
                    const ratio = parseFloat(prompt("完成比例 (%):") || "0");
                    authFetch(`/api/contracts/${selectedContract!.id}/progress`, {
                      method: "POST", body: JSON.stringify({ stage_name: name, completion_ratio: ratio }),
                    }).then(() => fetchProgress(selectedContract!.id));
                  }} className="text-[10px] px-2 py-1 rounded-full border border-dashed border-border text-text-muted hover:border-primary/50 hover:text-primary">
                    + 添加阶段
                  </button>
                </div>
                {progressList.length === 0 ? (
                  <p className="text-center text-text-muted text-xs py-2">暂无进度验收记录</p>
                ) : (
                  <div className="space-y-2">
                    {progressList.map((pg) => (
                      <div key={`prog-${pg.id}`} className={`bg-bg rounded-lg p-2.5 border ${
                        pg.review_status === "approved" ? "border-green-200 bg-green-50/30" :
                        pg.review_status === "rejected" ? "border-red-200 bg-red-50/30" :
                        "border-border"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{pg.stage_name}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              pg.review_status === "approved" ? "bg-green-500/10 text-green-600" :
                              pg.review_status === "rejected" ? "bg-red-500/10 text-red-600" :
                              pg.submitted_at ? "bg-amber-500/10 text-amber-600" : "bg-gray-500/10 text-gray-500"}`}>
                              {pg.submitted_at ? (REVIEW_STATUS_LABELS[pg.review_status] || pg.review_status) : "待提交"}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-primary">{pg.completion_ratio}%</span>
                        </div>
                        {pg.acceptance_criteria && <p className="text-[11px] text-text-muted mb-1">标准: {pg.acceptance_criteria}</p>}
                        <div className="flex items-center gap-3 text-[10px] text-text-muted">
                          {pg.planned_date && <span>📅 计划: {pg.planned_date}</span>}
                          {pg.actual_date && <span>✅ 实际: {pg.actual_date}</span>}
                        </div>
                        {pg.review_comment && <p className="text-[10px] text-amber-600 mt-1">💬 {pg.review_comment}</p>}
                        <div className="flex gap-2 mt-2">
                          {!pg.submitted_at && (
                            <button onClick={() => submitProgress(pg.id)} className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">
                              提交审核
                            </button>
                          )}
                          {pg.review_status === "pending" && pg.submitted_at && (
                            <>
                              <button onClick={() => reviewProgress(pg.id, true)} className="text-[10px] px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100">
                                通过
                              </button>
                              <button onClick={() => reviewProgress(pg.id, false)} className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">
                                驳回
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Phase 3: 审批流程展示 */}
              {approvalRecords.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">🔗 审批流程</h4>
                  <div className="space-y-2">
                    {approvalRecords.map((ar, i) => (
                      <div key={`appr-${ar.id}`} className={`bg-bg rounded-lg p-2.5 border ${
                        ar.status === "approved" ? "border-green-200 bg-green-50/30" :
                        ar.status === "rejected" ? "border-red-200 bg-red-50/30" :
                        "border-blue-200 bg-blue-50/20"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">第{i + 1}步</span>
                            <span className="text-xs font-medium">{ar.position_level_name || "未指定"}</span>
                            {ar.approver_name && <span className="text-xs text-text-muted">({ar.approver_name})</span>}
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            ar.status === "approved" ? "bg-green-500/10 text-green-600" :
                            ar.status === "rejected" ? "bg-red-500/10 text-red-600" :
                            "bg-blue-500/10 text-blue-600"}`}>
                            {APPROVAL_STATUS_LABELS[ar.status] || ar.status}
                          </span>
                        </div>
                        {ar.comment && <p className="text-[10px] text-text-muted mt-1">💬 {ar.comment}</p>}
                        {ar.approved_at && <p className="text-[9px] text-text-muted mt-0.5">🕐 {new Date(ar.approved_at).toLocaleString()}</p>}
                        {ar.status === "pending" && (
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => approveContractStep(ar.id, true)} className="text-[10px] px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100">通过</button>
                            <button onClick={() => approveContractStep(ar.id, false)} className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">驳回</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Alert Config Modal ===== */}
      {showAlertConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAlertConfig(false)}>
          <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">预警设置</h2>
            <div className="space-y-3 text-sm">
              <div><label className="text-xs text-text-muted">默认预警提前天数</label><input type="number" className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={alertConfig.default_alert_days} onChange={e => setAlertConfig({ ...alertConfig, default_alert_days: parseInt(e.target.value) })} min={1} max={90} /></div>
              {/* Phase 4: 多级预警阈值 */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-text-muted">启用多级预警</label>
                <input type="checkbox" checked={(alertConfig.enable_multi_level ?? 1) === 1} onChange={e => setAlertConfig({ ...alertConfig, enable_multi_level: e.target.checked ? 1 : 0 })} />
              </div>
              {(alertConfig.enable_multi_level ?? 1) === 1 && (
                <div className="bg-bg rounded-xl p-3 border border-border space-y-2">
                  <p className="text-xs text-text-muted">预警级别阈值（距到期天数）</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                      <label className="text-[11px] text-text-muted shrink-0">🟢 远期</label>
                      <input type="number" className="flex-1 px-2 py-1 rounded border border-border bg-bg text-xs w-14" value={alertConfig.level1_days ?? 30}
                        onChange={e => setAlertConfig({ ...alertConfig, level1_days: parseInt(e.target.value) || 30 })} min={5} max={90} />
                      <span className="text-[10px] text-text-muted">天</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 shrink-0" />
                      <label className="text-[11px] text-text-muted shrink-0">🟡 预警</label>
                      <input type="number" className="flex-1 px-2 py-1 rounded border border-border bg-bg text-xs w-14" value={alertConfig.level2_days ?? 15}
                        onChange={e => setAlertConfig({ ...alertConfig, level2_days: parseInt(e.target.value) || 15 })} min={3} max={60} />
                      <span className="text-[10px] text-text-muted">天</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                      <label className="text-[11px] text-text-muted shrink-0">🟠 警报</label>
                      <input type="number" className="flex-1 px-2 py-1 rounded border border-border bg-bg text-xs w-14" value={alertConfig.level3_days ?? 7}
                        onChange={e => setAlertConfig({ ...alertConfig, level3_days: parseInt(e.target.value) || 7 })} min={1} max={30} />
                      <span className="text-[10px] text-text-muted">天</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                      <label className="text-[11px] text-text-muted shrink-0">🔴 紧急</label>
                      <input type="number" className="flex-1 px-2 py-1 rounded border border-border bg-bg text-xs w-14" value={alertConfig.level4_days ?? 3}
                        onChange={e => setAlertConfig({ ...alertConfig, level4_days: parseInt(e.target.value) || 3 })} min={1} max={14} />
                      <span className="text-[10px] text-text-muted">天</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between"><label className="text-xs text-text-muted">飞书推送</label><input type="checkbox" checked={alertConfig.enable_feishu === 1} onChange={e => setAlertConfig({ ...alertConfig, enable_feishu: e.target.checked ? 1 : 0 })} /></div>
              {alertConfig.enable_feishu === 1 && <div><label className="text-xs text-text-muted">飞书 Webhook URL</label><input className="w-full px-3 py-2 rounded-lg border border-border bg-bg mt-1" value={alertConfig.feishu_webhook || ""} onChange={e => setAlertConfig({ ...alertConfig, feishu_webhook: e.target.value })} /></div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAlertConfig(false)} className="flex-1 py-2 rounded-xl border border-border text-sm">取消</button>
              <button onClick={saveAlertConfig} className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Stats Export Modal ===== */}
      {showStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowStats(false)}>
          <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">进度款统计导出</h2>
              <button onClick={() => setShowStats(false)} className="p-1 rounded hover:bg-bg"><X size={18} /></button>
            </div>

            <div className="flex gap-2 mb-4">
              {["this_month", "next_month", "custom"].map(p => (
                <button key={p} onClick={() => setStatsPeriod(p)} className={`text-xs px-3 py-1.5 rounded-full ${statsPeriod === p ? "bg-primary text-white" : "bg-bg text-text-muted"}`}>
                  {p === "this_month" ? "本月" : p === "next_month" ? "下月" : "自定义"}
                </button>
              ))}
              {statsPeriod === "custom" && (
                <div className="flex gap-1">
                  <input type="date" className="text-xs px-2 py-1.5 rounded border border-border bg-bg" value={statsCustomStart} onChange={e => setStatsCustomStart(e.target.value)} />
                  <span className="text-xs py-1.5">~</span>
                  <input type="date" className="text-xs px-2 py-1.5 rounded border border-border bg-bg" value={statsCustomEnd} onChange={e => setStatsCustomEnd(e.target.value)} />
                </div>
              )}
            </div>

            {statsData && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 rounded-xl p-3"><p className="text-xs text-green-700 font-medium">📥 应收</p><p className="text-lg font-semibold text-green-800">{fmtMoney(statsData.receivable.total)}</p><p className="text-xs text-green-600">待收: {fmtMoney(statsData.receivable.pending)} | {statsData.receivable.count}笔</p></div>
                  <div className="bg-orange-50 rounded-xl p-3"><p className="text-xs text-orange-700 font-medium">📤 应付</p><p className="text-lg font-semibold text-orange-800">{fmtMoney(statsData.payable.total)}</p><p className="text-xs text-orange-600">待付: {fmtMoney(statsData.payable.pending)} | {statsData.payable.count}笔</p></div>
                </div>

                <div className="flex gap-2 mb-3">
                  {["all", "receivable", "payable"].map(t => (
                    <button key={t} onClick={() => setStatsTab(t as any)} className={`text-xs px-3 py-1 rounded-full ${statsTab === t ? "bg-primary text-white" : "bg-bg text-text-muted"}`}>
                      {t === "all" ? "全部" : t === "receivable" ? "应收明细" : "应付明细"}
                    </button>
                  ))}
                </div>

                <div className="max-h-48 overflow-y-auto mb-4">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border text-text-muted"><th className="text-left py-1">合同编号</th><th className="text-left py-1">名称</th><th className="text-left py-1">对方</th><th className="text-left py-1">标签</th><th className="text-right py-1">金额</th><th className="text-left py-1">到期日</th><th className="text-left py-1">状态</th></tr></thead>
                    <tbody>
                      {statsDetails.filter((d: any) => statsTab === "all" || d.direction === statsTab).map((d: any, i: number) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-1 font-mono">{d.contract_no}</td><td className="py-1">{d.contract_title?.slice(0, 12)}</td><td className="py-1">{d.party_b?.slice(0, 8)}</td>
                          <td className="py-1">{d.label}</td><td className="py-1 text-right">{fmtMoney(d.amount)}</td><td className="py-1">{d.due_date}</td>
                          <td className="py-1">{d.paid ? <span className="text-green-600">✓</span> : <span className="text-orange-600">⏳</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => exportFile("xlsx")} className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-1"><Download size={14} /> 导出 Excel</button>
                  <button onClick={() => exportFile("csv")} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-bg flex items-center justify-center gap-1"><Download size={14} /> 导出 CSV</button>
                </div>
              </>
            )}
            {!statsData && <p className="text-center text-text-muted text-sm py-8">请选择时间范围查询</p>}
          </div>
        </div>
      )}

      {/* ===== Phase 3: Approval Rules Modal ===== */}
      {showApprovalRules && (
        <ApprovalRulesPanel onClose={() => setShowApprovalRules(false)} />
      )}

      {/* ===== Alert Dashboard Panel ===== */}
      {showDashboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDashboard(false)}>
          <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-[960px] mx-4 max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center"><AlertTriangle size={18} className="text-red-600" /></div>
                <div><h2 className="text-lg font-semibold">付款进度预警中心</h2><p className="text-xs text-text-muted">多级预警：30天⟹15天⟹7天⟹3天/逾期</p></div>
              </div>
              <button onClick={() => setShowDashboard(false)} className="p-1.5 rounded-lg hover:bg-bg"><X size={18} /></button>
            </div>

            {/* Multi-level Stats Bar */}
            <div className="grid grid-cols-5 gap-3 p-5 border-b border-border">
              <div className="bg-red-50 rounded-xl p-3 border border-red-200 cursor-pointer" onClick={() => document.getElementById('alert-section-l4')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="flex items-center gap-1.5 mb-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-xs text-red-700 font-semibold">🔴 紧急</span></div>
                <div className="text-2xl font-bold text-red-800">{multiLevelAlerts?.summary.critical ?? 0}</div>
                <div className="text-[11px] text-red-600 mt-0.5">{alertConfig.level4_days ?? 3}天内 / 已逾期</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 cursor-pointer" onClick={() => document.getElementById('alert-section-l3')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="flex items-center gap-1.5 mb-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span className="text-xs text-amber-700 font-semibold">🟠 警报</span></div>
                <div className="text-2xl font-bold text-amber-800">{multiLevelAlerts?.summary.urgent ?? 0}</div>
                <div className="text-[11px] text-amber-600 mt-0.5">{alertConfig.level3_days ?? 7}天内到期</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200 cursor-pointer" onClick={() => document.getElementById('alert-section-l2')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="flex items-center gap-1.5 mb-1"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><span className="text-xs text-yellow-700 font-semibold">🟡 预警</span></div>
                <div className="text-2xl font-bold text-yellow-800">{multiLevelAlerts?.summary.warning ?? 0}</div>
                <div className="text-[11px] text-yellow-600 mt-0.5">{alertConfig.level2_days ?? 15}天内到期</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 cursor-pointer" onClick={() => document.getElementById('alert-section-l1')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="flex items-center gap-1.5 mb-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-xs text-blue-700 font-semibold">🟢 提醒</span></div>
                <div className="text-2xl font-bold text-blue-800">{multiLevelAlerts?.summary.info ?? 0}</div>
                <div className="text-[11px] text-blue-600 mt-0.5">{alertConfig.level1_days ?? 30}天内到期</div>
              </div>
              <div className={(Number(stats?.receivable?.total || 0) - Number(stats?.receivable?.done || 0)) > (Number(stats?.payable?.total || 0) - Number(stats?.payable?.done || 0)) ? "bg-emerald-50 rounded-xl p-3 border border-emerald-200" : "bg-red-50 rounded-xl p-3 border border-red-200"}>
                <div className={`text-xs font-medium mb-1 ${(Number(stats?.receivable?.total || 0) - Number(stats?.receivable?.done || 0)) > (Number(stats?.payable?.total || 0) - Number(stats?.payable?.done || 0)) ? 'text-emerald-700' : 'text-red-700'}`}>净现金流</div>
                <div className={`text-lg font-bold ${(Number(stats?.receivable?.total || 0) - Number(stats?.receivable?.done || 0)) > (Number(stats?.payable?.total || 0) - Number(stats?.payable?.done || 0)) ? 'text-emerald-800' : 'text-red-800'}`}>{fmtMoney(Math.abs((stats?.receivable?.total || 0) - (stats?.receivable?.done || 0) - (stats?.payable?.total || 0) + (stats?.payable?.done || 0)))}</div>
                <div className={`text-[11px] mt-0.5 ${(Number(stats?.receivable?.total || 0) - Number(stats?.receivable?.done || 0)) > (Number(stats?.payable?.total || 0) - Number(stats?.payable?.done || 0)) ? 'text-emerald-600' : 'text-red-600'}`}>{(Number(stats?.receivable?.total || 0) - Number(stats?.receivable?.done || 0)) > (Number(stats?.payable?.total || 0) - Number(stats?.payable?.done || 0)) ? '✅ 净流入' : '⚠️ 净流出'}</div>
              </div>
            </div>

            {/* Multi-level Alert Sections */}
            {loadingAlerts ? (
              <div className="p-5 space-y-2">{[1,2,3].map(i => <div key={`skel-${i}`} className="animate-pulse bg-bg rounded-lg h-16" />)}</div>
            ) : !multiLevelAlerts || multiLevelAlerts.summary.total === 0 ? (
              <div className="text-center py-12 text-text-muted"><Check size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">暂无预警信号，一切正常</p><p className="text-xs mt-1 opacity-60">系统自动按30/15/7/3天多级监控付款到期日</p></div>
            ) : (
              <div className="divide-y divide-border">
                {/* Level 4: Critical */}
                {multiLevelAlerts.level4.length > 0 && (
                  <div id="alert-section-l4" className="p-4 bg-red-50/30">
                    <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">🔴 紧急级别 ({multiLevelAlerts.level4.length})<span className="text-[11px] text-red-600 font-normal">{alertConfig.level4_days ?? 3}天内到期 · 已逾期</span></h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {multiLevelAlerts.level4.map((a: MultiLevelAlertItem) => renderAlertItem(a, true))}
                    </div>
                  </div>
                )}
                {/* Level 3: Urgent */}
                {multiLevelAlerts.level3.length > 0 && (
                  <div id="alert-section-l3" className="p-4 bg-amber-50/20">
                    <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">🟠 警报级别 ({multiLevelAlerts.level3.length})<span className="text-[11px] text-amber-600 font-normal">{alertConfig.level3_days ?? 7}天内到期</span></h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {multiLevelAlerts.level3.map((a: MultiLevelAlertItem) => renderAlertItem(a, false))}
                    </div>
                  </div>
                )}
                {/* Level 2: Warning */}
                {multiLevelAlerts.level2.length > 0 && (
                  <div id="alert-section-l2" className="p-4 bg-yellow-50/10">
                    <h3 className="text-sm font-semibold text-yellow-700 mb-3 flex items-center gap-2">🟡 预警级别 ({multiLevelAlerts.level2.length})<span className="text-[11px] text-yellow-600 font-normal">{alertConfig.level2_days ?? 15}天内到期</span></h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {multiLevelAlerts.level2.map((a: MultiLevelAlertItem) => renderAlertItem(a, false))}
                    </div>
                  </div>
                )}
                {/* Level 1: Info */}
                {multiLevelAlerts.level1.length > 0 && (
                  <div id="alert-section-l1" className="p-4">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">🟢 远期提醒 ({multiLevelAlerts.level1.length})<span className="text-[11px] text-blue-500 font-normal">{alertConfig.level1_days ?? 30}天内到期</span></h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {multiLevelAlerts.level1.map((a: MultiLevelAlertItem) => renderAlertItem(a, false))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-bg/50">
              <button onClick={() => fetchAlerts()} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-bg flex items-center gap-1">🔄 刷新预警数据</button>
              <div className="text-[11px] text-text-muted">{multiLevelAlerts ? `总计 ${multiLevelAlerts.summary.total} 条预警 | 🔴${multiLevelAlerts.summary.critical} 🟠${multiLevelAlerts.summary.urgent} 🟡${multiLevelAlerts.summary.warning} 🟢${multiLevelAlerts.summary.info}` : `自动监控 · 提前${alertConfig.level1_days ?? 30}天预警`}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Escalation History Modal ===== */}
      {showEscalation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowEscalation(null)}>
          <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">升级历史</h3>
              <button onClick={() => setShowEscalation(null)} className="p-1 rounded hover:bg-bg"><X size={16} /></button>
            </div>
            <p className="text-xs text-text-muted mb-3">{showEscalation.label}</p>
            {escalationHistory.length === 0 ? (
              <div className="text-center py-6 text-text-muted text-xs">暂无升级记录</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {escalationHistory.map((e) => (
                  <div key={`esc-${e.id}`} className="flex items-start gap-2 p-2 rounded-lg bg-bg border border-border">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${e.alert_level === 4 ? 'bg-red-500' : e.alert_level === 3 ? 'bg-amber-500' : e.alert_level === 2 ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="text-xs font-medium">{e.level_label}</span><span className="text-[10px] text-text-muted">{e.created_at?.slice(0, 16)}</span></div>
                      {e.message && <div className="text-[11px] text-text-muted mt-0.5">{e.message}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Phase 5: Gantt Chart Modal ===== */}
      {showGantt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowGantt(false)}>
          <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-[1100px] mx-4 max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center"><Calendar size={18} className="text-purple-600" /></div>
                <div><h2 className="text-lg font-semibold">合同进度甘特图</h2><p className="text-xs text-text-muted">时间线视图 · 合同周期 + 付款节点 + 验收进度</p></div>
              </div>
              <div className="flex items-center gap-2">
                <select className="text-xs px-2 py-1 rounded border border-border bg-bg" value={ganttFilter} onChange={e => { setGanttFilter(e.target.value); }}>
                  <option value="">全部方向</option>
                  <option value="receivable">收款合同</option>
                  <option value="payable">付款合同</option>
                </select>
                <button onClick={() => setShowGantt(false)} className="p-1.5 rounded-lg hover:bg-bg"><X size={18} /></button>
              </div>
            </div>

            {ganttData.length === 0 ? (
              <div className="text-center py-16 text-text-muted"><FileText size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">暂无合同数据</p></div>
            ) : (
              <div className="p-4">
                {/* Gantt Timeline */}
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Month Header */}
                    {(() => {
                      const allDates: string[] = [];
                      ganttData.forEach(c => {
                        if (c.start_date) allDates.push(c.start_date);
                        if (c.end_date) allDates.push(c.end_date);
                        c.payments.forEach(p => { if (p.due_date) allDates.push(p.due_date); });
                      });
                      allDates.sort();
                      const minDate = allDates[0] ? new Date(allDates[0]) : new Date();
                      const maxDate = allDates[allDates.length - 1] ? new Date(allDates[allDates.length - 1]) : new Date();
                      minDate.setDate(1);
                      maxDate.setMonth(maxDate.getMonth() + 3);
                      const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000) || 365;
                      const dayToX = (d: string) => {
                        if (!d) return 0;
                        return Math.max(0, (new Date(d).getTime() - minDate.getTime()) / 86400000 / totalDays * 100);
                      };
                      const months: string[] = [];
                      const m = new Date(minDate);
                      while (m <= maxDate) {
                        months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
                        m.setMonth(m.getMonth() + 1);
                      }

                      return (
                        <>
                          {/* Month labels */}
                          <div className="flex ml-[260px] mb-1">
                            {months.map((mo) => (
                              <div key={`mh-${mo}`} className="text-[10px] text-text-muted text-center" style={{ flex: 1 }}>
                                {mo.slice(2)}
                              </div>
                            ))}
                          </div>
                          {/* Grid and bars */}
                          <div className="border border-border rounded-xl overflow-hidden">
                            {ganttData.map((c, ci) => {
                              const barX = dayToX(c.start_date || "");
                              const barW = Math.max(1, dayToX(c.end_date || "") - barX);
                              return (
                                <div key={`gc-${c.contract_id}`} className={`flex border-b border-border last:border-b-0 ${ci % 2 === 0 ? 'bg-bg/30' : ''}`}>
                                  {/* Left label */}
                                  <div className="w-[260px] shrink-0 p-2 border-r border-border">
                                    <div className="text-xs font-medium truncate">{c.title}</div>
                                    <div className="text-[10px] text-text-muted mt-0.5">{c.contract_no} · {c.party_b}</div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className={`text-[10px] px-1 rounded ${c.direction === 'receivable' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{c.direction === 'receivable' ? '收' : '付'}</span>
                                      <span className="text-[10px] text-text-muted">{fmtMoney(c.amount)}</span>
                                    </div>
                                  </div>
                                  {/* Bar area */}
                                  <div className="flex-1 relative py-4 min-h-[44px]">
                                    {/* Grid lines */}
                                    {months.map((_, mi) => (
                                      <div key={`gl-${mi}`} className="absolute top-0 bottom-0 border-l border-border/50" style={{ left: `${(mi / months.length) * 100}%` }} />
                                    ))}
                                    {/* Contract bar */}
                                    {c.start_date && c.end_date && (
                                      <div className="absolute top-1.5 h-3 rounded-full opacity-80" style={{
                                        left: `${barX}%`, width: `${barW}%`,
                                        background: c.direction === 'receivable'
                                          ? 'linear-gradient(90deg, #34d399, #10b981)'
                                          : 'linear-gradient(90deg, #f97316, #ef4444)'
                                      }} title={`${c.start_date} - ${c.end_date}`} />
                                    )}
                                    {/* Progress nodes */}
                                    {c.progress_nodes.map((pg, pi) => {
                                      if (!pg.planned_date) return null;
                                      const px = dayToX(pg.planned_date);
                                      return (
                                        <div key={`pg-${pg.id}`} className="absolute top-4" style={{ left: `${px}%` }}
                                          title={`${pg.stage_name}: ${pg.planned_date}${pg.actual_date ? ' → ' + pg.actual_date : ''}`}>
                                          <div className={`w-2 h-2 rounded-full ${pg.review_status === 'approved' ? 'bg-green-500' : pg.review_status === 'rejected' ? 'bg-red-500' : 'bg-purple-400'}`} />
                                          <div className="text-[9px] text-text-muted mt-0.5 -ml-2 max-w-[40px] truncate">{pg.stage_name}</div>
                                        </div>
                                      );
                                    })}
                                    {/* Payment dots */}
                                    {c.payments.map((p) => {
                                      if (!p.due_date) return null;
                                      const px = dayToX(p.due_date);
                                      return (
                                        <div key={`pdot-${p.id}`} className="absolute top-5" style={{ left: `${px}%` }}
                                          title={`${p.label}: ¥${(p.amount / 10000).toFixed(1)}万 ${p.due_date}${p.paid ? ' ✅' : ' ⏳'}`}>
                                          <div className={`w-2.5 h-2.5 rounded-full border-2 border-white ${p.paid ? 'bg-green-500' : 'bg-amber-400'}`} style={{ transform: 'translateX(-1px)' }} />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 text-[10px] text-text-muted border-t border-border pt-3">
                  <span className="flex items-center gap-1"><div className="w-6 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" /> 收款合同</span>
                  <span className="flex items-center gap-1"><div className="w-6 h-2 rounded-full bg-gradient-to-r from-orange-400 to-red-500" /> 付款合同</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-400" /> 验收节点</span>
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 待付款</span>
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /> 已付款</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Phase 5: Dashboard Modal ===== */}
      {showContractDashboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowContractDashboard(false)}>
          <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-4xl mx-4 max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center"><BarChart3 size={18} className="text-emerald-600" /></div>
                <div><h2 className="text-lg font-semibold">合同管理仪表盘</h2><p className="text-xs text-text-muted">总览 · 趋势 · 分布 · 预警</p></div>
              </div>
              <button onClick={() => setShowContractDashboard(false)} className="p-1.5 rounded-lg hover:bg-bg"><X size={18} /></button>
            </div>

            {!dashboardData ? (
              <div className="text-center py-16 text-text-muted"><div className="animate-pulse">加载中...</div></div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Overview Cards */}
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: "合同总数", value: dashboardData.overview.total, color: "bg-blue-50 border-blue-200 text-blue-800" },
                    { label: "执行中", value: dashboardData.overview.active, color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
                    { label: "已签署", value: dashboardData.overview.signed, color: "bg-green-50 border-green-200 text-green-800" },
                    { label: "已到期", value: dashboardData.overview.expired, color: "bg-red-50 border-red-200 text-red-800" },
                    { label: "本月新增", value: dashboardData.overview.newThisMonth, color: "bg-purple-50 border-purple-200 text-purple-800" },
                  ].map(card => (
                    <div key={card.label} className={`rounded-xl p-3 border ${card.color} text-center`}>
                      <div className="text-[11px] opacity-70 mb-0.5">{card.label}</div>
                      <div className="text-2xl font-bold">{card.value}</div>
                    </div>
                  ))}
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "应收总额", value: dashboardData.financial.totalReceivable, color: "text-green-700", bg: "bg-green-50 border-green-200" },
                    { label: "已收金额", value: dashboardData.financial.collected, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", pct: dashboardData.financial.totalReceivable ? (dashboardData.financial.collected / dashboardData.financial.totalReceivable * 100).toFixed(1) : "0" },
                    { label: "应付总额", value: dashboardData.financial.totalPayable, color: "text-red-700", bg: "bg-red-50 border-red-200" },
                    { label: "已付金额", value: dashboardData.financial.paid, color: "text-orange-700", bg: "bg-orange-50 border-orange-200", pct: dashboardData.financial.totalPayable ? (dashboardData.financial.paid / dashboardData.financial.totalPayable * 100).toFixed(1) : "0" },
                  ].map(f => (
                    <div key={f.label} className={`rounded-xl p-3 border ${f.bg}`}>
                      <div className={`text-[11px] font-medium mb-0.5 ${f.color}`}>{f.label}</div>
                      <div className={`text-lg font-bold ${f.color}`}>{fmtMoney(f.value)}</div>
                      {f.pct && <div className="text-[10px] opacity-60 mt-0.5">回收率 {f.pct}%</div>}
                    </div>
                  ))}
                </div>

                {/* Two-column layout */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Type Distribution */}
                  <div className="bg-bg rounded-xl p-4 border border-border">
                    <h3 className="text-sm font-semibold mb-3">合同类型分布</h3>
                    {dashboardData.typeDistribution.length === 0 ? (
                      <p className="text-xs text-text-muted text-center py-4">暂无数据</p>
                    ) : (
                      <div className="space-y-2">
                        {dashboardData.typeDistribution.map(t => {
                          const maxCount = dashboardData.typeDistribution[0]?.count || 1;
                          const pct = (t.count / maxCount * 100);
                          return (
                            <div key={t.contract_type} className="flex items-center gap-2">
                              <span className="text-xs w-16 shrink-0">{t.contract_type || "未分类"}</span>
                              <div className="flex-1 bg-bg-card rounded-full h-4 overflow-hidden">
                                <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] text-text-muted w-8 text-right">{t.count}</span>
                              <span className="text-[10px] text-text-muted w-16 text-right">{fmtMoney(t.amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Alert Summary */}
                  <div className="bg-bg rounded-xl p-4 border border-border">
                    <h3 className="text-sm font-semibold mb-3">预警概览</h3>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { label: "🔴 紧急", value: dashboardData.alertSummary.critical, color: "text-red-600 bg-red-50 border-red-200" },
                        { label: "🟠 警报", value: dashboardData.alertSummary.urgent, color: "text-amber-600 bg-amber-50 border-amber-200" },
                        { label: "🟡 预警", value: dashboardData.alertSummary.warning, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
                        { label: "🟢 提醒", value: dashboardData.alertSummary.info, color: "text-blue-600 bg-blue-50 border-blue-200" },
                      ].map(a => (
                        <div key={a.label} className={`rounded-lg p-2.5 border text-center ${a.color}`}>
                          <div className="text-[10px] opacity-70">{a.label}</div>
                          <div className="text-xl font-bold">{a.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Top 5 upcoming */}
                    {dashboardData.upcomingTop5.length > 0 && (
                      <>
                        <h4 className="text-xs font-medium text-text-muted mb-1.5">即将到期 TOP5</h4>
                        <div className="space-y-1">
                          {dashboardData.upcomingTop5.map((u, i) => (
                            <div key={`up-${u.id}`} className="flex items-center justify-between text-[11px] p-1.5 rounded hover:bg-bg-card">
                              <span className="truncate max-w-[160px]">{u.title}</span>
                              <span className={u.days_left < 0 ? 'text-red-500 font-medium' : u.days_left <= 7 ? 'text-amber-500 font-medium' : 'text-text-muted'}>
                                {u.days_left < 0 ? `逾期${Math.abs(u.days_left)}天` : `${u.days_left}天后`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount Trend (6 months) */}
                <div className="bg-bg rounded-xl p-4 border border-border">
                  <h3 className="text-sm font-semibold mb-3">近6个月收付款趋势</h3>
                  <div className="flex items-end gap-2 h-32">
                    {dashboardData.amountTrend.map((m, i) => {
                      const maxAmt = Math.max(...dashboardData.amountTrend.map(t => Math.max(t.receivable, t.payable)), 1);
                      const rH = (m.receivable / maxAmt * 100);
                      const pH = (m.payable / maxAmt * 100);
                      return (
                        <div key={`tr-${i}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                          <div className="text-[10px] text-text-muted">{fmtMoney(Math.max(m.receivable, m.payable))}</div>
                          <div className="flex items-end gap-1 w-full" style={{ height: '80px' }}>
                            <div className="flex-1 bg-emerald-400/50 rounded-t" style={{ height: `${rH}%` }} title={`收款: ${fmtMoney(m.receivable)}`} />
                            <div className="flex-1 bg-red-400/50 rounded-t" style={{ height: `${pH}%` }} title={`付款: ${fmtMoney(m.payable)}`} />
                          </div>
                          <div className="text-[10px] text-text-muted">{m.month.slice(2)}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-text-muted">
                    <span className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-emerald-400/60" /> 收款</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-red-400/60" /> 付款</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";
import { DollarSign, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";

interface ExpenseRecord {
  id: number;
  expense_type: string;
  amount: number;
  currency: string;
  expense_date: string;
  description: string;
  invoice_count: number;
  status: string;
  payment_status: string;
  employee_name: string;
  department_name: string;
  contract_title: string;
  created_at: string;
}

const EXPENSE_TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  travel: { label: "差旅", color: "text-blue-700", bg: "bg-blue-100 border-blue-200" },
  business: { label: "商务", color: "text-purple-700", bg: "bg-purple-100 border-purple-200" },
  office: { label: "办公", color: "text-green-700", bg: "bg-green-100 border-green-200" },
  communication: { label: "通讯", color: "text-cyan-700", bg: "bg-cyan-100 border-cyan-200" },
  vehicle: { label: "车辆", color: "text-orange-700", bg: "bg-orange-100 border-orange-200" },
  entertainment: { label: "招待", color: "text-pink-700", bg: "bg-pink-100 border-pink-200" },
  training: { label: "培训", color: "text-indigo-700", bg: "bg-indigo-100 border-indigo-200" },
  other: { label: "其他", color: "text-gray-700", bg: "bg-gray-100 border-gray-200" },
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "审批中", color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-200" },
  approved: { label: "已通过", color: "text-green-700", bg: "bg-green-100 border-green-200" },
  rejected: { label: "已驳回", color: "text-red-700", bg: "bg-red-100 border-red-200" },
  paid: { label: "已付款", color: "text-primary", bg: "bg-blue-100 border-blue-200" },
  cancelled: { label: "已撤回", color: "text-gray-700", bg: "bg-gray-100 border-gray-200" },
};

const EXPENSE_TYPES = [
  { value: "travel", label: "差旅" },
  { value: "business", label: "商务" },
  { value: "office", label: "办公" },
  { value: "communication", label: "通讯" },
  { value: "vehicle", label: "车辆" },
  { value: "entertainment", label: "招待" },
  { value: "training", label: "培训" },
  { value: "other", label: "其他" },
];

export default function ExpensePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [statsMonth, setStatsMonth] = useState(() => new Date().toISOString().substring(0, 7));
  const [monthStats, setMonthStats] = useState<any>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    expense_type: "travel",
    amount: "",
    currency: "CNY",
    expense_date: new Date().toISOString().split("T")[0],
    description: "",
    invoice_count: 0,
    supplier_name: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const totalPages = Math.ceil(total / limit);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterStatus) params.set("status", filterStatus);
      if (filterType) params.set("expense_type", filterType);
      const r = await authFetch(`/api/expense?${params}`);
      const d = await r.json();
      if (d.success) { setRecords(d.data.list); setTotal(d.data.total); }
    } finally { setLoading(false); }
  }, [page, limit, filterStatus, filterType]);

  const fetchStats = useCallback(async () => {
    const r = await authFetch(`/api/expense/stats/monthly?month=${statsMonth}`);
    const d = await r.json();
    if (d.success) setMonthStats(d.data);
  }, [statsMonth]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSubmit = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { alert("请输入正确的报销金额"); return; }
    if (!form.expense_date) { alert("请选择报销日期"); return; }

    setSubmitting(true);
    try {
      const r = await authFetch("/api/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      const d = await r.json();
      if (d.success) {
        alert("报销申请已提交");
        setShowForm(false);
        setForm({ expense_type: "travel", amount: "", currency: "CNY", expense_date: new Date().toISOString().split("T")[0], description: "", invoice_count: 0, supplier_name: "" });
        fetchList();
        fetchStats();
        // 触发工作流
        try {
          const defRes = await authFetch("/api/workflows-v2/definitions?status=active");
          const defJson = await defRes.json();
          if (defJson.success) {
            const expenseDef = defJson.data?.find((d: any) => d.name?.includes("报销"));
            if (expenseDef) {
              await authFetch("/api/workflows-v2/instances", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workflowId: expenseDef.id,
                  title: `${EXPENSE_TYPE_MAP[form.expense_type]?.label || form.expense_type}报销`,
                  variables: { amount: parseFloat(form.amount), expenseType: form.expense_type, description: form.description },
                }),
              });
            }
          }
        } catch (wfErr) { console.warn("工作流触发失败:", wfErr); }
      } else {
        alert(d.error || "提交失败");
      }
    } finally { setSubmitting(false); }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("确定撤回此报销申请？")) return;
    const r = await authFetch(`/api/expense/${id}/cancel`, { method: "PUT" });
    const d = await r.json();
    if (d.success) { alert("已撤回"); fetchList(); } else { alert(d.error || "撤回失败"); }
  };

  const handleMarkPaid = async (id: number) => {
    const r = await authFetch(`/api/expense/${id}/pay`, { method: "PUT" });
    const d = await r.json();
    if (d.success) { alert("已标记为已付款"); fetchList(); } else { alert(d.error || "操作失败"); }
  };

  const fmt = (d: string) => d ? d.split("T")[0] : "";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">费用报销</h1>
        <button onClick={() => setShowForm(true)}
          className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-blue-700 flex items-center gap-1">
          <Plus size={14} /> 新建报销
        </button>
      </div>

      {/* 月度统计 */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-primary" />
            <span className="font-medium text-text">月度统计</span>
          </div>
          <input type="month" value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)}
            className="text-sm border border-border rounded px-2 py-1" />
        </div>
        {monthStats?.summary ? (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                <div className="text-2xl font-bold text-blue-700">¥{monthStats.summary.total_amount?.toFixed(2) || 0}</div>
                <div className="text-xs text-blue-600 mt-1">总金额</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                <div className="text-2xl font-bold text-green-700">{monthStats.summary.total || 0}</div>
                <div className="text-xs text-green-600 mt-1">报销笔数</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                <div className="text-2xl font-bold text-purple-700">¥{monthStats.summary.avg_amount?.toFixed(2) || 0}</div>
                <div className="text-xs text-purple-600 mt-1">平均金额</div>
              </div>
            </div>
            {monthStats.byType?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {monthStats.byType.map((item: any) => (
                  EXPENSE_TYPE_MAP[item.expense_type] && (
                    <span key={item.expense_type}
                      className={`px-2 py-1 rounded text-xs border ${EXPENSE_TYPE_MAP[item.expense_type].bg} ${EXPENSE_TYPE_MAP[item.expense_type].color}`}>
                      {EXPENSE_TYPE_MAP[item.expense_type].label}: ¥{item.total?.toFixed(2) || 0}
                    </span>
                  )
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-text-muted">暂无统计数据</div>
        )}
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-primary" />
            <span className="font-medium text-text">报销记录</span>
            <span className="text-xs text-text-muted">（共 {total} 条）</span>
          </div>
          <div className="flex flex-1 items-center gap-2 md:justify-end">
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="text-sm border border-border rounded px-2 py-1">
              <option value="">全部状态</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="text-sm border border-border rounded px-2 py-1">
              <option value="">全部类型</option>
              {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg border-b border-border text-left">
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">日期</th>
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">类型</th>
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">金额</th>
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">票据</th>
                {isAdmin && <th className="px-4 py-2.5 text-xs text-text-muted font-medium">员工</th>}
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">状态</th>
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-text-muted">加载中...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-text-muted">暂无报销记录</td></tr>
              ) : (
                records.map(r => (
                  <tr key={r.id} className="hover:bg-bg transition-colors">
                    <td className="px-4 py-2.5 text-text">{r.expense_date}</td>
                    <td className="px-4 py-2.5">
                      {EXPENSE_TYPE_MAP[r.expense_type] ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs border ${EXPENSE_TYPE_MAP[r.expense_type].bg} ${EXPENSE_TYPE_MAP[r.expense_type].color}`}>
                          {EXPENSE_TYPE_MAP[r.expense_type].label}
                        </span>
                      ) : r.expense_type}
                    </td>
                    <td className="px-4 py-2.5 text-text font-medium">¥{r.amount.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-text">{r.invoice_count > 0 ? `${r.invoice_count}张` : "--"}</td>
                    {isAdmin && <td className="px-4 py-2.5 text-text">{r.employee_name}</td>}
                    <td className="px-4 py-2.5">
                      {STATUS_MAP[r.status] && (
                        <span className={`px-1.5 py-0.5 rounded text-xs border ${STATUS_MAP[r.status].bg} ${STATUS_MAP[r.status].color}`}>
                          {STATUS_MAP[r.status].label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        {r.status === "pending" && (
                          <button onClick={() => handleCancel(r.id)} className="text-xs text-red-600 hover:underline">撤回</button>
                        )}
                        {isAdmin && r.status === "approved" && r.payment_status === "unpaid" && (
                          <button onClick={() => handleMarkPaid(r.id)} className="text-xs text-primary hover:underline">标记付款</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1 text-sm border border-border rounded hover:bg-bg disabled:opacity-40">
              <ChevronLeft size={14} /> 上一页
            </button>
            <span className="text-xs text-text-muted">第 {page} / {totalPages} 页</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1 text-sm border border-border rounded hover:bg-bg disabled:opacity-40">
              下一页 <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* 新建报销弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-text">新建报销</span>
              <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text text-lg">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">费用类型 <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-4 gap-2">
                  {EXPENSE_TYPES.map(t => (
                    <label key={t.value}
                      className={`flex items-center justify-center px-2 py-1.5 rounded border text-sm cursor-pointer transition-colors ${form.expense_type === t.value ? "border-primary bg-blue-50 text-primary" : "border-border hover:bg-bg"}`}>
                      <input type="radio" name="expense_type" value={t.value}
                        checked={form.expense_type === t.value}
                        onChange={() => setForm({ ...form, expense_type: t.value })}
                        className="sr-only" />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text mb-1">报销金额 <span className="text-red-500">*</span></label>
                  <input type="number" step="0.01" min="0.01" value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00" className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">报销日期 <span className="text-red-500">*</span></label>
                  <input type="date" value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">票据数量</label>
                <input type="number" min="0" value={form.invoice_count}
                  onChange={(e) => setForm({ ...form, invoice_count: parseInt(e.target.value) || 0 })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">费用说明</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="请输入费用说明..." rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-bg">取消</button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  {submitting ? "提交中..." : "提交申请"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";
import { Calendar, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";

interface LeaveRecord {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: string;
  employee_name: string;
  department_name: string;
  substitute_name: string;
  reviewer_name: string;
  reviewed_at: string;
  review_comment: string;
  created_at: string;
}

const LEAVE_TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  annual: { label: "年假", color: "text-blue-700", bg: "bg-blue-100 border-blue-200" },
  sick: { label: "病假", color: "text-red-700", bg: "bg-red-100 border-red-200" },
  personal: { label: "事假", color: "text-orange-700", bg: "bg-orange-100 border-orange-200" },
  marriage: { label: "婚假", color: "text-pink-700", bg: "bg-pink-100 border-pink-200" },
  maternity: { label: "产假", color: "text-purple-700", bg: "bg-purple-100 border-purple-200" },
  bereavement: { label: "丧假", color: "text-gray-700", bg: "bg-gray-100 border-gray-200" },
  other: { label: "其他", color: "text-gray-700", bg: "bg-gray-100 border-gray-200" },
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "审批中", color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-200" },
  approved: { label: "已通过", color: "text-green-700", bg: "bg-green-100 border-green-200" },
  rejected: { label: "已驳回", color: "text-red-700", bg: "bg-red-100 border-red-200" },
  cancelled: { label: "已撤回", color: "text-gray-700", bg: "bg-gray-100 border-gray-200" },
};

const LEAVE_TYPES = [
  { value: "annual", label: "年假" },
  { value: "sick", label: "病假" },
  { value: "personal", label: "事假" },
  { value: "marriage", label: "婚假" },
  { value: "maternity", label: "产假" },
  { value: "bereavement", label: "丧假" },
  { value: "other", label: "其他" },
];

export default function LeavePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [stats, setStats] = useState<any>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    leave_type: "annual",
    start_date: "",
    end_date: "",
    total_days: 0,
    reason: "",
    substitute_employee_id: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const totalPages = Math.ceil(total / limit);

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return 0;
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterStatus) params.set("status", filterStatus);
      if (filterType) params.set("leave_type", filterType);
      const r = await authFetch(`/api/leave?${params}`);
      const d = await r.json();
      if (d.success) { setRecords(d.data.list); setTotal(d.data.total); }
    } finally { setLoading(false); }
  }, [page, limit, filterStatus, filterType]);

  const fetchStats = useCallback(async () => {
    const r = await authFetch("/api/leave/stats/summary");
    const d = await r.json();
    if (d.success) setStats(d.data);
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date) { alert("请选择开始和结束日期"); return; }
    const days = calcDays(form.start_date, form.end_date);
    if (days <= 0) { alert("结束日期必须大于开始日期"); return; }

    setSubmitting(true);
    try {
      const body = { ...form, total_days: days };
      if (!body.substitute_employee_id) (body as any).substitute_employee_id = undefined;
      const r = await authFetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        alert("请假申请已提交");
        setShowForm(false);
        setForm({ leave_type: "annual", start_date: "", end_date: "", total_days: 0, reason: "", substitute_employee_id: "" });
        fetchList();
        fetchStats();
        // 触发工作流
        try {
          const defRes = await authFetch("/api/workflows-v2/definitions?status=active");
          const defJson = await defRes.json();
          if (defJson.success) {
            const leaveDef = defJson.data?.find((d: any) => d.name?.includes("请假"));
            if (leaveDef) {
              await authFetch("/api/workflows-v2/instances", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workflowId: leaveDef.id,
                  title: `${LEAVE_TYPE_MAP[form.leave_type]?.label || form.leave_type}申请`,
                  variables: { days, leaveType: form.leave_type, reason: form.reason },
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
    if (!confirm("确定撤回此请假申请？")) return;
    const r = await authFetch(`/api/leave/${id}/cancel`, { method: "PUT" });
    const d = await r.json();
    if (d.success) { alert("已撤回"); fetchList(); } else { alert(d.error || "撤回失败"); }
  };

  const fmt = (d: string) => d ? d.split("T")[0] : "";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">请假管理</h1>
        <button onClick={() => setShowForm(true)}
          className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-blue-700 flex items-center gap-1">
          <Plus size={14} /> 新建请假
        </button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
            <div className="text-2xl font-bold text-blue-700">{stats.approved || 0}</div>
            <div className="text-xs text-blue-600">已通过</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-100">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending || 0}</div>
            <div className="text-xs text-yellow-600">审批中</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
            <div className="text-2xl font-bold text-red-700">{stats.rejected || 0}</div>
            <div className="text-xs text-red-600">已驳回</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
            <div className="text-2xl font-bold text-green-700">{stats.annual_used || 0}</div>
            <div className="text-xs text-green-600">年假已用(天)</div>
          </div>
        </div>
      )}

      {/* 列表 */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            <span className="font-medium text-text">请假记录</span>
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
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg border-b border-border text-left">
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">类型</th>
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">请假时间</th>
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">天数</th>
                {isAdmin && <th className="px-4 py-2.5 text-xs text-text-muted font-medium">员工</th>}
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">状态</th>
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-text-muted">加载中...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-text-muted">暂无请假记录</td></tr>
              ) : (
                records.map(r => (
                  <tr key={r.id} className="hover:bg-bg transition-colors">
                    <td className="px-4 py-2.5">
                      {LEAVE_TYPE_MAP[r.leave_type] ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs border ${LEAVE_TYPE_MAP[r.leave_type].bg} ${LEAVE_TYPE_MAP[r.leave_type].color}`}>
                          {LEAVE_TYPE_MAP[r.leave_type].label}
                        </span>
                      ) : r.leave_type}
                    </td>
                    <td className="px-4 py-2.5 text-text">{r.start_date} ~ {r.end_date}</td>
                    <td className="px-4 py-2.5 text-text">{r.total_days}天</td>
                    {isAdmin && <td className="px-4 py-2.5 text-text">{r.employee_name}</td>}
                    <td className="px-4 py-2.5">
                      {STATUS_MAP[r.status] && (
                        <span className={`px-1.5 py-0.5 rounded text-xs border ${STATUS_MAP[r.status].bg} ${STATUS_MAP[r.status].color}`}>
                          {STATUS_MAP[r.status].label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.status === "pending" && (
                        <button onClick={() => handleCancel(r.id)}
                          className="text-xs text-red-600 hover:underline">撤回</button>
                      )}
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

      {/* 新建请假弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-text">新建请假</span>
              <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text text-lg">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">请假类型 <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-4 gap-2">
                  {LEAVE_TYPES.map(t => (
                    <label key={t.value} className={`flex items-center justify-center px-2 py-1.5 rounded border text-sm cursor-pointer transition-colors ${form.leave_type === t.value ? "border-primary bg-blue-50 text-primary" : "border-border hover:bg-bg"}`}>
                      <input type="radio" name="leave_type" value={t.value}
                        checked={form.leave_type === t.value}
                        onChange={() => setForm({ ...form, leave_type: t.value })}
                        className="sr-only" />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text mb-1">开始日期 <span className="text-red-500">*</span></label>
                  <input type="date" value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value, total_days: calcDays(e.target.value, form.end_date) })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">结束日期 <span className="text-red-500">*</span></label>
                  <input type="date" value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value, total_days: calcDays(form.start_date, e.target.value) })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              {form.total_days > 0 && (
                <div className="text-sm text-primary font-medium bg-blue-50 rounded-lg px-3 py-2">
                  共 {form.total_days} 天
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-text mb-1">请假原因</label>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="请输入请假原因..." rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" />
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

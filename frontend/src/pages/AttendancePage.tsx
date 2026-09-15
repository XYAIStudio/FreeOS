import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";
import { Clock, LogIn, LogOut, Calendar, AlertCircle, ChevronLeft, ChevronRight, Plus } from "lucide-react";

interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  department_name: string;
  check_date: string;
  check_in_time: string;
  check_out_time: string;
  status: string;
  work_hours: number;
}

interface TodayStatus {
  id: number;
  status: string;
  check_in_time: string;
  check_out_time: string;
  work_hours: number;
}

interface SupplementRecord {
  id: number;
  employee_name: string;
  department_name: string;
  check_date: string;
  supplement_type: string;
  reason: string;
  status: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  normal: { label: "正常", color: "text-green-700", bg: "bg-green-100 border-green-200" },
  late: { label: "迟到", color: "text-orange-700", bg: "bg-orange-100 border-orange-200" },
  early_leave: { label: "早退", color: "text-orange-700", bg: "bg-orange-100 border-orange-200" },
  late_early_leave: { label: "迟到早退", color: "text-red-700", bg: "bg-red-100 border-red-200" },
  absent: { label: "缺勤", color: "text-red-700", bg: "bg-red-100 border-red-200" },
  leave: { label: "请假", color: "text-blue-700", bg: "bg-blue-100 border-blue-200" },
  business_trip: { label: "出差", color: "text-purple-700", bg: "bg-purple-100 border-purple-200" },
};

const SUPPLEMENT_TYPE_MAP: Record<string, string> = {
  check_in: "补签到",
  check_out: "补签退",
  both: "补签到+签退",
};

export default function AttendancePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [today, setToday] = useState<TodayStatus | null>(null);
  const [loadingToday, setLoadingToday] = useState(true);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loadingList, setLoadingList] = useState(false);

  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [stats, setStats] = useState<any>(null);
  const [statsMonth, setStatsMonth] = useState(() => new Date().toISOString().substring(0, 7));

  const [showSupplement, setShowSupplement] = useState(false);
  const [suppForm, setSuppForm] = useState({ check_date: "", supplement_type: "both", reason: "" });
  const [submitting, setSubmitting] = useState(false);

  const [supplements, setSupplements] = useState<SupplementRecord[]>([]);
  const [showSuppList, setShowSuppList] = useState(false);

  const totalPages = Math.ceil(total / limit);
  const todayStr = new Date().toISOString().split("T")[0];

  const fetchToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const r = await authFetch("/api/attendance/today");
      const d = await r.json();
      if (d.success) setToday(d.data);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterDate) params.set("check_date", filterDate);
      if (filterStatus) params.set("status", filterStatus);
      const r = await authFetch(`/api/attendance/records?${params}`);
      const d = await r.json();
      if (d.success) {
        setRecords(d.data.list);
        setTotal(d.data.total);
      }
    } finally {
      setLoadingList(false);
    }
  }, [page, limit, filterDate, filterStatus]);

  const fetchStats = useCallback(async () => {
    const r = await authFetch(`/api/attendance/stats?month=${statsMonth}`);
    const d = await r.json();
    if (d.success) setStats(d.data);
  }, [statsMonth]);

  const fetchSupplements = useCallback(async () => {
    const r = await authFetch("/api/attendance/supplements");
    const d = await r.json();
    if (d.success) setSupplements(d.data.list);
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);
  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { if (statsMonth) fetchStats(); }, [statsMonth, fetchStats]);
  useEffect(() => { if (isAdmin) fetchSupplements(); }, [isAdmin, fetchSupplements]);

  const formatTime = (t: string) => t ? t.split("T")[1]?.substring(0, 5) : "--:--";
  const formatDate = (d: string) => d ? d.split("T")[0] : "";

  const handleCheckIn = async () => {
    const r = await authFetch("/api/attendance/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "移动端签到" }),
    });
    const d = await r.json();
    if (d.success) {
      setToday({
        id: 0,
        check_in_time: new Date().toISOString(),
        check_out_time: "",
        work_hours: 0,
        status: d.data.status,
      });
      fetchList();
    } else {
      alert(d.error || "签到失败");
    }
  };

  const handleCheckOut = async () => {
    const r = await authFetch("/api/attendance/check-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "移动端签退" }),
    });
    const d = await r.json();
      if (d.success) {
        setToday((prev) => prev ? {
          ...prev,
          check_out_time: new Date().toISOString(),
          work_hours: d.data.work_hours,
          status: d.data.status,
        } : null);
        fetchList();
        fetchToday();
      } else {
      alert(d.error || "签退失败");
    }
  };

  const handleSubmitSupplement = async () => {
    if (!suppForm.check_date) { alert("请选择补卡日期"); return; }
    setSubmitting(true);
    try {
      const r = await authFetch("/api/attendance/supplements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(suppForm),
      });
      const d = await r.json();
      if (d.success) {
        alert("补卡申请已提交，等待审批");
        setShowSupplement(false);
        setSuppForm({ check_date: "", supplement_type: "both", reason: "" });
      } else {
        alert(d.error || "提交失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSupplement = async (id: number, status: "approved" | "rejected") => {
    const r = await authFetch(`/api/attendance/supplements/${id}/review`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await r.json();
    if (d.success) {
      fetchSupplements();
      if (status === "approved") {
        fetchList();
        fetchToday();
      }
    } else {
      alert(d.error || "操作失败");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">考勤管理</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowSuppList(!showSuppList)}
              className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 border border-purple-200 rounded hover:bg-purple-200 flex items-center gap-1"
            >
              补卡审批
              {supplements.filter(s => s.status === "pending").length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {supplements.filter(s => s.status === "pending").length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setShowSupplement(true)}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-blue-700 flex items-center gap-1"
          >
            <Plus size={14} /> 补卡申请
          </button>
        </div>
      </div>

      {/* 今日考勤 */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            <span className="font-medium text-text">今日考勤</span>
            <span className="text-sm text-text-muted">{todayStr}</span>
          </div>
          {today && STATUS_MAP[today.status] && (
            <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_MAP[today.status].bg} ${STATUS_MAP[today.status].color}`}>
              {STATUS_MAP[today.status].label}
            </span>
          )}
        </div>
        <div className="p-4">
          {loadingToday ? (
            <div className="text-center text-text-muted py-4">加载中...</div>
          ) : today ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xs text-text-muted mb-1">签到时间</div>
                <div className="text-lg font-semibold text-text flex items-center justify-center gap-1">
                  <LogIn size={16} className="text-green-600" />
                  {formatTime(today.check_in_time)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-text-muted mb-1">签退时间</div>
                <div className="text-lg font-semibold text-text flex items-center justify-center gap-1">
                  <LogOut size={16} className="text-orange-600" />
                  {formatTime(today.check_out_time)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-text-muted mb-1">工作时长</div>
                <div className="text-lg font-semibold text-text">{today.work_hours > 0 ? `${today.work_hours}h` : "--"}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-text-muted mb-1">操作</div>
                {!today.check_out_time ? (
                  <button onClick={handleCheckOut}
                    className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600">
                    签退
                  </button>
                ) : (
                  <span className="text-sm text-text-muted">已完成</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-3">
              <div className="text-text-muted">今日尚未签到</div>
              <button onClick={handleCheckIn}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium flex items-center gap-2 mx-auto">
                <LogIn size={16} /> 签到
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 月度统计 */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            <span className="font-medium text-text">月度统计</span>
          </div>
          <input type="month" value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)}
            className="text-sm border border-border rounded px-2 py-1" />
        </div>
        {stats ? (
          <div className="p-4 grid grid-cols-3 md:grid-cols-5 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
              <div className="text-2xl font-bold text-green-700">{stats.attendance?.normal_days ?? 0}</div>
              <div className="text-xs text-green-600 mt-1">正常</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
              <div className="text-2xl font-bold text-orange-700">{stats.attendance?.late_days ?? 0}</div>
              <div className="text-xs text-orange-600 mt-1">迟到</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
              <div className="text-2xl font-bold text-red-700">{stats.attendance?.early_leave_days ?? 0}</div>
              <div className="text-xs text-red-600 mt-1">早退</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
              <div className="text-2xl font-bold text-purple-700">{stats.supplements?.pending ?? 0}</div>
              <div className="text-xs text-purple-600 mt-1">补卡待审</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
              <div className="text-2xl font-bold text-blue-700">{stats.attendance?.total_days ?? 0}</div>
              <div className="text-xs text-blue-600 mt-1">考勤天数</div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-text-muted">加载中...</div>
        )}
      </div>

      {/* 补卡审批（管理员） */}
      {showSuppList && isAdmin && (
        <div className="bg-white rounded-xl border border-border shadow-sm">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <AlertCircle size={18} className="text-purple-600" />
            <span className="font-medium text-text">补卡审批</span>
          </div>
          <div className="divide-y divide-border">
            {supplements.filter(s => s.status === "pending").length === 0 ? (
              <div className="p-6 text-center text-text-muted text-sm">暂无待审批的补卡申请</div>
            ) : (
              supplements.filter(s => s.status === "pending").map((s) => (
                <div key={s.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-text">{s.employee_name}</span>
                      <span className="text-xs text-text-muted">{s.department_name}</span>
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                        {SUPPLEMENT_TYPE_MAP[s.supplement_type]}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">
                      补卡日期：{s.check_date} | 申请时间：{formatDate(s.created_at)}
                    </div>
                    {s.reason && <div className="text-xs text-text-muted mt-1">原因：{s.reason}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleReviewSupplement(s.id, "approved")}
                      className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">通过</button>
                    <button onClick={() => handleReviewSupplement(s.id, "rejected")}
                      className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">驳回</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 考勤记录列表 */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-primary" />
              <span className="font-medium text-text">考勤记录</span>
              <span className="text-xs text-text-muted">（共 {total} 条）</span>
            </div>
            <div className="flex flex-1 items-center gap-2 md:justify-end">
              <input type="date" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
                className="text-sm border border-border rounded px-2 py-1" />
              <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="text-sm border border-border rounded px-2 py-1">
                <option value="">全部状态</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg border-b border-border text-left">
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">日期</th>
                {isAdmin && <th className="px-4 py-2.5 text-xs text-text-muted font-medium">员工</th>}
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">签到</th>
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">签退</th>
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">时长</th>
                <th className="px-4 py-2.5 text-xs text-text-muted font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingList ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-text-muted">加载中...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-text-muted">暂无考勤记录</td></tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-bg transition-colors">
                    <td className="px-4 py-2.5 text-text">{r.check_date}</td>
                    {isAdmin && <td className="px-4 py-2.5 text-text">{r.employee_name}</td>}
                    <td className="px-4 py-2.5 text-text">
                      <div className="flex items-center gap-1">
                        <LogIn size={12} className="text-green-500" />
                        {formatTime(r.check_in_time)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-text">
                      <div className="flex items-center gap-1">
                        <LogOut size={12} className="text-orange-500" />
                        {formatTime(r.check_out_time)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-text">{r.work_hours > 0 ? `${r.work_hours}h` : "--"}</td>
                    <td className="px-4 py-2.5">
                      {STATUS_MAP[r.status] ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs border ${STATUS_MAP[r.status].bg} ${STATUS_MAP[r.status].color}`}>
                          {STATUS_MAP[r.status].label}
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">--</span>
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
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1 text-sm border border-border rounded hover:bg-bg disabled:opacity-40">
              <ChevronLeft size={14} /> 上一页
            </button>
            <span className="text-xs text-text-muted">第 {page} / {totalPages} 页，共 {total} 条</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1 text-sm border border-border rounded hover:bg-bg disabled:opacity-40">
              下一页 <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* 补卡申请弹窗 */}
      {showSupplement && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-text">补卡申请</span>
              <button onClick={() => setShowSupplement(false)} className="text-text-muted hover:text-text text-lg">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  补卡日期 <span className="text-red-500">*</span>
                </label>
                <input type="date" value={suppForm.check_date} max={todayStr}
                  onChange={(e) => setSuppForm({ ...suppForm, check_date: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  补卡类型 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  {[{ value: "check_in", label: "补签到" }, { value: "check_out", label: "补签退" }, { value: "both", label: "补签到+签退" }].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                      <input type="radio" name="supp_type" value={opt.value}
                        checked={suppForm.supplement_type === opt.value}
                        onChange={() => setSuppForm({ ...suppForm, supplement_type: opt.value })}
                        className="accent-primary" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">补卡原因</label>
                <textarea value={suppForm.reason} onChange={(e) => setSuppForm({ ...suppForm, reason: e.target.value })}
                  placeholder="请输入补卡原因..." rows={3}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowSupplement(false)}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-bg">取消</button>
                <button onClick={handleSubmitSupplement} disabled={submitting}
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

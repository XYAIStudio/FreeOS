import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";
import { FileText, Plus, ChevronLeft, ChevronRight, MessageSquare, X, Send } from "lucide-react";

interface DailyReport {
  id: number;
  report_type: string;
  report_date: string;
  week_number: number;
  title: string;
  work_summary: string;
  tomorrow_plan: string;
  issues_blockers: string;
  submit_status: string;
  employee_name: string;
  department_name: string;
  comment_count: number;
  created_at: string;
}

interface ReportComment {
  id: number;
  commenter_id: number;
  commenter_name: string;
  content: string;
  created_at: string;
}

export default function DailyReportPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    report_type: "daily",
    report_date: new Date().toISOString().split("T")[0],
    title: "",
    work_summary: "",
    tomorrow_plan: "",
    issues_blockers: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // 详情弹窗
  const [detail, setDetail] = useState<any>(null);
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const totalPages = Math.ceil(total / limit);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterType) params.set("report_type", filterType);
      const r = await authFetch(`/api/daily-report?${params}`);
      const d = await r.json();
      if (d.success) { setReports(d.data.list); setTotal(d.data.total); }
    } finally { setLoading(false); }
  }, [page, limit, filterType]);

  const fetchDetail = async (id: number) => {
    const r = await authFetch(`/api/daily-report/${id}`);
    const d = await r.json();
    if (d.success) {
      setDetail(d.data);
      setComments(d.data.comments || []);
    }
  };

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleSubmit = async () => {
    if (!form.work_summary) { alert("请填写工作内容"); return; }

    setSubmitting(true);
    try {
      const r = await authFetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.success) {
        alert(form.report_type === "daily" ? "日报已提交" : "周报已提交");
        setShowForm(false);
        setForm({ report_type: "daily", report_date: new Date().toISOString().split("T")[0], title: "", work_summary: "", tomorrow_plan: "", issues_blockers: "" });
        fetchList();
        // 触发工作流
        try {
          const defRes = await authFetch("/api/workflows-v2/definitions?status=active");
          const defJson = await defRes.json();
          if (defJson.success) {
            const keyword = form.report_type === "daily" ? "日报" : "周报";
            const reportDef = defJson.data?.find((d: any) => d.name?.includes(keyword));
            if (reportDef) {
              await authFetch("/api/workflows-v2/instances", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workflowId: reportDef.id,
                  title: form.title || `${keyword} - ${form.report_date}`,
                  variables: { reportType: form.report_type, workSummary: form.work_summary, issuesBlockers: form.issues_blockers },
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

  const handleAddComment = async () => {
    if (!newComment.trim() || !detail) return;
    setSubmittingComment(true);
    try {
      const r = await authFetch(`/api/daily-report/${detail.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      const d = await r.json();
      if (d.success) {
        setNewComment("");
        fetchDetail(detail.id);
      } else {
        alert(d.error || "评论失败");
      }
    } finally { setSubmittingComment(false); }
  };

  const fmt = (d: string) => d ? d.split("T")[0] : "";
  const fmtTime = (d: string) => d ? d.split("T")[1]?.substring(0, 5) : "";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">工作日报</h1>
        <button onClick={() => setShowForm(true)}
          className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-blue-700 flex items-center gap-1">
          <Plus size={14} /> 写{filterType === "weekly" ? "周报" : "日报"}
        </button>
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <span className="font-medium text-text">日报/周报</span>
            <span className="text-xs text-text-muted">（共 {total} 条）</span>
          </div>
          <div className="flex flex-1 items-center gap-2 md:justify-end">
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="text-sm border border-border rounded px-2 py-1">
              <option value="">全部</option>
              <option value="daily">日报</option>
              <option value="weekly">周报</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="px-4 py-8 text-center text-text-muted">加载中...</div>
          ) : reports.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-muted">暂无日报/周报</div>
          ) : (
            reports.map(r => (
              <div key={r.id} className="p-4 hover:bg-bg cursor-pointer transition-colors"
                onClick={() => fetchDetail(r.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs border ${r.report_type === "daily" ? "bg-blue-100 border-blue-200 text-blue-700" : "bg-purple-100 border-purple-200 text-purple-700"}`}>
                        {r.report_type === "daily" ? "日报" : "周报"}
                      </span>
                      <span className="text-sm font-medium text-text">{r.report_date}</span>
                      {r.title && <span className="text-sm text-text-muted truncate">{r.title}</span>}
                    </div>
                    <div className="text-sm text-text line-clamp-2 mb-1">{r.work_summary}</div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>{r.employee_name}</span>
                      {r.department_name && <span>{r.department_name}</span>}
                      {r.comment_count > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {r.comment_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
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

      {/* 新建日报/周报弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-white">
              <span className="font-semibold text-text">写{form.report_type === "daily" ? "日报" : "周报"}</span>
              <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text text-lg">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">报告类型 <span className="text-red-500">*</span></label>
                <div className="flex gap-4">
                  {[{ value: "daily", label: "日报" }, { value: "weekly", label: "周报" }].map(t => (
                    <label key={t.value}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm cursor-pointer ${form.report_type === t.value ? "border-primary bg-blue-50 text-primary" : "border-border hover:bg-bg"}`}>
                      <input type="radio" name="report_type" value={t.value}
                        checked={form.report_type === t.value}
                        onChange={() => setForm({ ...form, report_type: t.value })}
                        className="sr-only" />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  {form.report_type === "daily" ? "日期" : "报告周"} <span className="text-red-500">*</span>
                </label>
                <input type="date" value={form.report_date}
                  onChange={(e) => setForm({ ...form, report_date: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">标题（可选）</label>
                <input type="text" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={form.report_type === "daily" ? "今日工作简述" : "本周工作主题"}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  {form.report_type === "daily" ? "今日工作内容" : "本周工作内容"} <span className="text-red-500">*</span>
                </label>
                <textarea value={form.work_summary}
                  onChange={(e) => setForm({ ...form, work_summary: e.target.value })}
                  placeholder={form.report_type === "daily" ? "请描述今日完成的工作..." : "请描述本周完成的工作..."}
                  rows={4} className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  {form.report_type === "daily" ? "明日计划" : "下周计划"}
                </label>
                <textarea value={form.tomorrow_plan}
                  onChange={(e) => setForm({ ...form, tomorrow_plan: e.target.value })}
                  placeholder="请描述计划..." rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">问题/阻塞</label>
                <textarea value={form.issues_blockers}
                  onChange={(e) => setForm({ ...form, issues_blockers: e.target.value })}
                  placeholder="如有需要协调的问题，请在此说明..." rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-bg">取消</button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  {submitting ? "提交中..." : "提交"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs border ${detail.report_type === "daily" ? "bg-blue-100 border-blue-200 text-blue-700" : "bg-purple-100 border-purple-200 text-purple-700"}`}>
                  {detail.report_type === "daily" ? "日报" : "周报"}
                </span>
                <span className="font-semibold text-text">{detail.report_date}</span>
              </div>
              <button onClick={() => setDetail(null)} className="text-text-muted hover:text-text text-lg">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-text-muted mb-1">撰写人：{detail.employee_name} {detail.department_name && `· ${detail.department_name}`}</div>
                {detail.title && <div className="text-sm font-medium text-text mb-2">{detail.title}</div>}
              </div>
              <div>
                <div className="text-xs font-medium text-text-muted mb-1">
                  {detail.report_type === "daily" ? "今日工作" : "本周工作"}
                </div>
                <div className="text-sm text-text bg-bg rounded-lg p-3 whitespace-pre-wrap">{detail.work_summary}</div>
              </div>
              {detail.tomorrow_plan && (
                <div>
                  <div className="text-xs font-medium text-text-muted mb-1">
                    {detail.report_type === "daily" ? "明日计划" : "下周计划"}
                  </div>
                  <div className="text-sm text-text bg-bg rounded-lg p-3 whitespace-pre-wrap">{detail.tomorrow_plan}</div>
                </div>
              )}
              {detail.issues_blockers && (
                <div>
                  <div className="text-xs font-medium text-red-600 mb-1">问题/阻塞</div>
                  <div className="text-sm text-red-700 bg-red-50 rounded-lg p-3 whitespace-pre-wrap">{detail.issues_blockers}</div>
                </div>
              )}

              {/* 评论 */}
              <div className="border-t border-border pt-4">
                <div className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1">
                  <MessageSquare size={14} /> 评论 ({comments.length})
                </div>
                <div className="space-y-2 mb-3">
                  {comments.map(c => (
                    <div key={c.id} className="bg-bg rounded-lg p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-text">{c.commenter_name}</span>
                        <span className="text-xs text-text-muted">{fmtTime(c.created_at)}</span>
                      </div>
                      <div className="text-sm text-text">{c.content}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    placeholder="添加评论..." className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm" />
                  <button onClick={handleAddComment} disabled={submittingComment}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

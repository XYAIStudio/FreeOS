import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../stores/auth";
import { authFetch } from "../api/authFetch";
import { useLocale } from "../i18n";
import { Megaphone, Pin, Eye, EyeOff, Plus, X, Search, Bell, FileText, AlertTriangle, Newspaper, ChevronLeft, ChevronRight } from "lucide-react";

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: "notice" | "policy" | "news" | "emergency";
  priority: "low" | "normal" | "important" | "urgent";
  is_pinned: number;
  is_read: boolean;
  read_count: number;
  total_users: number;
  read_percent: number;
  published_at: string;
  expires_at: string | null;
  creator_name: string;
  created_at: string;
}

const TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  notice: { label: "通知", icon: Bell, color: "bg-blue-100 text-blue-700 border-blue-200" },
  policy: { label: "制度", icon: FileText, color: "bg-purple-100 text-purple-700 border-purple-200" },
  news: { label: "新闻", icon: Newspaper, color: "bg-green-100 text-green-700 border-green-200" },
  emergency: { label: "紧急", icon: AlertTriangle, color: "bg-red-100 text-red-700 border-red-200" },
};

const TYPE_EN: Record<string, string> = { notice: "Notice", policy: "Policy", news: "News", emergency: "Emergency" };
const typeLabel = (type: string, locale: string) => {
  const meta = TYPE_MAP[type] || TYPE_MAP.notice;
  return locale === "en" ? (TYPE_EN[type] || TYPE_EN.notice) : meta.label;
};

export default function AnnouncementPage() {
  const { t, locale } = useLocale();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [unreadCount, setUnreadCount] = useState(0);

  // detail modal
  const [detail, setDetail] = useState<Announcement | null>(null);

  // create/edit modal
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", content: "", type: "notice", priority: "normal", is_pinned: false, expires_at: "" });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), type: filterType });
      if (search) params.set("search", search);
      const r = await authFetch(`/api/announcements?${params}`);
      const d = await r.json();
      if (d.success) {
        setAnnouncements(d.data.list);
        setTotal(d.data.total);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [page, limit, filterType, search]);

  const fetchUnread = useCallback(async () => {
    try {
      const r = await authFetch("/api/announcements/action/unread");
      const d = await r.json();
      if (d.success) setUnreadCount(d.data.count);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { fetchList(); fetchUnread(); }, [fetchList, fetchUnread]);

  const openDetail = async (a: Announcement) => {
    try {
      const r = await authFetch(`/api/announcements/${a.id}`);
      const d = await r.json();
      if (d.success) {
        setDetail(d.data);
        setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, is_read: true } : x));
        fetchUnread();
      }
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    try {
      await authFetch("/api/announcements/read-all", { method: "POST" });
      setAnnouncements(prev => prev.map(x => ({ ...x, is_read: true })));
      setUnreadCount(0);
    } catch (e) { console.error(e); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ title: "", content: "", type: "notice", priority: "normal", is_pinned: false, expires_at: "" });
    setShowForm(true);
  };

  const openEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({ title: a.title, content: a.content, type: a.type, priority: a.priority, is_pinned: a.is_pinned === 1, expires_at: a.expires_at || "" });
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.title || !form.content) return alert(t("标题和内容不能为空", "Title and content are required"));
    try {
      const url = editId ? `/api/announcements/${editId}` : "/api/announcements";
      const method = editId ? "PUT" : "POST";
      const r = await authFetch(url, {
        method,
        body: JSON.stringify({ ...form, is_pinned: form.is_pinned ? 1 : 0, expires_at: form.expires_at || null }),
      });
      const d = await r.json();
      if (d.success) {
        setShowForm(false);
        fetchList();
      } else {
        alert(d.error);
      }
    } catch (e) { console.error(e); }
  };

  const deleteAnnouncement = async (id: number) => {
    if (!confirm(t("确定删除该公告？", "Delete this announcement?"))) return;
    try {
      await authFetch(`/api/announcements/${id}`, { method: "DELETE" });
      fetchList();
    } catch (e) { console.error(e); }
  };

  const togglePin = async (id: number) => {
    try {
      await authFetch(`/api/announcements/${id}/toggle-pin`, { method: "PUT" });
      fetchList();
    } catch (e) { console.error(e); }
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (d: string) => {
    if (!d) return "";
    return new Date(d).toLocaleString(locale === "en" ? "en-US" : "zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Megaphone size={24} className="text-primary" />
          <h1 className="text-xl font-bold text-text">{t("通知公告", "Announcements")}</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 font-medium">{unreadCount} {t("条未读", "unread")}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={markAllRead} className="text-sm text-text-muted hover:text-primary transition-colors">{t("全部已读", "Mark all read")}</button>
          {isAdmin && (
            <button onClick={openCreate} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary/90 transition-colors">
              <Plus size={14} /> {t("发布公告", "Publish announcement")}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {[
            { key: "all", label: t("全部", "All") },
            { key: "notice", label: t("通知", "Notice") },
            { key: "policy", label: t("制度", "Policy") },
            { key: "news", label: t("新闻", "News") },
            { key: "emergency", label: t("紧急", "Emergency") },
          ].map(filter => (
            <button key={filter.key} onClick={() => { setFilterType(filter.key); setPage(1); }}
              className={`px-3 py-1 rounded text-sm transition-colors ${filterType === filter.key ? "bg-primary text-white" : "bg-bg text-text-muted hover:bg-border"}`}>
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-56">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("搜索公告...", "Search announcements...")} className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-border bg-bg focus:outline-none focus:border-primary" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">{t("加载中...", "Loading...")}</div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 text-text-muted">{t("暂无公告", "No announcements")}</div>
      ) : (
        <div className="space-y-2">
          {announcements.map(a => {
            const typeMeta = TYPE_MAP[a.type] || TYPE_MAP.notice;
            const isExpired = a.expires_at && new Date(a.expires_at) < new Date();
            return (
              <div key={a.id}
                onClick={() => openDetail(a)}
                className={`relative bg-bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md transition-all ${a.is_pinned ? "border-primary/30 ring-1 ring-primary/10" : "border-border"} ${isExpired ? "opacity-60" : ""}`}>
                {a.is_pinned === 1 && (
                  <div className="absolute -top-2 -left-2">
                    <Pin size={14} className="text-primary rotate-45" />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 mt-0.5 px-2 py-0.5 rounded text-[11px] font-medium border ${typeMeta.color}`}>
                    {typeLabel(a.type, locale)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-medium truncate ${a.is_read ? "text-text-muted" : "text-text"}`}>
                        {!a.is_read && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle" />}
                        {a.title}
                      </h3>
                      {a.priority === "urgent" && <span className="text-[10px] text-red-500 font-bold">{t("紧急", "Urgent")}</span>}
                      {isExpired && <span className="text-[10px] text-text-muted">{t("已过期", "Expired")}</span>}
                    </div>
                    <p className="text-xs text-text-muted mt-1 line-clamp-1">{a.content?.replace(/<[^>]*>/g, "").slice(0, 80)}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted">
                      <span>{a.creator_name || t("系统", "System")}</span>
                      <span>{formatDate(a.published_at)}</span>
                      <span className="flex items-center gap-1">
                        <Eye size={11} /> {a.read_percent}% ({a.read_count}/{a.total_users})
                      </span>
                    </div>
                  </div>
                  {/* Admin actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(a)} className="p-1 text-text-muted hover:text-primary text-xs" title={t("编辑", "Edit")}>✎</button>
                      <button onClick={() => togglePin(a.id)} className="p-1 text-text-muted hover:text-primary text-xs" title={a.is_pinned ? t("取消置顶", "Unpin") : t("置顶", "Pin")}>
                        <Pin size={12} className={a.is_pinned ? "text-primary" : ""} />
                      </button>
                      <button onClick={() => deleteAnnouncement(a.id)} className="p-1 text-text-muted hover:text-red-500 text-xs" title={t("删除", "Delete")}>🗑</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-1.5 rounded border border-border text-text-muted hover:text-text disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-text-muted">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-1.5 rounded border border-border text-text-muted hover:text-text disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-bg-card rounded-lg max-w-2xl w-full max-h-[85vh] overflow-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className={`px-2 py-0.5 rounded text-xs font-medium border ${(TYPE_MAP[detail.type] || TYPE_MAP.notice).color}`}>
                  {typeLabel(detail.type, locale)}
                </div>
                {detail.priority === "urgent" && <span className="text-xs text-red-500 font-bold">{t("紧急", "Urgent")}</span>}
              </div>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-bg rounded"><X size={18} /></button>
            </div>
            <div className="p-4">
              <h2 className="text-lg font-bold text-text mb-3">{detail.title}</h2>
              <div className="flex items-center gap-3 text-xs text-text-muted mb-4">
                <span>{t("发布者: ", "Publisher: ")}{detail.creator_name || t("系统", "System")}</span>
                <span>{t("发布时间: ", "Published: ")}{formatDate(detail.published_at)}</span>
                {detail.expires_at && <span>{t("有效期至: ", "Expires: ")}{formatDate(detail.expires_at)}</span>}
                <span><Eye size={11} className="inline" /> {detail.read_percent}% {t("已读", "read")}</span>
              </div>
              <div className="prose prose-sm max-w-none text-text whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: detail.content }} />
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-bg-card rounded-lg max-w-lg w-full max-h-[90vh] overflow-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-text">{editId ? t("编辑公告", "Edit announcement") : t("发布公告", "Publish announcement")}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-bg rounded"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">{t("标题 *", "Title *")}</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded border border-border bg-bg focus:outline-none focus:border-primary" placeholder={t("公告标题", "Announcement title")} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">{t("内容 *（支持 HTML）", "Content * (HTML supported)")}</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                  rows={6} className="w-full px-3 py-2 text-sm rounded border border-border bg-bg focus:outline-none focus:border-primary resize-y" placeholder={t("公告正文...", "Announcement content...")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">{t("类型", "Type")}</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded border border-border bg-bg focus:outline-none">
                    <option value="notice">{t("通知", "Notice")}</option>
                    <option value="policy">{t("制度", "Policy")}</option>
                    <option value="news">{t("新闻", "News")}</option>
                    <option value="emergency">{t("紧急", "Emergency")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">{t("优先级", "Priority")}</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded border border-border bg-bg focus:outline-none">
                    <option value="low">{t("低", "Low")}</option>
                    <option value="normal">{t("普通", "Normal")}</option>
                    <option value="important">{t("重要", "Important")}</option>
                    <option value="urgent">{t("紧急", "Urgent")}</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
                    className="rounded" /> {t("置顶", "Pin")}
                </label>
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-text-muted shrink-0">{t("有效期至", "Expires")}</label>
                  <input type="datetime-local" value={form.expires_at ? form.expires_at.slice(0, 16) : ""}
                    onChange={e => setForm({ ...form, expires_at: e.target.value ? e.target.value + ":00" : "" })}
                    className="flex-1 px-2 py-1.5 text-sm rounded border border-border bg-bg focus:outline-none" />
                </div>
              </div>
              <button onClick={submitForm}
                className="w-full py-2 rounded bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
                {editId ? t("保存修改", "Save changes") : t("发布公告", "Publish announcement")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

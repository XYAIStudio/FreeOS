import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, X, MessageSquare, ListTodo, UserPlus, AlertCircle } from "lucide-react";
import { authFetch } from "../api/authFetch";
import { useLocale } from "../i18n";

interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  link?: string;
  read: number;
  created_at: string;
}

const ICONS: Record<string, any> = {
  task_assigned: ListTodo,
  task_status: ListTodo,
  chat_mention: MessageSquare,
  system: AlertCircle,
};

const COLORS: Record<string, string> = {
  task_assigned: "bg-info/10 text-info",
  task_status: "bg-warning/10 text-warning",
  chat_mention: "bg-accent/10 text-accent",
  system: "bg-text-muted/10 text-text-muted",
};

export default function NotificationPanel() {
  const { isEnglish, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const r = await authFetch("/api/notifications?limit=20");
      const d = await r.json();
      if (d.success) {
        setNotifications(d.data.notifications);
        setUnreadCount(d.data.unreadCount);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const markRead = async (id: number) => {
    await authFetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await authFetch("/api/notifications/read-all", { method: "POST" });
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    setUnreadCount(0);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t("刚刚", "Just now");
    if (minutes < 60) return isEnglish ? `${minutes} min ago` : `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return isEnglish ? `${hours} hr ago` : `${hours}小时前`;
    return isEnglish ? `${Math.floor(hours / 24)} days ago` : `${Math.floor(hours / 24)}天前`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-lg hover:bg-bg transition-colors"
      >
        <Bell size={18} className="text-text-muted" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-danger text-white text-[9px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text">{t("通知", "Notifications")}</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={12} /> {t("全部已读", "Mark all read")}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-text-muted text-xs">
                {t("加载中...", "Loading...")}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-text-muted">
                <Bell size={24} className="mb-2 opacity-30" />
                <p className="text-xs">{t("暂无通知", "No notifications")}</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = ICONS[n.type] || AlertCircle;
                const colorClass = COLORS[n.type] || "bg-bg text-text-muted";
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-bg transition-colors cursor-pointer ${
                      !n.read ? "bg-primary-bg/30" : ""
                    }`}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.link) window.location.href = n.link;
                    }}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text">{n.title}</p>
                      <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{n.content}</p>
                      <p className="text-[10px] text-text-muted mt-1">{formatTime(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

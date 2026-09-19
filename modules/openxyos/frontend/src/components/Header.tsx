import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";
import { authFetch } from "../api/authFetch";
import { Sun, Moon, Menu, X, LogOut, Megaphone } from "lucide-react";
import NotificationPanel from "./NotificationPanel";
import { LanguageToggle, useLocale } from "../i18n";

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

interface PinnedAnnouncement {
  id: number;
  title: string;
}

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();
  const { isEnglish, t } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinned, setPinned] = useState<PinnedAnnouncement[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const handleMobileToggle = () => {
    setMobileOpen(!mobileOpen);
    onMobileMenuToggle();
  };

  // 拉取置顶公告
  useEffect(() => {
    if (!user) return;
    authFetch("/api/announcements/pinned")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPinned(d.data || []);
      })
      .catch(() => {});
  }, [user]);

  // 轮播切换
  useEffect(() => {
    if (pinned.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % pinned.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [pinned]);

  return (
    <header className="flex min-w-0 items-center justify-between gap-2 h-12 px-3 md:px-4 border-b border-border bg-bg-card shrink-0">
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={handleMobileToggle}
          className="md:hidden p-1.5 rounded text-text-muted hover:text-text hover:bg-bg transition-colors"
          title={mobileOpen ? (isEnglish ? "Close menu" : "关闭菜单") : (isEnglish ? "Open menu" : "打开菜单")}>
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
        <span className="text-[11px] text-text-muted font-mono tracking-wide shrink-0">openXYOS</span>
      </div>

      {/* 置顶公告轮播 */}
      {pinned.length > 0 && (
        <div
          className="hidden md:flex flex-1 mx-4 overflow-hidden items-center h-7 rounded-full bg-bg border border-border px-3 cursor-pointer hover:border-primary-light transition-colors"
          onClick={() => navigate(`/announcements/${pinned[currentIdx].id}`)}
          title={isEnglish ? "View announcement" : "点击查看公告详情"}
        >
          <Megaphone size={12} className="text-primary shrink-0 mr-2" />
          <div className="relative flex-1 h-4 overflow-hidden">
            {pinned.map((a, i) => (
              <span
                key={a.id}
                className={`absolute left-0 right-0 text-[11px] truncate transition-all duration-500 ${
                  i === currentIdx ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"
                }`}
              >
                <span className="text-text-muted hover:text-primary transition-colors">
                  {a.title}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 shrink-0">
        <LanguageToggle className="ox-header-language inline-flex shrink-0"/>
        {user && (
          <>
            <span className="hidden lg:inline text-[11px] text-text-muted truncate max-w-[72px]">{user.nickname}</span>
            <button onClick={logout} className="shrink-0 p-1.5 text-text-muted hover:text-danger hover:bg-bg rounded transition-colors" title={isEnglish ? "Sign out" : "退出登录"}>
              <LogOut size={14} />
            </button>
            <button onClick={toggle} className="shrink-0 p-1.5 text-text-muted hover:text-text hover:bg-bg rounded transition-colors" title={dark ? (isEnglish ? "Use light mode" : "切换到亮色模式") : (isEnglish ? "Use dark mode" : "切换到深色模式")}>
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <NotificationPanel />
            <div className="hidden xl:flex shrink-0 items-center gap-1.5 text-[11px] text-text-muted px-2 py-1 rounded bg-bg">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-[pulse_2s_infinite]" />{t("AI 就绪", "AI ready")}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

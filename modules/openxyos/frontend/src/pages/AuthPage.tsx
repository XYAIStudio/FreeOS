import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { LanguageToggle, useLocale } from "../i18n";

const R = "[border-radius:1.5px]";
const freeosOrganization =
  import.meta.env.VITE_FREEOS_ORG_INTEGRATED === "true";

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuthStore();
  const { isEnglish } = useLocale();
  const tx = (zh: string, en: string) => (isEnglish ? en : zh);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const fillDemo = () => {
    setTab("login");
    setEmail("demo@demo.com");
    setPassword("openxyos-demo-2026");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        if (!agreed) {
          setError(
            tx(
              "请先阅读并同意用户协议和隐私政策",
              "Please accept the Terms of Service and Privacy Policy.",
            ),
          );
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError(
            tx("密码至少6位", "Password must be at least 6 characters."),
          );
          setLoading(false);
          return;
        }
        await register(email, password, nickname);
      }
      navigate("/app");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full min-h-screen">
      <div
        className="hidden lg:flex flex-[0_0_55%] text-white px-16 py-20 flex-col justify-center relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, #10B981 0%, #059669 40%, #047857 100%)",
        }}
      >
        <div className="absolute -top-[40%] -right-[15%] w-[600px] h-[600px] rounded-full bg-white/5" />
        <div className="absolute -bottom-[25%] -left-[8%] w-[450px] h-[450px] rounded-full bg-white/[0.03]" />
        <div className="relative z-10 max-w-[500px]">
          <div className="text-3xl font-extrabold mb-4 flex items-center gap-3">
            <span className="text-4xl">🏢</span> openXYOS
          </div>
          <p className="text-base opacity-90 mb-12 leading-relaxed">
            {tx(
              "AI赋能下的人机共融企业管理效能增强管理系统",
              "An AI-native operating system for human–AI organizations",
            )}
            <br />
            {tx(
              "一键部署专业AI团队，让每个企业都拥有AI赋能的组织能力",
              "Deploy governed AI teams and give every organization AI-powered capability.",
            )}
          </p>
          <div className="flex flex-col gap-4">
            {[
              {
                icon: "🤖",
                title: tx("AI人机共融团队", "Human–AI teams"),
                desc: tx(
                  "一键部署100+位专业AI员工，CEO/CTO/CFO等高管随时待命",
                  "Deploy specialized AI teammates for executive and operational roles.",
                ),
              },
              {
                icon: "📊",
                title: tx("全流程AaaS管理", "End-to-end AaaS"),
                desc: tx(
                  "任务协作、知识沉淀、Token统计、编排引擎一体化",
                  "Unify work, knowledge, usage insights, and orchestration.",
                ),
              },
              {
                icon: "🔒",
                title: tx("企业级安全", "Enterprise security"),
                desc: tx(
                  "多租户隔离、数据加密、权限管控、API限流",
                  "Tenant isolation, encryption, access control, and API rate limits.",
                ),
              },
            ].map((f, i) => (
              <div
                key={i}
                className={`bg-white/10 border border-white/[0.12] ${R} px-5 py-4 flex items-start gap-4 backdrop-blur-sm`}
                style={{
                  opacity: 0,
                  animation: `slideUp 0.5s ${0.2 + i * 0.15}s forwards`,
                }}
              >
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <h4 className="text-sm font-semibold mb-1">{f.title}</h4>
                  <p className="text-xs opacity-80 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-10 bg-bg">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <div
              className={`w-16 h-16 mx-auto mb-5 ${R} flex items-center justify-center text-3xl shadow-lg`}
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
                boxShadow: "0 8px 24px rgba(16,185,129,0.25)",
              }}
            >
              🏢
            </div>
            <h2 className="text-xl font-bold text-text mb-2">
              {tx(
                freeosOrganization
                  ? "欢迎使用 FreeOS 组织空间"
                  : "欢迎使用 openXYOS",
                freeosOrganization
                  ? "Welcome to FreeOS Organization"
                  : "Welcome to openXYOS",
              )}
            </h2>
            <p className="text-sm text-text-muted">
              {tx(
                "登录或注册，开启AI驱动的智能管理",
                "Sign in or create an account to begin AI-native management.",
              )}
            </p>
          </div>

          {!freeosOrganization && (
            <div
              className={`flex items-center gap-3 bg-primary-bg border border-primary-light ${R} px-4 py-3 mb-5 text-[13px] text-text`}
            >
              <span className="text-lg shrink-0">🎮</span>
              <span>
                {tx("Demo account:", "Demo account:")}{" "}
                <strong className="text-primary">demo@demo.com</strong>
              </span>
              <button
                onClick={fillDemo}
                className={`ml-auto px-3.5 py-2 bg-primary text-white text-xs font-semibold ${R} hover:opacity-90 whitespace-nowrap`}
              >
                {tx("一键填入", "Fill demo")}
              </button>
            </div>
          )}

          <div className={`flex bg-bg-card border border-border ${R} p-1 mb-6`}>
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 ${R} text-sm font-medium transition-all ${tab === t ? "bg-primary text-white" : "text-text-muted"}`}
              >
                {t === "login" ? tx("登录", "Sign in") : tx("注册", "Register")}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-[13px] font-medium mb-2 text-text">
                {tx("邮箱地址", "Email address")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tx("请输入邮箱", "Enter your email")}
                required
                autoComplete="email"
                className={`w-full px-3.5 py-2.5 border-[1.5px] border-border ${R} text-sm bg-bg-card text-text outline-none transition-all focus:border-primary`}
              />
            </div>
            {tab === "register" && (
              <div className="mb-4">
                <label className="block text-[13px] font-medium mb-2 text-text">
                  {tx("昵称", "Display name")}
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={tx("您的称呼", "Your name")}
                  className={`w-full px-3.5 py-2.5 border-[1.5px] border-border ${R} text-sm bg-bg-card text-text outline-none transition-all focus:border-primary`}
                />
              </div>
            )}
            <div className="mb-4">
              <label className="block text-[13px] font-medium mb-2 text-text">
                {tx("密码", "Password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  tab === "register"
                    ? tx("至少6位密码", "At least 6 characters")
                    : tx("请输入密码", "Enter your password")
                }
                required
                className={`w-full px-3.5 py-2.5 border-[1.5px] border-border ${R} text-sm bg-bg-card text-text outline-none transition-all focus:border-primary`}
              />
            </div>
            {error && <p className="text-danger text-xs mb-3">{error}</p>}
            <label className="flex items-start gap-2 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-xs text-text-muted leading-relaxed">
                {tx("我已阅读并同意", "I have read and agree to the")}
                <Link
                  to="/user-agreement"
                  target="_blank"
                  className="text-primary hover:underline mx-0.5"
                >
                  {tx("《用户服务协议》", "Terms of Service")}
                </Link>
                {tx("和", "and")}
                <Link
                  to="/privacy-policy"
                  target="_blank"
                  className="text-primary hover:underline mx-0.5"
                >
                  {tx("《隐私政策》", "Privacy Policy")}
                </Link>
              </span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 ${R} text-[15px] font-semibold text-white transition-all disabled:opacity-85`}
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
              }}
            >
              {loading
                ? tx("处理中...", "Working...")
                : tab === "login"
                  ? tx("登 录", "Sign in")
                  : tx("立即注册", "Create account")}
            </button>
            {tab === "register" && (
              <p className="text-center mt-3.5 text-[12px] text-primary font-semibold">
                🎉{" "}
                {tx(
                  "注册即享14天专业版免费试用",
                  "Start with a 14-day professional trial",
                )}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

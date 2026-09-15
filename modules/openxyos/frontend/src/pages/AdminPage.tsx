import { useState, useEffect } from "react";
import { authFetch } from "../api/authFetch";
import { Layers, Users, UserCheck, Zap, TrendingUp, MousePointer, Activity, Clock, CreditCard, Settings, Check, X, AlertTriangle, MessageCircle, MapPin, Eye, ChevronLeft, ChevronRight } from "lucide-react";

interface OverviewData {
  total_tenants: number;
  total_users: number;
  total_employees: number;
  total_tokens: number;
  today_visitors: number;
  today_logins: number;
  today_registrations: number;
}

interface TrialData {
  trialSummary: {
    total: number;
    active_trials: number;
    expired_trials: number;
    active_tenants: number;
  };
  trials: Array<{
    id: number; name: string; slug: string; status: string;
    plan: string; trial_ends_at: string; created_at: string;
    user_count: number; employee_count: number;
  }>;
  dailyRegs: Array<{ day: string; count: number }>;
  dailyLogins: Array<{ day: string; count: number }>;
  tokenRanking: Array<{ name: string; slug: string; total_tokens: number }>;
}

interface VisitorData {
  trend: Array<{ day: string; event_type: string; count: number }>;
  distribution: Array<{ event_type: string; count: number }>;
  recent: Array<{
    id: number; event_type: string; page_path: string;
    ip_address: string; email: string; tenant_name: string; created_at: string;
  }>;
}

export default function AdminPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trials, setTrials] = useState<TrialData | null>(null);
  const [visitors, setVisitors] = useState<VisitorData | null>(null);
  const [tab, setTab] = useState<"overview" | "trials" | "visitors" | "payment" | "assistant">("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [ov, tr, vi] = await Promise.all([
        authFetch("/api/admin/stats/overview").then(r => r.json()),
        authFetch("/api/admin/stats/trials").then(r => r.json()),
        authFetch("/api/admin/stats/visitors?days=30").then(r => r.json()),
      ]);
      if (ov.success) setOverview(ov.data);
      if (tr.success) setTrials(tr.data);
      if (vi.success) setVisitors(vi.data);
    } catch (e) {
      console.error("加载管理数据失败", e);
    }
    setLoading(false);
  }

  async function updateTrial(tenantId: number, field: string, value: string) {
    await authFetch(`/api/admin/tenants/${tenantId}/trial`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    loadAll();
  }

  const formatNum = (n: number) => n?.toLocaleString() || "0";
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("zh-CN") : "-";

  if (loading) return <div className="p-6 text-text-muted">加载中...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">管理员控制台</h1>
          <p className="text-sm text-text-muted mt-1">跨租户数据总览 · 试用管理 · 访客分析</p>
        </div>
        <button onClick={loadAll} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-bg-card transition-colors">
          刷新数据
        </button>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 border-b border-border pb-0">
          {[
            { k: "overview", label: "总览" },
            { k: "trials", label: "试用管理" },
            { k: "visitors", label: "访客分析" },
            { k: "assistant", label: "智能助手" },
            { k: "payment", label: "支付中心" },
          ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              tab === t.k ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && overview && <OverviewTab overview={overview} />}
      {tab === "trials" && trials && <TrialsTab data={trials} onUpdate={updateTrial} />}
      {tab === "visitors" && visitors && <VisitorsTab data={visitors} />}
      {tab === "assistant" && <AssistantTab />}
      {tab === "payment" && <PaymentTab />}
    </div>
  );
}

// ====== 总览 Tab ======
function OverviewTab({ overview }: { overview: OverviewData }) {
  const cards = [
    { icon: Layers, label: "租户总数", value: overview.total_tenants, color: "text-primary", bg: "bg-primary/10" },
    { icon: Users, label: "注册用户", value: overview.total_users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: UserCheck, label: "员工总数", value: overview.total_employees, color: "text-violet-500", bg: "bg-violet-500/10" },
    { icon: Zap, label: "Token消耗", value: `${(overview.total_tokens / 1_000_000).toFixed(1)}M`, color: "text-amber-500", bg: "bg-amber-500/10" },
    { icon: MousePointer, label: "今日访客", value: overview.today_visitors, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { icon: Activity, label: "今日登录", value: overview.today_logins, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c, i) => (
        <div key={i} className="bg-bg-card border border-border rounded-xl p-4">
          <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
            <c.icon size={18} className={c.color} />
          </div>
          <div className="text-2xl font-bold text-text">{c.value}</div>
          <div className="text-xs text-text-muted mt-1">{c.label}</div>
        </div>
      ))}

      {/* 今日注册 */}
      <div className="bg-bg-card border border-border rounded-xl p-4 col-span-2 md:col-span-3 lg:col-span-6">
        <div className="flex items-center gap-3">
          <Clock size={16} className="text-text-muted" />
          <span className="text-sm text-text-muted">今日注册：</span>
          <span className="text-lg font-bold text-primary">{overview.today_registrations}</span>
          <span className="text-xs text-text-muted ml-auto">实时更新</span>
        </div>
      </div>
    </div>
  );
}

// ====== 试用管理 Tab ======
function TrialsTab({ data, onUpdate }: { data: TrialData; onUpdate: (tid: number, f: string, v: string) => void }) {
  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "总租户", value: data.trialSummary.total, color: "text-text" },
          { label: "试用中", value: data.trialSummary.active_trials, color: "text-primary" },
          { label: "已过期", value: data.trialSummary.expired_trials, color: "text-rose-500" },
          { label: "正式客户", value: data.trialSummary.active_tenants, color: "text-emerald-500" },
        ].map((s, i) => (
          <div key={i} className="bg-bg-card border border-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-text-muted mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 租户列表 */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-soft">
                <th className="text-left p-3 font-medium text-text-muted">租户</th>
                <th className="text-left p-3 font-medium text-text-muted">状态</th>
                <th className="text-left p-3 font-medium text-text-muted">套餐</th>
                <th className="text-left p-3 font-medium text-text-muted">用户</th>
                <th className="text-left p-3 font-medium text-text-muted">员工</th>
                <th className="text-left p-3 font-medium text-text-muted">试用到期</th>
                <th className="text-left p-3 font-medium text-text-muted">注册时间</th>
                <th className="text-right p-3 font-medium text-text-muted">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.trials.map(t => (
                <tr key={t.id} className="border-b border-border hover:bg-bg-soft/50">
                  <td className="p-3">
                    <div className="font-medium text-text">{t.name}</div>
                    <div className="text-xs text-text-muted">{t.slug}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === "active" ? "bg-emerald-500/10 text-emerald-600" :
                      t.status === "trial" ? "bg-primary/10 text-primary" :
                      "bg-rose-500/10 text-rose-500"
                    }`}>
                      {t.status === "active" ? "正式" : t.status === "trial" ? "试用" : t.status || "未知"}
                    </span>
                  </td>
                  <td className="p-3 text-text-muted text-xs">{t.plan}</td>
                  <td className="p-3 text-text">{t.user_count}</td>
                  <td className="p-3 text-text">{t.employee_count}</td>
                  <td className="p-3">
                    {t.trial_ends_at ? (
                      <span className={new Date(t.trial_ends_at) < new Date() ? "text-rose-500" : "text-text"}>
                        {new Date(t.trial_ends_at).toLocaleDateString("zh-CN")}
                      </span>
                    ) : <span className="text-text-muted">-</span>}
                  </td>
                  <td className="p-3 text-text-muted text-xs">{new Date(t.created_at).toLocaleDateString("zh-CN")}</td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => onUpdate(t.id, "status", t.status === "active" ? "suspended" : "active")}
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-bg-soft transition-colors">
                        {t.status === "active" ? "停用" : "启用"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 注册趋势简易图表 */}
      {data.dailyRegs.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-text mb-3">近30天注册趋势</h3>
          <div className="flex items-end gap-1 h-20">
            {data.dailyRegs.map((d, i) => {
              const max = Math.max(...data.dailyRegs.map(x => x.count), 1);
              const h = (d.count / max) * 80;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count}注册`}>
                  <span className="text-[10px] text-text-muted">{d.count}</span>
                  <div className="w-full bg-primary/60 rounded-t-sm" style={{ height: `${h}px`, minHeight: d.count > 0 ? 4 : 0 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ====== 访客分析 Tab ======
function VisitorsTab({ data }: { data: VisitorData }) {
  return (
    <div className="space-y-4">
      {/* 事件分布 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.distribution.map((d, i) => (
          <div key={i} className="bg-bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-text">{d.count}</div>
            <div className="text-xs text-text-muted mt-1">{d.event_type}</div>
          </div>
        ))}
      </div>

      {/* 最近访客 */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-medium text-text">最近50条访问记录</h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-soft sticky top-0">
                <th className="text-left p-3 font-medium text-text-muted">时间</th>
                <th className="text-left p-3 font-medium text-text-muted">事件</th>
                <th className="text-left p-3 font-medium text-text-muted">用户</th>
                <th className="text-left p-3 font-medium text-text-muted">租户</th>
                <th className="text-left p-3 font-medium text-text-muted">页面</th>
                <th className="text-left p-3 font-medium text-text-muted">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map(r => (
                <tr key={r.id} className="border-b border-border hover:bg-bg-soft/50">
                  <td className="p-3 text-text-muted text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("zh-CN")}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.event_type === "login" ? "bg-primary/10 text-primary" :
                      r.event_type === "register" ? "bg-emerald-500/10 text-emerald-600" :
                      "bg-bg-soft text-text-muted"
                    }`}>{r.event_type}</span>
                  </td>
                  <td className="p-3 text-text text-xs">{r.email || "-"}</td>
                  <td className="p-3 text-text text-xs">{r.tenant_name || "-"}</td>
                  <td className="p-3 text-text-muted text-xs max-w-[200px] truncate">{r.page_path || "-"}</td>
                  <td className="p-3 text-text-muted text-xs font-mono">{r.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ====== 支付中心 Tab ======
function PaymentTab() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await authFetch("/api/payments/providers");
      const d = await r.json();
      if (d.success) setProviders(d.data || []);
    } catch {}
    setLoading(false);
  }

  async function save() {
    if (!editing) return;
    try {
      await authFetch(`/api/payments/config/${editing.provider}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: editing.enabled, fields: editing.fields }),
      });
      setEditing(null);
      load();
    } catch {}
  }

  async function testProvider(provider: string) {
    setTesting(provider);
    try {
      const r = await authFetch(`/api/payments/config/${provider}/test`, { method: "POST" });
      const d = await r.json();
      alert(d.success ? `✅ ${d.data?.message}` : `❌ ${d.error}`);
    } catch { alert("测试请求失败"); }
    setTesting(null);
  }

  if (loading) return <div className="text-center text-text-muted py-16">加载中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <CreditCard size={16} className="text-primary" />
        <span>配置全局支付渠道——所有租户共用的支付方式设置</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map(p => (
          <div key={p.provider} className={`bg-bg-card border rounded-xl p-5 transition-all ${p.enabled ? "border-green-300" : "border-border"}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{p.icon}</span>
                <div>
                  <h3 className="font-semibold text-sm">{p.name}</h3>
                  <p className="text-[11px] text-text-muted">{p.provider}</p>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {p.enabled ? "已启用" : "未启用"}
              </span>
            </div>

            {p.note && <p className="text-[11px] text-text-muted mb-3 bg-bg rounded-lg px-3 py-2">{p.note}</p>}

            <div className="text-[11px] text-text-muted mb-3">
              <span>支持模式：</span>
              {(p.modes || []).map((m: string) => (
                <span key={m} className="ml-1 px-1.5 py-0.5 bg-bg rounded text-[10px]">{m}</span>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...p, fields: p.fields.map((f: any) => ({ ...f })) })}
                className="flex-1 py-2 rounded-lg border border-border text-xs hover:bg-bg flex items-center justify-center gap-1">
                <Settings size={12} /> 配置
              </button>
              <button onClick={() => testProvider(p.provider)} disabled={testing === p.provider || !p.enabled}
                className="py-2 px-3 rounded-lg border border-border text-xs hover:bg-bg disabled:opacity-40">
                {testing === p.provider ? "..." : "测试"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 配置弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditing(null)}>
          <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><span className="text-2xl">{editing.icon}</span>
                <h2 className="text-lg font-semibold">配置 {editing.name}</h2>
              </div>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-bg"><X size={18} /></button>
            </div>

            <div className="mb-4 flex items-center justify-between bg-bg rounded-xl p-3">
              <span className="text-sm">启用状态</span>
              <button onClick={() => setEditing({ ...editing, enabled: editing.enabled ? 0 : 1 })}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium ${editing.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {editing.enabled ? "已启用" : "已禁用"}
              </button>
            </div>

            <div className="space-y-3">
              {editing.fields.map((f: any, i: number) => (
                <div key={f.key}>
                  <label className="text-xs text-text-muted">{f.label} {f.required && <span className="text-red-400">*</span>} {f.secret && <span className="text-amber-500 text-[10px]">密钥</span>}</label>
                  <input type={f.secret ? "password" : "text"} defaultValue={f.masked || f.value || ""}
                    placeholder={f.masked || `输入${f.label}`}
                    onChange={e => { const fields = [...editing.fields]; fields[i] = { ...fields[i], value: e.target.value }; setEditing({ ...editing, fields }); }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm mt-1" />
                  {f.masked && <p className="text-[10px] text-text-muted mt-0.5">已保存：{f.masked}（留空不变）</p>}
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm">取消</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90">保存配置</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
        <AlertTriangle size={14} className="inline mr-1" />
        支付密钥为敏感信息，请妥善保管。配置完成后请测试验证。生产环境务必修改默认密钥。
      </div>
    </div>
  );
}

// ====== 智能助手对话记录 Tab ======
function AssistantTab() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterLead, setFilterLead] = useState<string>("");
  const [detail, setDetail] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => { loadConversations(); loadStats(); }, [page, filterLead]);

  async function loadConversations() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterLead) params.set("has_lead", filterLead);
      const r = await authFetch(`/api/assistant/conversations?${params}`);
      const d = await r.json();
      if (d.success) {
        setConversations(d.data || []);
        setTotalPages(d.pagination?.totalPages || 1);
        setTotal(d.pagination?.total || 0);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadStats() {
    try {
      const r = await authFetch("/api/assistant/stats");
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch {}
  }

  async function viewDetail(id: number) {
    try {
      const r = await authFetch(`/api/assistant/conversations/${id}`);
      const d = await r.json();
      if (d.success) setDetail(d.data);
    } catch { alert("加载详情失败"); }
  }

  const formatDate = (d: string) => d ? new Date(d).toLocaleString("zh-CN") : "-";

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      {stats?.total && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: MessageCircle, label: "总对话数", value: stats.total.total_conversations || 0, color: "text-primary", bg: "bg-primary/10" },
            { icon: Zap, label: "总Token消耗", value: ((stats.total.total_tokens || 0) / 1000).toFixed(1) + "K", color: "text-amber-500", bg: "bg-amber-500/10" },
            { icon: UserCheck, label: "留资线索", value: stats.total.total_leads || 0, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { icon: TrendingUp, label: "留资率", value: stats.total.total_conversations ? ((stats.total.total_leads / stats.total.total_conversations) * 100).toFixed(1) + "%" : "0%", color: "text-violet-500", bg: "bg-violet-500/10" },
          ].map((c, i) => (
            <div key={i} className="bg-bg-card border border-border rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
                <c.icon size={18} className={c.color} />
              </div>
              <div className="text-2xl font-bold text-text">{c.value}</div>
              <div className="text-xs text-text-muted mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 筛选 */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-muted">筛选：</span>
        {[
          { v: "", label: "全部" },
          { v: "1", label: "已留资" },
          { v: "0", label: "未留资" },
        ].map(f => (
          <button key={f.v} onClick={() => { setFilterLead(f.v); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterLead === f.v ? "bg-primary text-white" : "border border-border text-text-muted hover:text-text"
            }`}>
            {f.label}
          </button>
        ))}
        <span className="text-xs text-text-muted ml-auto">共 {total} 条记录</span>
      </div>

      {/* 列表 */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-soft">
                <th className="text-left p-3 font-medium text-text-muted">时间</th>
                <th className="text-left p-3 font-medium text-text-muted">IP</th>
                <th className="text-left p-3 font-medium text-text-muted">位置</th>
                <th className="text-left p-3 font-medium text-text-muted">轮次</th>
                <th className="text-left p-3 font-medium text-text-muted">Token</th>
                <th className="text-left p-3 font-medium text-text-muted">留资</th>
                <th className="text-right p-3 font-medium text-text-muted">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-text-muted">加载中...</td></tr>
              ) : conversations.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-text-muted">暂无记录</td></tr>
              ) : (
                conversations.map(c => (
                  <tr key={c.id} className="border-b border-border hover:bg-bg-soft/50">
                    <td className="p-3 text-text-muted text-xs whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="p-3 text-text-muted text-xs font-mono">{c.ip_address || "-"}</td>
                    <td className="p-3 text-text-muted text-xs">
                      <span className="flex items-center gap-1"><MapPin size={10} />{[c.country, c.region, c.city].filter(Boolean).join(" ") || "-"}</span>
                    </td>
                    <td className="p-3 text-text text-xs">{c.message_count}</td>
                    <td className="p-3 text-text text-xs">{(c.total_tokens || 0).toLocaleString()}</td>
                    <td className="p-3">
                      {c.lead_captured ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600">
                          {c.lead_info_masked?.phone || c.lead_info_masked?.email || "有"}
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => viewDetail(c.id)}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-bg-soft flex items-center gap-1 ml-auto">
                        <Eye size={12} /> 详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-1.5 rounded border border-border disabled:opacity-30"><ChevronLeft size={14} /></button>
          <span className="text-sm text-text-muted">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-1.5 rounded border border-border disabled:opacity-30"><ChevronRight size={14} /></button>
        </div>
      )}

      {/* 详情弹窗 */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetail(null)}>
          <div className="bg-bg-card rounded-2xl border border-border shadow-xl w-full max-w-xl mx-4 p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <MessageCircle size={16} className="text-primary" /> 对话详情
              </h3>
              <button onClick={() => setDetail(null)} className="p-1 rounded hover:bg-bg"><X size={18} /></button>
            </div>

            {/* 元信息 */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-text-muted bg-bg rounded-xl p-3">
              <div>⏰ {formatDate(detail.created_at)}</div>
              <div>🌐 {detail.ip_address || "-"}</div>
              <div>📍 {[detail.country, detail.region, detail.city].filter(Boolean).join(" ") || "-"}</div>
              <div>💬 {detail.message_count} 条消息 · {(detail.total_tokens || 0).toLocaleString()} tokens</div>
              {detail.lead_info_masked && (
                <div className="col-span-2 text-emerald-600">
                  ✅ 留资：{detail.lead_info_masked.name}{detail.lead_info_masked.company ? ` · ${detail.lead_info_masked.company}` : ""}
                  {detail.lead_info_masked.phone ? ` · ${detail.lead_info_masked.phone}` : ""}
                  {detail.lead_info_masked.email ? ` · ${detail.lead_info_masked.email}` : ""}
                </div>
              )}
            </div>

            {/* 对话内容 */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(detail.messages || []).map((m: any, i: number) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === "user"
                      ? "bg-primary/10 text-text rounded-br-sm"
                      : "bg-bg-muted text-text rounded-bl-sm"
                  }`}>
                    <div className="text-[10px] text-text-muted mb-0.5">{m.role === "user" ? "👤 访客" : "🤖 小雄"}</div>
                    {m.text || m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 每日趋势简图 */}
      {stats?.daily?.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-text mb-3">近30天对话趋势</h3>
          <div className="flex items-end gap-1 h-16">
            {stats.daily.slice(0, 30).reverse().map((d: any, i: number) => {
              const max = Math.max(...stats.daily.map((x: any) => x.conversations || 0), 1);
              const h = ((d.conversations || 0) / max) * 60;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.day}: ${d.conversations}对话 · ${d.leads}留资`}>
                  <div className="w-full bg-primary/60 rounded-t-sm" style={{ height: `${Math.max(h, 2)}px` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mt-1">
            <span>{stats.daily[stats.daily.length - 1]?.day}</span>
            <span>{stats.daily[0]?.day}</span>
          </div>
        </div>
      )}
    </div>
  );
}

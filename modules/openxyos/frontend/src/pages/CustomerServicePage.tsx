import { useState, useEffect } from "react";
import { Users, Ticket, Receipt, Plus, Search, TrendingUp } from "lucide-react";
import { authFetch } from "../api/authFetch";

// ============================================================
// 客服收费系统 — 主页面
// ============================================================

type Tab = "customers" | "tickets" | "bills";

export default function CustomerServicePage() {
  const [tab, setTab] = useState<Tab>("customers");
  const [customers, setCustomers] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const tabs = [
    { key: "customers" as Tab, label: "客户管理", icon: Users },
    { key: "tickets" as Tab, label: "服务工单", icon: Ticket },
    { key: "bills" as Tab, label: "收费账单", icon: Receipt },
  ];

  useEffect(() => {
    loadTab(tab);
  }, [tab]);

  async function loadTab(t: Tab) {
    setLoading(true);
    try {
      if (t === "customers") {
        const r = await authFetch("/api/customers");
        setCustomers((await r.json()).data || []);
      } else if (t === "tickets") {
        const r = await authFetch("/api/customers/tickets");
        setTickets((await r.json()).data || []);
      } else {
        const [br, sr] = await Promise.all([
          authFetch("/api/customers/bills"),
          authFetch("/api/customers/stats/billing"),
        ]);
        setBills((await br.json()).data || []);
        setStats((await sr.json()).data || {});
      }
    } catch (e) { /* */ }
    setLoading(false);
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form));
    await authFetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    form.reset();
    loadTab("customers");
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form));
    await authFetch("/api/customers/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    form.reset();
    loadTab("tickets");
  }

  const statusColors: Record<string, string> = {
    open: "bg-yellow-100 text-yellow-800", processing: "bg-blue-100 text-blue-800",
    resolved: "bg-green-100 text-green-800", closed: "bg-gray-100 text-gray-600",
  };
  const priorityColors: Record<string, string> = {
    urgent: "text-red-600 font-bold", high: "text-orange-600", normal: "text-gray-600", low: "text-gray-400",
  };
  const billStatusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800", partial: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800", overdue: "bg-red-100 text-red-800",
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border bg-bg-card">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Users size={22} /> 客服收费系统
        </h1>
      </header>

      {/* 统计栏 */}
      {tab === "bills" && stats && (
        <div className="grid grid-cols-4 gap-3 px-6 py-3 bg-bg-card border-b border-border">
          {[
            { label: "总账单", value: `¥${((stats.totalBilled || 0) / 100).toFixed(2)}`, color: "text-blue-600" },
            { label: "已收款", value: `¥${((stats.totalCollected || 0) / 100).toFixed(2)}`, color: "text-green-600" },
            { label: "待收", value: `${stats.pending || 0} 笔`, color: "text-yellow-600" },
            { label: "逾期", value: `${stats.overdue || 0} 笔`, color: "text-red-600" },
          ].map((s, i) => (
            <div key={i} className="bg-bg rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 标签页 */}
      <nav className="flex gap-0 border-b border-border bg-bg-card px-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"
            }`}>
            <t.icon size={14} className="inline mr-1" />{t.label}
          </button>
        ))}
      </nav>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? <div className="text-center text-text-muted py-12">加载中...</div> : (
          tab === "customers" ? (
            <div>
              <form onSubmit={createCustomer} className="bg-bg-card rounded-lg p-4 mb-4 border border-border grid grid-cols-4 gap-3">
                <input name="name" placeholder="客户名称*" required className="input" />
                <input name="contact_person" placeholder="联系人" className="input" />
                <input name="phone" placeholder="电话" className="input" />
                <input name="email" placeholder="邮箱" className="input" />
                <select name="industry" className="input"><option>其他</option><option>制造业</option><option>金融</option><option>能源</option><option>医疗</option></select>
                <select name="level" className="input"><option>standard</option><option>premium</option><option>vip</option></select>
                <button type="submit" className="btn-primary"><Plus size={14} /> 添加客户</button>
              </form>
              <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-bg-muted"><tr>
                    <th className="p-3 text-left">名称</th><th className="p-3 text-left">联系人</th><th className="p-3 text-left">行业</th><th className="p-3 text-left">等级</th><th className="p-3 text-left">余额</th>
                  </tr></thead>
                  <tbody>{customers.map((c: any) => (
                    <tr key={c.id} className="border-t border-border hover:bg-bg">
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">{c.contact_person}</td>
                      <td className="p-3">{c.industry}</td>
                      <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${c.level === 'vip' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100'}`}>{c.level}</span></td>
                      <td className="p-3">¥{(c.balance / 100).toFixed(2)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ) : tab === "tickets" ? (
            <div>
              <form onSubmit={createTicket} className="bg-bg-card rounded-lg p-4 mb-4 border border-border grid grid-cols-4 gap-3">
                <input name="customer_id" type="number" placeholder="客户ID*" required className="input" />
                <input name="title" placeholder="工单标题*" required className="input col-span-2" />
                <select name="priority" className="input"><option>normal</option><option>high</option><option>urgent</option><option>low</option></select>
                <textarea name="description" placeholder="描述" className="input col-span-3" rows={2} />
                <button type="submit" className="btn-primary"><Plus size={14} /> 创建工单</button>
              </form>
              <div className="space-y-2">
                {tickets.map((t: any) => (
                  <div key={t.id} className="bg-bg-card rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-text-muted">{t.ticket_no}</span>
                        <h3 className="font-medium">{t.title}</h3>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className={`text-xs ${priorityColors[t.priority] || ''}`}>{t.priority}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${statusColors[t.status] || ''}`}>{t.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg-muted"><tr>
                  <th className="p-3 text-left">账单号</th><th className="p-3 text-left">项目</th><th className="p-3 text-right">金额</th><th className="p-3 text-right">已付</th><th className="p-3 text-left">状态</th><th className="p-3 text-left">到期</th>
                </tr></thead>
                <tbody>{bills.map((b: any) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="p-3 text-xs text-text-muted">{b.bill_no}</td>
                    <td className="p-3">{b.item}</td>
                    <td className="p-3 text-right">¥{(b.amount / 100).toFixed(2)}</td>
                    <td className="p-3 text-right">¥{(b.paid_amount / 100).toFixed(2)}</td>
                    <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${billStatusColors[b.status] || ''}`}>{b.status}</span></td>
                    <td className="p-3">{b.due_date}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}

const inputStyle = "w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:ring-1 focus:ring-primary";

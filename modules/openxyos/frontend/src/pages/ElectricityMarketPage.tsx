import { useState, useEffect } from "react";
import { Zap, TrendingUp, Activity, DollarSign, Plus } from "lucide-react";
import { authFetch } from "../api/authFetch";

type Tab = "trades" | "plants" | "grid";

export default function ElectricityMarketPage() {
  const [tab, setTab] = useState<Tab>("trades");
  const [trades, setTrades] = useState<any[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [grid, setGrid] = useState<any>(null);
  const [price, setPrice] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const tabs = [
    { key: "trades" as Tab, label: "电力交易", icon: TrendingUp },
    { key: "plants" as Tab, label: "电厂管理", icon: Zap },
    { key: "grid" as Tab, label: "电网调度", icon: Activity },
  ];

  useEffect(() => {
    loadData();
    const interval = setInterval(() => { if (tab === "grid") loadGrid(); }, 5000);
    return () => clearInterval(interval);
  }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      const [tr, pr, prc] = await Promise.all([
        authFetch("/api/electricity/trades"),
        authFetch("/api/electricity/plants"),
        authFetch("/api/electricity/price"),
      ]);
      setTrades((await tr.json()).data || []);
      setPlants((await pr.json()).data || []);
      setPrice((await prc.json()).data || {});
      if (tab === "grid") await loadGrid();
    } catch (e) { /* */ }
    setLoading(false);
  }

  async function loadGrid() {
    const r = await authFetch("/api/electricity/grid/snapshot");
    setGrid((await r.json()).data || null);
  }

  async function createPlant(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form));
    await authFetch("/api/electricity/plants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, installedCapacityKw: Number(data.installedCapacityKw) }) });
    form.reset();
    loadData();
  }

  async function createTrade(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form));
    await authFetch("/api/electricity/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, volumeKwh: Number(data.volumeKwh), pricePerKwh: Number(data.pricePerKwh) }) });
    form.reset();
    loadData();
  }

  const plantIcons: Record<string, string> = { thermal: "🔥", hydro: "💧", wind: "🌬️", solar: "☀️", nuclear: "⚛️", biomass: "🌿" };

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border bg-bg-card">
        <h1 className="text-lg font-bold flex items-center gap-2"><Zap size={22} /> 电力市场系统</h1>
      </header>

      {/* 实时电价面板 */}
      {price && (
        <div className="grid grid-cols-4 gap-3 px-6 py-3 bg-bg-card border-b border-border">
          {[
            { label: "现货价格", value: `¥${((price.spot_price || 0) / 100).toFixed(2)}/kWh`, color: "text-blue-600" },
            { label: "峰时电价", value: `¥${((price.peak_price || 0) / 100).toFixed(2)}/kWh`, color: "text-orange-600" },
            { label: "谷时电价", value: `¥${((price.valley_price || 0) / 100).toFixed(2)}/kWh`, color: "text-green-600" },
            { label: "均价", value: `¥${((price.avg_trade_price || 0) / 100).toFixed(2)}/kWh`, color: "text-gray-600" },
          ].map((s, i) => (
            <div key={i} className="bg-bg rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 标签 */}
      <nav className="flex gap-0 border-b border-border bg-bg-card px-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t.key ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"}`}>
            <t.icon size={14} className="inline mr-1" />{t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto p-6">
        {loading ? <div className="text-center py-12 text-text-muted">加载中...</div> : (
          tab === "trades" ? (
            <div>
              <form onSubmit={createTrade} className="bg-bg-card rounded-lg p-4 mb-4 border border-border grid grid-cols-5 gap-3">
                <input name="sellerId" type="number" placeholder="卖方ID*" required className="input" />
                <input name="buyerId" type="number" placeholder="买方ID*" required className="input" />
                <input name="volumeKwh" type="number" placeholder="电量(kWh)*" required className="input" />
                <input name="pricePerKwh" type="number" placeholder="单价(分/kWh)*" required className="input" />
                <select name="tradeType" className="input"><option>spot</option><option>forward</option><option>contract</option></select>
                <button type="submit" className="btn-primary col-span-5"><Plus size={14} /> 创建交易</button>
              </form>
              <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-bg-muted"><tr>
                    <th className="p-3">交易号</th><th className="p-3">类型</th><th className="p-3 text-right">电量(kWh)</th><th className="p-3 text-right">单价</th><th className="p-3 text-right">总价</th><th className="p-3">状态</th>
                  </tr></thead>
                  <tbody>{trades.map((t: any) => (
                    <tr key={t.id} className="border-t border-border hover:bg-bg">
                      <td className="p-3 text-xs text-text-muted">{t.trade_no}</td>
                      <td className="p-3">{t.trade_type}</td>
                      <td className="p-3 text-right">{t.volume_kwh?.toLocaleString()}</td>
                      <td className="p-3 text-right">¥{(t.price_per_kwh / 100).toFixed(2)}</td>
                      <td className="p-3 text-right font-medium">¥{(t.total_amount / 100).toFixed(2)}</td>
                      <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${t.status === 'completed' ? 'bg-green-100 text-green-800' : t.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{t.status}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ) : tab === "plants" ? (
            <div>
              <form onSubmit={createPlant} className="bg-bg-card rounded-lg p-4 mb-4 border border-border grid grid-cols-4 gap-3">
                <input name="name" placeholder="电厂名称*" required className="input" />
                <select name="type" className="input"><option>thermal</option><option>hydro</option><option>wind</option><option>solar</option><option>nuclear</option><option>biomass</option></select>
                <input name="installedCapacityKw" type="number" placeholder="装机容量(kW)*" required className="input" />
                <input name="gridPoint" placeholder="并网点" className="input" />
                <button type="submit" className="btn-primary col-span-4"><Plus size={14} /> 添加电厂</button>
              </form>
              <div className="grid grid-cols-2 gap-3">
                {plants.map((p: any) => (
                  <div key={p.id} className="bg-bg-card rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-lg">{plantIcons[p.type] || '🏭'} {p.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>{p.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
                      <div>装机: <span className="font-medium text-text">{p.installed_capacity_kw?.toLocaleString()} kW</span></div>
                      <div>出力: <span className="font-medium text-text">{p.current_output_kw?.toLocaleString()} kW</span></div>
                      <div>效率: <span className="font-medium text-text">{p.efficiency}%</span></div>
                      <div>类型: <span className="font-medium text-text">{p.type}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {grid && (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "总发电(kW)", value: grid.total_generation_kw?.toLocaleString(), color: "text-blue-600" },
                    { label: "总负荷(kW)", value: grid.total_load_kw?.toLocaleString(), color: "text-orange-600" },
                    { label: "频率(Hz)", value: grid.frequency_hz?.toFixed(2), color: grid.frequency_hz > 50.05 || grid.frequency_hz < 49.95 ? "text-red-600" : "text-green-600" },
                    { label: "备用裕度", value: `${grid.reserve_margin_pct}%`, color: grid.reserve_margin_pct > 10 ? "text-green-600" : "text-red-600" },
                  ].map((s, i) => (
                    <div key={i} className="bg-bg-card rounded-lg p-4 border border-border text-center">
                      <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-text-muted">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-center text-text-muted py-8">
                在线电厂: {grid?.online_plants || 0} | 数据刷新: 每5秒
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../api/authFetch";
import { ArrowLeft, Car, Fuel, Wrench, FileText, DollarSign } from "lucide-react";

interface VehicleExpense {
  id: number; vehicle_asset_id: number; vehicle_name?: string; asset_no?: string;
  log_type: string; log_date: string; cost: number; mileage?: number;
  description?: string; group_key?: string; count?: number; total_cost?: number;
}

interface Summary { total_cost: number; record_count: number; }

const TYPE_LABELS: Record<string, string> = { refuel: "加油", maintenance: "保养", repair: "维修", insurance: "保险", annual_inspection: "年检", traffic_fine: "违章罚款", other: "其他" };
const TYPE_ICONS: Record<string, typeof Fuel> = { refuel: Fuel, maintenance: Wrench, repair: Wrench, insurance: FileText, annual_inspection: FileText, traffic_fine: FileText, other: FileText };

export default function AssetVehicleExpensePage() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_cost: 0, record_count: 0 });
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<string>("");
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams({ year });
    if (groupBy) params.set("group_by", groupBy);
    const r = await authFetch(`/api/assets/vehicle-expenses?${params}`);
    const d = await r.json();
    if (d.success) {
      setExpenses(d.data || []);
      setSummary(d.summary || { total_cost: 0, record_count: 0 });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [groupBy, year]);

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/assets")} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white flex items-center gap-2"><Car size={20} /> 车辆费用报表</h1>
          </div>
        </div>
      </div>

      {/* Filters & Summary */}
      <div className="px-6 py-4 border-b border-border bg-bg-card shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={year} onChange={e => setYear(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm bg-white outline-none">
            {Array.from({ length: 5 }, (_, i) => {
              const y = new Date().getFullYear() - i;
              return <option key={y} value={y}>{y}年</option>;
            })}
          </select>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm bg-white outline-none">
            <option value="">明细列表</option>
            <option value="month">按月汇总</option>
            <option value="type">按类型汇总</option>
            <option value="vehicle">按车辆汇总</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="text-xs text-emerald-600 mb-1">年度总费用</div>
            <div className="text-lg font-bold text-emerald-700">¥{summary.total_cost.toLocaleString()}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs text-blue-600 mb-1">记录条数</div>
            <div className="text-lg font-bold text-blue-700">{summary.record_count}</div>
          </div>
        </div>
      </div>

      {/* Data */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted">加载中...</div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-muted gap-2">
            <Car size={32} className="text-text-muted/40" />
            <p className="text-sm">暂无车辆费用记录</p>
          </div>
        ) : groupBy ? (
          /* Grouped View */
          <div className="space-y-3">
            {expenses.map((item, i) => {
              const label = groupBy === "month" ? item.group_key :
                groupBy === "type" ? (TYPE_LABELS[item.group_key || ""] || item.group_key) :
                `${item.vehicle_name || ""} (${item.asset_no || ""})`;
              return (
                <div key={i} className="bg-bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-text">{label}</div>
                    <div className="text-xs text-text-muted mt-0.5">{item.count || 0} 条记录</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-emerald-600">¥{(item.total_cost || 0).toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Detail View */
          <div className="space-y-2">
            {expenses.map((item) => {
              const Icon = TYPE_ICONS[item.log_type] || FileText;
              return (
                <div key={item.id} className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    item.log_type === "refuel" ? "bg-amber-100 text-amber-600" :
                    item.log_type === "maintenance" ? "bg-blue-100 text-blue-600" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        item.log_type === "refuel" ? "bg-amber-100 text-amber-700" :
                        item.log_type === "maintenance" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>{TYPE_LABELS[item.log_type] || item.log_type}</span>
                      <span className="text-sm text-text truncate">{item.vehicle_name || ""}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">{item.log_date?.split("T")[0]} {item.mileage ? `· ${item.mileage.toLocaleString()}km` : ""} {item.description ? `· ${item.description}` : ""}</div>
                  </div>
                  <div className="text-base font-bold text-text shrink-0">¥{item.cost?.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

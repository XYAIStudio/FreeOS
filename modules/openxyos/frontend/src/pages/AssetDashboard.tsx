import { useState, useEffect, useCallback } from "react";
import { BarChart3, TrendingUp, Package, Landmark, Truck, Monitor, Wrench, DollarSign, ArrowLeft, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../api/authFetch";

interface DashboardData {
  overview: {
    total: number;
    total_value: number;
    new_this_month: number;
    new_value_this_month: number;
    tx_this_month: number;
    pending_transfers: number;
  };
  by_category: { category: string; count: number; total_value: number }[];
  by_status: { status: string; count: number }[];
  by_department: { department_id: number; department_name: string; count: number; total_value: number }[];
  by_owner_type: { owner_type: string; count: number; total_value: number }[];
}

const CATEGORY_ICON: Record<string, React.FC<{ size?: number }>> = {
  INSTRUMENT: Monitor,
  VEHICLE: Truck,
  OFFICE: Landmark,
  TOOL: Wrench,
};

const CATEGORY_LABELS: Record<string, string> = {
  INSTRUMENT: "检测仪器",
  VEHICLE: "车辆",
  OFFICE: "办公设备",
  TOOL: "小型工具",
};

const STATUS_LABELS: Record<string, string> = {
  in_stock: "在库",
  in_use: "使用中",
  idle: "闲置",
  repairing: "维修中",
  transferring: "调拨中",
  scrapped: "已报废",
  lost: "已遗失",
};

export default function AssetDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch("/api/assets/dashboard");
      const d = await r.json();
      if (d.success) setData(d.data);
    } catch (err: any) {
      console.error("加载驾驶舱数据失败:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12 text-gray-400">无法加载驾驶舱数据</div>
      </div>
    );
  }

  const maxDeptCount = Math.max(1, ...data.by_department.map(d => d.count));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/assets")} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 size={24} className="text-blue-600" /> 资产驾驶舱
            </h1>
            <p className="text-sm text-gray-500 mt-1">全集团资产总览与分布统计</p>
          </div>
        </div>
        {data.overview.pending_transfers > 0 && (
          <button onClick={() => navigate("/assets")} className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg text-sm text-yellow-700 hover:bg-yellow-100">
            <AlertTriangle size={14} /> {data.overview.pending_transfers} 条待审批调拨
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Package size={24} className="text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.overview.total.toLocaleString()}</div>
              <div className="text-xs text-gray-500">资产总数</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DollarSign size={24} className="text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{(data.overview.total_value / 10000).toFixed(1)}<span className="text-sm font-normal text-gray-500">万</span></div>
              <div className="text-xs text-gray-500">资产总值</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <TrendingUp size={24} className="text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.overview.new_this_month.toLocaleString()}</div>
              <div className="text-xs text-gray-500">本月新增（{data.overview.tx_this_month}条流转）</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Distribution */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">资产分类分布</h3>
          <div className="space-y-3">
            {data.by_category.map(c => {
              const Icon = CATEGORY_ICON[c.category] || Package;
              const pct = data.overview.total > 0 ? ((c.count / data.overview.total) * 100).toFixed(1) : "0";
              return (
                <div key={c.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <Package size={14} className="text-gray-400" /> {CATEGORY_LABELS[c.category] || c.category}
                    </span>
                    <span className="text-gray-500">{c.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.max(1, (c.count / Math.max(1, data.by_category[0].count)) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">资产状态分布</h3>
          <div className="space-y-2">
            {data.by_status.map(s => {
              const pct = data.overview.total > 0 ? ((s.count / data.overview.total) * 100).toFixed(1) : "0";
              return (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{STATUS_LABELS[s.status] || s.status}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${s.status === 'in_use' ? 'bg-green-500' : s.status === 'idle' ? 'bg-yellow-500' : s.status === 'scrapped' ? 'bg-gray-400' : 'bg-blue-500'}`}
                        style={{ width: `${Math.max(2, (s.count / data.overview.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-500 text-xs w-10 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Department bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">机构资产分布</h3>
        {data.by_department.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-sm">暂无机构数据</div>
        ) : (
          <div className="space-y-3">
            {data.by_department.map(d => (
              <div key={d.department_id} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 truncate" title={d.department_name}>{d.department_name}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-indigo-500 h-3 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(3, (d.count / maxDeptCount) * 100)}%` }}
                  >
                    <span className="text-[10px] text-white font-medium">{d.count}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-16 text-right">{(d.total_value / 10000).toFixed(1)}万</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Owner type */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">资产权属</h3>
        <div className="grid grid-cols-3 gap-4">
          {data.by_owner_type.map(o => {
            const labels: Record<string, string> = { owned: "自有资产", leased: "租赁资产", borrowed: "借用资产" };
            const colors: Record<string, string> = { owned: "text-blue-600", leased: "text-orange-600", borrowed: "text-purple-600" };
            return (
              <div key={o.owner_type} className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className={`text-2xl font-bold ${colors[o.owner_type] || "text-gray-600"}`}>{o.count}</div>
                <div className="text-xs text-gray-500 mt-1">{labels[o.owner_type] || o.owner_type}</div>
                <div className="text-xs text-gray-400 mt-0.5">{(o.total_value / 10000).toFixed(1)}万</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

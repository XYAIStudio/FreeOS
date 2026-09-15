import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Search, Plus, ChevronRight, AlertTriangle, Bell, Clock, RotateCcw, ClipboardCheck, BarChart3, User, X, Building2, Car, Download, ShoppingCart } from "lucide-react";
import { authFetch } from "../api/authFetch";

interface Asset {
  id: number;
  asset_no: string;
  name: string;
  category: string;
  sub_category: string | null;
  model: string | null;
  sn: string | null;
  manufacturer: string | null;
  purchase_date: string | null;
  purchase_price: number;
  expected_life: number | null;
  current_value: number;
  status: string;
  owner_type: string;
  department_id: number | null;
  department_name?: string;
  location_detail: string | null;
  custodian_id: number | null;
  custodian_name?: string;
  qr_code: string | null;
  remark: string | null;
  created_at: string;
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  INSTRUMENT: { label: "检测仪器", color: "bg-blue-100 text-blue-800" },
  VEHICLE: { label: "车辆", color: "bg-green-100 text-green-800" },
  OFFICE: { label: "办公设备", color: "bg-purple-100 text-purple-800" },
  TOOL: { label: "小型工具", color: "bg-orange-100 text-orange-800" },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  in_stock: { label: "在库", color: "bg-gray-100 text-gray-700" },
  in_use: { label: "使用中", color: "bg-green-100 text-green-700" },
  idle: { label: "闲置", color: "bg-yellow-100 text-yellow-700" },
  repairing: { label: "维修中", color: "bg-red-100 text-red-700" },
  transferring: { label: "调拨中", color: "bg-blue-100 text-blue-700" },
  scrapped: { label: "已报废", color: "bg-gray-200 text-gray-500" },
  lost: { label: "已遗失", color: "bg-red-200 text-red-800" },
};

export default function AssetPage() {
  const navigate = useNavigate();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});
  const limit = 20;

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "", category: "OFFICE", sub_category: "", model: "", sn: "",
    manufacturer: "", purchase_date: "", purchase_price: "", expected_life: "",
    status: "in_stock", owner_type: "owned", department_id: "", location_detail: "",
    custodian_id: "", remark: ""
  });
  const [departments, setDepartments] = useState<any[]>([]);

  // Tabs: ledger / idle / alerts
  const [activeTab, setActiveTab] = useState<"ledger" | "idle" | "alerts">("ledger");

  // Alerts
  const [alerts, setAlerts] = useState<any>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Idle pool
  const [idleAssets, setIdleAssets] = useState<Asset[]>([]);
  const [idleLoading, setIdleLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterCategory) params.set("category", filterCategory);
      if (filterStatus) params.set("status", filterStatus);
      if (filterDepartment) params.set("department_id", filterDepartment);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const r = await authFetch(`/api/assets?${params.toString()}`);
      const d = await r.json();
      if (d.success) {
        setAssets(d.data || []);
        setTotal(d.total || 0);
        if (d.stats) {
          const m: Record<string, number> = {};
          d.stats.forEach((s: any) => { m[s.category] = s.count; });
          setStats(m);
        }
      }
    } catch (err: any) {
      console.error("加载资产列表失败:", err);
    }
    setLoading(false);
  }, [search, filterCategory, filterStatus, filterDepartment, page]);

  const fetchDepartments = useCallback(async () => {
    try {
      const r = await authFetch("/api/org/departments");
      const d = await r.json();
      if (d.success) setDepartments(d.data || []);
    } catch (err: any) {
      console.error("加载机构列表失败:", err);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const r = await authFetch("/api/assets/alerts");
      const d = await r.json();
      if (d.success) setAlerts(d.data);
    } catch (err: any) {
      console.error("加载预警数据失败:", err);
    }
    setAlertsLoading(false);
  }, []);

  const fetchIdleAssets = useCallback(async () => {
    setIdleLoading(true);
    try {
      const r = await authFetch("/api/assets/idle-pool");
      const d = await r.json();
      if (d.success) setIdleAssets(d.data || []);
    } catch (err: any) {
      console.error("加载闲置池失败:", err);
    }
    setIdleLoading(false);
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);
  useEffect(() => { if (activeTab === "alerts" && !alerts) fetchAlerts(); }, [activeTab, alerts, fetchAlerts]);
  useEffect(() => { if (activeTab === "idle") fetchIdleAssets(); }, [activeTab, fetchIdleAssets]);
  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.category) return;
    try {
      const body: any = { ...createForm };
      if (createForm.purchase_price) body.purchase_price = parseFloat(createForm.purchase_price);
      if (createForm.expected_life) body.expected_life = parseInt(createForm.expected_life);
      if (createForm.department_id) body.department_id = parseInt(createForm.department_id);
      if (createForm.custodian_id) body.custodian_id = parseInt(createForm.custodian_id);
      else delete body.custodian_id;

      const r = await authFetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) {
        setShowCreate(false);
        setCreateForm({ name: "", category: "OFFICE", sub_category: "", model: "", sn: "", manufacturer: "", purchase_date: "", purchase_price: "", expected_life: "", status: "in_stock", owner_type: "owned", department_id: "", location_detail: "", custodian_id: "", remark: "" });
        fetchAssets();
      } else {
        alert(d.error || "新增资产失败");
      }
    } catch (err: any) {
      console.error("新增资产失败:", err);
      alert("新增请求失败");
    }
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    if (filterStatus) params.set("status", filterStatus);
    if (search) params.set("search", search);
    const qs = params.toString();
    const url = `/api/assets/export/csv${qs ? "?" + qs : ""}`;
    try {
      const r = await authFetch(url);
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `资产台账_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      console.error("导出CSV失败:", err);
      alert("导出失败: " + (err.message || err));
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">资产管理</h1>
          <p className="text-sm text-gray-500 mt-1">全集团固定资产台账与生命周期管理</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/assets/dashboard")}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <BarChart3 size={16} /> 驾驶舱
          </button>
          <button
            onClick={() => navigate("/assets/count")}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <ClipboardCheck size={16} /> 资产盘点
          </button>
          <button
            onClick={() => navigate("/assets/vehicles")}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <Car size={16} /> 车辆费用
          </button>
          <button
            onClick={() => navigate("/assets/procurement")}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <ShoppingCart size={16} /> 采购管理
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <Download size={16} /> 导出报表
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus size={16} /> 新增资产
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {[
          { key: "ledger", label: "资产台账", icon: Package },
          { key: "idle", label: "闲置池", icon: Clock },
          { key: "alerts", label: "预警中心", icon: Bell },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-all ${activeTab === tab.key ? "bg-white dark:bg-gray-700 shadow-sm font-medium text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            <tab.icon size={15} />
            {tab.label}
            {tab.key === "alerts" && alerts && alerts.summary?.total > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{alerts.summary.total}</span>
            )}
            {tab.key === "idle" && idleAssets.length > 0 && (
              <span className="bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">{idleAssets.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab !== "ledger" ? null : (<>
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[["INSTRUMENT", "检测仪器"], ["VEHICLE", "车辆"], ["OFFICE", "办公设备"], ["TOOL", "小型工具"]].map(([cat, label]) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
            className={`p-4 rounded-xl border text-left transition-all ${filterCategory === cat ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
          >
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {stats[cat] || 0}
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="搜索资产名称、编号、型号..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={filterDepartment} onChange={e => { setFilterDepartment(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm max-w-[180px] truncate">
          <option value="">全部机构</option>
          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm">
          <option value="">全部状态</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(filterCategory || filterStatus || search || filterDepartment) && (
          <button onClick={() => { setFilterCategory(""); setFilterStatus(""); setSearch(""); setFilterDepartment(""); setPage(1); }} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
            <X size={14} /> 清除筛选
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">资产编号</th>
                <th className="text-left px-4 py-3">名称</th>
                <th className="text-left px-4 py-3">分类</th>
                <th className="text-left px-4 py-3">规格型号</th>
                <th className="text-left px-4 py-3">状态</th>
                <th className="text-left px-4 py-3">所属机构</th>
                <th className="text-left px-4 py-3">保管人</th>
                <th className="text-left px-4 py-3">购置日期</th>
                <th className="text-right px-4 py-3">价格(元)</th>
                <th className="text-center px-4 py-3 w-16">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">加载中...</td></tr>
              ) : assets.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">
                  <Package size={40} className="mx-auto mb-2 opacity-30" />
                  暂无资产数据，点击"新增资产"开始登记
                </td></tr>
              ) : assets.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors" onClick={() => navigate(`/assets/${a.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.asset_no}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{a.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_MAP[a.category]?.color || "bg-gray-100"}`}>
                      {CATEGORY_MAP[a.category]?.label || a.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{a.model || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_MAP[a.status]?.color || "bg-gray-100"}`}>
                      {STATUS_MAP[a.status]?.label || a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {a.department_name && <span className="flex items-center gap-1"><Building2 size={12} />{a.department_name}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {a.custodian_name && <span className="flex items-center gap-1"><User size={12} />{a.custodian_name}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{a.purchase_date || "-"}</td>
                  <td className="px-4 py-3 text-right text-gray-700 text-xs">{(a.purchase_price || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <ChevronRight size={16} className="inline text-gray-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500">共 {total} 条</span>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`px-3 py-1 text-xs rounded ${page === i + 1 ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{i + 1}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">新增资产</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">资产名称 *</label>
                <input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">分类 *</label>
                <select value={createForm.category} onChange={e => setCreateForm({ ...createForm, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {Object.entries(CATEGORY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">小类</label>
                <input value={createForm.sub_category} onChange={e => setCreateForm({ ...createForm, sub_category: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">规格型号</label>
                <input value={createForm.model} onChange={e => setCreateForm({ ...createForm, model: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">出厂编号</label>
                <input value={createForm.sn} onChange={e => setCreateForm({ ...createForm, sn: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">生产厂家</label>
                <input value={createForm.manufacturer} onChange={e => setCreateForm({ ...createForm, manufacturer: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">购置日期</label>
                <input type="date" value={createForm.purchase_date} onChange={e => setCreateForm({ ...createForm, purchase_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">购置价格</label>
                <input type="number" value={createForm.purchase_price} onChange={e => setCreateForm({ ...createForm, purchase_price: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">预期使用年限(月)</label>
                <input type="number" value={createForm.expected_life} onChange={e => setCreateForm({ ...createForm, expected_life: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">状态</label>
                <select value={createForm.status} onChange={e => setCreateForm({ ...createForm, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">权属</label>
                <select value={createForm.owner_type} onChange={e => setCreateForm({ ...createForm, owner_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="owned">自有</option>
                  <option value="leased">租赁</option>
                  <option value="borrowed">借用</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">归属机构</label>
                <select value={createForm.department_id} onChange={e => setCreateForm({ ...createForm, department_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">-- 选择机构 --</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">存放位置</label>
                <input value={createForm.location_detail} onChange={e => setCreateForm({ ...createForm, location_detail: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="如：A标段试验室3号工位" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">备注</label>
                <textarea value={createForm.remark} onChange={e => setCreateForm({ ...createForm, remark: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleCreate} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">确认新增</button>
            </div>
          </div>
        </div>
      )}

      </>)}

      {/* Idle Pool Tab */}
      {activeTab === "idle" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} className="text-yellow-500" /> 闲置资产池
          </h3>
          {idleLoading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : idleAssets.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Package size={40} className="mx-auto mb-2 opacity-30" /> 当前无闲置资产
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">资产编号</th>
                    <th className="text-left px-4 py-3">名称</th>
                    <th className="text-left px-4 py-3">分类</th>
                    <th className="text-left px-4 py-3">所属机构</th>
                    <th className="text-left px-4 py-3">闲置天数</th>
                    <th className="text-right px-4 py-3">价格(元)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {idleAssets.map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer" onClick={() => navigate(`/assets/${a.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.asset_no}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{a.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_MAP[a.category]?.color || "bg-gray-100"}`}>
                          {CATEGORY_MAP[a.category]?.label || a.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{a.department_name || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.days_idle > 90 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {a.days_idle} 天
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 text-xs">{(a.purchase_price || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <div className="space-y-4">
          {alertsLoading ? (
            <div className="text-center py-12 text-gray-400">加载中...</div>
          ) : !alerts ? (
            <div className="text-center py-12 text-gray-400">暂无预警数据</div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: "校准到期", count: alerts.summary?.calibration, color: "border-l-blue-500", key: "calibration" },
                  { label: "年检到期", count: alerts.summary?.vehicle_inspection, color: "border-l-orange-500", key: "vehicle_inspection" },
                  { label: "保险到期", count: alerts.summary?.vehicle_insurance, color: "border-l-yellow-500", key: "vehicle_insurance" },
                  { label: "保修到期", count: alerts.summary?.warranty, color: "border-l-purple-500", key: "warranty" },
                  { label: "闲置超期", count: alerts.summary?.idle, color: "border-l-red-500", key: "idle" },
                ].map(item => (
                  <div key={item.key} className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 ${item.color} p-4`}>
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{item.count || 0}</div>
                  </div>
                ))}
              </div>

              {alerts.calibration?.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-blue-600 mb-3">
                    <AlertTriangle size={16} /> 仪器校准到期预警 ({alerts.calibration.length})
                  </h4>
                  <div className="space-y-2">
                    {alerts.calibration.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 p-2 rounded" onClick={() => navigate(`/assets/${a.id}`)}>
                        <span className="font-medium">{a.name}</span>
                        <span className="text-gray-500 text-xs">{a.asset_no}</span>
                        <span className="text-red-600 text-xs font-medium">到期: {a.next_calibration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alerts.vehicle_inspection?.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-orange-600 mb-3">
                    <AlertTriangle size={16} /> 车辆年检到期 ({alerts.vehicle_inspection.length})
                  </h4>
                  <div className="space-y-2">
                    {alerts.vehicle_inspection.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 p-2 rounded" onClick={() => navigate(`/assets/${a.id}`)}>
                        <span className="font-medium">{a.name}</span>
                        <span className="text-gray-500 text-xs">{a.plate_no}</span>
                        <span className="text-red-600 text-xs font-medium">到期: {a.next_inspection}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alerts.vehicle_insurance?.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-yellow-600 mb-3">
                    <AlertTriangle size={16} /> 车辆保险到期 ({alerts.vehicle_insurance.length})
                  </h4>
                  <div className="space-y-2">
                    {alerts.vehicle_insurance.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 p-2 rounded" onClick={() => navigate(`/assets/${a.id}`)}>
                        <span className="font-medium">{a.name}</span>
                        <span className="text-gray-500 text-xs">{a.plate_no}</span>
                        <span className="text-red-600 text-xs font-medium">到期: {a.insurance_expiry}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alerts.warranty?.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-purple-600 mb-3">
                    <RotateCcw size={16} /> 保修即将到期 ({alerts.warranty.length})
                  </h4>
                  <div className="space-y-2">
                    {alerts.warranty.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 p-2 rounded" onClick={() => navigate(`/assets/${a.id}`)}>
                        <span className="font-medium">{a.name}</span>
                        <span className="text-gray-500 text-xs">{a.asset_no}</span>
                        <span className="text-gray-500 text-xs">购置: {a.purchase_date} / 保修{a.expected_life}月</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alerts.idle?.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-red-600 mb-3">
                    <Clock size={16} /> 闲置超90天资产 ({alerts.idle.length})
                  </h4>
                  <div className="space-y-2">
                    {alerts.idle.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 p-2 rounded" onClick={() => navigate(`/assets/${a.id}`)}>
                        <span className="font-medium">{a.name}</span>
                        <span className="text-gray-500 text-xs">{a.asset_no}</span>
                        <span className="text-gray-500 text-xs">{a.department_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alerts.summary?.total === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Bell size={40} className="mx-auto mb-2 opacity-30" />
                  当前无预警，所有资产状态正常
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

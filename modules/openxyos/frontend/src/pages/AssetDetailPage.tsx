import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, User, Building2, Tag, Calendar, Edit3, History, ArrowRightLeft, Check, Trash2 } from "lucide-react";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";

interface Asset {
  id: number; asset_no: string; name: string; category: string; sub_category: string | null;
  model: string | null; sn: string | null; manufacturer: string | null; purchase_date: string | null;
  purchase_price: number; expected_life: number | null; current_value: number; status: string;
  owner_type: string; department_id: number | null; department_name?: string;
  location_detail: string | null; custodian_id: number | null; custodian_name?: string;
  qr_code: string | null; remark: string | null; created_at: string;
}

interface Transaction {
  id: number; type: string; from_dept_name?: string; to_dept_name?: string;
  from_user_name?: string; to_user_name?: string; expected_return: string | null;
  actual_return: string | null; condition: string | null; remark: string | null; created_at: string;
}

interface CategoryExt {
  // instrument
  calibration_cycle?: number; last_calibration?: string; next_calibration?: string;
  calibration_agency?: string; precision_level?: string; measure_range?: string; env_requirements?: string;
  // vehicle
  plate_no?: string; vin?: string; vehicle_type?: string; fuel_type?: string; seat_count?: number;
  insurance_company?: string; insurance_expire?: string; last_inspection?: string; next_inspection?: string;
  current_mileage?: number;
  // office
  device_type?: string; brand?: string; cpu?: string; ram?: string; storage?: string; os?: string;
  ip_address?: string; mac_address?: string; consumable_model?: string;
}

const CATEGORY_MAP: Record<string, string> = { INSTRUMENT: "检测仪器", VEHICLE: "车辆", OFFICE: "办公设备", TOOL: "小型工具" };
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  in_stock: { label: "在库", color: "text-green-600 bg-green-50" }, in_use: { label: "使用中", color: "text-blue-600 bg-blue-50" },
  idle: { label: "闲置", color: "text-yellow-600 bg-yellow-50" }, repairing: { label: "维修中", color: "text-red-600 bg-red-50" },
  transferring: { label: "调拨中", color: "text-purple-600 bg-purple-50" }, scrapped: { label: "已报废", color: "text-gray-500 bg-gray-100" },
  lost: { label: "已遗失", color: "text-red-700 bg-red-100" },
};
const TX_MAP: Record<string, string> = {
  checkout: "领用", return: "归还", transfer: "调拨", repair: "送修", scrap: "报废",
  calibrate: "送检", lend_out: "借出外部", lend_return: "外部归还", custodian_change: "保管人变更",
};

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const [asset, setAsset] = useState<Asset | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [catExt, setCatExt] = useState<CategoryExt | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "transactions">("info");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Asset>>({});

  // Checkout/Return
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ to_user_id: "", expected_return: "", remark: "" });
  const [returnForm, setReturnForm] = useState({ condition: "good", remark: "" });
  const [employees, setEmployees] = useState<any[]>([]);

  const fetchAsset = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, tRes, cRes] = await Promise.all([
        authFetch(`/api/assets/${id}`),
        authFetch(`/api/assets/${id}/transactions`),
        authFetch(`/api/assets/${id}/category`),
      ]);
      const aD = await aRes.json();
      const tD = await tRes.json();
      const cD = await cRes.json();
      if (aD.success) { setAsset(aD.data); setEditForm(aD.data); }
      if (tD.success) setTransactions(tD.data || []);
      if (cD.success && cD.data) setCatExt(cD.data);
    } catch (err: any) {
      console.error("加载资产详情失败:", err);
    }
    setLoading(false);
  }, [id]);

  const fetchEmployees = useCallback(async () => {
    try {
      const r = await authFetch("/api/employees");
      const d = await r.json();
      if (d.success) setEmployees(d.data || []);
    } catch (err: any) {
      console.error("加载员工列表失败:", err);
    }
  }, []);

  useEffect(() => { fetchAsset(); }, [fetchAsset]);
  useEffect(() => { if (showCheckout) fetchEmployees(); }, [showCheckout, fetchEmployees]);

  const handleEdit = async () => {
    try {
      const r = await authFetch(`/api/assets/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      const d = await r.json();
      if (d.success) { setAsset(d.data); setEditing(false); }
      else alert(d.error || "编辑失败");
    } catch (err: any) {
      console.error("编辑资产失败:", err);
      alert("编辑请求失败");
    }
  };

  const handleCheckout = async () => {
    if (!checkoutForm.to_user_id) return;
    try {
      const r = await authFetch(`/api/assets/${id}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(checkoutForm) });
      const d = await r.json();
      if (d.success) { setShowCheckout(false); setAsset(d.data); fetchAsset(); }
      else alert(d.error || "领用失败");
    } catch (err: any) {
      console.error("领用失败:", err);
      alert("领用请求失败");
    }
  };

  const handleReturn = async () => {
    try {
      const r = await authFetch(`/api/assets/${id}/return`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(returnForm) });
      const d = await r.json();
      if (d.success) { setShowReturn(false); setAsset(d.data); fetchAsset(); }
      else alert(d.error || "归还失败");
    } catch (err: any) {
      console.error("归还失败:", err);
      alert("归还请求失败");
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleDelete = async () => {
    try {
      const r = await authFetch(`/api/assets/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (d.success) { navigate("/assets"); }
      else alert(d.error || "删除失败");
    } catch { alert("删除请求失败"); }
  };

  if (loading) return <div className="p-6 text-center text-gray-400">加载中...</div>;
  if (!asset) return <div className="p-6 text-center text-gray-400">资产不存在</div>;

  const statusInfo = STATUS_MAP[asset.status] || { label: asset.status, color: "text-gray-600" };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate("/assets")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> 返回资产列表
        </button>
        <div className="flex gap-2">
          {asset.status === "in_stock" || asset.status === "idle" ? (
            <button onClick={() => setShowCheckout(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <ArrowRightLeft size={14} /> 领用
            </button>
          ) : null}
          {asset.status === "in_use" ? (
            <button onClick={() => setShowReturn(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Check size={14} /> 归还
            </button>
          ) : null}
          {!editing ? (
            <>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                <Edit3 size={14} /> 编辑
              </button>
              {isAdmin && (
                <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                  <Trash2 size={14} /> 删除
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={handleEdit} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg">保存</button>
              <button onClick={() => { setEditing(false); setEditForm(asset); }} className="px-3 py-1.5 text-sm border rounded-lg">取消</button>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-gray-400">{asset.asset_no}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{CATEGORY_MAP[asset.category]}</span>
              {asset.owner_type === "leased" && <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-600">租赁</span>}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{asset.name}</h1>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{(asset.purchase_price || 0).toLocaleString()}</div>
            <div className="text-xs text-gray-400">购置价格(元)</div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t">
          {editing ? (
            <>
              <div><label className="text-xs text-gray-400">名称</label><input value={editForm.name || ""} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" /></div>
              <div><label className="text-xs text-gray-400">编号</label><input value={editForm.asset_no || ""} onChange={e => setEditForm({...editForm, asset_no: e.target.value})} className="w-full px-2 py-1 border rounded text-sm font-mono" /></div>
              <div><label className="text-xs text-gray-400">规格型号</label><input value={editForm.model || ""} onChange={e => setEditForm({...editForm, model: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" /></div>
              <div><label className="text-xs text-gray-400">出厂编号</label><input value={editForm.sn || ""} onChange={e => setEditForm({...editForm, sn: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" /></div>
              <div><label className="text-xs text-gray-400">厂家</label><input value={editForm.manufacturer || ""} onChange={e => setEditForm({...editForm, manufacturer: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" /></div>
              <div><label className="text-xs text-gray-400">购置日期</label><input type="date" value={editForm.purchase_date?.slice(0,10) || ""} onChange={e => setEditForm({...editForm, purchase_date: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" /></div>
              <div><label className="text-xs text-gray-400">价格</label><input type="number" value={editForm.purchase_price || 0} onChange={e => setEditForm({...editForm, purchase_price: parseFloat(e.target.value)})} className="w-full px-2 py-1 border rounded text-sm" /></div>
              <div><label className="text-xs text-gray-400">存放位置</label><input value={editForm.location_detail || ""} onChange={e => setEditForm({...editForm, location_detail: e.target.value})} className="w-full px-2 py-1 border rounded text-sm" /></div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-600"><Building2 size={14} className="text-gray-400" /> {asset.department_name || "未指定"}</div>
              <div className="flex items-center gap-2 text-sm text-gray-600"><User size={14} className="text-gray-400" /> {asset.custodian_name || "未分配"}</div>
              <div className="flex items-center gap-2 text-sm text-gray-600"><MapPin size={14} className="text-gray-400" /> {asset.location_detail || "未设置"}</div>
              <div className="flex items-center gap-2 text-sm text-gray-600"><Calendar size={14} className="text-gray-400" /> {asset.purchase_date || "-"}</div>
              <div className="flex items-center gap-2 text-sm text-gray-600"><Tag size={14} className="text-gray-400" /> {asset.model || "-"}</div>
              <div className="flex items-center gap-2 text-sm text-gray-600">{asset.manufacturer || "-"}</div>
              <div className="flex items-center gap-2 text-sm text-gray-600">{asset.sn ? `SN:${asset.sn}` : "-"}</div>
              {asset.remark && <div className="flex items-center gap-2 text-sm text-gray-500 col-span-2">{asset.remark}</div>}
            </>
          )}
        </div>
      </div>

      {/* Category-specific info */}
      {catExt && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">分类详情</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {asset.category === "INSTRUMENT" && (
              <>
                <div><span className="text-gray-400">检定周期</span><div className="font-medium">{catExt.calibration_cycle ? `${catExt.calibration_cycle}月` : "-"}</div></div>
                <div><span className="text-gray-400">上次检定</span><div className="font-medium">{catExt.last_calibration || "-"}</div></div>
                <div><span className="text-gray-400">下次检定</span><div className={`font-medium ${catExt.next_calibration && catExt.next_calibration < new Date().toISOString().slice(0,10) ? "text-red-600" : ""}`}>{catExt.next_calibration || "-"}</div></div>
                <div><span className="text-gray-400">检定机构</span><div className="font-medium">{catExt.calibration_agency || "-"}</div></div>
                <div><span className="text-gray-400">精度等级</span><div className="font-medium">{catExt.precision_level || "-"}</div></div>
                <div><span className="text-gray-400">测量范围</span><div className="font-medium">{catExt.measure_range || "-"}</div></div>
                <div className="col-span-2"><span className="text-gray-400">环境要求</span><div className="font-medium">{catExt.env_requirements || "-"}</div></div>
              </>
            )}
            {asset.category === "VEHICLE" && (
              <>
                <div><span className="text-gray-400">车牌号</span><div className="font-medium font-mono text-lg">{catExt.plate_no || "-"}</div></div>
                <div><span className="text-gray-400">VIN码</span><div className="font-medium font-mono text-xs">{catExt.vin || "-"}</div></div>
                <div><span className="text-gray-400">车型</span><div className="font-medium">{catExt.vehicle_type || "-"}</div></div>
                <div><span className="text-gray-400">燃油/座位</span><div className="font-medium">{catExt.fuel_type || "-"} / {catExt.seat_count || "-"}座</div></div>
                <div><span className="text-gray-400">保险公司</span><div className="font-medium">{catExt.insurance_company || "-"}</div></div>
                <div><span className="text-gray-400">保险到期</span><div className={`font-medium ${catExt.insurance_expire && catExt.insurance_expire < new Date().toISOString().slice(0,10) ? "text-red-600" : ""}`}>{catExt.insurance_expire || "-"}</div></div>
                <div><span className="text-gray-400">上次年检</span><div className="font-medium">{catExt.last_inspection || "-"}</div></div>
                <div><span className="text-gray-400">下次年检</span><div className="font-medium">{catExt.next_inspection || "-"}</div></div>
                <div><span className="text-gray-400">当前里程</span><div className="font-medium text-lg">{catExt.current_mileage?.toLocaleString() || "0"} km</div></div>
              </>
            )}
            {asset.category === "OFFICE" && (
              <>
                <div><span className="text-gray-400">设备类型</span><div className="font-medium">{catExt.device_type || "-"}</div></div>
                <div><span className="text-gray-400">品牌</span><div className="font-medium">{catExt.brand || "-"}</div></div>
                <div><span className="text-gray-400">CPU/内存</span><div className="font-medium text-xs">{catExt.cpu || "-"} / {catExt.ram || "-"}</div></div>
                <div><span className="text-gray-400">存储</span><div className="font-medium">{catExt.storage || "-"}</div></div>
                <div><span className="text-gray-400">操作系统</span><div className="font-medium">{catExt.os || "-"}</div></div>
                <div><span className="text-gray-400">IP地址</span><div className="font-medium font-mono text-xs">{catExt.ip_address || "-"}</div></div>
                <div><span className="text-gray-400">MAC地址</span><div className="font-medium font-mono text-xs">{catExt.mac_address || "-"}</div></div>
                <div><span className="text-gray-400">耗材型号</span><div className="font-medium">{catExt.consumable_model || "-"}</div></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs: Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border overflow-hidden">
        <div className="flex border-b">
          <button onClick={() => setActiveTab("info")} className={`px-4 py-3 text-sm font-medium ${activeTab === "info" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}>资产信息</button>
          <button onClick={() => setActiveTab("transactions")} className={`px-4 py-3 text-sm font-medium ${activeTab === "transactions" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}>流转记录 ({transactions.length})</button>
        </div>

        {activeTab === "info" && (
          <div className="p-6">
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><dt className="text-gray-400">小类</dt><dd>{asset.sub_category || "-"}</dd></div>
              <div><dt className="text-gray-400">权属</dt><dd>{asset.owner_type === "owned" ? "自有" : asset.owner_type === "leased" ? "租赁" : "借用"}</dd></div>
              <div><dt className="text-gray-400">预计年限</dt><dd>{asset.expected_life ? `${asset.expected_life}月` : "-"}</dd></div>
              <div><dt className="text-gray-400">当前净值</dt><dd>{(asset.current_value || 0).toLocaleString()} 元</dd></div>
              <div><dt className="text-gray-400">创建时间</dt><dd className="text-xs">{asset.created_at || "-"}</dd></div>
            </dl>
          </div>
        )}

        {activeTab === "transactions" && (
          <div className="p-6">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400"><History size={32} className="mx-auto mb-2 opacity-30" />暂无流转记录</div>
            ) : (
              <div className="space-y-3">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                    <div className={`mt-0.5 px-2 py-0.5 rounded text-xs font-medium ${
                      tx.type === "checkout" ? "bg-blue-100 text-blue-700" : tx.type === "return" ? "bg-green-100 text-green-700" :
                      tx.type === "transfer" ? "bg-purple-100 text-purple-700" : tx.type === "repair" ? "bg-orange-100 text-orange-700" :
                      tx.type === "scrap" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                    }`}>{TX_MAP[tx.type] || tx.type}</div>
                    <div className="flex-1 text-sm">
                      {tx.type === "checkout" && <span>{tx.to_user_name} 领用</span>}
                      {tx.type === "return" && <span>归还，状态：{tx.condition === "good" ? "完好" : tx.condition === "damaged" ? "有损" : "遗失"}</span>}
                      {tx.type === "transfer" && <span>从 {tx.from_dept_name || "-"} → {tx.to_dept_name || "-"}</span>}
                      {tx.type === "repair" && <span>送修</span>}
                      {tx.remark && <span className="text-gray-400 ml-2">— {tx.remark}</span>}
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">{tx.created_at?.slice(0,16) || ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCheckout(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">领用资产</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">领用人 *</label>
                <select value={checkoutForm.to_user_id} onChange={e => setCheckoutForm({...checkoutForm, to_user_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm mt-1">
                  <option value="">-- 选择领用人 --</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">预计归还日期</label>
                <input type="date" value={checkoutForm.expected_return} onChange={e => setCheckoutForm({...checkoutForm, expected_return: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-gray-500">备注</label>
                <input value={checkoutForm.remark} onChange={e => setCheckoutForm({...checkoutForm, remark: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="用途说明" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCheckout(false)} className="px-4 py-2 text-sm border rounded-lg">取消</button>
              <button onClick={handleCheckout} disabled={!checkoutForm.to_user_id} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">确认领用</button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowReturn(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">归还资产</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">归还状态 *</label>
                <select value={returnForm.condition} onChange={e => setReturnForm({...returnForm, condition: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm mt-1">
                  <option value="good">完好</option>
                  <option value="damaged">有损坏</option>
                  <option value="lost">已遗失</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">备注</label>
                <input value={returnForm.remark} onChange={e => setReturnForm({...returnForm, remark: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="归还说明" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowReturn(false)} className="px-4 py-2 text-sm border rounded-lg">取消</button>
              <button onClick={handleReturn} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg">确认归还</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">确认删除</h3>
            <p className="text-sm text-gray-500 mb-4">确定要删除资产「{asset.name}」吗？此操作将软删除该资产，可在数据库中恢复。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm border rounded-lg">取消</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

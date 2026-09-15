import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";
import { ArrowLeft, Plus, ShoppingCart, Check, X, Truck, Package, Ban, UserCheck, Clock, AlertCircle } from "lucide-react";

interface WorkflowTask {
  id: number; step_index: number; title: string; status: string;
  assignee_id?: number; assignee_name?: string; result?: string;
  comment?: string; completed_at?: string;
}

interface Procurement {
  id: number; name: string; category: string; quantity: number;
  estimated_cost: number; reason?: string; budget_id?: number;
  department_id?: number; department_name?: string;
  status: string; requester_name?: string; approver_name?: string;
  budget_name?: string; budget_limit?: number; budget_used?: number;
  reject_reason?: string; created_at: string; approved_at?: string;
  workflow_status?: string; workflow_tasks?: WorkflowTask[];
  workflow_instance_id?: number;
}

interface ApproverInfo {
  user_id: number; name: string;
}

const CAT_MAP: Record<string, string> = { INSTRUMENT: "仪器仪表", VEHICLE: "车辆", OFFICE: "办公设备", TOOL: "工具" };
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "审批中", color: "bg-amber-100 text-amber-700" },
  approved: { label: "已批准", color: "bg-green-100 text-green-700" },
  rejected: { label: "已驳回", color: "bg-red-100 text-red-700" },
  ordered: { label: "已下单", color: "bg-blue-100 text-blue-700" },
  received: { label: "已入库", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "已取消", color: "bg-gray-100 text-gray-700" },
};

export default function AssetProcurementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const [form, setForm] = useState({ name: "", category: "OFFICE", quantity: "1", estimated_cost: "", reason: "", budget_id: "", department_id: "" });
  const [budgets, setBudgets] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [approvers, setApprovers] = useState<{ step1: ApproverInfo | null; step2: ApproverInfo | null }>({ step1: null, step2: null });
  const [submitMsg, setSubmitMsg] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    try {
      const r = await authFetch(`/api/assets/procurements?${params}`);
      const d = await r.json();
      if (d.success) setProcurements(d.data || []);
    } catch (err) { console.error("加载采购列表失败", err); }
    setLoading(false);
  };

  const fetchBudgets = async () => {
    try {
      const r = await authFetch("/api/budgets");
      const d = await r.json();
      if (d.success) setBudgets((d.data || []).filter((b: any) => b.status === "active"));
    } catch (err) { console.error("加载预算失败", err); }
  };

  const fetchDepartments = async () => {
    try {
      const r = await authFetch("/api/org/departments");
      const d = await r.json();
      if (d.success) setDepartments(d.data || []);
    } catch (err) { console.error("加载机构失败", err); }
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const handleCreate = async () => {
    if (!form.name || !form.category) return;
    try {
      const body: any = {
        name: form.name, category: form.category,
        quantity: parseInt(form.quantity) || 1,
        estimated_cost: parseFloat(form.estimated_cost) || 0,
        reason: form.reason || null,
        budget_id: form.budget_id ? parseInt(form.budget_id) : null,
      };
      if (form.department_id) body.department_id = parseInt(form.department_id);

      const r = await authFetch("/api/assets/procurements", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        setApprovers(d.approvers || { step1: null, step2: null });
        setSubmitMsg(d.message || "已提交");
        // 不清空弹窗，让它显示提交成功信息
      } else {
        alert(d.error || "提交失败");
        setShowCreate(false);
      }
    } catch (err) { console.error("创建采购失败", err); alert("提交失败"); }
    fetchData();
  };

  // 工作流审批（替代原 PUT 直改状态）
  const handleApprove = async (procurementId: number, result: string) => {
    const comment = result === "reject" ? prompt("请输入驳回原因（可选）：") : undefined;
    try {
      const r = await authFetch(`/api/assets/procurements/${procurementId}/approve`, {
        method: "POST",
        body: JSON.stringify({ result, comment: comment || undefined }),
      });
      const d = await r.json();
      if (d.success) alert(d.message || "操作成功");
      else alert(d.error || "操作失败");
    } catch (err) { console.error("审批失败", err); alert("审批失败"); }
    fetchData();
  };

  // 后续操作（下单/入库）
  const handleStatus = async (id: number, status: string) => {
    try {
      await authFetch(`/api/assets/procurements/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    } catch (err) { console.error("操作失败", err); }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确认删除此采购申请？")) return;
    try {
      await authFetch(`/api/assets/procurements/${id}`, { method: "DELETE" });
    } catch (err) { console.error("删除失败", err); }
    fetchData();
  };

  // 渲染工作流进度条
  const renderWorkflowProgress = (p: Procurement) => {
    if (!p.workflow_tasks || p.workflow_tasks.length === 0) return null;
    const tasks = p.workflow_tasks;

    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          {tasks.map((task, idx) => {
            let icon: React.ReactNode;
            let lineColor = "bg-gray-200";
            let dotColor = "border-gray-300 text-gray-400";

            if (task.status === "completed" && task.result === "approve") {
              icon = <Check size={11} />;
              dotColor = "border-green-500 text-green-600 bg-green-50";
              lineColor = "bg-green-400";
            } else if (task.status === "completed" && task.result === "reject") {
              icon = <X size={11} />;
              dotColor = "border-red-500 text-red-600 bg-red-50";
              lineColor = "bg-red-400";
            } else if (task.status === "pending") {
              icon = <Clock size={11} />;
              dotColor = "border-amber-500 text-amber-600 bg-amber-50";
              lineColor = "bg-gray-200";
            } else if (task.status === "waiting") {
              icon = <span className="text-[8px]">●</span>;
              dotColor = "border-gray-300 text-gray-300";
            }

            return (
              <div key={task.id} className="flex items-center gap-1.5">
                {idx > 0 && <div className={`w-5 h-0.5 ${lineColor}`} />}
                <div className="flex items-center gap-1">
                  <div className={`w-5 h-5 rounded-full border-2 ${dotColor} flex items-center justify-center text-[10px]`}>
                    {icon}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-text leading-tight">{task.title}</span>
                    <span className="text-[10px] text-text-muted leading-tight">
                      {task.assignee_name || "未指定"}
                      {task.status === "completed" && task.result === "approve" && " · 已通过"}
                      {task.status === "completed" && task.result === "reject" && " · 已驳回"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 获取当前待审批的任务
  const getCurrentTask = (p: Procurement): WorkflowTask | undefined => {
    return p.workflow_tasks?.find(t => t.status === "pending");
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/assets")} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white flex items-center gap-2"><ShoppingCart size={20} /> 资产采购</h1>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-border bg-bg-card shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm bg-white outline-none">
            <option value="">全部状态</option>
            <option value="pending">审批中</option>
            <option value="approved">已批准</option>
            <option value="rejected">已驳回</option>
            <option value="ordered">已下单</option>
            <option value="received">已入库</option>
          </select>
        </div>
        <button onClick={() => { setShowCreate(true); setSubmitMsg(""); setApprovers({ step1: null, step2: null }); fetchBudgets(); fetchDepartments(); }} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 font-medium">
          <Plus size={14} /> 采购申请
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted">加载中...</div>
        ) : procurements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-muted gap-2">
            <ShoppingCart size={32} className="text-text-muted/40" />
            <p className="text-sm">暂无采购申请</p>
          </div>
        ) : (
          <div className="space-y-3">
            {procurements.map(p => {
              const currentTask = getCurrentTask(p);
              const canApprove = isAdmin ||
                (currentTask && currentTask.assignee_id === user?.id);

              return (
                <div key={p.id} className="bg-bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-text">{p.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_MAP[p.status]?.color || "bg-gray-100 text-gray-700"}`}>
                          {STATUS_MAP[p.status]?.label || p.status}
                        </span>
                        {p.workflow_status === "running" && p.status === "pending" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600 flex items-center gap-0.5">
                            <AlertCircle size={10} />
                            {currentTask ? currentTask.title : "审批中"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span>{CAT_MAP[p.category] || p.category}</span>
                        <span>×{p.quantity}</span>
                        <span className="text-violet-600 font-medium">¥{p.estimated_cost?.toLocaleString()}</span>
                        {p.department_name && <span className="text-text-muted/60">{p.department_name}</span>}
                        {p.budget_name && <span className="text-text-muted/60">预算: {p.budget_name}</span>}
                      </div>
                      {p.reason && <p className="text-xs text-text-muted mt-1.5">理由: {p.reason}</p>}
                      {p.reject_reason && <p className="text-xs text-red-500 mt-1">驳回原因: {p.reject_reason}</p>}

                      {/* 工作流审批进度 */}
                      {renderWorkflowProgress(p)}

                      <div className="flex items-center gap-3 text-[11px] text-text-muted/60 mt-2">
                        <span>{p.requester_name || "未知"} 提交</span>
                        <span>{p.created_at?.split("T")[0]}</span>
                        {p.approver_name && <span>· {p.approver_name} {p.status === "rejected" ? "驳回" : "审批"}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      {/* 工作流审批按钮（仅当前审批人或管理员可见） */}
                      {p.status === "pending" && currentTask && canApprove && (
                        <>
                          <button onClick={() => handleApprove(p.id, "approve")} className="w-7 h-7 rounded-lg bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200" title={`批准 · ${currentTask.title}`}>
                            <Check size={14} />
                          </button>
                          <button onClick={() => handleApprove(p.id, "reject")} className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200" title={`驳回 · ${currentTask.title}`}>
                            <X size={14} />
                          </button>
                        </>
                      )}

                      {/* 后续操作（下单/入库 — 仅管理员） */}
                      {isAdmin && p.status === "approved" && (
                        <>
                          <button onClick={() => handleStatus(p.id, "ordered")} className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200" title="标记已下单">
                            <Truck size={14} />
                          </button>
                          <button onClick={() => handleStatus(p.id, "received")} className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200" title="标记已入库">
                            <Package size={14} />
                          </button>
                        </>
                      )}
                      {isAdmin && p.status === "ordered" && (
                        <button onClick={() => handleStatus(p.id, "received")} className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200" title="标记已入库">
                          <Package size={14} />
                        </button>
                      )}

                      {/* 删除（仅 pending/approved/rejected 且管理员） */}
                      {isAdmin && ["pending", "approved", "rejected"].includes(p.status) && (
                        <button onClick={() => handleDelete(p.id)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-100 hover:text-red-500" title="删除">
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => { setShowCreate(false); setSubmitMsg(""); }} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-card rounded-2xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto z-50" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <ShoppingCart size={16} className="text-violet-600" />
                {submitMsg ? "提交成功" : "采购申请"}
              </h3>
              <button onClick={() => { setShowCreate(false); setSubmitMsg(""); }} className="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-text-muted hover:text-text"><X size={16} /></button>
            </div>

            {submitMsg ? (
              /* 提交成功 */
              <div className="px-5 py-6 text-center space-y-4">
                <div className="w-14 h-14 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <Check size={28} className="text-green-600" />
                </div>
                <p className="text-sm font-medium text-text">{submitMsg}</p>
                {(approvers.step1 || approvers.step2) && (
                  <div className="bg-violet-50 rounded-lg p-3 text-left">
                    <p className="text-xs font-medium text-violet-700 mb-2">审批流程</p>
                    <div className="space-y-1.5 text-xs">
                      {approvers.step1 && (
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center text-[10px] font-bold">1</span>
                          <span className="text-violet-700">直管领导审核：<strong>{approvers.step1.name}</strong></span>
                        </div>
                      )}
                      {approvers.step2 && (
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center text-[10px] font-bold">2</span>
                          <span className="text-violet-700">分管领导审批：<strong>{approvers.step2.name}</strong></span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-violet-500 mt-2">审批人将收到系统通知，可在线审核/审批</p>
                  </div>
                )}
                <button
                  onClick={() => { setShowCreate(false); setSubmitMsg(""); setForm({ name: "", category: "OFFICE", quantity: "1", estimated_cost: "", reason: "", budget_id: "", department_id: "" }); }}
                  className="px-5 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 font-medium"
                >完成</button>
              </div>
            ) : (
              /* 表单 */
              <>
                <div className="px-5 py-4 space-y-3">
                  {/* 基本信息 */}
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">基本信息</p>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">物品名称 *</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-violet-500" placeholder="如：全站仪、压力试验机" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">分类</label>
                      <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none bg-white">
                        {Object.entries(CAT_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">数量</label>
                      <input value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} type="number" min="1" className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-violet-500" />
                    </div>
                  </div>
                  {/* 费用与归属 */}
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider pt-1">费用与归属</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">预估预算 (¥)</label>
                      <input value={form.estimated_cost} onChange={e => setForm({ ...form, estimated_cost: e.target.value })} type="number" min="0" className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-violet-500" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">申请部门</label>
                      <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none bg-white">
                        <option value="">选择部门</option>
                        {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                  {budgets.length > 0 && (
                    <div>
                      <label className="block text-xs text-text-muted mb-1">关联预算科目</label>
                      <select value={form.budget_id} onChange={e => setForm({ ...form, budget_id: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none bg-white">
                        <option value="">不关联</option>
                        {budgets.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name} (总额 ¥{b.limit_amount?.toLocaleString()}, 已用 ¥{(b.used_amount || 0).toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* 采购理由 */}
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider pt-1">采购理由</p>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">请详细说明采购原因 *</label>
                    <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={3} className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-violet-500 resize-none" placeholder="请详细说明：采购用途、紧急程度、是否影响项目进度等..." />
                  </div>
                </div>
                <div className="flex gap-2 justify-end px-5 py-4 border-t border-border">
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-text-muted hover:bg-bg rounded-lg">取消</button>
                  <button onClick={handleCreate} disabled={!form.name} className="px-5 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 font-medium disabled:opacity-50">提交申请</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

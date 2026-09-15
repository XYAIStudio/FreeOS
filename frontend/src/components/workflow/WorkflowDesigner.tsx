import { useState, useEffect } from "react";
import { Layout, FileText, Grid3X3, Save, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import FormDesigner, { FormPreview } from "./FormDesigner";
import FlowDesigner from "./FlowDesigner";
import type { FlowDefinition, FormField } from "./types";
import { authFetch } from "../../api/authFetch";

interface Props {
  onBack?: () => void;
  editId?: number; // 编辑已有模板
}

// 默认节点：开始→审批→结束
const DEFAULT_FLOW: FlowDefinition = {
  version: 2,
  nodes: [
    { id: "start", type: "start", title: "发起", config: {} },
    { id: "node_1", type: "approval", title: "审批", config: { signMode: "all", approvers: [{ mode: "department_head", value: "", label: "部门负责人" }], rejectStrategy: "back_to_start", allowDelegate: true, allowAddSign: true } },
    { id: "end", type: "end", title: "完成", config: { notifyRoles: ["audit_supervision", "it"] } },
  ],
  edges: [{ from: "start", to: "node_1" }, { from: "node_1", to: "end" }],
};

export default function WorkflowDesigner({ onBack, editId }: Props) {
  const [step, setStep] = useState<"flow" | "form">("flow");
  const [flowDef, setFlowDef] = useState<FlowDefinition>(DEFAULT_FLOW);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCategories();
    if (editId) loadDefinition(editId);
  }, [editId]);

  const loadCategories = async () => {
    try {
      const res = await authFetch("/api/workflows-v2/categories");
      const json = await res.json();
      if (json.success) setCategories(json.data);
    } catch {}
  };

  const loadDefinition = async (id: number) => {
    try {
      const res = await authFetch(`/api/workflows-v2/definitions/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setName(json.data.name || "");
        setDesc(json.data.description || "");
        setCategoryId(json.data.category_id);
        if (json.data.flowDef) setFlowDef(json.data.flowDef);
        if (json.data.formSchema) setFormFields(json.data.formSchema);
      }
    } catch {}
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("请填写流程名称"); return; }
    if (flowDef.nodes.length < 2) { setError("至少需要开始和结束节点"); return; }

    setSaving(true);
    setError("");
    try {
      const body: any = {
        name: name.trim(),
        description: desc.trim(),
        definition: flowDef,
        status: "active",
        formSchema: formFields.length > 0 ? formFields : undefined,
      };
      if (categoryId) body.categoryId = categoryId;

      const url = editId
        ? `/api/workflows-v2/definitions/${editId}`
        : "/api/workflows-v2/definitions";
      const method = editId ? "PUT" : "POST";
      const res = await authFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onBack?.();
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally { setSaving(false); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-card shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-1 text-xs text-text-muted hover:text-text">
              <ArrowLeft size={14} /> 返回
            </button>
          )}
          <h2 className="text-sm font-bold text-text">
            {editId ? "编辑流程模板" : "新建流程模板"}
          </h2>
          <div className="flex items-center gap-1 bg-bg rounded p-0.5">
            <button onClick={() => setStep("flow")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors ${step === "flow" ? "bg-white text-text shadow-sm" : "text-text-muted hover:text-text"}`}>
              <Grid3X3 size={12} /> 流程设计
            </button>
            <button onClick={() => setStep("form")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors ${step === "form" ? "bg-white text-text shadow-sm" : "text-text-muted hover:text-text"}`}>
              <Layout size={12} /> 表单设计
            </button>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-primary rounded hover:opacity-90 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? "保存中..." : "保存并启用"}
        </button>
      </div>

      {/* 基本信息 */}
      <div className="flex items-end gap-3 px-5 py-3 border-b border-border/50 bg-bg-card/50 shrink-0">
        <div className="flex-1 max-w-xs">
          <label className="text-[10px] text-text-muted block mb-1">流程名称 <span className="text-red-400">*</span></label>
          <input value={name} onChange={e => { setName(e.target.value); setError(""); }}
            className="w-full px-3 py-1.5 border border-border rounded text-xs outline-none focus:border-primary"
            placeholder="例：请假审批流程" />
        </div>
        <div className="flex-1 max-w-xs">
          <label className="text-[10px] text-text-muted block mb-1">分类</label>
          <select value={categoryId || ""} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-white">
            <option value="">未分类</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.icon || ""} {c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-text-muted block mb-1">描述</label>
          <input value={desc} onChange={e => setDesc(e.target.value)}
            className="w-full px-3 py-1.5 border border-border rounded text-xs outline-none focus:border-primary"
            placeholder="流程描述（可选）" />
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 shrink-0">{error}</div>
      )}

      {/* 工作区 */}
      <div className="flex-1 overflow-hidden">
        {step === "flow" ? (
          <FlowDesigner definition={flowDef} onChange={setFlowDef} />
        ) : (
          <div className="h-full flex">
            <div className="flex-1 overflow-auto p-5">
              <FormDesigner fields={formFields as any} onChange={setFormFields} />
            </div>
            <div className="w-[320px] border-l border-border bg-bg-card p-4 overflow-auto shrink-0">
              <div className="text-xs font-medium text-text-muted mb-3 flex items-center gap-1">
                <FileText size={12} /> 表单预览
              </div>
              <div className="bg-bg rounded-lg p-4 border border-border">
                <FormPreview fields={formFields as any} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

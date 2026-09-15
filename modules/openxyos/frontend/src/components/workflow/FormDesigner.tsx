import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Copy, ChevronDown, ChevronUp, Eye, EyeOff, Save } from "lucide-react";

// ============================================================
// 类型 (与 backend/services/workflow-types.ts 保持同步)
// ============================================================

type FieldType = "text" | "textarea" | "number" | "amount" | "date" | "dateRange" | "select" | "radio" | "checkbox" | "userPicker" | "deptPicker" | "projectPicker" | "image" | "attachment" | "divider" | "description";

interface FormField {
  key: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  defaultValue?: any;
  options?: { label: string; value: string }[];
  validation?: { min?: number; max?: number; pattern?: string; message?: string };
  autoCompute?: { formula: string; dependsOn: string[] };
  conditionRules?: { field: string; op: string; value: any; action: "show" | "hide" | "require" }[];
  attachmentConfig?: { accept: string[]; maxSize: number; maxCount: number };
  layout?: { colSpan: 1 | 2; group?: string };
  nodePermissions?: Record<string, "edit" | "readonly" | "hidden">;
}

// 监理行业字段组预设
const FIELD_GROUPS: { name: string; fields: FormField[] }[] = [
  {
    name: "监理日志字段组",
    fields: [
      { key: "log_date", type: "date", label: "日期", required: true, placeholder: "选择日期" },
      { key: "weather", type: "select", label: "天气", required: true, options: [{ label: "晴", value: "晴" }, { label: "阴", value: "阴" }, { label: "雨", value: "雨" }, { label: "雪", value: "雪" }] },
      { key: "contractor", type: "text", label: "施工单位", required: true },
      { key: "work_area", type: "text", label: "施工部位", required: true },
      { key: "work_content", type: "textarea", label: "施工内容", required: true },
      { key: "supervision_content", type: "textarea", label: "监理工作内容", required: true },
      { key: "issues", type: "textarea", label: "存在问题及处理", required: false },
      { key: "photos", type: "image", label: "现场照片", required: false, attachmentConfig: { accept: ["jpg", "png", "jpeg"], maxSize: 10, maxCount: 9 } },
    ],
  },
  {
    name: "整改通知单字段组",
    fields: [
      { key: "corrected_unit", type: "text", label: "被整改单位", required: true },
      { key: "corrected_area", type: "text", label: "整改部位", required: true },
      { key: "problem_desc", type: "textarea", label: "问题描述", required: true },
      { key: "violation_clause", type: "text", label: "违反规范条款", required: true },
      { key: "correction_requirement", type: "textarea", label: "整改要求", required: true },
      { key: "deadline", type: "date", label: "限改日期", required: true },
      { key: "problem_photos", type: "image", label: "问题照片", required: false },
      { key: "review_requirement", type: "textarea", label: "复查要求", required: false },
    ],
  },
];

const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: "text", label: "单行文本", icon: "Aa" },
  { type: "textarea", label: "多行文本", icon: "📝" },
  { type: "number", label: "数字", icon: "#" },
  { type: "amount", label: "金额", icon: "¥" },
  { type: "date", label: "日期", icon: "📅" },
  { type: "dateRange", label: "日期范围", icon: "📆" },
  { type: "select", label: "下拉选择", icon: "📋" },
  { type: "radio", label: "单选", icon: "⭕" },
  { type: "checkbox", label: "多选", icon: "☑" },
  { type: "userPicker", label: "人员选择", icon: "👤" },
  { type: "deptPicker", label: "组织选择", icon: "🏢" },
  { type: "projectPicker", label: "项目关联", icon: "🏗" },
  { type: "image", label: "图片上传", icon: "🖼" },
  { type: "attachment", label: "附件上传", icon: "📎" },
  { type: "divider", label: "分隔线", icon: "—" },
  { type: "description", label: "说明文字", icon: "ℹ" },
];

interface Props {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  readOnly?: boolean;
}

export default function FormDesigner({ fields, onChange, readOnly }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const addField = (type: FieldType) => {
    const ft = FIELD_TYPES.find(f => f.type === type)!;
    const newField: FormField = {
      key: `field_${Date.now()}`,
      type,
      label: ft.label,
      required: false,
      placeholder: "",
      layout: { colSpan: 1 },
    };
    if (type === "select" || type === "radio" || type === "checkbox") {
      newField.options = [{ label: "选项1", value: "1" }];
    }
    if (type === "attachment" || type === "image") {
      newField.attachmentConfig = { accept: ["pdf", "jpg"], maxSize: 10, maxCount: 1 };
    }
    onChange([...fields, newField]);
    setEditingIdx(fields.length);
  };

  const addFieldGroup = (group: typeof FIELD_GROUPS[0]) => {
    const newFields = group.fields.map(f => ({
      ...f,
      key: `${f.key}_${Date.now()}`,
    }));
    onChange([...fields, ...newFields]);
  };

  const removeField = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  const updateField = (idx: number, updates: Partial<FormField>) => {
    const copy = [...fields];
    copy[idx] = { ...copy[idx], ...updates };
    onChange(copy);
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    const copy = [...fields];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    onChange(copy);
  };

  const duplicateField = (idx: number) => {
    const copy = { ...fields[idx], key: `${fields[idx].key}_copy_${Date.now()}`, label: `${fields[idx].label}(副本)` };
    const newFields = [...fields];
    newFields.splice(idx + 1, 0, copy);
    onChange(newFields);
  };

  return (
    <div className="flex h-full gap-4">
      {/* 左侧字段列表 */}
      <div className="flex-1 overflow-auto space-y-2 pr-2">
        {fields.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <Plus size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">暂无字段</p>
            <p className="text-xs">从右侧添加字段</p>
          </div>
        )}

        {fields.map((field, idx) => (
          <div key={field.key}
            className={`border rounded-lg transition-all ${
              editingIdx === idx ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-bg-card hover:border-primary/30"
            }`}>
            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}>
              <GripVertical size={14} className="text-text-muted cursor-grab" />
              <span className="text-xs font-medium text-text flex-1">
                {field.required && <span className="text-red-500 mr-1">*</span>}
                {field.label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg text-text-muted">
                {FIELD_TYPES.find(f => f.type === field.type)?.label || field.type}
              </span>
              {editingIdx === idx ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {!readOnly && (
                <button onClick={(e) => { e.stopPropagation(); removeField(idx); }}
                  className="p-0.5 text-text-muted hover:text-red-500 rounded">
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {editingIdx === idx && (
              <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-text-muted">字段标识</label>
                    <input value={field.key} onChange={e => updateField(idx, { key: e.target.value })}
                      className="w-full px-2 py-1 border border-border rounded text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-muted">类型</label>
                    <select value={field.type} onChange={e => updateField(idx, { type: e.target.value as FieldType })}
                      className="w-full px-2 py-1 border border-border rounded text-xs">
                      {FIELD_TYPES.map(ft => (
                        <option key={ft.type} value={ft.type}>{ft.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-text-muted">标签</label>
                    <input value={field.label} onChange={e => updateField(idx, { label: e.target.value })}
                      className="w-full px-2 py-1 border border-border rounded text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-muted">占位文字</label>
                    <input value={field.placeholder || ""} onChange={e => updateField(idx, { placeholder: e.target.value })}
                      className="w-full px-2 py-1 border border-border rounded text-xs" />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={field.required} onChange={e => updateField(idx, { required: e.target.checked })}
                      className="rounded" />
                    必填
                  </label>
                </div>

                {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
                  <div>
                    <label className="text-[10px] text-text-muted">选项（每行一个，格式: label|value）</label>
                    <textarea
                      value={(field.options || []).map(o => `${o.label}|${o.value}`).join("\n")}
                      onChange={e => {
                        const opts = e.target.value.split("\n").filter(Boolean).map(line => {
                          const [label, value] = line.split("|");
                          return { label: label.trim(), value: (value || label).trim() };
                        });
                        updateField(idx, { options: opts });
                      }}
                      className="w-full px-2 py-1 border border-border rounded text-xs h-16 resize-none"
                    />
                  </div>
                )}

                <div className="flex gap-1">
                  {!readOnly && (
                    <>
                      <button onClick={() => moveField(idx, -1)} disabled={idx === 0}
                        className="px-2 py-0.5 text-[10px] border border-border rounded hover:bg-bg disabled:opacity-30">
                        <ChevronUp size={10} className="inline" /> 上移
                      </button>
                      <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1}
                        className="px-2 py-0.5 text-[10px] border border-border rounded hover:bg-bg disabled:opacity-30">
                        <ChevronDown size={10} className="inline" /> 下移
                      </button>
                      <button onClick={() => duplicateField(idx)}
                        className="px-2 py-0.5 text-[10px] border border-border rounded hover:bg-bg">
                        <Copy size={10} className="inline" /> 复制
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 右侧工具栏 */}
      {!readOnly && (
        <div className="w-48 shrink-0 space-y-3">
          {/* 字段类型 */}
          <div className="bg-bg-card border border-border rounded-lg p-3">
            <h4 className="text-xs font-medium text-text mb-2">添加字段</h4>
            <div className="space-y-1">
              {FIELD_TYPES.map(ft => (
                <button key={ft.type} onClick={() => addField(ft.type)}
                  className="w-full text-left px-2 py-1 text-xs text-text-muted hover:bg-bg hover:text-text rounded transition-colors">
                  <span className="mr-1">{ft.icon}</span> {ft.label}
                </button>
              ))}
            </div>
          </div>

          {/* 监理行业字段组 */}
          <div className="bg-bg-card border border-border rounded-lg p-3">
            <h4 className="text-xs font-medium text-text mb-2">监理字段组</h4>
            <div className="space-y-1">
              {FIELD_GROUPS.map(g => (
                <button key={g.name} onClick={() => addFieldGroup(g)}
                  className="w-full text-left px-2 py-1.5 text-xs text-text-muted hover:bg-primary/5 hover:text-primary rounded transition-colors border border-border">
                  <span className="mr-1">📋</span> {g.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 表单实时预览组件
export function FormPreview({ fields, values }: { fields: FormField[]; values?: Record<string, any> }) {
  return (
    <div className="bg-white border border-border rounded-lg p-4 max-w-lg">
      <div className="space-y-3">
        {fields.map(field => {
          if (field.type === "divider") return <hr key={field.key} className="border-border" />;
          if (field.type === "description") return <p key={field.key} className="text-xs text-text-muted">{field.label}</p>;

          return (
            <div key={field.key} className={field.layout?.colSpan === 2 ? "col-span-2" : ""}>
              <label className="text-xs font-medium text-text block mb-1">
                {field.required && <span className="text-red-500 mr-0.5">*</span>}
                {field.label}
              </label>

              {field.type === "textarea" ? (
                <textarea placeholder={field.placeholder} rows={3}
                  className="w-full px-2 py-1.5 border border-border rounded text-xs resize-none"
                  value={values?.[field.key] || ""} readOnly />
              ) : field.type === "select" ? (
                <select className="w-full px-2 py-1.5 border border-border rounded text-xs">
                  {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : field.type === "radio" ? (
                <div className="flex gap-3">
                  {field.options?.map(o => (
                    <label key={o.value} className="flex items-center gap-1 text-xs">
                      <input type="radio" name={field.key} value={o.value} /> {o.label}
                    </label>
                  ))}
                </div>
              ) : field.type === "checkbox" ? (
                <div className="flex gap-3">
                  {field.options?.map(o => (
                    <label key={o.value} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" /> {o.label}
                    </label>
                  ))}
                </div>
              ) : field.type === "userPicker" || field.type === "deptPicker" || field.type === "projectPicker" ? (
                <input placeholder={field.placeholder || `请选择${field.label}`}
                  className="w-full px-2 py-1.5 border border-border rounded text-xs text-text-muted" readOnly />
              ) : field.type === "image" || field.type === "attachment" ? (
                <div className="border border-dashed border-border rounded p-3 text-center text-xs text-text-muted">
                  📎 点击上传{(field.attachmentConfig?.accept || []).join(", ")}
                </div>
              ) : (
                <input type={field.type === "number" || field.type === "amount" ? "number" : field.type === "date" ? "date" : "text"}
                  placeholder={field.placeholder}
                  className="w-full px-2 py-1.5 border border-border rounded text-xs"
                  value={values?.[field.key] || ""} readOnly />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

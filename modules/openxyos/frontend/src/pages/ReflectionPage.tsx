import { useState, useEffect, useCallback } from "react";
import { Brain, Plus, RefreshCw, Trash2, Shield, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { authFetch } from "../api/authFetch";
import { useLocale } from "../i18n";

interface Reflection {
  id: number; employee_id: number; task_id: number | null;
  reflection_type: string; success_factors: string | null;
  failure_reasons: string | null; knowledge_gaps: string | null;
  improvement_plans: string | null; extracted_skills: string | null;
  learned_knowledge: string | null; importance_score: number;
  created_at: string;
}

const REFLECTION_TYPES: Record<string, string> = {
  task_completion: "任务完成", error_learning: "错误学习", knowledge_capture: "知识沉淀", improvement: "改进计划",
} as const;
const REFLECTION_TYPE_COLORS: Record<string, string> = {
  task_completion: "bg-success/10 text-success", error_learning: "bg-danger/10 text-danger",
  knowledge_capture: "bg-primary/10 text-primary", improvement: "bg-warning/10 text-warning",
};

/** 系统部署铁律 — 从反思中提炼的不可违背规则 */
const DEPLOYMENT_LAWS = [
  { id: 1, rule: ["TypeScript 编译检查：部署前必须 npx tsc --noEmit", "TypeScript compilation: run npx tsc --noEmit before deployment"], detail: ["比 read_lints 更严，能抓 const 死区、类型不匹配、缺失导入", "Stricter than read_lints; catches temporal-dead-zone errors, type mismatches, and missing imports"] },
  { id: 2, rule: ["re-read 上下文：每次 replace_in_file 后重读改动位置前后 10 行", "Re-read context: inspect 10 lines around every replace_in_file edit"], detail: ["确认变量声明顺序、导入完整性、引用存在性", "Confirm declaration order, complete imports, and valid references"] },
  { id: 3, rule: ["分批验证：改 5+ 文件时按模块分批 build", "Validate in batches: build by module when changing 5+ files"], detail: ["不在全部改完后再 build，问题早发现早解决", "Do not wait for every edit; find and fix issues early"] },
  { id: 4, rule: ["本地冒烟：关键页面改完后 vite 预览确认不白屏", "Local smoke test: preview key pages in Vite after edits"], detail: ["员工详情、员工列表、聊天页至少点一遍", "Open employee detail, people list, and chat at least once"] },
  { id: 5, rule: ["部署后验证文件状态：确认 dist/avatars/ 文件数 = 53", "After deployment, verify expected file state"], detail: ["plink 查看文件清单，清理残留源文件", "Review the file list and remove residual source artifacts"] },
  { id: 6, rule: ["部署后验证 PM2 日志：确认无启动错误", "After deployment, verify service logs have no startup errors"], detail: ["pm2 logs --lines 20 --nostream，排查 Cannot find module / ReferenceError", "Inspect recent logs for Cannot find module or ReferenceError failures"] },
  { id: 7, rule: ["浏览器最终验证：关键页面逐个确认", "Final browser validation: confirm each critical page"], detail: ["员工详情可打开、头像正常显示、权限控制正确", "Verify employee details open, avatars render, and permissions are correct"] },
] as const;

export default function ReflectionPage() {
  const { t, isEnglish } = useLocale();
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLaws, setShowLaws] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newReflection, setNewReflection] = useState({
    employee_id: 0, reflection_type: "task_completion", success_factors: "",
    failure_reasons: "", knowledge_gaps: "", improvement_plans: "",
    extracted_skills: "", learned_knowledge: "", importance_score: 50
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rRes = await authFetch("/api/reflections/reflections").then(r => r.json());
      if (rRes.success) setReflections(rRes.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!newReflection.employee_id) return;
    await authFetch("/api/reflections/reflections", {
      method: "POST",
      body: JSON.stringify(newReflection),
    });
    setNewReflection({
      employee_id: 0, reflection_type: "task_completion", success_factors: "",
      failure_reasons: "", knowledge_gaps: "", improvement_plans: "",
      extracted_skills: "", learned_knowledge: "", importance_score: 50
    });
    setShowCreate(false);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("确定删除此反思记录？", "Delete this reflection?"))) return;
    await authFetch(`/api/reflections/reflections/${id}`, { method: "DELETE" });
    fetchData();
  };

  const getImportanceColor = (score: number) => {
    if (score >= 80) return "text-danger";
    if (score >= 60) return "text-warning";
    if (score >= 40) return "text-primary";
    return "text-text-muted";
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-accent" />
          <h1 className="text-lg font-semibold">{t("反思引擎", "Reflection Engine")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 text-text-muted hover:text-text hover:bg-surface rounded-lg">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-sm [border-radius:1.5px]">
            <Plus size={14} /> {t("新建反思", "New reflection")}
          </button>
        </div>
      </div>

      {/* 系统铁律 — 从反思中提炼的不可违背规则 */}
      <div className="px-4 py-2 border-b border-border/30">
        <button onClick={() => setShowLaws(v => !v)} className="flex items-center gap-2 w-full py-2 text-sm text-text-secondary hover:text-text">
          <Shield size={14} className="text-warning" />
          <span className="font-medium">{t("系统部署铁律（7条）", "Deployment principles (7)")}</span>
          <span className="text-text-muted text-xs">{t("— 错误反思 · 不可违背", "— lessons learned · non-negotiable")}</span>
          {showLaws ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
        </button>
        {showLaws && (
          <div className="grid grid-cols-1 gap-1.5 pb-2">
            {DEPLOYMENT_LAWS.map(law => (
              <div key={law.id} className="flex items-start gap-2 px-3 py-1.5 bg-surface/20 rounded text-xs">
                <CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-text">{isEnglish ? law.rule[1] : law.rule[0]}</span>
                  <span className="text-text-muted ml-2">{isEnglish ? law.detail[1] : law.detail[0]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="px-4 py-3 border-b border-border/30 bg-surface/30">
          <div className="flex flex-col gap-2 max-w-xl">
            <div className="flex gap-2">
              <input type="number" value={newReflection.employee_id || ""} onChange={e => setNewReflection(p => ({ ...p, employee_id: Number(e.target.value) }))}
                placeholder={t("员工ID", "Employee ID")} className="w-24 px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
              <select value={newReflection.reflection_type} onChange={e => setNewReflection(p => ({ ...p, reflection_type: e.target.value }))}
                className="px-3 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]">
                <option value="task_completion">{t("任务完成", "Task completion")}</option>
                <option value="error_learning">{t("错误学习", "Error learning")}</option>
                <option value="knowledge_capture">{t("知识沉淀", "Knowledge capture")}</option>
                <option value="improvement">{t("改进计划", "Improvement plan")}</option>
              </select>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">{t("重要性", "Importance")}</span>
                <input type="number" min="0" max="100" value={newReflection.importance_score}
                  onChange={e => setNewReflection(p => ({ ...p, importance_score: Number(e.target.value) }))}
                  className="w-16 px-2 py-2 bg-bg border border-border/50 text-sm [border-radius:1.5px]" />
              </div>
            </div>
            <textarea value={newReflection.success_factors} onChange={e => setNewReflection(p => ({ ...p, success_factors: e.target.value }))}
              placeholder={t("成功因素", "Success factors")} rows={2} className="px-3 py-2 bg-bg border border-border/50 text-sm resize-none [border-radius:1.5px]" />
            <textarea value={newReflection.failure_reasons} onChange={e => setNewReflection(p => ({ ...p, failure_reasons: e.target.value }))}
              placeholder={t("失败原因", "Failure reasons")} rows={2} className="px-3 py-2 bg-bg border border-border/50 text-sm resize-none [border-radius:1.5px]" />
            <textarea value={newReflection.improvement_plans} onChange={e => setNewReflection(p => ({ ...p, improvement_plans: e.target.value }))}
              placeholder={t("改进计划", "Improvement plan")} rows={2} className="px-3 py-2 bg-bg border border-border/50 text-sm resize-none [border-radius:1.5px]" />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-primary text-white text-sm [border-radius:1.5px]">{t("创建", "Create")}</button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-text-muted text-sm hover:bg-surface [border-radius:1.5px]">{t("取消", "Cancel")}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted">{t("加载中...", "Loading...")}</div>
        ) : reflections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-muted">
            <Brain size={32} className="mb-2 opacity-30" />
            <span>{t("暂无反思记录", "No reflections yet")}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {reflections.map(ref => (
              <div key={ref.id} className="bg-bg-card border border-border/30 p-4 [border-radius:1.5px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 [border-radius:1.5px] ${REFLECTION_TYPE_COLORS[ref.reflection_type]}`}>
                      {REFLECTION_TYPES[ref.reflection_type]}
                    </span>
                    <span className="text-sm font-medium">{t("员工 #", "Employee #")}{ref.employee_id}</span>
                    {ref.task_id && <span className="text-xs text-text-muted">{t("任务 #", "Task #")}{ref.task_id}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${getImportanceColor(ref.importance_score)}`}>
                      {t("重要性: ", "Importance: ")}{ref.importance_score}
                    </span>
                    <button onClick={() => handleDelete(ref.id)} className="text-text-muted hover:text-danger p-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {ref.success_factors && (
                    <div className="p-2 bg-success/5 rounded">
                      <div className="text-success font-medium mb-1">{t("成功因素", "Success factors")}</div>
                      <div className="text-text-muted">{ref.success_factors}</div>
                    </div>
                  )}
                  {ref.failure_reasons && (
                    <div className="p-2 bg-danger/5 rounded">
                      <div className="text-danger font-medium mb-1">{t("失败原因", "Failure reasons")}</div>
                      <div className="text-text-muted">{ref.failure_reasons}</div>
                    </div>
                  )}
                  {ref.improvement_plans && (
                    <div className="p-2 bg-warning/5 rounded">
                      <div className="text-warning font-medium mb-1">{t("改进计划", "Improvement plan")}</div>
                      <div className="text-text-muted">{ref.improvement_plans}</div>
                    </div>
                  )}
                  {ref.extracted_skills && (
                    <div className="p-2 bg-primary/5 rounded">
                      <div className="text-primary font-medium mb-1">{t("提取技能", "Extracted skills")}</div>
                      <div className="text-text-muted">{ref.extracted_skills}</div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-text-muted mt-2">{new Date(ref.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

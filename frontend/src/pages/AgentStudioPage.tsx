import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bot, Check, Database, FileText, LoaderCircle, Plus, ShieldCheck, Sparkles, Upload, Users } from "lucide-react";
import { authFetch } from "../api/authFetch";
import { useLocale } from "../i18n";

interface ReferenceFile { id: number; original_name: string; file_type: string; file_size: number; scan_status: string }
interface Result { talent_id: number; status: string; ima_status: string; next_step: string }

const STEPS = ["角色定义", "经验与资料", "能力与边界", "生成并入市"];
const SUGGESTED = [["知识库查询", "Knowledge lookup"], ["行业问答", "Industry Q&A"], ["风险提示", "Risk alerts"], ["对比分析", "Comparative analysis"], ["报告生成", "Report generation"], ["方案建议", "Recommendations"]] as const;

export default function AgentStudioPage() {
  const navigate = useNavigate();
  const { t, isEnglish } = useLocale();
  const steps = isEnglish ? ["Define role", "Experience & references", "Capabilities & boundaries", "Generate & publish"] : STEPS;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", industry: "", positioning: "", experience: "", ima_url: "", capabilities: [] as string[] });
  const [capabilityDraft, setCapabilityDraft] = useState("");
  const [references, setReferences] = useState<ReferenceFile[]>([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    void authFetch("/api/agent-studio/references").then(r => r.json()).then(data => {
      if (data.success) setReferences(data.data || []);
    }).catch(() => {});
  }, []);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(form.name.trim() && form.industry.trim() && form.positioning.trim());
    if (step === 1) return Boolean(form.experience.trim() || selectedReferenceIds.length || form.ima_url.trim());
    if (step === 2) return form.capabilities.length > 0;
    return true;
  }, [step, form, selectedReferenceIds]);

  const addCapability = (value: string) => {
    const clean = value.trim();
    if (!clean || form.capabilities.includes(clean)) return;
    setForm(current => ({ ...current, capabilities: [...current.capabilities, clean].slice(0, 16) }));
    setCapabilityDraft("");
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true); setError("");
    try {
      const created: ReferenceFile[] = [];
      for (const file of Array.from(files)) {
        const body = new FormData(); body.append("file", file);
        const response = await authFetch("/api/agent-studio/references", { method: "POST", body });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || t(`${file.name} 上传失败`, `${file.name} upload failed`));
        created.push({ id: Number(data.data.id), original_name: data.data.name, file_type: file.name.split(".").pop() || "", file_size: data.data.size, scan_status: data.data.scan });
      }
      setReferences(current => [...created, ...current]);
      setSelectedReferenceIds(current => [...new Set([...current, ...created.map(file => file.id)])]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("参考资料上传失败", "Reference upload failed"));
    } finally { setUploading(false); }
  };

  const generate = async () => {
    setGenerating(true); setError("");
    try {
      const response = await authFetch("/api/agent-studio/generate", {
        method: "POST",
        body: JSON.stringify({ ...form, reference_ids: selectedReferenceIds }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || t("智能体生成失败", "Agent generation failed"));
      setResult(data.data); setStep(3);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : t("智能体生成失败", "Agent generation failed"));
    } finally { setGenerating(false); }
  };

  return <div className="p-5 md:p-7 max-w-6xl mx-auto">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-cyan-500 text-white flex items-center justify-center"><Bot size={23}/></div>
      <div><h1 className="text-xl font-bold text-text">{t("智能体定制", "Agent Studio")}</h1><p className="text-xs text-text-muted mt-1">{t("把行业经验、参考资料与知识库组合成可治理的顾问型智能体", "Combine industry experience, references, and knowledge into a governed consultant agent")}</p></div>
    </div>

    <div className="grid lg:grid-cols-[220px_1fr] gap-5">
      <aside className="bg-bg-card border border-border rounded-xl p-4 h-fit">
        <p className="text-xs font-semibold text-text-muted mb-4">{t("创建流程", "Creation flow")}</p>
        <div className="space-y-2">{steps.map((label, index) => <div key={label} className={`flex items-center gap-3 p-2.5 rounded-lg text-sm ${index === step ? "bg-primary/10 text-primary font-medium" : index < step ? "text-success" : "text-text-muted"}`}><span className={`w-6 h-6 rounded-full grid place-items-center text-xs border ${index === step ? "border-primary" : index < step ? "border-success bg-success/10" : "border-border"}`}>{index < step ? <Check size={13}/> : index + 1}</span>{label}</div>)}</div>
        <div className="mt-5 pt-4 border-t border-border text-[11px] text-text-muted leading-relaxed"><ShieldCheck size={15} className="text-primary mb-2"/>{t("生成结果先进入人才市场，不会自动获得员工权限或加入部门。", "Generated agents enter the talent market first; they do not automatically receive employee permissions or join a department.")}</div>
      </aside>

      <section className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 md:px-7 py-5 border-b border-border"><span className="text-xs text-primary font-mono">STEP {step + 1} / 4</span><h2 className="text-lg font-semibold mt-1">{steps[step]}</h2></div>
        <div className="p-5 md:p-7 min-h-[430px]">
          {step === 0 && <div className="space-y-5 max-w-2xl">
            <Field label={t("智能体名称", "Agent name")} help={t("用户在人才市场和会话中看到的名称", "The name shown in the talent market and conversations")}><input value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder={t("例如：新能源项目尽调顾问", "Example: Renewable Energy Due Diligence Advisor")}/></Field>
            <div className="grid md:grid-cols-2 gap-4"><Field label={t("行业/领域", "Industry or domain")}><input value={form.industry} onChange={e => setForm({...form,industry:e.target.value})} placeholder={t("例如：新能源、建筑、医疗", "Example: renewable energy, construction, healthcare")}/></Field><Field label={t("类型", "Type")}><div className="h-10 px-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center text-sm text-primary"><Sparkles size={15} className="mr-2"/>{t("专业顾问型智能体", "Professional consultant agent")}</div></Field></div>
            <Field label={t("定位与服务对象", "Positioning and audience")} help={t("说明它帮助谁、解决什么问题、交付什么结果", "Describe who it helps, problems it solves, and expected outcomes")}><textarea rows={5} value={form.positioning} onChange={e => setForm({...form,positioning:e.target.value})} placeholder={t("例如：面向投资经理，依据企业标准与项目资料完成尽调分析，输出带证据和风险提示的报告。", "Example: Help investment managers complete due diligence using company standards and project records, with evidence and risk alerts.")}/></Field>
          </div>}

          {step === 1 && <div className="space-y-5">
            <Field label={t("行业经验与判断准则", "Industry experience and decision criteria")} help={t("建议包含典型案例、边界案例、反例和必须转人工的情形", "Include typical and boundary cases, counterexamples, and when human review is required")}><textarea rows={6} value={form.experience} onChange={e => setForm({...form,experience:e.target.value})} placeholder={t("输入你的行业经验、工作方法、质量标准和风险红线…", "Enter industry experience, methods, quality standards, and risk limits…")}/></Field>
            <div><label className="block text-sm font-medium mb-2">{t("上传行业资料与参考文件", "Upload industry references")}</label><label className="min-h-24 border border-dashed border-border hover:border-primary rounded-xl flex flex-col items-center justify-center cursor-pointer text-text-muted bg-bg/50"><Upload size={20}/><span className="text-sm mt-2">{uploading ? t("正在安全扫描并上传…", "Security scanning and uploading…") : t("点击上传 TXT / MD / CSV / JSON / PDF / DOCX / XLSX / PPTX", "Upload TXT / MD / CSV / JSON / PDF / DOCX / XLSX / PPTX")}</span><input className="hidden" type="file" multiple disabled={uploading} onChange={e => void uploadFiles(e.target.files)}/></label></div>
            {references.length > 0 && <div className="grid md:grid-cols-2 gap-2">{references.map(file => <label key={file.id} className={`p-3 border rounded-lg flex items-center gap-3 cursor-pointer ${selectedReferenceIds.includes(file.id) ? "border-primary bg-primary/5" : "border-border"}`}><input type="checkbox" checked={selectedReferenceIds.includes(file.id)} onChange={() => setSelectedReferenceIds(current => current.includes(file.id) ? current.filter(id => id !== file.id) : [...current,file.id])}/><FileText size={16} className="text-primary"/><span className="text-xs truncate flex-1">{file.original_name}</span><small className="text-[10px] text-success">{file.scan_status}</small></label>)}</div>}
            <Field label={t("关联我的 ima 知识库", "Link my ima knowledge base")} help={t("保存知识库连接；当前环境会标记为“已关联、待运行验证”，不会伪报已可检索", "The connection is saved as linked but unverified until a runtime check succeeds")}><div className="relative"><Database size={16} className="absolute left-3 top-3 text-text-muted"/><input className="!pl-9" value={form.ima_url} onChange={e => setForm({...form,ima_url:e.target.value})} placeholder="https://…ima…/knowledge/…"/></div></Field>
          </div>}

          {step === 2 && <div className="space-y-5 max-w-2xl">
            <div><label className="block text-sm font-medium mb-2">{t("核心能力", "Core capabilities")}</label><div className="flex flex-wrap gap-2 mb-3">{SUGGESTED.map(([zh, en]) => <button key={zh} onClick={() => addCapability(isEnglish ? en : zh)} className="px-3 py-1.5 rounded-full border border-border text-xs hover:border-primary hover:text-primary">{isEnglish ? en : zh}</button>)}</div><div className="flex gap-2"><input value={capabilityDraft} onChange={e => setCapabilityDraft(e.target.value)} onKeyDown={e => { if(e.key === "Enter"){e.preventDefault();addCapability(capabilityDraft)}}} placeholder={t("输入自定义能力后按回车", "Enter a custom capability and press Enter")}/><button onClick={() => addCapability(capabilityDraft)} className="px-3 rounded-lg bg-primary text-white"><Plus size={17}/></button></div></div>
            <div className="flex flex-wrap gap-2">{form.capabilities.map(item => <button key={item} onClick={() => setForm({...form,capabilities:form.capabilities.filter(value => value !== item)})} className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs">{item} ×</button>)}</div>
            <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 text-sm"><b className="block mb-2">{t("默认治理边界", "Default governance boundaries")}</b><ul className="text-text-muted text-xs space-y-1.5"><li>· {t("高风险结论必须提交人工复核", "High-risk conclusions require human review")}</li><li>· {t("不执行外发、删除、支付或生产环境修改", "No external sending, deletion, payment, or production changes")}</li><li>· {t("资料仅限当前租户与创建者授权范围", "References remain within the current tenant and creator authorization scope")}</li></ul></div>
          </div>}

          {step === 3 && (result ? <div className="max-w-xl mx-auto py-8 text-center"><div className="w-16 h-16 mx-auto rounded-full bg-success/10 text-success grid place-items-center"><Check size={30}/></div><h3 className="text-xl font-bold mt-5">{t("智能体已生成并进入人才市场", "Agent generated and published to the talent market")}</h3><p className="text-sm text-text-muted mt-3 leading-relaxed">{result.next_step}</p><div className="mt-5 p-4 rounded-xl bg-bg text-left text-xs space-y-2"><p>{t("人才编号：", "Talent ID:")}#{result.talent_id}</p><p>{t("市场状态：", "Market status:")}<span className="text-success">{result.status}</span></p><p>ima {t("状态：", "status:")}<span className="text-warning">{result.ima_status}</span></p></div><button onClick={() => navigate("/employees")} className="mt-6 px-5 py-2.5 bg-primary text-white rounded-lg text-sm inline-flex items-center gap-2"><Users size={16}/> {t("前往人机资源招募", "Go to Human–AI resources")} <ArrowRight size={15}/></button></div> : <div className="max-w-xl"><h3 className="font-semibold mb-4">{t("确认生成内容", "Confirm generation details")}</h3><Summary label={t("名称", "Name")} value={form.name}/><Summary label={t("行业", "Industry")} value={form.industry}/><Summary label={t("定位", "Positioning")} value={form.positioning}/><Summary label={t("能力", "Capabilities")} value={form.capabilities.join(isEnglish ? ", " : "、")}/><Summary label={t("参考资料", "References")} value={selectedReferenceIds.length ? (isEnglish ? `${selectedReferenceIds.length} files` : `${selectedReferenceIds.length} 份`) : t("无", "None")}/><Summary label={t("ima 知识库", "ima knowledge base")} value={form.ima_url ? t("已填写，生成后标记为待运行验证", "Linked; availability is verified at runtime") : t("未关联", "Not linked")}/><button disabled={generating} onClick={() => void generate()} className="mt-5 px-5 py-2.5 bg-primary text-white rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-60">{generating ? <LoaderCircle size={16} className="animate-spin"/> : <Sparkles size={16}/>}{t("生成顾问型智能体", "Generate consultant agent")}</button></div>)}
          {error && <div className="mt-5 p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}
        </div>
        {!result && <footer className="px-5 md:px-7 py-4 border-t border-border flex justify-between"><button disabled={step===0} onClick={() => {setError("");setStep(value => Math.max(0,value-1))}} className="px-4 py-2 border border-border rounded-lg text-sm disabled:opacity-30 inline-flex gap-2 items-center"><ArrowLeft size={15}/> {t("上一步", "Back")}</button>{step < 3 && <button disabled={!canContinue} onClick={() => {setError("");setStep(value => value+1)}} className="px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-40 inline-flex gap-2 items-center">{t("下一步", "Next")} <ArrowRight size={15}/></button>}</footer>}
      </section>
    </div>
  </div>;
}

function Field({label,help,children}:{label:string;help?:string;children:React.ReactNode}){return <label className="block"><span className="block text-sm font-medium mb-1.5">{label}</span>{help&&<span className="block text-[11px] text-text-muted mb-2">{help}</span>}<div className="[&_input]:w-full [&_input]:h-10 [&_input]:px-3 [&_input]:border [&_input]:border-border [&_input]:rounded-lg [&_input]:bg-bg [&_input]:outline-none [&_input:focus]:border-primary [&_textarea]:w-full [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:border [&_textarea]:border-border [&_textarea]:rounded-lg [&_textarea]:bg-bg [&_textarea]:outline-none [&_textarea:focus]:border-primary [&_textarea]:resize-y">{children}</div></label>}
function Summary({label,value}:{label:string;value:string}){return <div className="grid grid-cols-[90px_1fr] gap-3 py-3 border-b border-border text-sm"><span className="text-text-muted">{label}</span><span>{value || "—"}</span></div>}

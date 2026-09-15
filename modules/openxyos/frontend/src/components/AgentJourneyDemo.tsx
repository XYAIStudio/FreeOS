import { useEffect, useState } from "react";
import { ArrowRight, Bot, BriefcaseBusiness, Building2, Check, FileText, Network, Send, Sparkles, UserRoundPlus, UsersRound } from "lucide-react";
import { useLocale } from "../i18n";
import "./agent-journey-demo.css";

const STEPS = [
  { zh: ["画像与资料", "定位 · 能力 · 行业经验"], en: ["Profile & sources", "Positioning · skills · experience"], icon: FileText },
  { zh: ["生成智能体", "顾问型蓝图与技能组合"], en: ["Generate an agent", "Advisor blueprint and skill set"], icon: Sparkles },
  { zh: ["进入人才市场", "招募至备选员工"], en: ["Enter talent market", "Recruit into candidate staff"], icon: UserRoundPlus },
  { zh: ["组织内协作", "岗位、部门与人机群聊"], en: ["Collaborate in org", "Role, department, and human–AI chat"], icon: UsersRound },
] as const;

export default function AgentJourneyDemo({ onExperience }: { onExperience: () => void }) {
  const [step, setStep] = useState(0);
  const { isEnglish } = useLocale();
  const tx = (zh: string, en: string) => isEnglish ? en : zh;
  const copy = (index: number) => isEnglish ? STEPS[index].en : STEPS[index].zh;
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setStep(current => (current + 1) % STEPS.length), 3600);
    return () => window.clearInterval(timer);
  }, []);
  const StepIcon = STEPS[step].icon;

  return <section id="agent-flow" className="ox-agent-flow" aria-labelledby="agent-flow-title">
    <div className="ox-agent-flow-head">
      <div><small>LIVE FLOW / 02</small><h2 id="agent-flow-title">{tx("让智能体从设想成为组织成员", "Turn an agent concept into an organization member")}</h2><p>{tx("定制画像、吸收资料、生成顾问、进入人才市场，再由人类招募并归入组织。每一步都有明确的治理边界。", "Define a profile, ground it in sources, generate an advisor, publish it to the talent market, and recruit it into the organization with clear governance at every step.")}</p></div>
      <button className="ox-secondary" onClick={onExperience}>{tx("体验智能体定制", "Try agent customization")} <ArrowRight size={16}/></button>
    </div>
    <div className="journey-stepper" aria-label={tx("智能体定制演示步骤", "Agent customization demo steps")}>
      {STEPS.map((item, index) => { const [label, detail] = copy(index); return <button key={item.zh[0]} className={index === step ? "active" : index < step ? "done" : ""} onClick={() => setStep(index)} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check size={13}/> : `0${index + 1}`}</span><b>{label}</b><small>{detail}</small></button>; })}
    </div>
    <div className={`journey-stage stage-${step}`}>
      <div className="journey-grid"/><div className="journey-input panel">
        <div className="panel-top"><span><Bot size={14}/> Agent Studio</span><i>draft</i></div>
        <div className="form-label">{tx("智能体名称", "Agent name")} <b>{tx("必填", "required")}</b></div><div className="form-value"><span>{tx("战略增长顾问", "Strategic Growth Advisor")}</span><em className="typing"/></div>
        <div className="form-label">{tx("行业定位", "Industry positioning")}</div><div className="form-value muted">{tx("企业智能化转型 · 战略与组织", "Enterprise transformation · strategy & organization")}</div>
        <div className="form-label">{tx("能力与资料", "Capabilities & sources")}</div><div className="skill-chips"><span>{tx("组织诊断", "Organization diagnosis")}</span><span>{tx("增长策略", "Growth strategy")}</span><span>{tx("人才规划", "Talent planning")}</span></div>
        <div className="source-file"><FileText size={14}/><span>{tx("行业研究与实践经验.pdf", "Industry research & practice.pdf")}</span><Check size={13}/></div><div className="source-file"><Network size={14}/><span>{tx("ima 知识库已关联", "ima knowledge base connected")}</span><Check size={13}/></div><div className="generate-line"><i/><span>{tx("正在构建可治理智能体蓝图", "Building a governable agent blueprint")}</span></div>
      </div>
      <div className="journey-rail" aria-hidden="true"><span/><i/><i/><i/><i/></div>
      <div className="journey-output panel"><div className="panel-top"><span><StepIcon size={14}/> {copy(step)[0]}</span><i>live</i></div><div className="agent-orb"><div className="orb-core"><Bot size={28}/></div><span/><span/><span/></div>
        {step === 0 && <div className="output-copy"><b>{tx("顾问型智能体蓝图", "Advisor agent blueprint")}</b><p>{tx("角色、能力、资料与知识库已经组织为可编辑配置。", "Role, capabilities, sources, and knowledge are organized into editable configuration.")}</p><div className="trace"><i/><span>{tx("资料提取完成", "Sources extracted")}</span><i/><span>{tx("治理约束已加载", "Governance loaded")}</span></div></div>}
        {step === 1 && <div className="output-copy"><b>{tx("战略增长顾问 · XYAI", "Strategic Growth Advisor · XYAI")}</b><p>{tx("已生成可追溯的岗位定位、专业能力与协作边界。", "A traceable role profile, specialist skills, and collaboration boundaries are ready.")}</p><div className="metric-row"><span><strong>03</strong> {tx("技能", "skills")}</span><span><strong>02</strong> {tx("知识源", "sources")}</span><span><strong>{tx("人工", "Human")}</strong> {tx("确认", "review")}</span></div></div>}
        {step === 2 && <div className="talent-card"><div><span className="avatar"><Bot size={19}/></span><b>{tx("战略增长顾问", "Strategic Growth Advisor")}</b><small>{tx("人才市场 · 等待招募", "Talent market · ready to recruit")}</small></div><button>{tx("招募", "Recruit")} <UserRoundPlus size={14}/></button><p><BriefcaseBusiness size={14}/> {tx("已进入备选员工序列", "Added to candidate staff")}</p></div>}
        {step === 3 && <div className="org-card"><div className="org-root"><Building2 size={15}/><b>{tx("雄元科技", "Xiongyuan Technology")}</b></div><i/><div className="org-branch"><span><UsersRound size={14}/> {tx("战略与组织中心", "Strategy & Organization Center")}</span><div><b className="human">{tx("人", "H")}</b><b className="ai">AI</b><small>{tx("战略增长顾问", "Strategic Growth Advisor")}</small></div></div><div className="chat-line"><Send size={13}/><span>{tx("人机协作群已创建", "Human–AI collaboration group created")}</span><Check size={13}/></div></div>}
      </div>
      <div className="journey-caption"><span className="caption-dot"/><b>{copy(step)[0]}</b><span>{copy(step)[1]}</span><em>{tx("真实链路演示", "Live path demo")}</em></div>
    </div>
  </section>;
}
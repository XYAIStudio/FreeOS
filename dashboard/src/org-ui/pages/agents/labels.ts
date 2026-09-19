import type { OrgLocale } from "../../shell";

const EN = {
  title: "Agent Studio",
  subtitle:
    "Compile organization digital colleagues from openxyos.agent-blueprint.v1 and manage their lifecycle on the host.",
  hostHint:
    "FreeOS Agents, Experts, and the personalization editor stay where they are. This page only compiles blueprints and advances colleague lifecycle.",
  notHereTitle: "Not on this page",
  notHereBody:
    "This is not Chat, not the FreeOS agent editor, and not the unmounted sidecar Agent Studio. Generated colleagues enter draft first; spawn them to appear on Experts.",
  openExperts: "FreeOS Experts",
  openPersonalization: "Agent personalization",
  openEmployees: "Employees directory",
  openWorkbench: "Organization workbench",
  compileTitle: "Compile a blueprint",
  compileHint:
    "Writes a tenant workspace (SOUL.md, skills, MEMORY) and registers a draft colleague. No talent-market sidecar, no file-upload studio.",
  fieldName: "Colleague name",
  namePlaceholder: "e.g. Renewable Energy Due Diligence Advisor",
  fieldIndustry: "Industry or domain",
  industryPlaceholder: "e.g. renewable energy, construction, healthcare",
  fieldPositioning: "Positioning and audience",
  positioningPlaceholder:
    "Who it helps, which problems it solves, and what it should deliver.",
  fieldExperience: "Experience and decision criteria",
  experiencePlaceholder:
    "Typical cases, counterexamples, and when a human must review.",
  fieldCapabilities: "Capabilities",
  capabilityPlaceholder: "Add a capability and press Enter",
  fieldIma: "Knowledge URL (optional)",
  imaPlaceholder: "https://… — stored as linked, unverified",
  suggested: [
    "Knowledge lookup",
    "Industry Q&A",
    "Risk alerts",
    "Comparative analysis",
    "Report generation",
    "Recommendations",
  ],
  governanceTitle: "Default governance",
  governanceBody:
    "High-risk conclusions require human review. No outbound send, delete, pay, or production change until the colleague is promoted.",
  compile: "Compile draft colleague",
  compiling: "Compiling…",
  compileDone: "Compiled and registered as draft",
  colleaguesTitle: "Digital colleagues",
  colleaguesHint:
    "Host lifecycle: draft → market → recruit → shadow → active → offboard. Directory employees stay on the Employees page.",
  spawn: "Register as FreeOS agent",
  spawning: "Registering…",
  spawnDone: "Registered for FreeOS chat",
  openSpawned: "Open on Experts",
  loading: "Loading digital colleagues…",
  loadFailed: "Could not load digital colleagues",
  compileFailed: "Could not compile the blueprint",
  actionFailed: "Could not update the colleague",
  required: "Name, positioning, and at least one capability are required.",
  empty: "No compiled colleagues yet.",
  emptyHint: "Compile a blueprint to create a draft digital colleague.",
  total: "Colleagues",
  spawned: "Spawned",
  draft: "Draft",
  market: "Market",
  recruit: "Recruit",
  shadow: "Shadow",
  active: "Active",
  offboard: "Offboard",
  lifecycle: "Lifecycle",
  workspace: "Workspace",
  slug: "Slug",
  readOnly: "Only administrators can compile or change lifecycle.",
};

const ZH: typeof EN = {
  title: "智能体定制",
  subtitle:
    "在宿主内把 openxyos.agent-blueprint.v1 编译成组织数字同事，并管理其生命周期。",
  hostHint:
    "FreeOS 智能体、专家页和个性化编辑器保持原位。本页只编译蓝图并推进同事生命周期。",
  notHereTitle: "本页没有这些",
  notHereBody:
    "这里不是对话，不是 FreeOS 智能体编辑器，也不是未挂载的边车 Agent Studio。生成结果先进入 draft；注册后才会出现在专家页。",
  openExperts: "FreeOS 专家",
  openPersonalization: "智能体个性化",
  openEmployees: "员工目录",
  openWorkbench: "组织工作台",
  compileTitle: "编译蓝图",
  compileHint:
    "写入租户工作区（SOUL.md、技能、MEMORY）并登记为 draft 同事。没有边车人才市场，也没有资料上传工作室。",
  fieldName: "同事名称",
  namePlaceholder: "例如：新能源项目尽调顾问",
  fieldIndustry: "行业 / 领域",
  industryPlaceholder: "例如：新能源、建筑、医疗",
  fieldPositioning: "定位与服务对象",
  positioningPlaceholder: "帮助谁、解决什么问题、交付什么结果。",
  fieldExperience: "经验与判断准则",
  experiencePlaceholder: "典型案例、反例，以及必须转人工的情形。",
  fieldCapabilities: "核心能力",
  capabilityPlaceholder: "输入能力后按回车",
  fieldIma: "知识库地址（可选）",
  imaPlaceholder: "https://… — 保存为已关联、待运行验证",
  suggested: [
    "知识库查询",
    "行业问答",
    "风险提示",
    "对比分析",
    "报告生成",
    "方案建议",
  ],
  governanceTitle: "默认治理边界",
  governanceBody:
    "高风险结论必须人工复核。晋升前不外发、删除、支付或改生产环境。",
  compile: "编译为草稿同事",
  compiling: "正在编译…",
  compileDone: "已编译并登记为草稿",
  colleaguesTitle: "数字同事",
  colleaguesHint:
    "宿主生命周期：draft → market → recruit → shadow → active → offboard。目录员工仍在员工目录页。",
  spawn: "注册为 FreeOS 智能体",
  spawning: "正在注册…",
  spawnDone: "已登记到 FreeOS 对话",
  openSpawned: "在专家页打开",
  loading: "正在加载数字同事…",
  loadFailed: "无法加载数字同事",
  compileFailed: "无法编译蓝图",
  actionFailed: "无法更新同事",
  required: "名称、定位和至少一项能力为必填。",
  empty: "还没有编译过的同事。",
  emptyHint: "编译一份蓝图即可创建草稿数字同事。",
  total: "同事",
  spawned: "已注册",
  draft: "草稿",
  market: "市场",
  recruit: "招募",
  shadow: "见习",
  active: "在职",
  offboard: "离岗",
  lifecycle: "生命周期",
  workspace: "工作区",
  slug: "标识",
  readOnly: "只有管理员可以编译或变更生命周期。",
};

export type AgentsLabels = typeof EN;

export function agentsLabels(locale: OrgLocale): AgentsLabels {
  return locale === "zh" ? ZH : EN;
}

export function lifecycleLabel(state: string, labels: AgentsLabels): string {
  switch (state) {
    case "draft":
      return labels.draft;
    case "market":
      return labels.market;
    case "recruit":
      return labels.recruit;
    case "shadow":
      return labels.shadow;
    case "active":
      return labels.active;
    case "offboard":
      return labels.offboard;
    default:
      return state;
  }
}

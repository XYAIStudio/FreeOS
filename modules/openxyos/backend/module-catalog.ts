/** Tenant-configurable product modules. Core navigation and administration stay available. */
export const TENANT_MODULES = [
  { key: "announcements", label: "通知公告", description: "企业通知、公告发布与已读状态" },
  { key: "organization", label: "组织架构", description: "部门、岗位和汇报关系" },
  { key: "employees", label: "员工管理", description: "人类员工与 AI 员工管理" },
  { key: "skills", label: "技能插件", description: "技能库与插件能力" },
  { key: "chat", label: "沟通协作", description: "单聊、群聊和实时协作" },
  { key: "tasks", label: "任务管理", description: "任务、子任务、评论和附件" },
  { key: "workflows", label: "流程管理", description: "工作流设计、执行和审批" },
  { key: "contracts", label: "合同管理", description: "合同台账、预警和分析" },
  { key: "assets", label: "资产管理", description: "资产台账、盘点、车辆与采购" },
  { key: "attendance", label: "考勤管理", description: "考勤、排班和请假" },
  { key: "expenses", label: "费用报销", description: "费用记录和报销流程" },
  { key: "work_records", label: "工作记录", description: "日报和工作记录" },
  { key: "goals", label: "目标管理", description: "目标制定和进度跟踪" },
  { key: "budgets", label: "预算管理", description: "预算编制和执行跟踪" },
  { key: "performance", label: "绩效评估", description: "绩效指标和评估" },
  { key: "efficiency", label: "效能仪表板", description: "组织效能指标和分析" },
  { key: "reflections", label: "反思引擎", description: "复盘、反思和知识沉淀" },
  { key: "knowledge", label: "知识库", description: "知识文件、笔记和检索" },
  { key: "governance", label: "治理引擎", description: "管理员治理策略与执行" },
  { key: "audit", label: "审计追溯", description: "超级管理员审计与证据追溯" },
] as const;

export type TenantModuleKey = typeof TENANT_MODULES[number]["key"];

const TENANT_MODULE_KEY_SET = new Set<string>(TENANT_MODULES.map(module => module.key));

/** Returns whether an external value names a supported tenant module. */
export function isTenantModuleKey(value: string): value is TenantModuleKey {
  return TENANT_MODULE_KEY_SET.has(value);
}

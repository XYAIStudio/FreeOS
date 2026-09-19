import type { OrgLocale } from "../../shell";

const EN = {
  title: "Reflection Engine",
  subtitle:
    "Capture lessons, failures, and reusable experience on the host. Stored under FREEOS_HOME/org — not a sidecar and not Chat.",
  hostHint:
    "These are organizational reflections. Agent conversation stays on Chat. Extracted skills do not become a second skill runtime.",
  search: "Search reflections…",
  loading: "Loading reflections…",
  empty: "No reflections yet.",
  emptyHint: "Create a reflection here. It stays on the host org store.",
  noMatch: "No reflections match this filter",
  create: "New reflection",
  createTitle: "New reflection",
  refresh: "Refresh",
  required: "Add at least one lesson, plan, or captured knowledge",
  cancel: "Cancel",
  delete: "Delete",
  confirmDelete: "Delete this reflection?",
  total: "Total",
  all: "All",
  employee: "Employee ID",
  task: "Task ID",
  employeeLabel: "Employee #",
  taskLabel: "Task #",
  orgLevel: "Organization",
  importance: "Importance",
  success: "Success factors",
  failure: "Failure reasons",
  gaps: "Knowledge gaps",
  plan: "Improvement plan",
  skills: "Extracted skills",
  knowledge: "Learned knowledge",
  typeTask: "Task completion",
  typeError: "Error learning",
  typeKnowledge: "Knowledge capture",
  typeImprovement: "Improvement plan",
};

const ZH: typeof EN = {
  title: "反思引擎",
  subtitle:
    "在宿主内整理复盘结论、失败原因和可复用经验。数据写在 FREEOS_HOME/org，不是边车，也不是对话。",
  hostHint:
    "这是组织复盘记录。智能体对话仍在 Chat。提取的技能不会变成第二套技能运行时。",
  search: "搜索反思…",
  loading: "加载反思…",
  empty: "还没有反思记录。",
  emptyHint: "在此新建一条。记录会留在宿主组织库。",
  noMatch: "没有符合筛选的反思",
  create: "新建反思",
  createTitle: "新建反思",
  refresh: "刷新",
  required: "至少填写一项经验、计划或沉淀知识",
  cancel: "取消",
  delete: "删除",
  confirmDelete: "确定删除此反思记录？",
  total: "全部",
  all: "全部",
  employee: "员工 ID",
  task: "任务 ID",
  employeeLabel: "员工 #",
  taskLabel: "任务 #",
  orgLevel: "组织",
  importance: "重要性",
  success: "成功因素",
  failure: "失败原因",
  gaps: "知识缺口",
  plan: "改进计划",
  skills: "提取技能",
  knowledge: "沉淀知识",
  typeTask: "任务完成",
  typeError: "错误学习",
  typeKnowledge: "知识沉淀",
  typeImprovement: "改进计划",
};

export type ReflectionLabels = typeof EN;

export function reflectionLabels(locale: OrgLocale): ReflectionLabels {
  return locale === "zh" ? ZH : EN;
}

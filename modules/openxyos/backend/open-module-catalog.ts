export const OPENXYOS_MODULES = [
  { key: "workspace", label: "工作台", description: "组织运行总览与待办入口", locked: true },
  { key: "announcements", label: "通知公告", description: "可二次开发的通知发布与已读示例", locked: false },
  { key: "organization", label: "组织架构", description: "集团、公司、部门、岗位与汇报关系", locked: false },
  { key: "employees", label: "人机资源", description: "人类员工、AI 员工、备选员工与人才市场", locked: false },
  { key: "skills", label: "技能插件", description: "智能体技能目录与能力装配", locked: false },
  { key: "chat", label: "沟通协作", description: "人机单聊、群聊与实时协作", locked: false },
  { key: "agents", label: "智能体定制", description: "在线生成顾问型智能体并登记人才市场", locked: false },
  { key: "tasks", label: "任务管理", description: "可二次开发的任务、子任务与状态流转示例", locked: false },
  { key: "knowledge", label: "知识库", description: "可二次开发的资料上传、解析与检索示例", locked: false },
  { key: "reflections", label: "反思引擎", description: "可二次开发的复盘与经验沉淀示例", locked: false },
  { key: "governance", label: "治理引擎", description: "人机协作策略、人工复核与审计边界", locked: false },
  { key: "settings", label: "系统设置", description: "租户、模型、模块与用户设置", locked: true },
] as const;
export type OpenXyosModuleKey = typeof OPENXYOS_MODULES[number]["key"];
const KEYS = new Set<string>(OPENXYOS_MODULES.map(item => item.key));
export function isOpenXyosModuleKey(value: string): value is OpenXyosModuleKey { return KEYS.has(value); }
export function isLockedModule(value: string): boolean { return OPENXYOS_MODULES.some(item => item.key === value && item.locked); }

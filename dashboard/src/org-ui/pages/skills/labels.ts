import type { OrgLocale } from "../../shell";

const EN = {
  title: "Skills",
  subtitle:
    "Organization skills are generated wrappers that call org APIs. Agent Skills stay on FreeOS — this page does not start a second skill runtime.",
  loading: "Loading skills…",
  refresh: "Refresh",
  generate: "Generate from catalog",
  generateOne: "Generate",
  generating: "Generating…",
  publish: "Publish draft",
  publishing: "Publishing…",
  search: "Search skills, modules, or packages…",
  orgTab: "Organization skills",
  hostTab: "Host Agent Skills",
  generated: "Generated",
  published: "Published drafts",
  hostPackages: "Host packages",
  catalog: "Catalog modules",
  emptyOrg: "No organization skills generated yet.",
  emptyOrgHint:
    "Generate SKILL.md trees from the Open-12 catalog. They call host /api/org-module routes — they are not a sidecar marketplace.",
  emptyHost: "No host skill packages yet.",
  emptyHostHint:
    "Create and edit packages on Personalization → Skill packages. Agents run those skills; this page only lists them.",
  adminOnly: "Generate and publish are limited to administrators.",
  hostHint:
    "These packages are the same FreeOS Agent Skills catalog. Open Personalization to install or edit them.",
  openHost: "Open Agent Skills",
  detail: "Skill content",
  close: "Close",
  module: "Module",
  slug: "Slug",
  status: "Status",
  notGenerated: "Not generated",
  draftReady: "Draft published",
  generatedOnly: "Generated",
  hostPackage: "Skill package",
  skillCount: "Skills",
  loadFailed: "Could not load skills",
  generateFailed: "Could not generate skills",
  publishFailed: "Could not publish this skill",
  generateDone: "Generated organization skills from the catalog.",
  publishDone: "Wrote a tenant-toggleable plugin draft. It is not enabled.",
  confirmGenerate:
    "Write SKILL.md trees under the host org-skills directory? Existing files for the same modules are overwritten.",
  confirmPublish:
    "Publish a plugin draft next to this skill? It stays disabled until a tenant opts in.",
};

const ZH: typeof EN = {
  title: "技能",
  subtitle:
    "组织技能是调用组织 API 的生成包装，不是第二套运行时。智能体真正执行的仍是 FreeOS「个性化 → 技能 / 技能包」。",
  loading: "加载技能…",
  refresh: "刷新",
  generate: "从目录生成",
  generateOne: "生成",
  generating: "正在生成…",
  publish: "发布草稿",
  publishing: "正在发布…",
  search: "搜索技能、模块或技能包…",
  orgTab: "组织技能",
  hostTab: "宿主 Agent Skills",
  generated: "已生成",
  published: "已发布草稿",
  hostPackages: "宿主技能包",
  catalog: "目录模块",
  emptyOrg: "还没有生成组织技能。",
  emptyOrgHint:
    "从 Open-12 目录生成 SKILL.md。它们走宿主 /api/org-module，不是边车技能市场。",
  emptyHost: "还没有宿主技能包。",
  emptyHostHint:
    "请到「个性化 → 技能包」创建或编辑。智能体运行那些技能；本页只列出，不另造运行时。",
  adminOnly: "生成与发布仅管理员可用。",
  hostHint: "这些技能包就是 FreeOS Agent Skills 目录。安装与编辑请到个性化页。",
  openHost: "打开 Agent Skills",
  detail: "技能内容",
  close: "关闭",
  module: "模块",
  slug: "标识",
  status: "状态",
  notGenerated: "未生成",
  draftReady: "草稿已发布",
  generatedOnly: "已生成",
  hostPackage: "技能包",
  skillCount: "技能数",
  loadFailed: "无法加载技能",
  generateFailed: "无法生成技能",
  publishFailed: "无法发布该技能",
  generateDone: "已从目录生成组织技能。",
  publishDone: "已写出按租户开关的插件草稿，默认不启用。",
  confirmGenerate:
    "在宿主 org-skills 目录写入 SKILL.md？同名模块的已有文件会被覆盖。",
  confirmPublish: "在该技能旁写出插件草稿？默认保持关闭，需租户自行打开。",
};

export type SkillsLabels = typeof EN;

export function skillsLabels(locale: OrgLocale): SkillsLabels {
  return locale === "zh" ? ZH : EN;
}

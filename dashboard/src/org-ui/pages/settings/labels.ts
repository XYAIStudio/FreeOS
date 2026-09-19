import type { OrgLocale } from "../../shell";

const EN = {
  title: "Organization settings",
  subtitle:
    "Catalog module toggles and org-local preferences on the host. This is not FreeOS system settings.",
  hostHint:
    "LLM keys, users, timezone, and models stay on FreeOS system settings. This page only edits org_os catalog enablement and org-local prefs.",
  notHereTitle: "Not on this page",
  notHereBody:
    "FreeOS already has system Settings. Open those for models, users, timezone, and security.",
  openSystem: "FreeOS system settings",
  openModels: "Models & keys",
  openUsers: "Users",
  openWorkbench: "Organization workbench",
  profileTitle: "Organization profile",
  profileHint:
    "Shown on this Organization module. Not the FreeOS instance name.",
  name: "Organization name",
  namePlaceholder: "e.g. Northwind",
  description: "Description",
  descriptionPlaceholder: "Optional short description",
  savePrefs: "Save preferences",
  saving: "Saving…",
  saved: "Saved",
  modulesTitle: "Catalog modules",
  modulesHint:
    "When off, the module is hidden from the Organization catalog. Workspace and Settings stay on.",
  locked: "Always on",
  enabled: "Shown",
  disabled: "Hidden",
  loading: "Loading organization settings…",
  loadFailed: "Could not load organization settings",
  saveFailed: "Could not save",
  readOnly: "Only administrators can change organization settings.",
};

const ZH: typeof EN = {
  title: "组织设置",
  subtitle: "宿主内的目录模块开关与组织本地偏好。这里不是 FreeOS 系统设置。",
  hostHint:
    "大模型密钥、用户、时区和模型仍在 FreeOS 系统设置。本页只改 org_os 目录启用与组织本地偏好。",
  notHereTitle: "本页没有这些",
  notHereBody: "FreeOS 已有系统设置。模型、用户、时区和安全请到那里改。",
  openSystem: "FreeOS 系统设置",
  openModels: "模型与密钥",
  openUsers: "用户",
  openWorkbench: "组织工作台",
  profileTitle: "组织资料",
  profileHint: "只用于本组织模块，不是 FreeOS 实例名。",
  name: "组织名称",
  namePlaceholder: "例如 北风",
  description: "简介",
  descriptionPlaceholder: "可选短简介",
  savePrefs: "保存偏好",
  saving: "保存中…",
  saved: "已保存",
  modulesTitle: "目录模块",
  modulesHint: "关闭后，该模块从组织目录隐藏。工作台与设置保持开启。",
  locked: "始终开启",
  enabled: "显示",
  disabled: "隐藏",
  loading: "正在加载组织设置…",
  loadFailed: "无法加载组织设置",
  saveFailed: "保存失败",
  readOnly: "只有管理员可以更改组织设置。",
};

export type SettingsLabels = typeof EN;

export function settingsLabels(locale: OrgLocale): SettingsLabels {
  return locale === "zh" ? ZH : EN;
}

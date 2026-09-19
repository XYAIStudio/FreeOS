import type { OrgLocale } from "../../shell";

const EN = {
  title: "Governance",
  subtitle:
    "Pending human approvals and the local host audit. High-risk tools stay blocked until someone decides.",
  loading: "Loading governance…",
  refresh: "Refresh",
  overview: "Overview",
  pending: "Pending approvals",
  audit: "Audit",
  enabled: "Gate on",
  disabled: "Gate off",
  enabledHint:
    "The host PEP/PDP already default-denies outbound, delete, pay, and prod. This page does not rewrite that engine.",
  disabledHint:
    "The interceptor is off. Pauses and audit still show what the engine recorded on disk.",
  totalEvents: "Audit events",
  allowed: "Allowed",
  denied: "Denied",
  pendingCount: "Pending",
  emptyPending: "No pauses waiting for a human.",
  emptyPendingHint:
    "High-risk tool calls create a durable pause here. Approve or reject; the agent must re-check before it can execute.",
  emptyAudit: "No governance events yet.",
  emptyAuditHint:
    "Policy checks write to the host audit JSONL. Sidecar SQL.js is not the source of truth.",
  time: "Time",
  tool: "Tool",
  category: "Category",
  actor: "Actor",
  reason: "Reason",
  status: "Status",
  pauseId: "Pause id",
  event: "Event",
  result: "Result",
  actions: "Actions",
  approve: "Approve",
  reject: "Reject",
  confirmReject: "Reject this pause? The tool stays blocked.",
  confirmApprove:
    "Approve this pause? The agent must re-check with this id before execute is true.",
  detail: "Details",
  close: "Close",
  resolveFailed: "Could not resolve this pause",
  loadFailed: "Could not load governance data",
  adminOnly: "Approve and reject are limited to administrators.",
  ruleSource: "Rule source",
  digest: "Args digest",
  noActor: "Unknown actor",
};

const ZH: typeof EN = {
  title: "治理",
  subtitle:
    "待人工复核的暂停，以及宿主本地审计。高风险工具在有人拍板前保持拦截。",
  loading: "加载治理…",
  refresh: "刷新",
  overview: "概览",
  pending: "待审批",
  audit: "审计",
  enabled: "闸门已开",
  disabled: "闸门关闭",
  enabledHint:
    "宿主 PEP/PDP 已对 outbound / delete / pay / prod 默认拒绝。本页只展示与裁决，不重写引擎。",
  disabledHint: "进程内拦截器未开启。磁盘上已有的暂停与审计仍可在此查看。",
  totalEvents: "审计事件",
  allowed: "通过",
  denied: "拒绝",
  pendingCount: "待审批",
  emptyPending: "没有等待人工处理的暂停。",
  emptyPendingHint:
    "高风险工具调用会在此留下持久暂停。批准或驳回后，智能体必须带着同一 id 再检查才能执行。",
  emptyAudit: "还没有治理事件。",
  emptyAuditHint: "策略检查写入宿主 audit JSONL。边车 SQL.js 不是事实来源。",
  time: "时间",
  tool: "工具",
  category: "类别",
  actor: "操作者",
  reason: "原因",
  status: "状态",
  pauseId: "暂停 ID",
  event: "事件",
  result: "结果",
  actions: "操作",
  approve: "批准",
  reject: "驳回",
  confirmReject: "驳回该暂停？工具将保持拦截。",
  confirmApprove:
    "批准该暂停？智能体必须带着此 id 再检查，execute 才会为 true。",
  detail: "详情",
  close: "关闭",
  resolveFailed: "无法处理该暂停",
  loadFailed: "无法加载治理数据",
  adminOnly: "批准与驳回仅管理员可用。",
  ruleSource: "规则来源",
  digest: "参数摘要",
  noActor: "未知操作者",
};

export type GovernanceLabels = typeof EN;

export function governanceLabels(locale: OrgLocale): GovernanceLabels {
  return locale === "zh" ? ZH : EN;
}

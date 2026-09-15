// ============================================================
// 前端共享工作流类型 (与 backend/services/workflow-types.ts 保持同步)
// ============================================================

export type ApproverMode =
  | "specific" | "role" | "position" | "department_head" | "org_escalation" | "initiator_choice";

export type SignMode = "all" | "any" | "ratio";

export type RejectStrategy = "back_to_start" | "back_to_prev" | "to_specified";

export interface ApproverConfig {
  mode: ApproverMode;
  value: string | number;
  label: string;
}

export interface ConditionBranch {
  label: string;
  op: "eq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";
  value: any;
  nextNodeId: string;
}

export interface ApprovalNodeConfig {
  signMode: SignMode;
  approvers: ApproverConfig[];
  timeoutHours?: number;
  rejectStrategy: RejectStrategy;
  rejectTargetNodeId?: string;
  allowDelegate: boolean;
  allowAddSign: boolean;
  sensitiveFields?: string[];
}

export interface ConditionNodeConfig {
  field: string;
  branches: ConditionBranch[];
  defaultNextNodeId?: string;
}

export interface EndNodeConfig {
  notifyRoles: string[];
  notifyUsers?: number[];
  requireRead?: boolean;
}

export type NodeConfig = Record<string, never> | ApprovalNodeConfig | ConditionNodeConfig | EndNodeConfig;

export type FlowNodeType = "start" | "approval" | "task" | "condition" | "parallel" | "end";

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  title: string;
  config: NodeConfig;
  _isRuntimeNode?: boolean;
}

export interface FlowEdge {
  from: string;
  to: string;
}

export interface FlowDefinition {
  version: 2;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FormField {
  key: string;
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  defaultValue?: any;
  options?: { label: string; value: string }[];
  validation?: { min?: number; max?: number; pattern?: string; message?: string };
  autoCompute?: { formula: string; dependsOn: string[] };
  conditionRules?: { field: string; op: string; value: any; action: "show" | "hide" | "require" }[];
  attachmentConfig?: { accept: string[]; maxSize: number; maxCount: number };
  layout?: { colSpan: 1 | 2; group?: string };
  nodePermissions?: Record<string, "edit" | "readonly" | "hidden">;
}

import { useState, useMemo } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Copy, GitBranch, UserPlus, Users, Clock, AlertTriangle } from "lucide-react";
import type { FlowNode, FlowEdge, FlowDefinition, ApproverConfig, SignMode, RejectStrategy, ApprovalNodeConfig, ConditionNodeConfig, EndNodeConfig, ConditionBranch, NodeConfig } from "./types";

import FlowPreview from "./FlowPreview";

interface Props {
  definition: FlowDefinition;
  onChange: (def: FlowDefinition) => void;
  readOnly?: boolean;
}

const NODE_TYPES: { type: FlowNode["type"]; label: string; color: string; icon: string }[] = [
  { type: "start", label: "开始", color: "bg-green-500", icon: "●" },
  { type: "approval", label: "审批", color: "bg-blue-500", icon: "□" },
  { type: "task", label: "任务", color: "bg-amber-500", icon: "◇" },
  { type: "condition", label: "条件分支", color: "bg-purple-500", icon: "◇" },
  { type: "end", label: "结束", color: "bg-gray-500", icon: "●" },
];

const SIGN_MODES: { mode: SignMode; label: string }[] = [
  { mode: "all", label: "会签(全部同意)" },
  { mode: "any", label: "或签(任一同意)" },
];

const REJECT_STRATEGIES: { strat: RejectStrategy; label: string }[] = [
  { strat: "back_to_start", label: "退回发起人" },
  { strat: "back_to_prev", label: "退回上一节点" },
];

export default function FlowDesigner({ definition, onChange, readOnly }: Props) {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(definition.nodes[0]?.id || null);

  const nodes = definition.nodes;
  const edges = definition.edges;

  const updateNodes = (newNodes: FlowNode[]) => onChange({ ...definition, nodes: newNodes });
  const updateEdges = (newEdges: FlowEdge[]) => onChange({ ...definition, edges: newEdges });

  // 智能边维护：插入节点时只修改局部边，保留条件分支等手动配置的边
  const insertNodeEdges = (nds: FlowNode[], insertIdx: number, newNodeId: string): FlowEdge[] => {
    const newEdges: FlowEdge[] = [];
    const usedPairs = new Set<string>();

    // 保留所有不是被插入打断的现有边
    for (const e of edges) {
      const fromIdx = nds.findIndex(n => n.id === e.from);
      const toIdx = nds.findIndex(n => n.id === e.to);
      // 如果这对边跨越插入点，需要拆开
      if (fromIdx >= 0 && toIdx >= 0 && fromIdx < insertIdx && toIdx > insertIdx) {
        // 这条边被插入打断，拆分为 from→new + new→to
        newEdges.push({ from: e.from, to: newNodeId });
        usedPairs.add(`${e.from}→${newNodeId}`);
        usedPairs.add(`${newNodeId}→${e.to}`);
        newEdges.push({ from: newNodeId, to: e.to });
      } else {
        newEdges.push(e);
        usedPairs.add(`${e.from}→${e.to}`);
      }
    }

    return newEdges;
  };

  // 生成默认线性边（用于全新流程或重置）
  const buildDefaultLinearEdges = (nds: FlowNode[]): FlowEdge[] => {
    const newEdges: FlowEdge[] = [];
    for (let i = 0; i < nds.length - 1; i++) {
      newEdges.push({ from: nds[i].id, to: nds[i + 1].id });
    }
    return newEdges;
  };

  const addNode = (type: FlowNode["type"], afterIdx?: number) => {
    const newId = `node_${Date.now()}`;
    const newConfig = type === "approval" ? {
      signMode: "all" as SignMode,
      approvers: [{ mode: "department_head" as const, value: "", label: "部门负责人" }],
      rejectStrategy: "back_to_start" as RejectStrategy,
      allowDelegate: true,
      allowAddSign: true,
    } : type === "condition" ? {
      field: "",
      branches: [],
    } : type === "end" ? {
      notifyRoles: ["audit_supervision", "it"],
    } : {};

    const newNode: FlowNode = {
      id: newId,
      type,
      title: NODE_TYPES.find(n => n.type === type)?.label || "",
      config: newConfig as NodeConfig,
    };

    let newNodes: FlowNode[];
    if (afterIdx !== undefined) {
      newNodes = [...nodes];
      newNodes.splice(afterIdx + 1, 0, newNode);
    } else {
      newNodes = [...nodes, newNode];
    }

    updateNodes(newNodes);
    updateEdges(insertNodeEdges(newNodes, afterIdx !== undefined ? afterIdx + 1 : newNodes.length - 1, newId));
    setEditingNodeId(newId);
  };

  const removeNode = (idx: number) => {
    const id = nodes[idx].id;
    const newNodes = nodes.filter(n => n.id !== id);
    const newEdges = edges.filter(e => e.from !== id && e.to !== id);
    updateNodes(newNodes);
    updateEdges(newEdges);
    if (editingNodeId === id) setEditingNodeId(newNodes[0]?.id || null);
  };

  const moveNode = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= nodes.length) return;
    const copy = [...nodes];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    updateNodes(copy);
    // 仅交换涉及移动节点的边，保留其他手动配置的边
    const [a, b] = [copy[idx].id, copy[target].id];
    const newEdges = edges.map(e => {
      if (e.from === a) return { ...e, from: b };
      if (e.from === b) return { ...e, from: a };
      if (e.to === a) return { ...e, to: b };
      if (e.to === b) return { ...e, to: a };
      return e;
    });
    updateEdges(newEdges);
  };

  const updateNode = (id: string, updates: Partial<FlowNode>) => {
    updateNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const updateConfig = (id: string, configUpdates: any) => {
    updateNodes(nodes.map(n =>
      n.id === id ? { ...n, config: { ...(n.config || {}), ...configUpdates } } : n
    ));
  };

  const updateApprover = (nodeId: string, idx: number, updates: Partial<ApproverConfig>) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const cfg = node.config as ApprovalNodeConfig;
    const newApprovers = [...cfg.approvers];
    newApprovers[idx] = { ...newApprovers[idx], ...updates };
    updateConfig(nodeId, { approvers: newApprovers });
  };

  const addApprover = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const cfg = node.config as ApprovalNodeConfig;
    const newApprovers = [...cfg.approvers, { mode: "department_head" as const, value: "", label: "审批人" }];
    updateConfig(nodeId, { approvers: newApprovers });
  };

  const removeApprover = (nodeId: string, idx: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const cfg = node.config as ApprovalNodeConfig;
    if (!cfg.approvers || cfg.approvers.length <= 1) return;
    updateConfig(nodeId, { approvers: cfg.approvers.filter((_, i) => i !== idx) });
  };

  const addConditionBranch = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const cfg = node.config as ConditionNodeConfig;
    const newBranches = [...cfg.branches, { label: "新分支", op: "eq" as const, value: "", nextNodeId: "" }];
    updateConfig(nodeId, { branches: newBranches });
  };

  const updateConditionBranch = (nodeId: string, idx: number, updates: Partial<ConditionBranch>) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const cfg = node.config as ConditionNodeConfig;
    const newBranches = [...cfg.branches];
    newBranches[idx] = { ...newBranches[idx], ...updates };
    updateConfig(nodeId, { branches: newBranches });
  };

  const removeConditionBranch = (nodeId: string, idx: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const cfg = node.config as ConditionNodeConfig;
    updateConfig(nodeId, { branches: cfg.branches.filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex h-full gap-4">
      {/* 左侧: 节点编辑器 */}
      <div className="flex-1 overflow-auto pr-2 space-y-2">
        {nodes.map((node, idx) => (
          <div key={node.id}
            className={`border rounded-lg transition-all ${
              editingNodeId === node.id ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-bg-card hover:border-primary/30"
            }`}>
            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              onClick={() => setEditingNodeId(editingNodeId === node.id ? null : node.id)}>
              <span className={`w-2 h-2 rounded-full ${NODE_TYPES.find(t => t.type === node.type)?.color || "bg-gray-400"}`} />
              <span className="text-xs font-medium text-text flex-1">{node.title || "未命名"}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg text-text-muted">
                {NODE_TYPES.find(t => t.type === node.type)?.label || node.type}
              </span>
              {!readOnly && node.type !== "start" && node.type !== "end" && (
                <button onClick={(e) => { e.stopPropagation(); removeNode(idx); }}
                  className="p-0.5 text-text-muted hover:text-red-500 rounded">
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {editingNodeId === node.id && (
              <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                {/* 标题 */}
                <div>
                  <label className="text-[10px] text-text-muted">节点标题</label>
                  <input value={node.title || ""} onChange={e => updateNode(node.id, { title: e.target.value })}
                    className="w-full px-2 py-1 border border-border rounded text-xs"
                    placeholder="请输入节点标题" />
                </div>

                {/* 审批节点专属配置 */}
                {node.type === "approval" && (
                  <ApprovalNodeConfigPanel
                    config={node.config as ApprovalNodeConfig}
                    nodeId={node.id}
                    onUpdateConfig={(u) => updateConfig(node.id, u)}
                    onUpdateApprover={(i, u) => updateApprover(node.id, i, u)}
                    onAddApprover={() => addApprover(node.id)}
                    onRemoveApprover={(i) => removeApprover(node.id, i)}
                    readOnly={readOnly}
                  />
                )}

                {/* 条件节点专属配置 */}
                {node.type === "condition" && (
                  <ConditionNodeConfigPanel
                    config={node.config as ConditionNodeConfig}
                    nodeId={node.id}
                    nodes={nodes}
                    onUpdateConfig={(u) => updateConfig(node.id, u)}
                    onUpdateBranch={(i, u) => updateConditionBranch(node.id, i, u)}
                    onAddBranch={() => addConditionBranch(node.id)}
                    onRemoveBranch={(i) => removeConditionBranch(node.id, i)}
                    readOnly={readOnly}
                  />
                )}

                {/* 结束节点 */}
                {node.type === "end" && (
                  <EndNodeConfigPanel
                    config={node.config as EndNodeConfig}
                    onUpdateConfig={(u) => updateConfig(node.id, u)}
                    readOnly={readOnly}
                  />
                )}

                {/* 操作按钮 */}
                {!readOnly && (
                  <div className="flex gap-1 pt-1">
                    <button onClick={() => moveNode(idx, -1)} disabled={idx === 0}
                      className="px-2 py-0.5 text-[10px] border border-border rounded hover:bg-bg disabled:opacity-30">
                      <ChevronUp size={10} /> 上移
                    </button>
                    <button onClick={() => moveNode(idx, 1)} disabled={idx === nodes.length - 1}
                      className="px-2 py-0.5 text-[10px] border border-border rounded hover:bg-bg disabled:opacity-30">
                      <ChevronDown size={10} /> 下移
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 连线 */}
            {idx < nodes.length - 1 && (
              <div className="flex justify-center pb-2">
                <div className="w-px h-4 bg-border" />
              </div>
            )}
          </div>
        ))}

        {/* 添加节点按钮 */}
        {!readOnly && (
          <div className="flex gap-1 flex-wrap">
            {NODE_TYPES.filter(t => t.type !== "start" && t.type !== "end").map(nt => (
              <button key={nt.type} onClick={() => addNode(nt.type, nodes.length - 2)}
                className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded hover:bg-bg hover:border-primary/50 transition-colors">
                <span className={`w-1.5 h-1.5 rounded-full ${nt.color}`} />
                + 添加{nt.label}节点
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 右侧: 预览 */}
      <div className="w-[260px] shrink-0">
        <div className="bg-bg-card border border-border rounded-lg p-3">
          <h4 className="text-xs font-medium text-text mb-2">流程预览</h4>
          <FlowPreview definition={definition} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 审批节点配置面板
// ============================================================

function ApprovalNodeConfigPanel({ config, nodeId, onUpdateConfig, onUpdateApprover, onAddApprover, onRemoveApprover, readOnly }: {
  config: ApprovalNodeConfig;
  nodeId: string;
  onUpdateConfig: (u: any) => void;
  onUpdateApprover: (idx: number, u: Partial<ApproverConfig>) => void;
  onAddApprover: () => void;
  onRemoveApprover: (idx: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      {/* 审批模式 */}
      <div>
        <label className="text-[10px] text-text-muted">审批模式</label>
        <select value={config.signMode} onChange={e => onUpdateConfig({ signMode: e.target.value as SignMode })}
          className="w-full px-2 py-1 border border-border rounded text-xs" disabled={readOnly}>
          {SIGN_MODES.map(sm => <option key={sm.mode} value={sm.mode}>{sm.label}</option>)}
        </select>
      </div>

      {/* 审批人列表 */}
      <div>
        <label className="text-[10px] text-text-muted flex items-center justify-between">
          审批人
          {!readOnly && (
            <button onClick={onAddApprover} className="text-primary hover:underline text-[10px]">
              + 添加
            </button>
          )}
        </label>
        <div className="space-y-1 mt-0.5">
          {(config.approvers || []).map((ac: ApproverConfig, i: number) => (
            <div key={i} className="flex items-center gap-1 bg-bg rounded px-2 py-1">
              <select value={ac.mode} onChange={e => onUpdateApprover(i, { mode: e.target.value as any, label: e.target.selectedOptions[0].text })}
                className="flex-1 text-xs bg-transparent outline-none" disabled={readOnly}>
                <option value="specific">指定人员</option>
                <option value="role">按角色</option>
                <option value="position">按职位</option>
                <option value="department_head">部门负责人</option>
                <option value="org_escalation">组织逐级</option>
                <option value="initiator_choice">发起人自选</option>
              </select>
              {ac.mode !== "department_head" && ac.mode !== "initiator_choice" && (
                <input value={String(ac.value || "")} onChange={e => onUpdateApprover(i, { value: e.target.value })}
                  placeholder="值" className="w-16 text-xs bg-transparent outline-none border-l border-border pl-1" disabled={readOnly} />
              )}
              {!readOnly && config.approvers.length > 1 && (
                <button onClick={() => onRemoveApprover(i)} className="text-text-muted hover:text-red-500">×</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 超时 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-text-muted">超时(小时)</label>
          <input type="number" value={config.timeoutHours || ""} onChange={e => onUpdateConfig({ timeoutHours: Number(e.target.value) || undefined })}
            className="w-full px-2 py-1 border border-border rounded text-xs" disabled={readOnly} />
        </div>
        <div>
          <label className="text-[10px] text-text-muted">驳回策略</label>
          <select value={config.rejectStrategy} onChange={e => onUpdateConfig({ rejectStrategy: e.target.value })}
            className="w-full px-2 py-1 border border-border rounded text-xs" disabled={readOnly}>
            {REJECT_STRATEGIES.map(rs => <option key={rs.strat} value={rs.strat}>{rs.label}</option>)}
          </select>
        </div>
      </div>

      {/* 权限开关 */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={config.allowDelegate} onChange={e => onUpdateConfig({ allowDelegate: e.target.checked })}
            disabled={readOnly} className="rounded" />
          允许转签
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={config.allowAddSign} onChange={e => onUpdateConfig({ allowAddSign: e.target.checked })}
            disabled={readOnly} className="rounded" />
          允许加签
        </label>
      </div>
    </div>
  );
}

// ============================================================
// 条件节点配置面板
// ============================================================

function ConditionNodeConfigPanel({ config, nodeId, nodes, onUpdateConfig, onUpdateBranch, onAddBranch, onRemoveBranch, readOnly }: {
  config: ConditionNodeConfig;
  nodeId: string;
  nodes: FlowNode[];
  onUpdateConfig: (u: any) => void;
  onUpdateBranch: (idx: number, u: Partial<ConditionBranch>) => void;
  onAddBranch: () => void;
  onRemoveBranch: (idx: number) => void;
  readOnly?: boolean;
}) {
  const targetNodes = nodes.filter(n => n.id !== nodeId);

  return (
    <div className="space-y-2">
      <div>
        <label className="text-[10px] text-text-muted">条件字段</label>
        <input value={config.field || ""} onChange={e => onUpdateConfig({ field: e.target.value })}
          className="w-full px-2 py-1 border border-border rounded text-xs"
          placeholder="如: amount, days" disabled={readOnly} />
      </div>

      <div>
        <label className="text-[10px] text-text-muted flex items-center justify-between">
          分支条件
          {!readOnly && (
            <button onClick={onAddBranch} className="text-primary hover:underline text-[10px]">+ 添加分支</button>
          )}
        </label>
        <div className="space-y-1.5 mt-0.5">
          {(config.branches || []).map((branch: ConditionBranch, i: number) => (
            <div key={i} className="bg-bg rounded p-2 space-y-1 border border-border/50">
              <div className="flex items-center gap-1">
                <input value={branch.label} onChange={e => onUpdateBranch(i, { label: e.target.value })}
                  className="w-16 text-xs bg-white border border-border rounded px-1 py-0.5" placeholder="标签" disabled={readOnly} />
                <select value={branch.op} onChange={e => onUpdateBranch(i, { op: e.target.value as any })}
                  className="text-xs bg-white border border-border rounded px-1 py-0.5" disabled={readOnly}>
                  <option value="eq">等于</option>
                  <option value="gt">大于</option>
                  <option value="gte">≥</option>
                  <option value="lt">小于</option>
                  <option value="lte">≤</option>
                  <option value="contains">包含</option>
                  <option value="in">属于</option>
                </select>
                <input value={branch.value} onChange={e => onUpdateBranch(i, { value: e.target.value })}
                  className="w-16 text-xs bg-white border border-border rounded px-1 py-0.5" placeholder="值" disabled={readOnly} />
                <span className="text-[10px] text-text-muted">→</span>
                <select value={branch.nextNodeId || ""} onChange={e => onUpdateBranch(i, { nextNodeId: e.target.value })}
                  className="flex-1 text-xs bg-white border border-border rounded px-1 py-0.5" disabled={readOnly}>
                  <option value="">选择目标节点</option>
                  {targetNodes.map(n => <option key={n.id} value={n.id}>{n.title || n.id}</option>)}
                </select>
                {!readOnly && (
                  <button onClick={() => onRemoveBranch(i)} className="text-text-muted hover:text-red-500 text-xs">×</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 结束节点配置面板
// ============================================================

function EndNodeConfigPanel({ config, onUpdateConfig, readOnly }: {
  config: EndNodeConfig;
  onUpdateConfig: (u: any) => void;
  readOnly?: boolean;
}) {
  const roles = config.notifyRoles || ["audit_supervision", "it"];

  const addRole = () => onUpdateConfig({ notifyRoles: [...roles, ""] });
  const updateRole = (idx: number, value: string) => {
    const copy = [...roles];
    copy[idx] = value;
    onUpdateConfig({ notifyRoles: copy });
  };
  const removeRole = (idx: number) => {
    onUpdateConfig({ notifyRoles: roles.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="text-[10px] text-text-muted flex items-center justify-between">
          流程完成后知会
          {!readOnly && (
            <button onClick={addRole} className="text-primary hover:underline text-[10px]">+ 添加</button>
          )}
        </label>
        <div className="space-y-1 mt-0.5">
          {roles.map((role: string, i: number) => (
            <div key={i} className="flex items-center gap-1">
              <input value={role} onChange={e => updateRole(i, e.target.value)}
                className="flex-1 px-2 py-1 border border-border rounded text-xs"
                placeholder="角色/部门标识" disabled={readOnly} />
              {!readOnly && roles.length > 1 && (
                <button onClick={() => removeRole(i)} className="text-text-muted hover:text-red-500">×</button>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-1">
          例: audit_supervision(监察审计部), it(IT部)
        </p>
      </div>
    </div>
  );
}

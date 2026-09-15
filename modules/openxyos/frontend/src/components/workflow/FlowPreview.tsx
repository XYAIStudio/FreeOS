import { useMemo } from "react";
import type { FlowDefinition, FlowNode, FlowEdge } from "./types";

interface Props {
  definition: FlowDefinition;
  className?: string;
}

const NODE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  start:    { bg: "bg-green-50", border: "border-green-400", text: "text-green-700", dot: "bg-green-500" },
  approval: { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700", dot: "bg-blue-500" },
  task:     { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700", dot: "bg-amber-500" },
  condition:{ bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-700", dot: "bg-purple-500" },
  end:      { bg: "bg-gray-50", border: "border-gray-400", text: "text-gray-700", dot: "bg-gray-500" },
};

/** 对节点做拓扑排序 (BFS from start) */
function topologicalSort(def: FlowDefinition): FlowNode[] {
  const startNode = def.nodes.find(n => n.type === "start");
  if (!startNode) return def.nodes;

  const visited = new Set<string>();
  const result: FlowNode[] = [];
  const queue = [startNode.id];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = def.nodes.find(n => n.id === id);
    if (node) result.push(node);

    const nextIds = def.edges.filter(e => e.from === id).map(e => e.to);
    for (const nid of nextIds) {
      if (!visited.has(nid)) queue.push(nid);
    }
  }

  // 追加未访问的节点 (可能孤立)
  for (const n of def.nodes) {
    if (!visited.has(n.id)) result.push(n);
  }

  return result;
}

export default function FlowPreview({ definition, className }: Props) {
  if (!definition || !definition.nodes) {
    return <div className="text-xs text-text-muted text-center py-4">流程数据加载中...</div>;
  }
  const sorted = useMemo(() => topologicalSort(definition), [definition]);
  const edges = definition.edges;

  // 获取指定 from 的边的 to 列表
  const getNextIds = (fromId: string) => edges.filter(e => e.from === fromId).map(e => e.to);

  // 获取指定 to 的边数
  const getInDegree = (toId: string) => edges.filter(e => e.to === toId).length;

  if (sorted.length === 0) {
    return <div className="text-xs text-text-muted text-center py-4">暂未配置节点</div>;
  }

  return (
    <div className={`space-y-0 ${className || ""}`}>
      {sorted.map((node, idx) => {
        const colors = NODE_COLORS[node.type] || NODE_COLORS.approval;
        const nextIds = getNextIds(node.id);
        const isLast = idx === sorted.length - 1;
        const isCondition = node.type === "condition";

        // 条件节点的子节点（分支）
        let condBranches: { label: string; nextNodeId: string }[] = [];
        if (isCondition) {
          const cfg = node.config as any;
          condBranches = cfg.branches || [];
        }

        return (
          <div key={node.id} className="relative">
            {/* 节点卡片 */}
            <div className={`rounded-lg border px-3 py-2 text-xs ${colors.bg} ${colors.border}`}>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                <span className={`font-medium ${colors.text}`}>
                  {NODE_TYPE_ICONS[node.type]} {node.title}
                </span>
              </div>

              {/* 审批节点：显示审批人 */}
              {node.type === "approval" && (
                <div className="mt-1 text-[10px] text-text-muted">
                  {(() => {
                    const cfg = node.config as any;
                    const approvers: any[] = cfg.approvers || [];
                    if (approvers.length === 0) return <span>未配置审批人</span>;
                    return (
                      <>
                        {approvers.map((a: any, i: number) => (
                          <span key={i} className="inline-flex items-center gap-0.5 mr-1.5 px-1 py-0.5 bg-white/60 rounded">
                            <span>{APPROVER_MODE_ICONS[a.mode]}</span>
                            {a.label || a.mode}
                          </span>
                        ))}
                        <span className="ml-1 text-primary">
                          {cfg.signMode === "all" ? "(会签)" : "(或签)"}
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 结束节点：显示知会 */}
              {node.type === "end" && (
                <div className="mt-1 text-[10px] text-text-muted">
                  {(() => {
                    const cfg = node.config as any;
                    const roles: string[] = cfg.notifyRoles || [];
                    return roles.length > 0
                      ? <span>📨 知会: {roles.join(", ")}</span>
                      : "未配置知会";
                  })()}
                </div>
              )}

            </div>

            {/* 连线 */}
            {!isLast && (nextIds.length > 0 || condBranches.length > 0) && (
              <div className="flex justify-center py-1">
                {isCondition && condBranches.length > 0 ? (
                  /* 条件节点的分叉连线 */
                  <div className="flex flex-col items-center w-full">
                    <div className="flex items-start gap-3 w-full">
                      {condBranches.map((branch, bi) => (
                        <div key={bi} className="flex flex-col items-center flex-1">
                          <div className="text-[9px] text-text-muted px-1.5 py-0.5 bg-amber-50 rounded-full border border-amber-200 mb-1">
                            {branch.label}
                          </div>
                          <div className="w-px h-3 bg-border" />
                          {/* 目标节点卡片 */}
                          {(() => {
                            const target = definition.nodes.find(n => n.id === branch.nextNodeId);
                            if (!target) return <div className="text-[9px] text-red-400">?</div>;
                            const tc = NODE_COLORS[target.type] || NODE_COLORS.approval;
                            return (
                              <div className={`rounded border px-2 py-1 text-[10px] ${tc.bg} ${tc.border} ${tc.text}`}>
                                {NODE_TYPE_ICONS[target.type]} {target.title}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* 直线连线 */
                  <div className="w-px h-3 bg-border" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const NODE_TYPE_ICONS: Record<string, string> = {
  start: "●",
  approval: "□",
  task: "◇",
  condition: "◇",
  end: "●",
};

const APPROVER_MODE_ICONS: Record<string, string> = {
  specific: "👤",
  role: "🔑",
  position: "📌",
  department_head: "🏢",
  org_escalation: "⬆",
  initiator_choice: "✋",
};

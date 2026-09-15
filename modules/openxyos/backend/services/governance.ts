import { dbAll, dbGet, dbRun } from "../db";

export interface PermissionCheck {
  tenantId: number;
  actorLevel: number;
  actorType: string;
  actionType?: string;
  targetType?: string;
  actorId?: number;
  targetId?: number | string;
  action?: string;
}

export class GovernanceEngine {
  static validateAction(params: PermissionCheck): { allowed: boolean; reason: string; rule?: any } {
    const rule = dbGet("SELECT * FROM governance_permission_matrix WHERE tenant_id = ? AND role_level = ? AND permission_type = ?", [params.tenantId, params.actorLevel, params.actionType]) as any;
    if (!rule) return { allowed: false, reason: "无匹配权限规则" };
    if (params.targetType && rule.target_type !== "both" && rule.target_type !== params.targetType) return { allowed: false, reason: "目标类型不匹配", rule };
    return { allowed: true, reason: "通过", rule };
  }

  static checkCommRule(params: { tenantId: number; senderLevel: number; receiverLevel: number; commType: string }): { allowed: boolean; reason: string; rule?: any } {
    const rule = dbGet("SELECT * FROM governance_comm_rules WHERE tenant_id = ? AND sender_level = ? AND receiver_level = ? AND comm_type = ?", [params.tenantId, params.senderLevel, params.receiverLevel, params.commType]) as any;
    if (!rule) return { allowed: true, reason: "无规则限制，默认允许" };
    if (!rule.is_allowed) return { allowed: false, reason: "通信规则禁止", rule };
    return { allowed: true, reason: rule.require_approval ? `需要 L${rule.approval_level} 审批` : "通过", rule };
  }

  static cascadeValidation(params: { tenantId: number; actorLevel: number; actionType: string; senderLevel?: number; receiverLevel?: number; commType?: string; targetType?: string }) {
    const checks: any[] = [];
    const permission = this.validateAction({ tenantId: params.tenantId, actorLevel: params.actorLevel, actorType: "", actionType: params.actionType, targetType: params.targetType });
    checks.push({ type: "permission", ...permission });
    if (!permission.allowed) return { allowed: false, checks, reason: permission.reason };
    if (params.senderLevel && params.receiverLevel && params.commType) {
      const communication = this.checkCommRule({ tenantId: params.tenantId, senderLevel: params.senderLevel, receiverLevel: params.receiverLevel, commType: params.commType });
      checks.push({ type: "communication", ...communication });
      if (!communication.allowed) return { allowed: false, checks, reason: communication.reason };
    }
    return { allowed: true, checks, reason: "通用治理校验通过" };
  }

  static smartRoute(params: { taskComplexity: string; teamHasManager: boolean; tenantId?: number }) {
    return { mode: params.taskComplexity === "complex" && params.teamHasManager ? "review" : "standard", reason: "这是可配置的通用工作流建议，不自动作出组织决定。" };
  }

  static logGovernance(params: { tenantId: number; actionId?: string; actorType: string; actorId: number; actorLevel?: number; targetType?: string; targetId?: number; permissionCheck?: string; commRuleCheck?: string; processCheck?: string; result: string; reason?: string }) {
    dbRun("INSERT INTO governance_event_log (tenant_id, action_id, actor_type, actor_id, actor_level, target_type, target_id, permission_check, comm_rule_check, process_check, result, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [params.tenantId, params.actionId, params.actorType, params.actorId, params.actorLevel, params.targetType, params.targetId, params.permissionCheck, params.commRuleCheck, params.processCheck, params.result, params.reason]);
  }

  static getPermissionMatrix(tenantId: number) { return dbAll("SELECT * FROM governance_permission_matrix WHERE tenant_id = ? ORDER BY role_level, permission_type", [tenantId]); }
  static getCommRules(tenantId: number) { return dbAll("SELECT * FROM governance_comm_rules WHERE tenant_id = ? ORDER BY sender_level, receiver_level", [tenantId]); }
  static getProcessTemplates(tenantId: number) { return dbAll("SELECT * FROM governance_process_templates WHERE tenant_id = ?", [tenantId]); }
  static getGovernanceLogs(tenantId: number, limit = 50) { return dbAll("SELECT * FROM governance_event_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?", [tenantId, limit]); }

  static getGovernanceStats(tenantId: number) {
    const count = (sql: string, parameters: any[] = []) => (dbGet(sql, parameters) as any)?.count || 0;
    const totalLogs = count("SELECT COUNT(*) AS count FROM governance_event_log WHERE tenant_id = ?", [tenantId]);
    const allowedLogs = count("SELECT COUNT(*) AS count FROM governance_event_log WHERE tenant_id = ? AND result = 'allow'", [tenantId]);
    const deniedLogs = count("SELECT COUNT(*) AS count FROM governance_event_log WHERE tenant_id = ? AND result = 'deny'", [tenantId]);
    const pendingLogs = count("SELECT COUNT(*) AS count FROM governance_event_log WHERE tenant_id = ? AND result = 'pending'", [tenantId]);
    return {
      overview: {
        totalLogs, allowedLogs, deniedLogs, pendingLogs,
        allowRate: totalLogs ? Math.round((allowedLogs / totalLogs) * 100) : 0,
        permCount: count("SELECT COUNT(*) AS count FROM governance_permission_matrix WHERE tenant_id = ?", [tenantId]),
        commRuleCount: count("SELECT COUNT(*) AS count FROM governance_comm_rules WHERE tenant_id = ?", [tenantId]),
        templateCount: count("SELECT COUNT(*) AS count FROM governance_process_templates WHERE tenant_id = ?", [tenantId]),
      },
      actionStats: dbAll("SELECT permission_check AS action, COUNT(*) AS count, SUM(CASE WHEN result = 'allow' THEN 1 ELSE 0 END) AS allowed FROM governance_event_log WHERE tenant_id = ? GROUP BY permission_check", [tenantId]),
      levelStats: dbAll("SELECT actor_level, COUNT(*) AS count, SUM(CASE WHEN result = 'allow' THEN 1 ELSE 0 END) AS allowed FROM governance_event_log WHERE tenant_id = ? GROUP BY actor_level", [tenantId]),
      recentTrend: [],
    };
  }

  static createProcessTemplate(tenantId: number, params: any) { dbRun("INSERT INTO governance_process_templates (tenant_id, name, description, template_type, steps_json, is_default) VALUES (?, ?, ?, ?, ?, ?)", [tenantId, params.name, params.description || null, params.template_type, params.steps_json, params.is_default || 0]); }
  static updateProcessTemplate(tenantId: number, id: number, params: any) {
    const fields = ["name", "description", "template_type", "steps_json", "is_default"].filter(field => params[field] !== undefined);
    if (fields.length) dbRun(`UPDATE governance_process_templates SET ${fields.map(field => `${field} = ?`).join(", ")} WHERE tenant_id = ? AND id = ?`, [...fields.map(field => params[field]), tenantId, id]);
  }
  static deleteProcessTemplate(tenantId: number, id: number) { dbRun("DELETE FROM governance_process_templates WHERE tenant_id = ? AND id = ?", [tenantId, id]); }
  static updatePermissionMatrix(tenantId: number, rules: any[]) { for (const rule of rules) dbRun("INSERT OR REPLACE INTO governance_permission_matrix (tenant_id, role_level, permission_type, scope, target_type) VALUES (?, ?, ?, ?, ?)", [tenantId, rule.role_level, rule.permission_type, rule.scope, rule.target_type]); }
  static updateCommRules(tenantId: number, rules: any[]) { for (const rule of rules) dbRun("INSERT OR REPLACE INTO governance_comm_rules (tenant_id, sender_level, receiver_level, comm_type, is_allowed, require_approval, approval_level) VALUES (?, ?, ?, ?, ?, ?, ?)", [tenantId, rule.sender_level, rule.receiver_level, rule.comm_type, rule.is_allowed, rule.require_approval, rule.approval_level || null]); }
}

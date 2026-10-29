/**
 * One-time cleanup of residue left by FreeOS v0.0.x organization seeding.
 *
 * Runs from initDatabase, which the upgraded process reaches only after the
 * F9 full backup in scripts/install.sh, scripts/install.ps1, and the desktop
 * in-app upgrade (backupSQLiteBeforeUpgrade before the package is replaced).
 * A database that never had these rows is a no-op. A marker row makes the
 * second start a no-op as well. Tenant status is never updated.
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { dbAll, dbGet, dbRun } from "./db";

export const F10_MARKER = "f10_v010_seed_residue";

const DEMO_EMAILS = ["demo@demo.com", "user@demo.com"] as const;

export const P16_ERROR_LEARNING = {
  failure_reasons:
    "const 临时死区（TDZ）导致员工详情页白屏崩溃。isOwnProfile 在 useState 声明前访问了 employee 变量（line 48 引用，line 51 声明），触发 ReferenceError。根因：replace_in_file 只改了局部代码，未 re-read 确认变量声明顺序。",
  knowledge_gaps:
    "批量编辑时仅依赖单文件上下文，缺乏跨行预检步骤。AI 对大文件编辑缺乏变量声明顺序的静态扫描。",
  improvement_plans:
    "【铁律1】部署前必须 npx tsc --noEmit；【铁律2】每次 replace_in_file 后必须 re-read 改动位置前后 10 行，确认 const/let/var 声明顺序；【铁律3】改 5+ 文件时按模块分批 build，不一次性全改。",
  extracted_skills: "TypeScript 静态检查; const TDZ 预防; replace_in_file 安全编辑",
  learned_knowledge:
    "JavaScript const 声明在块级作用域中不会被提升（hoisting），在声明行之前访问会导致 ReferenceError。这与 var 不同（var 会被提升但值为 undefined）。在批量编辑多文件时，必须 TS 编译检查 + 逐文件 re-read 验证变量声明顺序，不能依赖单次 read_file 的碎片上下文。",
};

export const P16_KNOWLEDGE = {
  success_factors:
    "7条部署铁律从多次事故中提炼：①TS编译检查；②re-read上下文；③分批build；④本地冒烟；⑤部署后文件状态确认；⑥PM2日志验证；⑦浏览器最终验证。这些规则是系统稳定性的最后防线，不可违背。",
  extracted_skills: "部署SOP; 安全生产; 反思引擎",
  learned_knowledge:
    "XYOS 部署 SOP 铁律（2026-06-27 制定）：\n【铁律1-TS检查】部署前必须跑 npx tsc --noEmit，比 read_lints 更严。\n【铁律2-re-read上下文】每次 replace_in_file 后必须 re-read 改动位置前后 10 行，确认变量声明顺序、导入完整性、引用存在性。\n【铁律3-分批验证】改 5+ 文件时按模块分批 build，不在全部改完后再 build。\n【铁律4-本地冒烟】关键页面改完后本地 vite 预览确认不白屏。\n【铁律5-部署后验证文件】确认 dist/ 文件数正确，plink 查看文件清单。\n【铁律6-部署后验证PM2】pm2 logs --lines 20，排查 Cannot find module / ReferenceError。\n【铁律7-浏览器验证】关键页面逐个确认可访问、头像正常、权限正确。",
};

export const SEED_PLUGIN = {
  name: "AI合同智能解析",
  slug: "ai合同智能解析",
  category: "法务合规",
  description: "上传PDF/DOCX合同文档，AI自动提取合同信息与收/付款节点，一键入库",
  version: "1.0.0",
  author: "雄元科技",
  price: "¥99/月",
  tags: "AI,合同,解析,文档",
};

const OWNERSHIP: Array<{ table: string; column: string; extra?: string }> = [
  { table: "chats", column: "created_by" },
  { table: "messages", column: "sender_id", extra: "AND sender_type = 'user'" },
  { table: "tasks", column: "created_by" },
  { table: "task_comments", column: "user_id" },
  { table: "task_attachments", column: "uploaded_by" },
  { table: "knowledge_files", column: "uploaded_by" },
  { table: "contracts", column: "created_by" },
  { table: "employees", column: "user_id" },
  { table: "announcements", column: "created_by" },
  { table: "assets", column: "created_by" },
  { table: "workflow_instances", column: "started_by" },
  { table: "pending_reviews", column: "initiator_user_id" },
  { table: "projects", column: "created_by" },
  { table: "projects", column: "owner_id" },
  { table: "documents", column: "created_by" },
  { table: "documents", column: "owner_id" },
  { table: "docs", column: "created_by" },
  { table: "knowledge_notes", column: "user_id" },
  { table: "knowledge_documents", column: "created_by" },
];

function tableHasColumn(table: string, column: string): boolean {
  const exists = dbGet(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [table],
  );
  if (!exists) return false;
  const cols = dbAll(`PRAGMA table_info(${table})`) as Array<{ name?: string }>;
  return cols.some((col) => col.name === column);
}

function userOwnsData(userId: number): boolean {
  for (const item of OWNERSHIP) {
    if (!tableHasColumn(item.table, item.column)) continue;
    const hit = dbGet(
      `SELECT 1 AS hit FROM ${item.table} WHERE ${item.column} = ? ${item.extra || ""} LIMIT 1`,
      [userId],
    );
    if (hit) return true;
  }
  return false;
}

function ensureUserStatusColumn(): void {
  if (tableHasColumn("users", "status")) return;
  try {
    dbRun("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  } catch (error: any) {
    if (!String(error?.message || "").includes("duplicate column")) throw error;
  }
}

function ensureMarkerTable(): void {
  dbRun(`CREATE TABLE IF NOT EXISTS org_upgrade_markers (
    marker TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
    detail TEXT
  )`);
}

function ensureAuditTable(): void {
  dbRun(`CREATE TABLE IF NOT EXISTS workflow_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

function audit(tenantId: number, userId: number, action: string, targetType: string, targetId: number, detail: string): void {
  if (!tableHasColumn("workflow_audit_log", "action")) {
    console.log(`[迁移] F10 ${action} tenant=${tenantId} target=${targetType}#${targetId} ${detail}`);
    return;
  }
  dbRun(
    `INSERT INTO workflow_audit_log (tenant_id, user_id, action, target_type, target_id, new_value)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, userId, action, targetType, targetId, detail],
  );
  console.log(`[迁移] F10 ${action} ${targetType}#${targetId} ${detail}`);
}

function unusablePasswordHash(): string {
  return bcrypt.hashSync(randomBytes(32).toString("hex"), 10);
}

function isBootstrapSuperAdmin(row: {
  email?: string;
  role?: string;
  tenant_id?: number;
  nickname?: string;
}): boolean {
  return row.email === "admin@example.com"
    && row.role === "super_admin"
    && Number(row.tenant_id) === 1
    && row.nickname === "超级管理员";
}

function cleanupSeedUsers(actions: string[]): void {
  const rows = dbAll(
    "SELECT id, email, role, tenant_id, nickname, status FROM users WHERE email IN ('demo@demo.com', 'user@demo.com', 'admin@example.com')",
  ) as Array<{ id: number; email: string; role: string; tenant_id: number; nickname: string; status?: string }>;
  for (const row of rows) {
    const demo = (DEMO_EMAILS as readonly string[]).includes(row.email);
    const seededAdmin = isBootstrapSuperAdmin(row);
    if (!demo && !seededAdmin) {
      const note = `left ${row.email}; not the seeded bootstrap super-admin`;
      actions.push(note);
      audit(Number(row.tenant_id) || 0, Number(row.id), "f10_leave_user", "user", Number(row.id), note);
      continue;
    }
    const owns = userOwnsData(Number(row.id));
    const status = owns ? "active" : "disabled";
    dbRun(
      `UPDATE users
       SET password_hash = ?, must_change_password = 1, token_version = COALESCE(token_version, 0) + 1, status = ?
       WHERE id = ?`,
      [unusablePasswordHash(), status, row.id],
    );
    const note = owns
      ? `${row.email} kept enabled; seeded password invalidated; password reset required`
      : `${row.email} disabled; seeded password invalidated`;
    actions.push(note);
    audit(Number(row.tenant_id) || 0, Number(row.id), owns ? "f10_reset_seed_user" : "f10_disable_seed_user", "user", Number(row.id), note);
  }
}

function textEq(actual: unknown, expected: string | null): boolean {
  if (expected === null) return actual === null || actual === undefined || actual === "";
  return actual === expected;
}

function cleanupP16(actions: string[]): void {
  if (!tableHasColumn("reflections", "learned_knowledge")) return;
  const rows = dbAll(
    `SELECT id, tenant_id, employee_id, task_id, reflection_type, success_factors, failure_reasons,
            knowledge_gaps, improvement_plans, extracted_skills, learned_knowledge, importance_score
     FROM reflections
     WHERE tenant_id = 1 AND employee_id = 0
       AND reflection_type IN ('error_learning', 'knowledge_capture')`,
  ) as Array<Record<string, unknown>>;
  for (const row of rows) {
    const exactError = row.reflection_type === "error_learning"
      && (row.task_id === null || row.task_id === undefined)
      && textEq(row.success_factors, null)
      && textEq(row.failure_reasons, P16_ERROR_LEARNING.failure_reasons)
      && textEq(row.knowledge_gaps, P16_ERROR_LEARNING.knowledge_gaps)
      && textEq(row.improvement_plans, P16_ERROR_LEARNING.improvement_plans)
      && textEq(row.extracted_skills, P16_ERROR_LEARNING.extracted_skills)
      && textEq(row.learned_knowledge, P16_ERROR_LEARNING.learned_knowledge)
      && Number(row.importance_score) === 95;
    const exactKnowledge = row.reflection_type === "knowledge_capture"
      && (row.task_id === null || row.task_id === undefined)
      && textEq(row.success_factors, P16_KNOWLEDGE.success_factors)
      && textEq(row.failure_reasons, null)
      && textEq(row.knowledge_gaps, null)
      && textEq(row.improvement_plans, null)
      && textEq(row.extracted_skills, P16_KNOWLEDGE.extracted_skills)
      && textEq(row.learned_knowledge, P16_KNOWLEDGE.learned_knowledge)
      && Number(row.importance_score) === 98;
    if (exactError || exactKnowledge) {
      dbRun("DELETE FROM reflections WHERE id = ?", [row.id]);
      const note = `removed exact P16 ${row.reflection_type} row`;
      actions.push(note);
      audit(1, 0, "f10_remove_p16_seed", "reflection", Number(row.id), note);
      continue;
    }
    const blob = `${row.failure_reasons || ""}\n${row.learned_knowledge || ""}\n${row.success_factors || ""}`;
    if (!blob.includes("部署铁律") && !blob.includes("const 死区") && !blob.includes("const 临时死区")) continue;
    const note = `kept user-edited P16 ${row.reflection_type} row ${row.id}`;
    actions.push(note);
    audit(1, 0, "f10_keep_edited_p16", "reflection", Number(row.id), note);
  }
}

function pluginIsSeedFingerprint(row: Record<string, unknown>): boolean {
  const config = row.config_json;
  const configEmpty = config === null || config === undefined || config === "";
  return row.name === SEED_PLUGIN.name
    && row.slug === SEED_PLUGIN.slug
    && row.category === SEED_PLUGIN.category
    && row.description === SEED_PLUGIN.description
    && row.version === SEED_PLUGIN.version
    && row.author === SEED_PLUGIN.author
    && row.price === SEED_PLUGIN.price
    && row.tags === SEED_PLUGIN.tags
    && Number(row.install_count) === 0
    && Number(row.rating) === 5
    && configEmpty;
}

function cleanupSeedPlugin(actions: string[]): void {
  if (!tableHasColumn("plugins", "slug")) return;
  const rows = dbAll(
    "SELECT * FROM plugins WHERE slug = ? OR name = ?",
    [SEED_PLUGIN.slug, SEED_PLUGIN.name],
  ) as Array<Record<string, unknown>>;
  for (const row of rows) {
    const id = Number(row.id);
    const tenantId = Number(row.tenant_id) || 0;
    if (!pluginIsSeedFingerprint(row)) {
      const note = `left plugin #${id}; not the v0.0.x auto-install fingerprint`;
      actions.push(note);
      audit(tenantId, 0, "f10_leave_plugin", "plugin", id, note);
      continue;
    }
    const installed = tableHasColumn("tenant_plugin_installs", "plugin_id")
      ? dbGet("SELECT id FROM tenant_plugin_installs WHERE plugin_id = ?", [id])
      : undefined;
    if (installed) {
      const note = `left plugin #${id}; an install record makes it indistinguishable from a user install`;
      actions.push(note);
      audit(tenantId, 0, "f10_leave_plugin", "plugin", id, note);
      continue;
    }
    dbRun("UPDATE plugins SET status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    const note = `disabled auto-installed plugin #${id} without deleting the catalog row`;
    actions.push(note);
    audit(tenantId, 0, "f10_disable_seed_plugin", "plugin", id, note);
  }
}

export function cleanupV010SeedResidue(): void {
  ensureMarkerTable();
  const marker = dbGet("SELECT marker FROM org_upgrade_markers WHERE marker = ?", [F10_MARKER]);
  if (marker) return;
  ensureAuditTable();
  ensureUserStatusColumn();
  const actions: string[] = [];
  if (tableHasColumn("users", "email")) cleanupSeedUsers(actions);
  cleanupP16(actions);
  cleanupSeedPlugin(actions);
  if (actions.length === 0) actions.push("no v0.0.x seed residue");
  dbRun(
    "INSERT INTO org_upgrade_markers (marker, detail) VALUES (?, ?)",
    [F10_MARKER, actions.join("\n")],
  );
}

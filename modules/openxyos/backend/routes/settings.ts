import { Router } from "express";
import fs from "fs";
import path from "path";
import { dbAll, dbGet, dbRun, getDb, saveDb } from "../db";
import { authenticate, requireAdmin, requireSuperAdmin, AuthRequest } from "../middleware";
import { LLM_PROVIDERS, type LLMProviderId } from "../llm-providers";
import { localizedError } from "../utils/locale";

// 数据库备份目录
// Keep backups outside an immutable release directory in production. The default
// preserves the local-development layout, while deployments can set BACKUP_DIR.
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "..", "data", "backups");

export const settingsRoutes = Router();
settingsRoutes.use(authenticate);

const settingsError = (req: AuthRequest, zh: string, en: string) => localizedError(req, zh, en);

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ===== 数据库管理 API（仅超级管理员） =====

// 获取数据库信息
settingsRoutes.get("/database/info", requireSuperAdmin, (req: AuthRequest, res) => {
  try {
    const db = getDb();
    // 获取表数量和行数统计
    const tables = dbAll(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    let totalRows = 0;
    const tableStats: Record<string, number> = {};
    for (const t of tables as any[]) {
      try {
        const r = dbGet(`SELECT COUNT(*) as c FROM [${t.name}]`);
        const c = r?.c || 0;
        totalRows += c;
        tableStats[t.name] = c;
      } catch {}
    }

    // 数据库文件大小
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "xiongyuan.db");
    let fileSizeBytes = 0;
    if (fs.existsSync(dbPath)) {
      const stat = fs.statSync(dbPath);
      fileSizeBytes = stat.size;
    }

    // 备份列表
    let backups: any[] = [];
    if (fs.existsSync(BACKUP_DIR)) {
      backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith(".db"))
        .map(f => {
          const fp = path.join(BACKUP_DIR, f);
          const stat = fs.statSync(fp);
          return { filename: f, size: stat.size, created_at: stat.birthtime.toISOString() };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    res.json({
      success: true,
      data: {
        dialect: "sqlite",
        file_size_bytes: fileSizeBytes,
        file_size_human: formatBytes(fileSizeBytes),
        table_count: tables.length,
        total_rows: totalRows,
        table_stats: tableStats,
        backups_count: backups.length,
        latest_backup: backups[0]?.created_at || null,
        backups: backups.slice(0, 10), // 最近10个备份
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

// 创建数据库备份
settingsRoutes.post("/database/backup", requireSuperAdmin, (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const data = db.export();
    const buffer = Buffer.from(data);

    // 文件名格式：xyos-YYYYMMDD-HHMMSS.db
    const now = new Date();
    const ts = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, "0")
      + String(now.getDate()).padStart(2, "0") + "-"
      + String(now.getHours()).padStart(2, "0")
      + String(now.getMinutes()).padStart(2, "0")
      + String(now.getSeconds()).padStart(2, "0");
    const filename = `xyos-${ts}.db`;
    const filePath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filePath, buffer);

    // 限制备份文件数量（最多保留20个）
    cleanupBackups(20);

    res.json({
      success: true,
      data: {
        filename,
        size: buffer.length,
        size_human: formatBytes(buffer.length),
        path: filePath,
        message: settingsError(req, "数据库备份成功", "Database backup created"),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

// 列出所有备份
settingsRoutes.get("/database/backups", requireSuperAdmin, (req: AuthRequest, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({ success: true, data: [] });
    }

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith(".db") || f.endsWith(".db.bak"))
      .map(f => {
        const fp = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(fp);
        return {
          filename: f,
          size: stat.size,
          size_human: formatBytes(stat.size),
          created_at: stat.birthtime.toISOString(),
          modified_at: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime());

    res.json({ success: true, data: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

// 恢复数据库备份
settingsRoutes.post("/database/restore", requireSuperAdmin, (req: AuthRequest, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: settingsError(req, "请指定要恢复的备份文件名", "Specify the backup file to restore") });
    }

    // 安全检查：防止路径穿越
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ success: false, error: settingsError(req, "非法的文件名", "Invalid filename") });
    }

    const backupPath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: settingsError(req, "备份文件不存在", "Backup file was not found") });
    }

    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "xiongyuan.db");

    // 先创建当前数据库的自动备份（安全回滚点）
    const preRestoreBackup = `pre-restore-${Date.now()}.bak`;
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, path.join(BACKUP_DIR, preRestoreBackup));
    }

    // 执行恢复：覆盖主数据库文件
    fs.copyFileSync(backupPath, dbPath);

    res.json({
      success: true,
      data: {
        message: settingsError(req, "数据库恢复成功，将在下次重启后生效（或点击立即重载）", "Database restore succeeded. It takes effect after the next restart (or immediate reload)."),
        restored_from: filename,
        safety_backup: preRestoreBackup,
        note: settingsError(req, "建议重启后端服务以确保数据完全加载", "Restart the backend service to fully load the restored database."),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

// 删除备份文件
settingsRoutes.delete("/database/backups/:filename", requireSuperAdmin, (req: AuthRequest, res) => {
  try {
    const { filename } = req.params;
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ success: false, error: settingsError(req, "非法的文件名", "Invalid filename") });
    }

    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: settingsError(req, "文件不存在", "File was not found") });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, data: { message: settingsError(req, "备份已删除", "Backup deleted") } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

// ===== 工具函数 =====
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function cleanupBackups(maxKeep: number): void {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("xyos-") && f.endsWith(".db"))
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  while (files.length > maxKeep) {
    const old = files.pop();
    if (old) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, old.name)); } catch {}
    }
  }
}

settingsRoutes.get("/registration", (req: AuthRequest, res) => {
  try {
    const setting = dbGet("SELECT setting_value FROM company_settings WHERE setting_key = 'registration_enabled'") as any;
    const enabled = setting ? setting.setting_value === "true" : true;
    res.json({ success: true, data: { enabled } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.put("/registration", requireAdmin, (req: AuthRequest, res) => {
  try {
    const { enabled } = req.body;
    dbRun(
      "INSERT OR REPLACE INTO company_settings (company_id, setting_key, setting_value, tenant_id, updated_at) VALUES (1, 'registration_enabled', ?, ?, CURRENT_TIMESTAMP)",
      [enabled ? "true" : "false", req.user!.tenant_id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.get("/company", (req: AuthRequest, res) => {
  try {
    const company = dbGet("SELECT * FROM companies WHERE tenant_id = ?", [req.user!.tenant_id]);
    const settings = dbAll("SELECT * FROM company_settings WHERE tenant_id = ?", [req.user!.tenant_id]);
    const settingsMap: Record<string, string> = {};
    for (const s of settings as any[]) {
      settingsMap[s.setting_key] = s.setting_value;
    }
    res.json({ success: true, data: { company, settings: settingsMap } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.put("/company", requireAdmin, (req: AuthRequest, res) => {
  try {
    const { name, settings } = req.body;
    if (name) {
      dbRun("UPDATE companies SET name = ? WHERE tenant_id = ?", [name, req.user!.tenant_id]);
    }
    if (settings && typeof settings === "object") {
      for (const [key, value] of Object.entries(settings)) {
        dbRun(
          "INSERT OR REPLACE INTO company_settings (company_id, setting_key, setting_value, tenant_id, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
          [1, key, value, req.user!.tenant_id]
        );
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.get("/ai", (req: AuthRequest, res) => {
  try {
    const configs = dbAll("SELECT * FROM ai_config WHERE tenant_id = ?", [req.user!.tenant_id]);
    const configMap: Record<string, string> = {};
    for (const c of configs as any[]) {
      if (c.key === "llm_api_key") {
        configMap.llm_api_key = "";
        configMap.llm_api_key_configured = c.value ? "true" : "false";
      } else {
        configMap[c.key] = c.value;
      }
    }
    res.json({ success: true, data: configMap });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.put("/ai/onboarding", requireAdmin, (req: AuthRequest, res) => {
  try {
    const providerId = String(req.body?.providerId || "") as LLMProviderId;
    const apiKey = String(req.body?.apiKey || "").trim();
    const preset = LLM_PROVIDERS[providerId];
    if (!preset) return res.status(400).json({ success: false, error: settingsError(req, "请选择受支持的大模型", "Choose a supported AI model") });
    const isLocal = providerId === "ollama" || Boolean("local" in preset && preset.local);
    if (!isLocal && (apiKey.length < 8 || apiKey.length > 512 || /\s/.test(apiKey))) {
      return res.status(400).json({ success: false, error: settingsError(req, "API Key 格式无效", "API key format is invalid") });
    }
    if (isLocal && apiKey && (apiKey.length > 512 || /\s/.test(apiKey))) {
      return res.status(400).json({ success: false, error: settingsError(req, "API Key 格式无效", "API key format is invalid") });
    }

    const values = {
      llm_provider: providerId,
      llm_api_base: preset.baseUrl,
      llm_model: preset.model,
      llm_api_key: isLocal ? (apiKey || "ollama") : apiKey,
      ai_reply_enabled: "true",
    };
    for (const [key, value] of Object.entries(values)) {
      dbRun(
        "INSERT OR REPLACE INTO ai_config (key, value, tenant_id, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        [key, value, req.user!.tenant_id],
      );
    }
    res.json({
      success: true,
      data: { providerId, provider: preset.provider, model: preset.model, configured: true },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.put("/ai", requireAdmin, (req: AuthRequest, res) => {
  try {
    // Accept both { configs: {...} } and flat { key: value } formats
    const entries = req.body.configs || req.body;
    if (entries && typeof entries === "object") {
      for (const [key, value] of Object.entries(entries)) {
        if (value !== undefined && value !== null) {
          dbRun(
            "INSERT OR REPLACE INTO ai_config (key, value, tenant_id, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            [key, String(value), req.user!.tenant_id]
          );
        }
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.get("/roles", (req: AuthRequest, res) => {
  try {
    const roles = dbAll("SELECT * FROM roles WHERE tenant_id = ?", [req.user!.tenant_id]);
    res.json({ success: true, data: roles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.post("/roles", requireAdmin, (req: AuthRequest, res) => {
  try {
    const { name, permissions } = req.body;
    if (!name || !permissions) return res.status(400).json({ success: false, error: settingsError(req, "名称和权限必填", "Name and permissions are required") });
    const result = dbRun(
      "INSERT INTO roles (name, permissions, tenant_id) VALUES (?, ?, ?)",
      [name, JSON.stringify(permissions), req.user!.tenant_id]
    );
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.put("/roles/:id", requireAdmin, (req: AuthRequest, res) => {
  try {
    const { name, permissions } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (name) { updates.push("name = ?"); params.push(name); }
    if (permissions) { updates.push("permissions = ?"); params.push(JSON.stringify(permissions)); }
    if (updates.length === 0) return res.status(400).json({ success: false, error: settingsError(req, "无更新内容", "No updates were supplied") });
    params.push(req.params.id, req.user!.tenant_id);
    dbRun(`UPDATE roles SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, params);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.delete("/roles/:id", requireAdmin, (req: AuthRequest, res) => {
  try {
    dbRun("DELETE FROM roles WHERE id = ? AND tenant_id = ?", [req.params.id, req.user!.tenant_id]);
    dbRun("DELETE FROM user_roles WHERE role_id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.get("/users", requireAdmin, (req: AuthRequest, res) => {
  try {
    const users = dbAll(
      `SELECT u.*, GROUP_CONCAT(r.name) as role_names
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.tenant_id = ?
       GROUP BY u.id`,
      [req.user!.tenant_id]
    );
    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.post("/users", requireAdmin, (req: AuthRequest, res) => {
  try {
    const { email, password, nickname, role } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: settingsError(req, "邮箱和密码必填", "Email and password are required") });

    const existing = dbGet("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) return res.status(400).json({ success: false, error: settingsError(req, "邮箱已注册", "Email is already registered") });

    const bcrypt = require("bcryptjs");
    const hash = bcrypt.hashSync(password, 10);
    const userRole = role || "user";

    if (userRole === "super_admin" && req.user!.role !== "super_admin") {
      return res.status(403).json({ success: false, error: settingsError(req, "只有超级管理员可以创建超级管理员", "Only super administrators can create super administrators") });
    }

    const result = dbRun(
      "INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
      [email, hash, nickname || email.split("@")[0], userRole, req.user!.tenant_id]
    );
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.put("/users/:id", requireAdmin, (req: AuthRequest, res) => {
  try {
    const { nickname, role, password } = req.body;
    const targetUser = dbGet("SELECT * FROM users WHERE id = ? AND tenant_id = ?", [req.params.id, req.user!.tenant_id]) as any;
    if (!targetUser) return res.status(404).json({ success: false, error: settingsError(req, "用户不存在", "User was not found") });

    if (targetUser.role === "super_admin" && req.user!.role !== "super_admin") {
      return res.status(403).json({ success: false, error: settingsError(req, "只有超级管理员可以修改超级管理员", "Only super administrators can edit super administrators") });
    }

    if (role === "super_admin" && req.user!.role !== "super_admin") {
      return res.status(403).json({ success: false, error: settingsError(req, "只有超级管理员可以设置超级管理员角色", "Only super administrators can assign the super administrator role") });
    }

    const updates: string[] = [];
    const params: any[] = [];
    if (nickname) { updates.push("nickname = ?"); params.push(nickname); }
    if (role) { updates.push("role = ?"); params.push(role); }
    if (password) {
      const bcrypt = require("bcryptjs");
      updates.push("password_hash = ?");
      params.push(bcrypt.hashSync(password, 10));
    }

    if (updates.length === 0) return res.status(400).json({ success: false, error: settingsError(req, "无更新内容", "No updates were supplied") });

    params.push(req.params.id, req.user!.tenant_id);
    dbRun(`UPDATE users SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, params);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.delete("/users/:id", requireAdmin, (req: AuthRequest, res) => {
  try {
    const targetUser = dbGet("SELECT * FROM users WHERE id = ? AND tenant_id = ?", [req.params.id, req.user!.tenant_id]) as any;
    if (!targetUser) return res.status(404).json({ success: false, error: settingsError(req, "用户不存在", "User was not found") });

    if (targetUser.role === "super_admin") {
      return res.status(403).json({ success: false, error: settingsError(req, "不能删除超级管理员", "Super administrators cannot be deleted") });
    }

    if (targetUser.id === req.user!.id) {
      return res.status(400).json({ success: false, error: settingsError(req, "不能删除自己", "You cannot delete your own account") });
    }

    dbRun("DELETE FROM users WHERE id = ? AND tenant_id = ?", [req.params.id, req.user!.tenant_id]);
    dbRun("DELETE FROM user_roles WHERE user_id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.post("/users/:userId/roles", requireAdmin, (req: AuthRequest, res) => {
  try {
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ success: false, error: settingsError(req, "角色ID必填", "Role ID is required") });
    dbRun(
      "INSERT OR IGNORE INTO user_roles (user_id, role_id, tenant_id) VALUES (?, ?, ?)",
      [req.params.userId, roleId, req.user!.tenant_id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

settingsRoutes.delete("/users/:userId/roles/:roleId", requireAdmin, (req: AuthRequest, res) => {
  try {
    dbRun(
      "DELETE FROM user_roles WHERE user_id = ? AND role_id = ? AND tenant_id = ?",
      [req.params.userId, req.params.roleId, req.user!.tenant_id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

// ===== 空中模式（私有化策略）开关 =====

// 获取当前空中模式状态
settingsRoutes.get("/air-gap", requireAdmin, (req: AuthRequest, res) => {
  try {
    const row = dbGet("SELECT setting_value FROM company_settings WHERE setting_key = 'air_gap_mode'") as any;
    const enabled = row?.setting_value === "true";
    res.json({ success: true, data: { airGapMode: enabled } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

// 切换空中模式
settingsRoutes.post("/air-gap", requireAdmin, (req: AuthRequest, res) => {
  try {
    const { enabled } = req.body;
    const value = enabled ? "true" : "false";
    const existing = dbGet("SELECT id FROM company_settings WHERE setting_key = 'air_gap_mode'") as any;
    if (existing) {
      dbRun("UPDATE company_settings SET setting_value = ? WHERE setting_key = 'air_gap_mode'", [value]);
    } else {
      dbRun("INSERT INTO company_settings (company_id, setting_key, setting_value, tenant_id) VALUES (1, 'air_gap_mode', ?, 1)", [value]);
    }
    saveDb();
    res.json({ success: true, data: { airGapMode: enabled } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: settingsError(req, "系统设置服务暂时不可用，请稍后重试", "Settings service is temporarily unavailable. Please try again") });
  }
});

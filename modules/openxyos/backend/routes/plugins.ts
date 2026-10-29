import { Router } from "express";
import { dbAll, dbGet, dbRun } from "../db";
import { authenticate, AuthRequest } from "../middleware";

export const pluginRoutes = Router();
pluginRoutes.use(authenticate);

const FREE_PRICES = new Set(["", "免费", "免费额度", "free", "free tier", "0"]);

function isPaidPrice(price: unknown): boolean {
  return !FREE_PRICES.has(String(price || "").trim().toLowerCase());
}

function writePluginAudit(tenantId: number, userId: number, action: string, pluginId: number, detail: string): void {
  dbRun(
    `CREATE TABLE IF NOT EXISTS workflow_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  );
  dbRun(
    `INSERT INTO workflow_audit_log (tenant_id, user_id, action, target_type, target_id, new_value)
     VALUES (?, ?, ?, 'plugin', ?, ?)`,
    [tenantId, userId, action, pluginId, detail],
  );
}

pluginRoutes.get("/", (req: AuthRequest, res) => {
  try {
    const { category, search, sort } = req.query;
    let sql = "SELECT * FROM plugins WHERE tenant_id = ? AND status = 'active'";
    const params: any[] = [req.user!.tenant_id];

    if (category) { sql += " AND category = ?"; params.push(category); }
    if (search) { sql += " AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    if (sort === "popular") sql += " ORDER BY install_count DESC";
    else if (sort === "rating") sql += " ORDER BY rating DESC";
    else if (sort === "newest") sql += " ORDER BY created_at DESC";
    else sql += " ORDER BY category, name";

    res.json({ success: true, data: dbAll(sql, params) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

pluginRoutes.get("/stats", (req: AuthRequest, res) => {
  try {
    const tid = req.user!.tenant_id;
    const total = dbGet("SELECT COUNT(*) as c FROM plugins WHERE tenant_id = ? AND status = 'active'", [tid]) as any;
    const byCategory = dbAll(
      "SELECT category, COUNT(*) as count FROM plugins WHERE tenant_id = ? AND status = 'active' GROUP BY category ORDER BY count DESC",
      [tid]
    );

    res.json({ success: true, data: { total: total.c, byCategory } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 插件启用/禁用切换
pluginRoutes.post("/:id/toggle", (req: AuthRequest, res) => {
  try {
    const plugin = dbGet(
      "SELECT * FROM plugins WHERE id = ? AND tenant_id = ?",
      [parseInt(req.params.id), req.user!.tenant_id]
    ) as any;
    if (!plugin) return res.status(404).json({ success: false, error: "插件不存在" });

    const newStatus = plugin.status === "active" ? "disabled" : "active";
    dbRun("UPDATE plugins SET status = ? WHERE id = ? AND tenant_id = ?", [newStatus, plugin.id, req.user!.tenant_id]);
    res.json({ success: true, data: { id: plugin.id, status: newStatus } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// 获取租户已安装的插件ID列表
pluginRoutes.get("/installed", (req: AuthRequest, res) => {
  try {
    const rows = dbAll(
      "SELECT plugin_id FROM tenant_plugin_installs WHERE tenant_id = ?",
      [req.user!.tenant_id]
    ) as any[];
    res.json({ success: true, data: rows.map((r: any) => r.plugin_id) });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// 安装插件
pluginRoutes.post("/:id/install", (req: AuthRequest, res) => {
  try {
    const plugin = dbGet(
      "SELECT * FROM plugins WHERE id = ? AND tenant_id = ?",
      [parseInt(req.params.id), req.user!.tenant_id]
    ) as any;
    if (!plugin) return res.status(404).json({ success: false, error: "插件不存在" });

    if (isPaidPrice(plugin.price)) {
      const confirmed = req.body?.confirm_price === true && String(req.body?.price || "") === String(plugin.price);
      if (!confirmed) {
        return res.status(409).json({
          success: false,
          code: "PRICE_CONFIRMATION_REQUIRED",
          error: "付费插件需要明确确认价格后才能启用",
          data: { price: plugin.price, enabled: false },
        });
      }
    }

    const already = dbGet(
      "SELECT id FROM tenant_plugin_installs WHERE tenant_id = ? AND plugin_id = ?",
      [req.user!.tenant_id, plugin.id]
    );
    if (!already) {
      dbRun(
        "INSERT INTO tenant_plugin_installs (tenant_id, plugin_id) VALUES (?, ?)",
        [req.user!.tenant_id, plugin.id]
      );
      dbRun("UPDATE plugins SET install_count = install_count + 1 WHERE id = ?", [plugin.id]);
    }
    dbRun("UPDATE plugins SET status = 'active' WHERE id = ? AND tenant_id = ?", [plugin.id, req.user!.tenant_id]);
    writePluginAudit(
      req.user!.tenant_id,
      req.user!.id,
      "f6_install_plugin",
      plugin.id,
      `enabled ${plugin.slug || plugin.name} after ${isPaidPrice(plugin.price) ? "price confirmation" : "free install"}`,
    );

    res.json({ success: true, data: { installed: true, enabled: true, message: "安装成功" } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// 卸载插件
pluginRoutes.post("/:id/uninstall", (req: AuthRequest, res) => {
  try {
    const pluginId = parseInt(req.params.id);
    const plugin = dbGet(
      "SELECT id, slug, name FROM plugins WHERE id = ? AND tenant_id = ?",
      [pluginId, req.user!.tenant_id]
    ) as { id: number; slug?: string; name?: string } | undefined;
    if (!plugin) return res.status(404).json({ success: false, error: "插件不存在" });
    dbRun(
      "DELETE FROM tenant_plugin_installs WHERE tenant_id = ? AND plugin_id = ?",
      [req.user!.tenant_id, plugin.id]
    );
    dbRun(
      "UPDATE plugins SET status = 'disabled' WHERE id = ? AND tenant_id = ?",
      [plugin.id, req.user!.tenant_id]
    );
    writePluginAudit(
      req.user!.tenant_id,
      req.user!.id,
      "f6_uninstall_plugin",
      plugin.id,
      `disabled ${plugin.slug || plugin.name}; catalog row kept`,
    );
    res.json({ success: true, data: { installed: false, enabled: false, status: "disabled" } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

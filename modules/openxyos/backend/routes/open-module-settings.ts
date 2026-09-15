import { Router } from "express";
import { dbAll, dbGet, dbRun } from "../db";
import { authenticate, AuthRequest, requireAdmin } from "../middleware";
import { isLockedModule, isOpenXyosModuleKey, OPENXYOS_MODULES } from "../open-module-catalog";

export const openModuleSettingsRoutes = Router();
openModuleSettingsRoutes.use(authenticate);

let schemaReady = false;
function ensureSchema() {
  if (schemaReady) return;
  try { dbRun("ALTER TABLE tenant_module_settings ADD COLUMN display_name TEXT"); }
  catch (error: any) { if (!error.message?.includes("duplicate column")) throw error; }
  schemaReady = true;
}
function resolveTenantId(req: AuthRequest, requested: unknown): number | null {
  const id = requested === undefined || requested === null || requested === "" ? req.user!.tenant_id : Number(requested);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (id !== req.user!.tenant_id && req.user!.role !== "super_admin") return null;
  return id;
}
function readModules(tenantId: number) {
  ensureSchema();
  const rows = dbAll("SELECT module_key, enabled, display_name FROM tenant_module_settings WHERE tenant_id = ?", [tenantId]) as Array<{module_key:string;enabled:number;display_name:string|null}>;
  const stored = new Map(rows.map(row => [row.module_key, row]));
  return OPENXYOS_MODULES.map(module => {
    const setting = stored.get(module.key);
    return { ...module, defaultLabel: module.label, label: setting?.display_name?.trim() || module.label, enabled: module.locked ? true : setting?.enabled !== 0 };
  });
}

openModuleSettingsRoutes.get("/", (req: AuthRequest, res) => {
  try {
    const tenantId = resolveTenantId(req, req.query.tenant_id);
    if (!tenantId) return res.status(403).json({ success:false, error:"无权查看该租户的模块设置" });
    const tenant = dbGet("SELECT id, name FROM tenants WHERE id = ?", [tenantId]);
    if (!tenant) return res.status(404).json({ success:false, error:"租户不存在" });
    res.json({ success:true, data:{ tenant, modules:readModules(tenantId) } });
  } catch (error:any) { res.status(500).json({ success:false, error:error.message }); }
});

openModuleSettingsRoutes.put("/", requireAdmin, (req: AuthRequest, res) => {
  try {
    const tenantId = resolveTenantId(req, req.body?.tenant_id);
    if (!tenantId) return res.status(403).json({ success:false, error:"无权修改该租户的模块设置" });
    const updates = req.body?.updates;
    const labels = req.body?.labels;
    if ((!updates || typeof updates !== "object" || Array.isArray(updates)) && (!labels || typeof labels !== "object" || Array.isArray(labels))) {
      return res.status(400).json({ success:false, error:"请提交 updates 或 labels" });
    }
    ensureSchema();
    for (const [key,value] of Object.entries(updates || {})) {
      if (!isOpenXyosModuleKey(key)) return res.status(400).json({ success:false, error:`未知模块: ${key}` });
      if (isLockedModule(key)) return res.status(400).json({ success:false, error:`${key} 是基础模块，不能关闭` });
      if (typeof value !== "boolean") return res.status(400).json({ success:false, error:`${key} 的开关值必须是布尔值` });
      dbRun(`INSERT INTO tenant_module_settings (tenant_id,module_key,enabled,updated_by,updated_at)
        VALUES (?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(tenant_id,module_key) DO UPDATE SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`,
        [tenantId,key,value?1:0,req.user!.id]);
    }
    for (const [key,value] of Object.entries(labels || {})) {
      if (!isOpenXyosModuleKey(key)) return res.status(400).json({ success:false, error:`未知模块: ${key}` });
      if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 20) {
        return res.status(400).json({ success:false, error:`${key} 的显示名称须为 2-20 个字符` });
      }
      dbRun(`INSERT INTO tenant_module_settings (tenant_id,module_key,enabled,display_name,updated_by,updated_at)
        VALUES (?,?,1,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(tenant_id,module_key) DO UPDATE SET display_name=excluded.display_name,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`,
        [tenantId,key,value.trim(),req.user!.id]);
    }
    const tenant = dbGet("SELECT id, name FROM tenants WHERE id = ?", [tenantId]);
    res.json({ success:true, data:{ tenant, modules:readModules(tenantId) } });
  } catch (error:any) { res.status(500).json({ success:false, error:error.message }); }
});

import { Router, Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { dbAll, dbGet, dbRun } from "../db";

/**
 * FreeOS ↔ openXYOS mutual-growth bridge.
 *
 * Enabled only when the sidecar is launched by FreeOS (FREEOS_HOME or
 * FREEOS_INGEST_TOKEN). Authenticates with a shared ingest token so the
 * Organization page can push / pull assets without a login wall.
 */
export const freeosBridgeRoutes = Router();

function ingestEnabled(): boolean {
  return Boolean(
    (process.env.FREEOS_INGEST_TOKEN || "").trim() ||
      (process.env.FREEOS_HOME || "").trim(),
  );
}

function expectedToken(): string {
  return (process.env.FREEOS_INGEST_TOKEN || "").trim();
}

function tokensMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function requireIngestToken(req: Request, res: Response, next: NextFunction) {
  if (!ingestEnabled()) {
    return res.status(404).json({ success: false, error: "freeos bridge disabled" });
  }
  const expected = expectedToken();
  if (!expected) {
    return res.status(503).json({ success: false, error: "FREEOS_INGEST_TOKEN unset" });
  }
  const provided = String(req.header("x-freeos-ingest-token") || "").trim();
  if (!tokensMatch(provided, expected)) {
    return res.status(401).json({ success: false, error: "invalid ingest token" });
  }
  next();
}

function resolveTenantId(raw: unknown): number {
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  const first = dbGet("SELECT id FROM tenants ORDER BY id LIMIT 1") as { id?: number } | undefined;
  return Number(first?.id) || 1;
}

function asList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function text(value: unknown, fallback = ""): string {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function skillsText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(", ");
  }
  return text(value);
}

function upsertEmployee(tenantId: number, item: Record<string, unknown>): "created" | "updated" {
  const name = text(item.name, text(item.slug, "digital-colleague"));
  const existing = dbGet(
    "SELECT id FROM employees WHERE tenant_id = ? AND name = ?",
    [tenantId, name],
  ) as { id?: number } | undefined;
  const role = text(item.role, text(item.agent_type, "ai-colleague"));
  const agentType = text(item.agent_type, item.slug ? `freeos-${item.slug}` : "freeos");
  const skills = skillsText(item.skills || item.capabilities);
  const status = text(item.status, "active");
  const category = text(item.employment_category, "internal");
  const description = text(item.description);
  const emoji = text(item.avatar_emoji, "🤖");
  if (existing?.id) {
    dbRun(
      `UPDATE employees SET role = ?, agent_type = ?, employee_type = 'ai', skills = ?,
        avatar_emoji = ?, status = ?, employment_category = ?, description = ?
       WHERE id = ? AND tenant_id = ?`,
      [role, agentType, skills, emoji, status, category, description, existing.id, tenantId],
    );
    return "updated";
  }
  dbRun(
    `INSERT INTO employees
      (company_id, name, role, agent_type, employee_type, skills, avatar_emoji, status, employment_category, description, tenant_id)
     VALUES (?, ?, ?, ?, 'ai', ?, ?, ?, ?, ?, ?)`,
    [1, name, role, agentType, skills, emoji, status, category, description, tenantId],
  );
  return "created";
}

function upsertTalent(tenantId: number, item: Record<string, unknown>): "created" | "updated" {
  const name = text(item.name, "digital-talent");
  const existing = dbGet(
    "SELECT id FROM talent_pool WHERE tenant_id = ? AND name = ?",
    [tenantId, name],
  ) as { id?: number } | undefined;
  const skills = skillsText(item.skills || item.capabilities);
  const status = text(item.status || item.talent_status, "available");
  const description = text(item.description);
  const agentType = text(item.agent_type);
  if (existing?.id) {
    dbRun(
      `UPDATE talent_pool SET talent_type = 'ai', skills = ?, status = ?, description = ?,
        agent_type = ?, source = 'FreeOS', integration_type = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [skills, status, description, agentType, text(item.integration_type, "agent-blueprint-v1"), existing.id, tenantId],
    );
    return "updated";
  }
  dbRun(
    `INSERT INTO talent_pool
      (tenant_id, talent_type, name, skills, description, source, status, agent_type, integration_type)
     VALUES (?, 'ai', ?, ?, ?, 'FreeOS', ?, ?, ?)`,
    [tenantId, name, skills, description, status, agentType, text(item.integration_type, "agent-blueprint-v1")],
  );
  return "created";
}

function upsertPlugin(tenantId: number, item: Record<string, unknown>, category = "工具"): "created" | "updated" {
  const slug = text(item.slug || item.plugin_id || item.id || item.name);
  const name = text(item.name, slug || "freeos-plugin");
  const existing = dbGet(
    "SELECT id FROM plugins WHERE tenant_id = ? AND (slug = ? OR name = ?)",
    [tenantId, slug, name],
  ) as { id?: number } | undefined;
  const description = text(item.description, "Imported from FreeOS");
  const config = typeof item.config_json === "string" ? item.config_json : JSON.stringify(item);
  if (existing?.id) {
    dbRun(
      `UPDATE plugins SET name = ?, slug = ?, category = ?, description = ?, author = 'FreeOS',
        status = 'active', config_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [name, slug, category, description, config, existing.id, tenantId],
    );
    return "updated";
  }
  dbRun(
    `INSERT INTO plugins (tenant_id, name, slug, category, description, author, status, config_json)
     VALUES (?, ?, ?, ?, ?, 'FreeOS', 'active', ?)`,
    [tenantId, name, slug, category, description, config],
  );
  return "created";
}

function upsertSkill(tenantId: number, item: Record<string, unknown>): "created" | "updated" {
  const slug = text(item.slug || item.name);
  const name = text(item.name, slug || "freeos-skill");
  const existing = dbGet(
    "SELECT id FROM skills WHERE tenant_id = ? AND (slug = ? OR name = ?)",
    [tenantId, slug, name],
  ) as { id?: number } | undefined;
  const content = text(item.content || item.description);
  const category = text(item.category, "FreeOS");
  if (existing?.id) {
    dbRun(
      `UPDATE skills SET name = ?, slug = ?, category = ?, description = ?, content = ?,
        source = 'FreeOS', enabled = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [name, slug, category, content, content, existing.id, tenantId],
    );
    return "updated";
  }
  dbRun(
    `INSERT INTO skills (tenant_id, name, slug, category, description, content, source, enabled, author)
     VALUES (?, ?, ?, ?, ?, ?, 'FreeOS', 1, 'FreeOS')`,
    [tenantId, name, slug, category, content, content],
  );
  return "created";
}

function countOf(sql: string, tenantId: number): number {
  const row = dbGet(sql, [tenantId]) as { c?: number } | undefined;
  return Number(row?.c || 0);
}

freeosBridgeRoutes.get("/health", (_req, res) => {
  if (!ingestEnabled()) {
    return res.status(404).json({ success: false, error: "freeos bridge disabled" });
  }
  res.json({
    success: true,
    data: {
      ok: true,
      ingest: Boolean(expectedToken()),
      plane: "openxyos-control",
    },
  });
});

freeosBridgeRoutes.use(requireIngestToken);

freeosBridgeRoutes.get("/export", (req, res) => {
  const tenantId = resolveTenantId(req.query.tenant_id);
  const employees = dbAll("SELECT * FROM employees WHERE tenant_id = ? ORDER BY id", [tenantId]);
  const talent = dbAll("SELECT * FROM talent_pool WHERE tenant_id = ? ORDER BY id", [tenantId]);
  const plugins = dbAll("SELECT * FROM plugins WHERE tenant_id = ? ORDER BY id", [tenantId]);
  const skills = dbAll("SELECT * FROM skills WHERE tenant_id = ? ORDER BY id", [tenantId]);
  res.json({
    success: true,
    data: {
      tenant_id: tenantId,
      employees,
      talent,
      plugins,
      skills,
      counts: {
        employees: employees.length,
        talent: talent.length,
        plugins: plugins.length,
        skills: skills.length,
      },
    },
  });
});

freeosBridgeRoutes.post("/ingest", (req, res) => {
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const tenantId = resolveTenantId(body.tenant_id);
  const landed = {
    employees: { created: 0, updated: 0 },
    talent: { created: 0, updated: 0 },
    plugins: { created: 0, updated: 0 },
    skills: { created: 0, updated: 0 },
    mcp: { created: 0, updated: 0 },
  };

  for (const item of asList(body.employees)) {
    landed.employees[upsertEmployee(tenantId, item)] += 1;
  }
  for (const item of asList(body.talent)) {
    landed.talent[upsertTalent(tenantId, item)] += 1;
  }
  for (const item of asList(body.plugins)) {
    landed.plugins[upsertPlugin(tenantId, item)] += 1;
  }
  for (const item of asList(body.skills)) {
    landed.skills[upsertSkill(tenantId, item)] += 1;
  }
  for (const item of asList(body.mcp)) {
    landed.mcp[upsertPlugin(tenantId, { ...item, category: "MCP" }, "MCP")] += 1;
  }

  res.json({
    success: true,
    data: {
      tenant_id: tenantId,
      landed,
      counts: {
        employees: countOf("SELECT COUNT(*) as c FROM employees WHERE tenant_id = ?", tenantId),
        talent: countOf("SELECT COUNT(*) as c FROM talent_pool WHERE tenant_id = ?", tenantId),
        plugins: countOf("SELECT COUNT(*) as c FROM plugins WHERE tenant_id = ?", tenantId),
        skills: countOf("SELECT COUNT(*) as c FROM skills WHERE tenant_id = ?", tenantId),
      },
      note: "Drafts landed on the control plane. Modules are not auto-enabled.",
    },
  });
});

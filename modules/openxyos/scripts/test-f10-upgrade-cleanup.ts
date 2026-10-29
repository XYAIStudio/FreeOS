import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "freeos-f10-"));
  process.env.DATABASE_PATH = path.join(dir, "xiongyuan.db");
  process.env.FREEOS_ORG_INTEGRATED = "1";
  delete process.env.FREEOS_ORG_LOCAL_TEST;
  delete process.env.FREEOS_ORG_DEV_BOOTSTRAP;
  delete process.env.FREEOS_DEV_BUILD;
  delete process.env.SEED_DEMO_DATA;

  const { initDatabase, dbRun, dbGet } = await import("../backend/db");
  const { cleanupV010SeedResidue, F10_MARKER, P16_ERROR_LEARNING, P16_KNOWLEDGE, SEED_PLUGIN } = await import("../backend/upgrade-cleanup");

  await initDatabase();
  assert.equal(dbGet("SELECT id FROM users WHERE email = ?", ["demo@demo.com"]), undefined);
  assert.equal(
    dbGet("SELECT marker FROM org_upgrade_markers WHERE marker = ?", [F10_MARKER])?.marker,
    F10_MARKER,
  );
  const emptyDetail = dbGet("SELECT detail FROM org_upgrade_markers WHERE marker = ?", [F10_MARKER]) as { detail: string };
  assert.match(emptyDetail.detail, /no v0.0.x seed residue/);
  const usersBeforeSecondEmptyRun = Number(dbGet("SELECT COUNT(*) as c FROM users").c);
  cleanupV010SeedResidue();
  assert.equal(Number(dbGet("SELECT COUNT(*) as c FROM users").c), usersBeforeSecondEmptyRun);

  dbRun("DELETE FROM org_upgrade_markers WHERE marker = ?", [F10_MARKER]);
  dbRun("INSERT OR IGNORE INTO tenants (id, name, slug, status, plan) VALUES (1, 'openXYOS', 'openxyos', 'suspended', 'community')");
  dbRun("UPDATE tenants SET status = 'suspended' WHERE id = 1");
  dbRun("INSERT OR IGNORE INTO tenants (id, name, slug, status, plan) VALUES (2, 'local', 'openxyos-local', 'trial', 'community')");
  dbRun("UPDATE tenants SET status = 'trial' WHERE id = 2");

  dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id, must_change_password) VALUES (?, ?, ?, 'admin', 2, 0)",
    ["demo@demo.com", "seed-hash-demo", "管理员"],
  );
  const colleagueId = Number(dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id, must_change_password) VALUES (?, ?, ?, 'user', 2, 0)",
    ["user@demo.com", "seed-hash-user", "同事"],
  ).lastInsertRowid);
  dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id, must_change_password) VALUES (?, ?, ?, 'super_admin', 1, 0)",
    ["admin@example.com", "seed-hash-admin", "超级管理员"],
  );
  dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id, must_change_password) VALUES (?, ?, ?, 'admin', 1, 0)",
    ["owner@example.com", "hash-keep", "Owner"],
  );
  dbRun("INSERT INTO chats (title, created_by, tenant_id) VALUES ('owned', ?, 2)", [colleagueId]);
  dbRun(
    `INSERT INTO reflections (tenant_id, employee_id, task_id, reflection_type, success_factors, failure_reasons, knowledge_gaps, improvement_plans, extracted_skills, learned_knowledge, importance_score)
     VALUES (1, 0, NULL, 'error_learning', NULL, ?, ?, ?, ?, ?, 95)`,
    [
      P16_ERROR_LEARNING.failure_reasons,
      P16_ERROR_LEARNING.knowledge_gaps,
      P16_ERROR_LEARNING.improvement_plans,
      P16_ERROR_LEARNING.extracted_skills,
      P16_ERROR_LEARNING.learned_knowledge,
    ],
  );
  dbRun(
    `INSERT INTO reflections (tenant_id, employee_id, task_id, reflection_type, success_factors, failure_reasons, knowledge_gaps, improvement_plans, extracted_skills, learned_knowledge, importance_score)
     VALUES (1, 0, NULL, 'knowledge_capture', ?, NULL, NULL, NULL, ?, ?, 98)`,
    [P16_KNOWLEDGE.success_factors, P16_KNOWLEDGE.extracted_skills, P16_KNOWLEDGE.learned_knowledge],
  );
  dbRun(
    `INSERT INTO reflections (tenant_id, employee_id, task_id, reflection_type, success_factors, learned_knowledge, importance_score)
     VALUES (1, 0, NULL, 'knowledge_capture', ?, ?, 98)`,
    ["edited by a person", "部署铁律 but the operator rewrote this paragraph"],
  );
  dbRun(
    `INSERT INTO reflections (tenant_id, employee_id, reflection_type, learned_knowledge, importance_score)
     VALUES (1, 7, 'task_completion', 'unrelated note', 10)`,
  );
  const seededPluginId = Number(dbRun(
    `INSERT INTO plugins (tenant_id, name, slug, category, description, icon, version, author, price, tags, install_count, rating, status)
     VALUES (1, ?, ?, ?, ?, '🤖', ?, ?, ?, ?, 0, 5.0, 'active')`,
    [SEED_PLUGIN.name, SEED_PLUGIN.slug, SEED_PLUGIN.category, SEED_PLUGIN.description, SEED_PLUGIN.version, SEED_PLUGIN.author, SEED_PLUGIN.price, SEED_PLUGIN.tags],
  ).lastInsertRowid);
  const editedPluginId = Number(dbRun(
    `INSERT INTO plugins (tenant_id, name, slug, category, description, version, author, price, tags, install_count, rating, status, config_json)
     VALUES (2, ?, ?, '法务合规', 'user edited', '1.0.0', '雄元科技', '¥99/月', 'AI', 12, 4.2, 'active', '{"enabled":true}')`,
    [SEED_PLUGIN.name, SEED_PLUGIN.slug],
  ).lastInsertRowid);

  cleanupV010SeedResidue();

  const demo = dbGet("SELECT status, must_change_password, password_hash FROM users WHERE email = ?", ["demo@demo.com"]) as any;
  assert.equal(demo.status, "disabled");
  assert.equal(Number(demo.must_change_password), 1);
  assert.notEqual(demo.password_hash, "seed-hash-demo");
  const colleague = dbGet("SELECT status, must_change_password, password_hash FROM users WHERE email = ?", ["user@demo.com"]) as any;
  assert.equal(colleague.status, "active");
  assert.equal(Number(colleague.must_change_password), 1);
  assert.notEqual(colleague.password_hash, "seed-hash-user");
  assert.equal(Number(dbGet("SELECT COUNT(*) as c FROM chats WHERE created_by = ?", [colleagueId]).c), 1);
  const admin = dbGet("SELECT status, must_change_password, password_hash FROM users WHERE email = ?", ["admin@example.com"]) as any;
  assert.equal(admin.status, "disabled");
  assert.equal(Number(admin.must_change_password), 1);
  assert.notEqual(admin.password_hash, "seed-hash-admin");
  const owner = dbGet("SELECT status, must_change_password, password_hash FROM users WHERE email = ?", ["owner@example.com"]) as any;
  assert.equal(owner.password_hash, "hash-keep");
  assert.equal(Number(owner.must_change_password), 0);
  assert.notEqual(owner.status, "disabled");
  assert.equal(dbGet("SELECT status FROM tenants WHERE id = 1").status, "suspended");
  assert.equal(dbGet("SELECT status FROM tenants WHERE id = 2").status, "trial");
  assert.equal(Number(dbGet("SELECT COUNT(*) as c FROM reflections WHERE failure_reasons LIKE '%const 临时死区%'").c), 0);
  const edited = dbGet("SELECT learned_knowledge FROM reflections WHERE learned_knowledge LIKE '%operator rewrote%'") as any;
  assert.match(edited.learned_knowledge, /operator rewrote/);
  assert.equal(Number(dbGet("SELECT COUNT(*) as c FROM reflections WHERE employee_id = 7").c), 1);
  const seededPlugin = dbGet("SELECT id, status FROM plugins WHERE id = ?", [seededPluginId]) as any;
  assert.equal(seededPlugin.status, "disabled");
  assert.equal(dbGet("SELECT status FROM plugins WHERE id = ?", [editedPluginId]).status, "active");
  assert.equal(Number(dbGet("SELECT COUNT(*) as c FROM workflow_audit_log WHERE action LIKE 'f10_%'").c) > 0, true);

  const after = {
    demo: demo.password_hash,
    colleague: colleague.password_hash,
    admin: admin.password_hash,
    owner: owner.password_hash,
    plugin: seededPlugin.status,
    editedReflection: edited.learned_knowledge,
  };
  cleanupV010SeedResidue();
  assert.equal(dbGet("SELECT password_hash FROM users WHERE email = ?", ["demo@demo.com"]).password_hash, after.demo);
  assert.equal(dbGet("SELECT password_hash FROM users WHERE email = ?", ["user@demo.com"]).password_hash, after.colleague);
  assert.equal(dbGet("SELECT password_hash FROM users WHERE email = ?", ["admin@example.com"]).password_hash, after.admin);
  assert.equal(dbGet("SELECT password_hash FROM users WHERE email = ?", ["owner@example.com"]).password_hash, after.owner);
  assert.equal(dbGet("SELECT status FROM plugins WHERE id = ?", [seededPluginId]).status, "disabled");
  assert.equal(dbGet("SELECT learned_knowledge FROM reflections WHERE learned_knowledge LIKE '%operator rewrote%'").learned_knowledge, after.editedReflection);

  dbRun("UPDATE tenants SET status = 'active' WHERE id = 1");
  process.env.JWT_SECRET = "f10-plugin-list-secret-at-least-32-characters";
  process.env.COOKIE_SECRET = "f10-plugin-list-cookie-secret-at-least-32-chars";
  const { pluginRoutes } = await import("../backend/routes/plugins");
  const { signToken } = await import("../backend/middleware");
  const ownerRow = dbGet("SELECT id FROM users WHERE email = ?", ["owner@example.com"]) as { id: number };
  const token = signToken({
    id: ownerRow.id,
    email: "owner@example.com",
    nickname: "Owner",
    role: "admin",
    tenant_id: 1,
  });
  const app = express();
  app.use(express.json());
  app.use("/api/plugins", pluginRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const listed = await fetch(`${base}/api/plugins`, { headers: { Authorization: `Bearer ${token}` } });
    const listedBody = await listed.json() as { data?: Array<{ name: string; status: string; paid?: boolean; price?: string }>; error?: string };
    assert.equal(listed.status, 200, JSON.stringify(listedBody));
    assert.equal(listedBody.data.some((row) => row.name === "AI合同智能解析" && row.status === "active"), false);
    assert.equal(listedBody.data.some((row) => row.price), false);
    const removed = await fetch(`${base}/api/plugins/${seededPluginId}/uninstall`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(removed.status, 200);
    assert.equal(dbGet("SELECT status FROM plugins WHERE id = ?", [seededPluginId]).status, "disabled");
    assert.ok(dbGet("SELECT id FROM plugins WHERE id = ?", [seededPluginId]));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  console.log("f10 upgrade cleanup ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

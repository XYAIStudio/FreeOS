import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "freeos-seed-"));
  const dbPath = path.join(dir, "xiongyuan.db");
  process.env.DATABASE_PATH = dbPath;
  process.env.FREEOS_ORG_INTEGRATED = "1";
  delete process.env.FREEOS_ORG_LOCAL_TEST;
  delete process.env.FREEOS_ORG_DEV_BOOTSTRAP;
  delete process.env.SEED_DEMO_DATA;
  delete process.env.SEED_ADMIN_PASSWORD;
  delete process.env.SEED_DEMO_PASSWORD;

  const { initDatabase, saveDb, dbRun, dbGet } = await import("../backend/db");
  const { seedDatabase } = await import("../backend/seed");
  await initDatabase();
  dbRun(
    "INSERT INTO tenants (name, slug, status, plan) VALUES (?, ?, 'suspended', 'community')",
    ["Acme", "acme-suspended"],
  );
  dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id, must_change_password) VALUES (?, ?, ?, 'admin', 1, 0)",
    ["owner@example.com", "hash-keep", "Owner"],
  );
  saveDb();

  const snapshot = () => ({
    users: dbGet("SELECT email, password_hash, must_change_password FROM users WHERE email = ?", [
      "owner@example.com",
    ]),
    tenant: dbGet("SELECT status FROM tenants WHERE slug = ?", ["acme-suspended"]),
    demo: dbGet("SELECT id FROM users WHERE email = ?", ["demo@demo.com"]),
    colleague: dbGet("SELECT id FROM users WHERE email = ?", ["user@demo.com"]),
  });
  const before = snapshot();
  for (let i = 0; i < 3; i += 1) await seedDatabase();
  assert.deepEqual(snapshot(), before);
  assert.equal(before.demo, undefined);
  assert.equal(before.users.password_hash, "hash-keep");
  assert.equal(before.tenant.status, "suspended");
  assert.equal(fs.existsSync(path.join(dir, "bootstrap-credentials.txt")), false);

  dbRun(
    "DELETE FROM reflections WHERE tenant_id = 1 AND employee_id = 0 AND (failure_reasons LIKE '%const 死区%' OR learned_knowledge LIKE '%部署铁律%')",
  );
  saveDb();
  const reflectionCount = () =>
    dbGet(
      "SELECT COUNT(*) as c FROM reflections WHERE tenant_id = 1 AND employee_id = 0 AND (failure_reasons LIKE '%const 死区%' OR learned_knowledge LIKE '%部署铁律%')",
    );
  assert.equal(Number(reflectionCount().c), 0);
  dbRun("DELETE FROM plugins WHERE slug = ?", ["ai合同智能解析"]);
  saveDb();
  const pluginCount = () =>
    dbGet("SELECT COUNT(*) as c FROM plugins WHERE slug = ?", ["ai合同智能解析"]);
  assert.equal(Number(pluginCount().c), 0);
  for (let i = 0; i < 3; i += 1) await initDatabase();
  assert.equal(Number(reflectionCount().c), 0);
  assert.equal(Number(pluginCount().c), 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

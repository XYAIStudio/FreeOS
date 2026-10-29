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
  for (let i = 0; i < 3; i += 1) seedDatabase();
  assert.deepEqual(snapshot(), before);
  assert.equal(before.demo, undefined);
  assert.equal(before.users.password_hash, "hash-keep");
  assert.equal(before.tenant.status, "suspended");
  assert.equal(fs.existsSync(path.join(dir, "bootstrap-credentials.txt")), false);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

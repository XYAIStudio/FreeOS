import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "freeos-f2-"));
  process.env.DATABASE_PATH = path.join(dir, "xiongyuan.db");
  process.env.FREEOS_ORG_INTEGRATED = "1";
  process.env.FREEOS_ORG_LOCAL_TEST = "1";
  process.env.FREEOS_ORG_DEV_BOOTSTRAP = "1";
  delete process.env.FREEOS_DEV_BUILD;
  delete process.env.SEED_DEMO_DATA;

  const { initDatabase, dbRun, dbGet } = await import("../backend/db");
  const { seedDatabase } = await import("../backend/seed");
  await initDatabase();
  await seedDatabase();
  assert.equal(dbGet("SELECT id FROM users WHERE email = ?", ["demo@demo.com"]), undefined);
  assert.equal(dbGet("SELECT id FROM users WHERE email = ?", ["user@demo.com"]), undefined);
  assert.equal(dbGet("SELECT id FROM users WHERE email = ?", ["admin@example.com"]), undefined);
  assert.equal(fs.existsSync(path.join(dir, "bootstrap-credentials.txt")), false);

  dbRun("INSERT OR IGNORE INTO tenants (id, name, slug, status, plan) VALUES (2, 'local', 'openxyos-local', 'suspended', 'community')");
  dbRun("UPDATE tenants SET status = 'suspended' WHERE id = 2");
  dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id, must_change_password) VALUES (?, ?, ?, 'admin', 2, 0)",
    ["demo@demo.com", "hash-keep-demo", "管理员"],
  );
  dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id, must_change_password) VALUES (?, ?, ?, 'admin', 1, 0)",
    ["owner@example.com", "hash-keep-owner", "Owner"],
  );
  const before = {
    demo: dbGet("SELECT password_hash, must_change_password, status FROM users WHERE email = ?", ["demo@demo.com"]),
    owner: dbGet("SELECT password_hash, must_change_password FROM users WHERE email = ?", ["owner@example.com"]),
    tenant: dbGet("SELECT status FROM tenants WHERE id = 2"),
  };
  for (let i = 0; i < 3; i += 1) await seedDatabase();
  assert.deepEqual(dbGet("SELECT password_hash, must_change_password, status FROM users WHERE email = ?", ["demo@demo.com"]), before.demo);
  assert.deepEqual(dbGet("SELECT password_hash, must_change_password FROM users WHERE email = ?", ["owner@example.com"]), before.owner);
  assert.deepEqual(dbGet("SELECT status FROM tenants WHERE id = 2"), before.tenant);
  assert.equal(fs.existsSync(path.join(dir, "bootstrap-credentials.txt")), false);
  console.log("f2 empty db and upgrade residue ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

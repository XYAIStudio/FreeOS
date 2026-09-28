import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openxyos-db-"));
  const dbPath = path.join(dir, "xiongyuan.db");
  try {
    fs.writeFileSync(dbPath, Buffer.alloc(4096));
    process.env.DATABASE_PATH = dbPath;
    const { initDatabase, saveDb, dbRun } = await import("../backend/db");
    await initDatabase();
    assert.equal(fs.readdirSync(dir).filter((name) => name.endsWith(".bak")).length, 1);
    dbRun("CREATE TABLE IF NOT EXISTS persistence_test (value TEXT)");
    dbRun("INSERT INTO persistence_test (value) VALUES (?)", ["saved"]);
    saveDb();
    assert.equal(fs.readFileSync(dbPath).subarray(0, 16).toString(), "SQLite format 3\0");
    assert.equal(fs.readdirSync(dir).filter((name) => name.endsWith(".tmp")).length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

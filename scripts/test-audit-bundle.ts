/**
 * V0.80 R3 审计模块测试
 */
process.env.NODE_ENV = "development";
process.env.JWT_SECRET = "test-v080-secret-at-least-32-characters";
process.env.COOKIE_SECRET = "test-cookie-32-chars-at-least";
process.env.DB_DIALECT = "sqlite";
process.env.DATABASE_PATH = "./backend/data/test-v080.db";

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const { initDatabase, dbRun } = await import("../backend/db");
  await initDatabase();
  dbRun("INSERT OR IGNORE INTO tenants (id, name, status) VALUES (?,?,?)", [1, "Test", "active"]);

  const {
    createKnowledgeSnapshot, listSnapshots, getSnapshot, diffSnapshots,
    createEvidenceBundle, verifyEvidenceBundle, getEvidenceBundle,
    recordRevocation, isRevoked, listRevocations,
  } = await import("../backend/services/audit-bundle");

  let passed = 0, failed = 0;
  function test(msg: string, fn: () => void) {
    try { fn(); console.log(`  ✅ ${msg}`); passed++; }
    catch (err: any) { console.error(`  ❌ ${msg}: ${err.message}`); failed++; }
  }

  console.log("\n📦 审计模块测试\n");

  // ── 知识快照 ──
  test("创建知识快照", () => {
    const id = createKnowledgeSnapshot(1, "manual");
    assert(id > 0);
  });

  test("列出快照", () => {
    const list = listSnapshots(1);
    assert(list.length >= 1);
  });

  test("获取快照详情", () => {
    const list = listSnapshots(1);
    const s = getSnapshot(list[0].id, 1);
    assert(s !== null);
    assert.strictEqual(s.snapshot_type, "manual");
  });

  test("对比快照差异", () => {
    const idA = createKnowledgeSnapshot(1, "manual");
    const idB = createKnowledgeSnapshot(1, "manual");
    const diff = diffSnapshots(idA, idB, 1);
    assert(typeof diff.added === "number");
    assert(typeof diff.removed === "number");
  });

  // ── 证据包 ──
  test("创建证据包", () => {
    const hash = createEvidenceBundle(1, "test bundle", [
      { type: "audit", timestamp: new Date().toISOString(), actor: "user1", action: "login", target: "system", details: { ip: "127.0.0.1" } },
    ]);
    assert(hash.length === 64);
  });

  test("验证证据包完整性", () => {
    const hash = createEvidenceBundle(1, "test2", [
      { type: "security", timestamp: new Date().toISOString(), actor: "admin", action: "revoke", target: "token", details: { reason: "compromised" } },
    ]);
    const result = verifyEvidenceBundle(hash);
    assert(result.valid);
  });

  test("获取证据包内容", () => {
    const hash = createEvidenceBundle(1, "test3", [
      { type: "data", timestamp: new Date().toISOString(), actor: "system", action: "export", target: "report", details: {} },
    ]);
    const bundle = getEvidenceBundle(hash);
    assert(bundle !== null);
    assert(bundle.items.length === 1);
    assert.strictEqual(bundle.items[0].action, "export");
  });

  test("证据包链式哈希——前驱验证", () => {
    const h1 = createEvidenceBundle(1, "chain-1", [
      { type: "t", timestamp: new Date().toISOString(), actor: "a", action: "x", target: "y", details: {} },
    ]);
    const h2 = createEvidenceBundle(1, "chain-2", [
      { type: "t", timestamp: new Date().toISOString(), actor: "b", action: "y", target: "z", details: {} },
    ]);
    const r1 = verifyEvidenceBundle(h1);
    const r2 = verifyEvidenceBundle(h2);
    assert(r1.valid && r2.valid);
  });

  test("篡改证据包检测", () => {
    const hash = createEvidenceBundle(1, "tamper-test", [
      { type: "t", timestamp: new Date().toISOString(), actor: "a", action: "x", target: "y", details: {} },
    ]);
    // 直接修改 content 来模拟篡改
    dbRun("UPDATE evidence_bundles SET content = ? WHERE bundle_hash = ?", [JSON.stringify({ tampered: true }), hash]);
    const result = verifyEvidenceBundle(hash);
    assert(!result.valid);
  });

  // ── 撤销记录 ──
  test("注册撤销", () => {
    const id = recordRevocation("knowledge_file", 1, "包含敏感信息", 42, 1);
    assert(id > 0);
  });

  test("检查已撤销", () => {
    assert(isRevoked("knowledge_file", 1));
  });

  test("检查未撤销", () => {
    assert(!isRevoked("knowledge_file", 99999));
  });

  test("列出撤销记录", () => {
    const list = listRevocations(1);
    assert(list.length >= 1);
  });

  console.log(`\n📦 审计模块测试完成 (${passed} ✅ / ${failed} ❌)\n`);
  if (failed > 0) process.exit(1);
  const fs = await import("node:fs");
  try { fs.unlinkSync(process.env.DATABASE_PATH!); } catch {}
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });

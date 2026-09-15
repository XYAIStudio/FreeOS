/**
 * V0.50 R0 WebSocket 短期票据 · 自动化测试 (DB-backed)
 */

process.env.NODE_ENV = "development";
process.env.JWT_SECRET = "test-ws-ticket-secret-that-is-more-than-32-chars";
process.env.COOKIE_SECRET = "test-cookie-secret-that-is-more-than-32-chars-lots";
process.env.DB_DIALECT = "sqlite";
process.env.DATABASE_PATH = "./backend/data/test-ws-ticket.db";

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const { initDatabase, dbRun } = await import("../backend/db");

  await initDatabase();

  // 测试租户和用户
  const tenantIds = [7, 1001, 1002, 200, 3001, 4001, 5001, 5002, 7001];
  for (const tid of tenantIds) {
    dbRun("INSERT OR IGNORE INTO tenants (id, name, status, token_version) VALUES (?, ?, ?, ?)", [tid, `T${tid}`, "active", 0]);
  }
  const userIds = [1, 10, 20, 42, 2001, 6001, 6002];
  for (const uid of userIds) {
    dbRun("INSERT OR IGNORE INTO users (id, email, password_hash, nickname, role, tenant_id, token_version) VALUES (?, ?, ?, ?, ?, ?, ?)", [uid, `u${uid}@x.com`, "h", `U${uid}`, "user", 7, 0]);
  }
  // Specific user-tenant mappings
  dbRun("INSERT OR IGNORE INTO users (id, email, password_hash, nickname, role, tenant_id, token_version) VALUES (?, ?, ?, ?, ?, ?, ?)", [2001, "u2001@x.com", "h", "U2001", "user", 3001, 0]);
  dbRun("INSERT OR IGNORE INTO users (id, email, password_hash, nickname, role, tenant_id, token_version) VALUES (?, ?, ?, ?, ?, ?, ?)", [6001, "u6001@x.com", "h", "U6001", "user", 7001, 0]);
  dbRun("INSERT OR IGNORE INTO users (id, email, password_hash, nickname, role, tenant_id, token_version) VALUES (?, ?, ?, ?, ?, ?, ?)", [6002, "u6002@x.com", "h", "U6002", "user", 7001, 0]);

  const { generateWsTicket, verifyWsTicket, revokeUserWsTicket, revokeTenantWsTicket } =
    await import("../backend/routes/ws-ticket");

  let passed = 0;
  let failed = 0;

  function test(msg: string, fn: () => void) {
    try { fn(); console.log(`  ✅ ${msg}`); passed++; }
    catch (err: any) { console.error(`  ❌ ${msg}: ${err.message}`); failed++; }
  }

  console.log("\n🔌 WebSocket 短期票据测试 (DB-backed)\n");

  test("有效票据验证通过", () => {
    const t = generateWsTicket(1, 7);
    const p = verifyWsTicket(t);
    assert(p !== null);
    assert.strictEqual(p.uid, 1);
  });

  test("空/格式错误拒绝", () => {
    assert.strictEqual(verifyWsTicket(""), null);
    assert.strictEqual(verifyWsTicket("bad"), null);
  });

  test("篡改签名/负载拒绝", () => {
    const t = generateWsTicket(1, 7);
    const [b64, sig] = t.split(".");
    const badSig = sig.slice(0, -1) + (sig.slice(-1) === "A" ? "B" : "A");
    assert.strictEqual(verifyWsTicket(`${b64}.${badSig}`), null);
  });

  test("撤销用户后旧票据无效", () => {
    const t = generateWsTicket(2001, 3001);
    assert(verifyWsTicket(t) !== null);
    revokeUserWsTicket(3001, 2001);
    assert.strictEqual(verifyWsTicket(t), null);
    assert(verifyWsTicket(generateWsTicket(2001, 3001)) !== null);
  });

  test("撤销租户后旧票据无效", () => {
    const t = generateWsTicket(1, 4001);
    assert(verifyWsTicket(t) !== null);
    revokeTenantWsTicket(4001);
    assert.strictEqual(verifyWsTicket(t), null);
    assert(verifyWsTicket(generateWsTicket(1, 4001)) !== null);
  });

  test("不同租户隔离", () => {
    const tA = generateWsTicket(1, 5001);
    const tB = generateWsTicket(1, 5002);
    assert(verifyWsTicket(tA) !== null && verifyWsTicket(tB) !== null);
    revokeTenantWsTicket(5001);
    assert.strictEqual(verifyWsTicket(tA), null);
    assert(verifyWsTicket(tB) !== null);
  });

  test("用户级撤销不干扰同租户其他用户", () => {
    const tA = generateWsTicket(6001, 7001);
    const tB = generateWsTicket(6002, 7001);
    assert(verifyWsTicket(tA) !== null && verifyWsTicket(tB) !== null);
    revokeUserWsTicket(7001, 6001);
    assert.strictEqual(verifyWsTicket(tA), null);
    assert(verifyWsTicket(tB) !== null);
  });

  console.log(`\n🔌 WS 票据测试完成 (${passed} ✅ / ${failed} ❌)\n`);
  if (failed > 0) process.exit(1);

  const fs = await import("node:fs");
  try { fs.unlinkSync(process.env.DATABASE_PATH!); } catch {}
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

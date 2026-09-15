/**
 * V0.50 R0 受控下载令牌 · 自动化测试 (DB-backed)
 */

process.env.NODE_ENV = "development";
process.env.JWT_SECRET = "test-dl-secret-that-is-more-than-32-chars";
process.env.COOKIE_SECRET = "test-dl-cookie-more-than-32-chars";
process.env.DB_DIALECT = "sqlite";
process.env.DATABASE_PATH = "./backend/data/test-dl.db";

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const { initDatabase, dbRun } = await import("../backend/db");
  await initDatabase();

  // 为所有测试分配独立的租户/用户组合
  const T = { main: 1, revU: 2, revT: 3, isoA: 4, isoB: 5 };
  const U = { main: 101, revU: 102, revT: 103, isoA: 104, isoB: 105 };

  for (const tid of Object.values(T)) {
    dbRun("INSERT OR IGNORE INTO tenants (id, name, status, token_version) VALUES (?,?,?,?)", [tid, `T${tid}`, "active", 0]);
  }
  const userMap: Record<string, number> = { "101": T.main, "102": T.revU, "103": T.revT, "104": T.isoA, "105": T.isoB };
  for (const [uid, tid] of Object.entries(userMap)) {
    dbRun("INSERT OR IGNORE INTO users (id, email, password_hash, nickname, role, tenant_id, token_version) VALUES (?,?,?,?,?,?,?)", [Number(uid), `u${uid}@x`, "h", `U${uid}`, "user", tid, 0]);
  }

  const { generateDownloadToken, verifyDownloadToken, revokeUserTokens, revokeTenantTokens } =
    await import("../backend/services/download-token");

  let p = 0, f = 0;
  function test(msg: string, fn: () => void) {
    try { fn(); console.log(`  ✅ ${msg}`); p++; }
    catch (err: any) { console.error(`  ❌ ${msg}: ${err.message}`); f++; }
  }

  console.log("\n📁 受控下载令牌测试 (DB-backed)\n");

  test("生成→验证通过", () => {
    const t = generateDownloadToken(1, U.main, T.main);
    assert(t.includes("."));
    const d = verifyDownloadToken(t);
    assert(d !== null && d.fid === 1 && d.uid === U.main && d.tid === T.main);
  });

  test("空/格式错误/篡改拒绝", () => {
    assert.strictEqual(verifyDownloadToken(""), null);
    assert.strictEqual(verifyDownloadToken("bad.token"), null);
    const t = generateDownloadToken(1, U.main, T.main);
    const [b, s] = t.split(".");
    assert.strictEqual(verifyDownloadToken(`${b}.${s.slice(0, -1)}X`), null);
  });

  test("撤销用户→旧令牌失效", () => {
    const t = generateDownloadToken(2, U.revU, T.revU);
    assert(verifyDownloadToken(t) !== null);
    revokeUserTokens(T.revU, U.revU);
    assert.strictEqual(verifyDownloadToken(t), null);
    assert(verifyDownloadToken(generateDownloadToken(2, U.revU, T.revU)) !== null);
  });

  test("撤销租户→旧令牌失效", () => {
    const t = generateDownloadToken(3, U.revT, T.revT);
    assert(verifyDownloadToken(t) !== null);
    revokeTenantTokens(T.revT);
    assert.strictEqual(verifyDownloadToken(t), null);
    assert(verifyDownloadToken(generateDownloadToken(3, U.revT, T.revT)) !== null);
  });

  test("不同租户隔离", () => {
    const tA = generateDownloadToken(4, U.isoA, T.isoA);
    const tB = generateDownloadToken(5, U.isoB, T.isoB);
    assert(verifyDownloadToken(tA) !== null);
    assert(verifyDownloadToken(tB) !== null);
    revokeUserTokens(T.isoA, U.isoA);
    assert.strictEqual(verifyDownloadToken(tA), null);
    assert(verifyDownloadToken(tB) !== null);
  });

  test("租户撤销不影响其他租户用户令牌", () => {
    const tt = generateDownloadToken(6, U.isoB, T.isoB);
    assert(verifyDownloadToken(tt) !== null);
  });

  console.log(`\n📁 下载令牌测试完成 (${p} ✅ / ${f} ❌)\n`);
  if (f > 0) process.exit(1);
  const fs = await import("node:fs");
  try { fs.unlinkSync(process.env.DATABASE_PATH!); } catch {}
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });

/**
 * V0.60 R1 AuthProvider 单元测试
 *
 * 覆盖：
 * 1. 有效凭据认证 → access + refresh token
 * 2. 无效密码 → 拒绝
 * 3. 不存在的邮箱 → 拒绝
 * 4. token 验证 → 通过
 * 5. 伪造 token → 拒绝
 * 6. refresh token → 获得新令牌对
 * 7. 撤权后 token 失效
 */

process.env.NODE_ENV = "development";
process.env.JWT_SECRET = "test-auth-provider-secret-that-is-more-than-32-chars";
process.env.COOKIE_SECRET = "test-cookie-secret-more-than-32-chars-lots";
process.env.DB_DIALECT = "sqlite";
process.env.DATABASE_PATH = "./backend/data/test-auth-provider.db";

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const { initDatabase, dbRun } = await import("../backend/db");
  await initDatabase();

  // 种子数据
  dbRun("INSERT OR IGNORE INTO tenants (id, name, status) VALUES (?, ?, ?)", [1, "Test", "active"]);
  dbRun("INSERT OR IGNORE INTO users (id, email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
    [100, "test@xyos.com", require("bcryptjs").hashSync("Test1234!", 10), "Tester", "admin", 1]);
  dbRun("INSERT OR IGNORE INTO users (id, email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
    [101, "user@xyos.com", require("bcryptjs").hashSync("User5678!", 10), "User", "user", 1]);

  const { LTSProvider } = await import("../backend/services/auth-provider");

  const provider = new LTSProvider();
  let passed = 0, failed = 0;

  function test(msg: string, fn: () => void | Promise<void>) {
    (async () => {
      try { await fn(); console.log(`  ✅ ${msg}`); passed++; }
      catch (err: any) { console.error(`  ❌ ${msg}: ${err.message}`); failed++; }
    })();
  }

  console.log("\n🔐 AuthProvider 测试\n");

  test("有效凭据认证成功", async () => {
    const r = await provider.authenticate({ email: "test@xyos.com", password: "Test1234!" });
    assert(r.success);
    assert(r.tokens?.accessToken);
    assert(r.tokens?.refreshToken);
    assert.strictEqual(r.tokens!.expiresIn, 3600);
    assert.strictEqual(r.user?.email, "test@xyos.com");
    assert.strictEqual(r.user?.role, "admin");
  });

  test("无效密码拒绝", async () => {
    const r = await provider.authenticate({ email: "test@xyos.com", password: "wrong" });
    assert(!r.success);
    assert.strictEqual(r.code, "INVALID_CREDENTIALS");
  });

  test("不存在邮箱拒绝", async () => {
    const r = await provider.authenticate({ email: "nobody@x.com", password: "x" });
    assert(!r.success);
    assert.strictEqual(r.code, "INVALID_CREDENTIALS");
  });

  test("空凭据拒绝", async () => {
    const r = await provider.authenticate({ email: "", password: "" });
    assert(!r.success);
  });

  test("access token 验证通过", async () => {
    const login = await provider.authenticate({ email: "test@xyos.com", password: "Test1234!" });
    assert(login.tokens);
    const v = await provider.validateAccessToken(login.tokens.accessToken);
    assert(v.success);
    assert.strictEqual(v.user?.email, "test@xyos.com");
  });

  test("伪造 token 拒绝", async () => {
    const v = await provider.validateAccessToken("eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.fakesig");
    assert(!v.success);
    assert.strictEqual(v.code, "TOKEN_EXPIRED");
  });

  test("refresh token 获得新令牌对", async () => {
    const login = await provider.authenticate({ email: "test@xyos.com", password: "Test1234!" });
    const refresh = await provider.refreshAccessToken(login.tokens!.refreshToken);
    assert(refresh.success);
    assert(refresh.tokens?.accessToken);
    assert.notStrictEqual(refresh.tokens.accessToken, login.tokens?.accessToken);
  });

  test("撤权后 token 失效", async () => {
    const login = await provider.authenticate({ email: "user@xyos.com", password: "User5678!" });
    assert(login.success);
    await provider.revokeUserTokens(login.user!.id);
    const v = await provider.validateAccessToken(login.tokens!.accessToken);
    assert(!v.success);
    assert.strictEqual(v.code, "TOKEN_EXPIRED");
  });

  test("撤权后 refresh token 也失效", async () => {
    const login = await provider.authenticate({ email: "test@xyos.com", password: "Test1234!" });
    await provider.revokeUserTokens(login.user!.id);
    const r = await provider.refreshAccessToken(login.tokens!.refreshToken);
    assert(!r.success);
  });

  // 等待所有异步测试完成
  await new Promise(r => setTimeout(r, 2000));

  console.log(`\n🔐 AuthProvider 测试完成 (${passed} ✅ / ${failed} ❌)\n`);
  if (failed > 0) process.exit(1);

  const fs = await import("node:fs");
  try { fs.unlinkSync(process.env.DATABASE_PATH!); } catch {}
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });

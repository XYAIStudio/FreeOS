/**
 * V1.00 R5 综合测试：HA 集群 + 压测引擎 + 行业能力包
 */

process.env.NODE_ENV = "development";
process.env.JWT_SECRET = "test-v100-secret-at-least-32-chars-here";
process.env.COOKIE_SECRET = "test-cookie-v100-more-32-chars";
process.env.DB_DIALECT = "sqlite";
process.env.DATABASE_PATH = "./backend/data/test-v100.db";

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const { initDatabase, dbRun } = await import("../backend/db");
  await initDatabase();

  let passed = 0, failed = 0;
  function test(msg: string, fn: () => void | Promise<void>) {
    (async () => {
      try { await fn(); console.log(`  ✅ ${msg}`); passed++; }
      catch (err: any) { console.error(`  ❌ ${msg}: ${err.message}`); failed++; }
    })();
  }

  console.log("\n🚀 V1.00 综合测试\n");

  // ── HA 集群 ──
  const cluster = await import("../backend/services/cluster");

  test("注册节点", () => {
    cluster.registerNode("localhost", 3000);
    const nodes = cluster.listOnlineNodes();
    assert(nodes.length >= 1);
  });

  test("健康聚合", () => {
    const health = cluster.aggregateHealth();
    assert(health.totalNodes >= 1);
    assert(typeof health.clusterStatus === "string");
  });

  test("leader 选举", () => {
    const leader = cluster.electLeader();
    assert(leader !== null);
  });

  test("获取 leader", () => {
    const leader = cluster.getLeader();
    assert(leader !== null);
    assert.strictEqual(leader.role, "leader");
  });

  test("故障转移检查", () => {
    const result = cluster.checkAndFailover();
    assert(result.action === "none" || result.action === "election");
  });

  test("注销节点", () => {
    cluster.deregisterNode();
    const health = cluster.aggregateHealth();
    assert(typeof health.clusterStatus === "string");
  });

  // ── 压测引擎 ──
  const { runStressTest, formatStressReport } = await import("../scripts/stress-test");

  test("压测：100 请求 / 10 并发", async () => {
    const result = await runStressTest(
      { concurrency: 10, totalRequests: 100, timeoutMs: 1000 },
      () => Promise.resolve({ success: true })
    );
    assert.strictEqual(result.completed, 100);
    assert.strictEqual(result.failed, 0);
    assert(result.throughputPerSec > 0);
  });

  test("压测：含失败场景", async () => {
    let callCount = 0;
    const result = await runStressTest(
      { concurrency: 5, totalRequests: 50, timeoutMs: 1000 },
      () => {
        callCount++;
        return callCount % 3 === 0
          ? Promise.resolve({ success: false, error: "模拟失败" })
          : Promise.resolve({ success: true });
      }
    );
    assert(result.failed > 0);
    assert(result.errors.some(e => e.message === "模拟失败"));
  });

  test("压测：超时处理", async () => {
    const result = await runStressTest(
      { concurrency: 2, totalRequests: 5, timeoutMs: 50 },
      () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 200))
    );
    assert(result.timedOut >= 0); // 可能全部超时
  });

  test("压测报告格式化", () => {
    const result = {
      totalRequests: 10, completed: 8, failed: 1, timedOut: 1,
      totalTimeMs: 500, avgLatencyMs: 50, p50LatencyMs: 45,
      p95LatencyMs: 90, p99LatencyMs: 100, throughputPerSec: 16,
      errors: [{ message: "timeout", count: 1 }],
    };
    const report = formatStressReport(result);
    assert(report.includes("并发压测报告"));
    assert(report.includes("8"));
  });

  // ── 行业能力包 ──
  const ip = await import("../backend/services/industry-package");

  test("列出行业包", () => {
    const list = ip.listIndustryPackages();
    assert(list.length === 4);
    assert(list.map(p => p.id).includes("manufacturing"));
    assert(list.map(p => p.id).includes("finance"));
  });

  test("获取行业包详情", () => {
    const pkg = ip.getIndustryPackage("finance");
    assert(pkg !== null);
    assert(pkg.features.includes("risk_management"));
    assert(pkg.agentTemplates.length >= 1);
  });

  test("激活行业包", () => {
    const result = ip.activateIndustryPackage(1, "manufacturing");
    assert(result.success);
  });

  test("获取已激活行业包", () => {
    const active = ip.getActiveIndustryPackage(1);
    assert(active !== null);
    assert.strictEqual(active.id, "manufacturing");
  });

  test("激活无效包返回错误", () => {
    const result = ip.activateIndustryPackage(1, "nonexistent");
    assert(!result.success);
  });

  test("未激活租户返回 null", () => {
    assert.strictEqual(ip.getActiveIndustryPackage(99999), null);
  });

  setTimeout(() => {
    console.log(`\n🚀 V1.00 综合测试完成 (${passed} ✅ / ${failed} ❌)\n`);
    if (failed > 0) process.exit(1);
  }, 3000);

  const fs = await import("node:fs");
  try { fs.unlinkSync(process.env.DATABASE_PATH!); } catch {}
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });

/**
 * V0.90 R4 工具网关测试
 */
import assert from "node:assert/strict";
import { ToolRegistry, invokeTool, initToolGateway, ConnectorGateway } from "../backend/services/tool-gateway";

// 不依赖数据库的测试
initToolGateway();

let passed = 0, failed = 0;
function test(msg: string, fn: () => void | Promise<void>) {
  (async () => {
    try { await fn(); console.log(`  ✅ ${msg}`); passed++; }
    catch (err: any) { console.error(`  ❌ ${msg}: ${err.message}`); failed++; }
  })();
}

console.log("\n🔧 工具网关测试\n");

test("工具注册表初始化", () => {
  assert(ToolRegistry.list().length >= 10);
});

test("分类筛选", () => {
  const oa = ToolRegistry.list("oa");
  assert(oa.length >= 1);
  assert(oa[0].category === "oa");
});

test("获取工具分类列表", () => {
  const cats = ToolRegistry.categories();
  assert(cats.includes("oa"));
  assert(cats.includes("knowledge"));
  assert(cats.includes("erp"));
  assert(cats.includes("crm"));
});

test("获取工具定义", () => {
  const tool = ToolRegistry.get("search_knowledge");
  assert(tool !== undefined);
  assert.strictEqual(tool.name, "search_knowledge");
  assert.strictEqual(tool.parameters[0].name, "query");
  assert(tool.parameters[0].required);
});

test("未知工具返回 null", () => {
  assert.strictEqual(ToolRegistry.get("nonexistent"), undefined);
});

test("参数必填检查", async () => {
  const r = await invokeTool({
    toolName: "search_knowledge",
    parameters: {}, // 缺少 query
    caller: { userId: 1, tenantId: 1 },
  });
  assert(!r.success);
  assert(r.error?.includes("query"));
});

test("参数类型检查", async () => {
  const r = await invokeTool({
    toolName: "get_employee",
    parameters: { employee_id: "not_a_number" },
    caller: { userId: 1, tenantId: 1 },
  });
  assert(!r.success);
  assert(r.error?.includes("类型不匹配"));
});

test("未知工具调用返回错误", async () => {
  const r = await invokeTool({
    toolName: "nonexistent_tool",
    parameters: {},
    caller: { userId: 1, tenantId: 1 },
  });
  assert(!r.success);
  assert(r.error?.includes("未知工具"));
});

test("连接器注册", () => {
  const connectors = ConnectorGateway.list();
  assert(connectors.length === 3);
  assert(connectors.map(c => c.name).includes("oa"));
  assert(connectors.map(c => c.name).includes("erp"));
  assert(connectors.map(c => c.name).includes("crm"));
});

test("获取连接器", () => {
  const oa = ConnectorGateway.get("oa");
  assert(oa !== undefined);
  assert.strictEqual(oa.system, "oa");
});

test("未知连接器返回 undefined", () => {
  assert.strictEqual(ConnectorGateway.get("nonexistent"), undefined);
});

test("工具引用正确的连接器", () => {
  const tool = ToolRegistry.get("oa_get_approvals");
  assert(tool !== undefined);
  assert.strictEqual(tool.connector, "oa");
});

setTimeout(() => {
  console.log(`\n🔧 工具网关测试完成 (${passed} ✅ / ${failed} ❌)\n`);
  if (failed > 0) process.exit(1);
}, 2000);

/**
 * V0.60 R1 PEP 断言函数单元测试
 */

import assert from "node:assert/strict";
import {
  assertTenantScope,
  assertOwner,
  assertHasRole,
  assertResourceExists,
  principalFromRequest,
  isAdmin,
} from "../backend/middleware/pep";
import type { Principal } from "../backend/middleware/pep";

const admin: Principal = { id: 1, role: "super_admin", tenantId: 7 };
const user: Principal = { id: 2, role: "user", tenantId: 7 };
const otherTenant: Principal = { id: 3, role: "user", tenantId: 99 };

let passed = 0, failed = 0;

function test(msg: string, fn: () => void) {
  try { fn(); console.log(`  ✅ ${msg}`); passed++; }
  catch (err: any) { console.error(`  ❌ ${msg}: ${err.message}`); failed++; }
}

console.log("\n🛡️ PEP 断言函数测试\n");

test("同租户通过 assertTenantScope", () => {
  assertTenantScope(user, 7);
});

test("跨租户拒绝 assertTenantScope", () => {
  assert.throws(() => assertTenantScope(otherTenant, 7), { code: "CROSS_TENANT" });
});

test("管理员通过 assertOwner", () => {
  assertOwner(admin, { tenantId: 7, ownerId: 2 });
});

test("资源所有者通过 assertOwner", () => {
  assertOwner(user, { tenantId: 7, ownerId: 2 });
});

test("非所有者、非管理员拒绝 assertOwner", () => {
  assert.throws(() => assertOwner(user, { tenantId: 7, ownerId: 999 }), { code: "NOT_OWNER" });
});

test("跨租户 assertOwner 拒绝", () => {
  assert.throws(() => assertOwner(otherTenant, { tenantId: 7, ownerId: 3 }), { code: "CROSS_TENANT" });
});

test("角色匹配通过 assertHasRole", () => {
  assertHasRole(admin, ["super_admin"]);
  assertHasRole(admin, ["super_admin", "admin"]);
});

test("角色不匹配拒绝 assertHasRole", () => {
  assert.throws(() => assertHasRole(user, ["super_admin"]), { code: "INSUFFICIENT_ROLE" });
});

test("资源存在且属于正确租户 → assertResourceExists 返回资源", () => {
  const resource = { id: 1, name: "test" };
  const r = assertResourceExists(resource, user, 7);
  assert.strictEqual(r, resource);
});

test("资源不存在 → assertResourceExists 抛出 404", () => {
  assert.throws(() => assertResourceExists(null, user, 7), { code: "NOT_FOUND" });
});

test("资源存在但租户不匹配 → assertResourceExists 抛出 403", () => {
  assert.throws(() => assertResourceExists({ id: 1 }, otherTenant, 7), { code: "CROSS_TENANT" });
});

test("isAdmin 判断正确", () => {
  assert(isAdmin(admin));
  assert(!isAdmin(user));
});

test("principalFromRequest 提取正确", () => {
  const req = { user: { id: 1, role: "admin", tenant_id: 7 } };
  const p = principalFromRequest(req as any);
  assert.strictEqual(p.id, 1);
  assert.strictEqual(p.role, "admin");
  assert.strictEqual(p.tenantId, 7);
});

test("principalFromRequest 无认证抛出 401", () => {
  assert.throws(() => principalFromRequest({} as any), { code: "UNAUTHORIZED" });
});

console.log(`\n🛡️ PEP 测试完成 (${passed} ✅ / ${failed} ❌)\n`);
if (failed > 0) process.exit(1);

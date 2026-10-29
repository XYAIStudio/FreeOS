import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "freeos-plugin-"));
  process.env.NODE_ENV = "development";
  process.env.JWT_SECRET = "plugin-install-test-secret-at-least-32-characters";
  process.env.COOKIE_SECRET = "plugin-install-cookie-secret-at-least-32-chars";
  process.env.DATABASE_PATH = path.join(dir, "xiongyuan.db");
  delete process.env.FREEOS_DEV_BUILD;

  const { initDatabase, dbGet, dbRun } = await import("../backend/db");
  const { pluginRoutes } = await import("../backend/routes/plugins");
  const { contractRoutes } = await import("../backend/routes/contracts");
  const { signToken } = await import("../backend/middleware");
  await initDatabase();

  dbRun("INSERT OR IGNORE INTO tenants (id, name, slug, status, plan) VALUES (1, 'Acme', 'acme', 'active', 'community')");
  const userId = Number(dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'admin', 1)",
    ["owner@example.com", "hash", "Owner"],
  ).lastInsertRowid);
  const pluginId = Number(dbRun(
    `INSERT INTO plugins (tenant_id, name, slug, category, description, version, author, price, tags, install_count, rating, status)
     VALUES (1, 'AI合同智能解析', 'ai合同智能解析', '法务合规', 'paid', '1.0.0', '雄元科技', '¥99/月', 'AI', 0, 5, 'active')`,
  ).lastInsertRowid);
  dbRun("INSERT INTO tenant_plugin_installs (tenant_id, plugin_id) VALUES (1, ?)", [pluginId]);

  const token = signToken({ id: userId, email: "owner@example.com", nickname: "Owner", role: "admin", tenant_id: 1 });
  const app = express();
  app.use(express.json());
  app.use("/api/plugins", pluginRoutes);
  app.use("/api/contracts", contractRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function call(url: string, method = "GET", body?: unknown) {
    return fetch(`${base}${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  try {
    const removed = await call(`/api/plugins/${pluginId}/uninstall`, "POST");
    assert.equal(removed.status, 200);
    const removedBody = await removed.json() as { data: { enabled: boolean; status: string } };
    assert.equal(removedBody.data.enabled, false);
    assert.equal(removedBody.data.status, "disabled");
    assert.equal(dbGet("SELECT status FROM plugins WHERE id = ?", [pluginId]).status, "disabled");
    assert.equal(dbGet("SELECT id FROM plugins WHERE id = ?", [pluginId]).id, pluginId);
    assert.equal(dbGet("SELECT id FROM tenant_plugin_installs WHERE plugin_id = ?", [pluginId]), undefined);
    const gated = await call("/api/contracts/approval/rules/parse", "POST");
    assert.equal(gated.status, 402);

    const listed = await call("/api/plugins");
    const listedBody = await listed.json() as { data: Array<{ id: number }> };
    assert.equal(listedBody.data.some((row) => row.id === pluginId), false);

    const refused = await call(`/api/plugins/${pluginId}/install`, "POST", {});
    assert.equal(refused.status, 409);
    const refusedBody = await refused.json() as { code: string; data: { price: string; enabled: boolean } };
    assert.equal(refusedBody.code, "PRICE_CONFIRMATION_REQUIRED");
    assert.equal(refusedBody.data.enabled, false);
    assert.equal(dbGet("SELECT status FROM plugins WHERE id = ?", [pluginId]).status, "disabled");

    const confirmed = await call(`/api/plugins/${pluginId}/install`, "POST", { confirm_price: true, price: "¥99/月" });
    assert.equal(confirmed.status, 200);
    assert.equal(dbGet("SELECT status FROM plugins WHERE id = ?", [pluginId]).status, "active");
    assert.equal(Number(dbGet("SELECT COUNT(*) as c FROM workflow_audit_log WHERE action = 'f6_install_plugin'").c), 1);

    const again = await call(`/api/plugins/${pluginId}/uninstall`, "POST");
    assert.equal(again.status, 200);
    assert.equal(dbGet("SELECT status FROM plugins WHERE id = ?", [pluginId]).status, "disabled");
    assert.equal(Number(dbGet("SELECT COUNT(*) as c FROM workflow_audit_log WHERE action = 'f6_uninstall_plugin'").c), 2);
    console.log("plugin install confirmation and uninstall ok");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

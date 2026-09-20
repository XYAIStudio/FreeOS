import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openxyos-llm-onboarding-"));
  process.env.NODE_ENV = "development";
  process.env.JWT_SECRET = "llm-onboarding-test-secret-at-least-32-characters";
  process.env.COOKIE_SECRET = "llm-onboarding-cookie-secret-at-least-32-chars";
  process.env.DATABASE_PATH = path.join(tempRoot, "test.db");

  const { initDatabase, dbAll, dbRun } = await import("../backend/db");
  const { settingsRoutes } = await import("../backend/routes/settings");
  const { authenticate, signToken } = await import("../backend/middleware");
  const { getRequestTenantId } = await import("../backend/services/request-context");
  await initDatabase();

  const tenantA = dbRun("INSERT INTO tenants (name, slug, status) VALUES (?, ?, 'active')", ["Tenant A", "llm-a"]).lastInsertRowid;
  const tenantB = dbRun("INSERT INTO tenants (name, slug, status) VALUES (?, ?, 'active')", ["Tenant B", "llm-b"]).lastInsertRowid;
  const adminId = dbRun("INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'admin', ?)", ["admin@llm.test", "unused", "Admin", tenantA]).lastInsertRowid;
  const userId = dbRun("INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'user', ?)", ["user@llm.test", "unused", "User", tenantA]).lastInsertRowid;
  const tenantBAdminId = dbRun("INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'admin', ?)", ["admin-b@llm.test", "unused", "Admin B", tenantB]).lastInsertRowid;
  const tokens = {
    admin: signToken({ id: adminId, email: "admin@llm.test", nickname: "Admin", role: "admin", tenant_id: tenantA }),
    user: signToken({ id: userId, email: "user@llm.test", nickname: "User", role: "user", tenant_id: tenantA }),
    tenantB: signToken({ id: tenantBAdminId, email: "admin-b@llm.test", nickname: "Admin B", role: "admin", tenant_id: tenantB }),
  };

  const app = express();
  app.use(express.json());
  app.use("/api/settings", settingsRoutes);
  app.get("/api/context", authenticate, (_req, res) => res.json({ tenantId: getRequestTenantId() }));
  const server = app.listen(0, "127.0.0.1");
  let baseUrl = "";
  const request = (token: string, url: string, init: RequestInit = {}) => fetch(`${baseUrl}${url}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });

  try {
    await new Promise<void>(resolve => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const saved = await request(tokens.admin, "/api/settings/ai/onboarding", {
      method: "PUT",
      body: JSON.stringify({ providerId: "deepseek", apiKey: "sk-test-key-123456" }),
    });
    assert.equal(saved.status, 200);
    const rows = dbAll("SELECT key, value, tenant_id FROM ai_config WHERE tenant_id = ?", [tenantA]) as any[];
    assert.equal(rows.find(row => row.key === "llm_api_key")?.value, "sk-test-key-123456");
    assert.equal(rows.find(row => row.key === "llm_model")?.value, "deepseek-v4-flash");
    assert.equal((dbAll("SELECT * FROM ai_config WHERE tenant_id = ?", [tenantB]) as any[]).length, 0);

    const read = await request(tokens.user, "/api/settings/ai");
    const readBody = await read.json() as any;
    assert.equal(readBody.data.llm_api_key, "");
    assert.equal(readBody.data.llm_api_key_configured, "true");
    assert(!JSON.stringify(readBody).includes("sk-test-key-123456"));

    const forbidden = await request(tokens.user, "/api/settings/ai/onboarding", {
      method: "PUT",
      body: JSON.stringify({ providerId: "openai", apiKey: "sk-user-key-123456" }),
    });
    assert.equal(forbidden.status, 403);
    const invalid = await request(tokens.admin, "/api/settings/ai/onboarding", {
      method: "PUT",
      body: JSON.stringify({ providerId: "unknown", apiKey: "sk-test-key-123456" }),
    });
    assert.equal(invalid.status, 400);

    const emptyCloud = await request(tokens.admin, "/api/settings/ai/onboarding", {
      method: "PUT",
      body: JSON.stringify({ providerId: "deepseek", apiKey: "" }),
    });
    assert.equal(emptyCloud.status, 400);

    const local = await request(tokens.admin, "/api/settings/ai/onboarding", {
      method: "PUT",
      body: JSON.stringify({ providerId: "ollama", apiKey: "" }),
    });
    assert.equal(local.status, 200);
    const localRows = dbAll("SELECT key, value FROM ai_config WHERE tenant_id = ?", [tenantA]) as any[];
    assert.equal(localRows.find(row => row.key === "llm_api_key")?.value, "ollama");
    assert.equal(localRows.find(row => row.key === "llm_api_base")?.value, "http://127.0.0.1:11434/v1");

    const context = await request(tokens.tenantB, "/api/context");
    assert.equal((await context.json() as any).tenantId, tenantB);
    console.log("LLM onboarding, key masking, and tenant isolation integration tests passed");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xyos-module-settings-"));
  process.env.NODE_ENV = "development";
  process.env.JWT_SECRET = "module-settings-test-secret-at-least-32-characters";
  process.env.COOKIE_SECRET = "module-settings-cookie-secret-at-least-32-chars";
  process.env.DATABASE_PATH = path.join(tempRoot, "test.db");

  const { initDatabase, dbRun } = await import("../backend/db");
  const { openModuleSettingsRoutes: moduleSettingsRoutes } = await import("../backend/routes/open-module-settings");
  const { signToken } = await import("../backend/middleware");
  await initDatabase();

  const tenantA = dbRun("INSERT INTO tenants (name, slug, status) VALUES (?, ?, 'active')", ["Tenant A", "module-a"]).lastInsertRowid;
  const tenantB = dbRun("INSERT INTO tenants (name, slug, status) VALUES (?, ?, 'active')", ["Tenant B", "module-b"]).lastInsertRowid;
  const adminId = dbRun("INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'admin', ?)", ["admin@module.test", "unused", "Admin", tenantA]).lastInsertRowid;
  const userId = dbRun("INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'user', ?)", ["user@module.test", "unused", "User", tenantA]).lastInsertRowid;
  const superId = dbRun("INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'super_admin', ?)", ["super@module.test", "unused", "Super", tenantA]).lastInsertRowid;

  const tokens = {
    admin: signToken({ id: adminId, email: "admin@module.test", nickname: "Admin", role: "admin", tenant_id: tenantA }),
    user: signToken({ id: userId, email: "user@module.test", nickname: "User", role: "user", tenant_id: tenantA }),
    super: signToken({ id: superId, email: "super@module.test", nickname: "Super", role: "super_admin", tenant_id: tenantA }),
  };

  const app = express();
  app.use(express.json());
  app.use("/api/module-settings", moduleSettingsRoutes);
  const server = app.listen(0, "127.0.0.1");
  let baseUrl = "";

  async function request(token: string, url: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${url}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
  }

  try {
    await new Promise<void>(resolve => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const initial = await request(tokens.user, "/api/module-settings");
    assert.equal(initial.status, 200);
    const initialBody = await initial.json() as any;
    assert(initialBody.data.modules.every((module: any) => module.enabled === true));

    const saved = await request(tokens.admin, "/api/module-settings", {
      method: "PUT",
      body: JSON.stringify({ updates: { tasks: false, knowledge: false }, labels: { employees: "协同成员" } }),
    });
    assert.equal(saved.status, 200);
    const savedBody = await saved.json() as any;
    assert.equal(savedBody.data.modules.find((module: any) => module.key === "tasks").enabled, false);
    assert.equal(savedBody.data.modules.find((module: any) => module.key === "employees").label, "协同成员");
    assert.equal(savedBody.data.modules.length, 12);

    const userWrite = await request(tokens.user, "/api/module-settings", {
      method: "PUT",
      body: JSON.stringify({ updates: { tasks: true } }),
    });
    assert.equal(userWrite.status, 403);

    const adminCrossTenant = await request(tokens.admin, "/api/module-settings", {
      method: "PUT",
      body: JSON.stringify({ tenant_id: tenantB, updates: { chat: false } }),
    });
    assert.equal(adminCrossTenant.status, 403);

    const superCrossTenant = await request(tokens.super, "/api/module-settings", {
      method: "PUT",
      body: JSON.stringify({ tenant_id: tenantB, updates: { chat: false } }),
    });
    assert.equal(superCrossTenant.status, 200);

    const tenantBRead = await request(tokens.super, `/api/module-settings?tenant_id=${tenantB}`);
    const tenantBBody = await tenantBRead.json() as any;
    assert.equal(tenantBBody.data.modules.find((module: any) => module.key === "chat").enabled, false);

    const invalid = await request(tokens.admin, "/api/module-settings", {
      method: "PUT",
      body: JSON.stringify({ updates: { unknown_module: false } }),
    });
    assert.equal(invalid.status, 400);

    console.log("tenant module settings integration tests passed");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

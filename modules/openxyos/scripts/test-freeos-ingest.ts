import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openxyos-freeos-ingest-"));
  process.env.NODE_ENV = "development";
  process.env.FILE_SCAN_MODE = "disabled";
  process.env.JWT_SECRET = "freeos-ingest-test-secret-at-least-32-characters";
  process.env.COOKIE_SECRET = "freeos-ingest-cookie-secret-at-least-32-ch";
  process.env.DATABASE_PATH = path.join(tempRoot, "test.db");
  process.env.FREEOS_HOME = tempRoot;
  process.env.FREEOS_INGEST_TOKEN = "ingest-secret";

  const { initDatabase, dbGet, dbRun, dbAll } = await import("../backend/db");
  const { freeosBridgeRoutes } = await import("../backend/routes/freeos-bridge");
  const { employeeRoutes } = await import("../backend/routes/employees");
  const { talentRoutes } = await import("../backend/routes/talent");
  const { skillsRoutes } = await import("../backend/routes/skills");
  const { pluginRoutes } = await import("../backend/routes/plugins");
  const { signToken } = await import("../backend/middleware");
  await initDatabase();

  dbRun(
    "INSERT OR IGNORE INTO tenants (id, name, slug, status, plan) VALUES (1, ?, ?, 'active', 'community')",
    ["雄元科技", "openxyos"],
  );
  dbRun(
    "INSERT OR IGNORE INTO tenants (id, name, slug, status, plan) VALUES (2, ?, ?, 'active', 'community')",
    ["openXYOS 本地租户", "openxyos-local"],
  );
  dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'super_admin', 1)",
    ["admin@example.com", "unused", "超级管理员"],
  );
  const demoId = Number(dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'admin', 2)",
    ["demo@demo.com", "unused", "管理员"],
  ).lastInsertRowid);
  dbRun("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [demoId]);

  const token = signToken({
    id: demoId,
    email: "demo@demo.com",
    nickname: "管理员",
    role: "admin",
    tenant_id: 2,
  });

  const app = express();
  app.use(express.json());
  app.use("/api/freeos", freeosBridgeRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/talent", talentRoutes);
  app.use("/api/skills", skillsRoutes);
  app.use("/api/plugins", pluginRoutes);
  const server = app.listen(0, "127.0.0.1");
  let baseUrl = "";

  async function ingest(body: Record<string, unknown>) {
    return fetch(`${baseUrl}/api/freeos/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FreeOS-Ingest-Token": "ingest-secret",
      },
      body: JSON.stringify(body),
    });
  }

  async function asDemo(url: string) {
    return fetch(`${baseUrl}${url}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const health = await fetch(`${baseUrl}/api/freeos/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json() as { data: { ui_tenant_id: number } };
    assert.equal(healthBody.data.ui_tenant_id, 2);

    const ingested = await ingest({
      tenant_id: 1,
      employees: [
        {
          name: "Ops Coordinator",
          slug: "ops-coordinator",
          status: "active",
          employment_category: "staff",
          skills: "ops",
        },
        {
          name: "Policy Analyst",
          slug: "policy-analyst",
          status: "active",
          employment_category: "probation",
          skills: "policy",
        },
      ],
      talent: [
        { name: "Ops Coordinator", status: "draft", skills: "ops" },
        { name: "Policy Analyst", talent_status: "recruited", skills: "policy" },
      ],
      skills: [{ name: "org-governance", slug: "org-governance", content: "gate high-risk tools" }],
      plugins: [{ name: "org-governance", slug: "org-governance" }],
      mcp: [{ name: "xyos-governance-mcp", slug: "xyos-governance-mcp" }],
    });
    assert.equal(ingested.status, 200);
    const ingestBody = await ingested.json() as {
      success: boolean;
      data: { tenant_id: number; also_tenants: number[]; landed: Record<string, { created: number }> };
    };
    assert.equal(ingestBody.success, true);
    assert.equal(ingestBody.data.tenant_id, 2);
    assert.deepEqual(ingestBody.data.also_tenants, [1]);
    assert.equal(ingestBody.data.landed.employees.created, 2);
    assert.equal(ingestBody.data.landed.talent.created, 2);

    const employees = await asDemo("/api/employees?category=internal");
    assert.equal(employees.status, 200);
    const employeeBody = await employees.json() as { success: boolean; data: Array<{ name: string; employment_category: string; status: string; tenant_id: number }> };
    assert.equal(employeeBody.success, true);
    const names = employeeBody.data.map((row) => row.name).sort();
    assert.deepEqual(names, ["Ops Coordinator", "Policy Analyst"]);
    assert(employeeBody.data.every((row) => row.employment_category === "internal"));
    assert(employeeBody.data.every((row) => row.status === "active"));
    assert(employeeBody.data.every((row) => row.tenant_id === 2));

    const talent = await asDemo("/api/talent");
    assert.equal(talent.status, 200);
    const talentBody = await talent.json() as { success: boolean; data: Array<{ name: string; status: string; tenant_id: number }> };
    assert.equal(talentBody.success, true);
    assert.deepEqual(talentBody.data.map((row) => row.name).sort(), ["Ops Coordinator", "Policy Analyst"]);
    assert(talentBody.data.every((row) => row.status === "available"));

    const skills = await asDemo("/api/skills");
    assert.equal(skills.status, 200);
    const skillBody = await skills.json() as { success: boolean; data: Array<{ name: string; enabled: number }> };
    assert(skillBody.data.some((row) => row.name === "org-governance" && row.enabled === 1));

    const plugins = await asDemo("/api/plugins");
    assert.equal(plugins.status, 200);
    const pluginBody = await plugins.json() as { success: boolean; data: Array<{ name: string; status: string }> };
    assert(pluginBody.data.some((row) => row.name === "org-governance" && row.status === "active"));
    assert(pluginBody.data.some((row) => row.name === "xyos-governance-mcp" && row.status === "active"));

    const tenant1Employees = dbAll(
      "SELECT name FROM employees WHERE tenant_id = 1 ORDER BY name",
    ) as Array<{ name: string }>;
    assert.deepEqual(tenant1Employees.map((row) => row.name), ["Ops Coordinator", "Policy Analyst"]);
    const tenant2Count = dbGet(
      "SELECT COUNT(*) as c FROM employees WHERE tenant_id = 2",
    ) as { c: number };
    assert.equal(Number(tenant2Count.c), 2);

    console.log("freeos ingest writes to the active UI tenant and list APIs see the rows");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

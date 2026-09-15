import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openxyos-agent-studio-"));
  process.env.NODE_ENV = "development";
  process.env.FILE_SCAN_MODE = "disabled";
  process.env.JWT_SECRET = "agent-studio-test-secret-at-least-32-characters";
  process.env.COOKIE_SECRET = "agent-studio-cookie-secret-at-least-32-chars";
  process.env.DATABASE_PATH = path.join(tempRoot, "test.db");
  process.env.AGENT_STUDIO_UPLOAD_DIR = path.join(tempRoot, "uploads");

  const { initDatabase, dbGet, dbRun } = await import("../backend/db");
  const { agentStudioRoutes } = await import("../backend/routes/agent-studio");
  const { talentRoutes } = await import("../backend/routes/talent");
  const { signToken } = await import("../backend/middleware");
  await initDatabase();

  const tenantId = Number(dbRun(
    "INSERT INTO tenants (name, slug, status) VALUES (?, ?, 'active')",
    ["openXYOS Test", "openxyos-agent-test"],
  ).lastInsertRowid);
  const adminId = Number(dbRun(
    "INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'admin', ?)",
    ["admin@openxyos.test", "unused", "Admin", tenantId],
  ).lastInsertRowid);
  const token = signToken({
    id: adminId,
    email: "admin@openxyos.test",
    nickname: "Admin",
    role: "admin",
    tenant_id: tenantId,
  });

  const app = express();
  app.use(express.json());
  app.use("/api/agent-studio", agentStudioRoutes);
  app.use("/api/talent", talentRoutes);
  const server = app.listen(0, "127.0.0.1");
  let baseUrl = "";

  async function request(url: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${url}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
  }

  try {
    await new Promise<void>(resolve => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const form = new FormData();
    form.set("file", new Blob([
      "制造业设备顾问准则：发生安全风险时必须停止自动处置，并提交人工复核。"
    ], { type: "text/plain" }), "industry-guide.txt");
    const uploaded = await request("/api/agent-studio/references", { method: "POST", body: form });
    assert.equal(uploaded.status, 200);
    const uploadedBody = await uploaded.json() as any;
    assert.equal(uploadedBody.success, true);
    assert(uploadedBody.data.id);

    const generated = await request("/api/agent-studio/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "制造业设备顾问",
        positioning: "帮助设备负责人分析故障并给出受控建议",
        industry: "制造业",
        experience: "优先核实设备状态和现场安全条件。",
        capabilities: ["故障分析", "维护建议"],
        reference_ids: [uploadedBody.data.id],
        ima_url: "https://ima.qq.com/knowledge/demo",
      }),
    });
    assert.equal(generated.status, 201);
    const generatedBody = await generated.json() as any;
    assert.equal(generatedBody.data.status, "available");
    assert.equal(generatedBody.data.ima_status, "linked_unverified");

    const talent = dbGet("SELECT * FROM talent_pool WHERE id = ?", [generatedBody.data.talent_id]) as any;
    assert.equal(talent.source, "agent-customization");
    assert.match(talent.description, /设备顾问准则/);
    const blueprint = JSON.parse(talent.capabilities);
    assert.equal(blueprint.schema, "openxyos.agent-blueprint.v1");
    assert.match(blueprint.references[0].excerpt, /人工复核/);

    const recruited = await request(`/api/talent/${talent.id}/recruit`, { method: "POST" });
    assert.equal(recruited.status, 200);
    const recruitedBody = await recruited.json() as any;
    const employee = dbGet("SELECT * FROM employees WHERE id = ?", [recruitedBody.data.employee_id]) as any;
    assert.equal(employee.employment_category, "reserve");
    assert.equal(employee.agent_type, talent.agent_type);
    assert.match(employee.description, /设备顾问准则/);

    console.log("agent studio -> talent market -> reserve employee integration tests passed");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
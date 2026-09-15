import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

function expectStatus(actual: number, expected: number, description: string) {
  assert.equal(actual, expected, `${description}: expected HTTP ${expected}, received ${actual}`);
}

async function request(baseUrl: string, token: string, pathName: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${pathName}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xyos-r0-access-"));
  process.env.NODE_ENV = "development";
  process.env.DEPLOY_MODE = "";
  process.env.JWT_SECRET = "development-only-secret-with-at-least-32-characters";
  process.env.COOKIE_SECRET = "development-cookie-secret-with-at-least-32-chars";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  process.env.DB_DIALECT = "sqlite";
  process.env.DATABASE_PATH = path.join(tempRoot, "xyos-r0-test.db");
  process.env.XYOS_UPLOAD_DIR = path.join(tempRoot, "uploads");

  const { initDatabase, dbAll, dbGet, dbRun } = await import("../backend/db");
  const { authRoutes } = await import("../backend/routes/auth");
  const { chatRoutes } = await import("../backend/routes/chats");
  const { taskRoutes } = await import("../backend/routes/tasks");
  const { knowledgeRoutes } = await import("../backend/routes/knowledge");
  const { signToken } = await import("../backend/middleware");

  await initDatabase();
  const tenantA = dbRun("INSERT INTO tenants (name, slug, status) VALUES (?, ?, 'active')", ["Tenant A", "test-a"]).lastInsertRowid;
  const tenantB = dbRun("INSERT INTO tenants (name, slug, status) VALUES (?, ?, 'active')", ["Tenant B", "test-b"]).lastInsertRowid;
  const userA = dbRun("INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'admin', ?)", ["a@example.test", "unused", "User A", tenantA]).lastInsertRowid;
  const userAViewer = dbRun("INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'user', ?)", ["viewer@example.test", "unused", "Viewer A", tenantA]).lastInsertRowid;
  const userB = dbRun("INSERT INTO users (email, password_hash, nickname, role, tenant_id) VALUES (?, ?, ?, 'user', ?)", ["b@example.test", "unused", "User B", tenantB]).lastInsertRowid;
  const employeeB = dbRun("INSERT INTO employees (name, role, employee_type, status, tenant_id) VALUES (?, ?, 'ai', 'active', ?)", ["Agent B", "Engineer", tenantB]).lastInsertRowid;
  const chatA = dbRun("INSERT INTO chats (company_id, title, type, created_by, tenant_id) VALUES (1, ?, 'group', ?, ?)", ["Tenant A group", userA, tenantA]).lastInsertRowid;
  const taskA = dbRun("INSERT INTO tasks (title, tenant_id, status, created_by) VALUES (?, ?, 'todo', ?)", ["Tenant A task", tenantA, userA]).lastInsertRowid;
  const subtaskA = dbRun("INSERT INTO task_subtasks (task_id, title, tenant_id) VALUES (?, ?, ?)", [taskA, "Tenant A subtask", tenantA]).lastInsertRowid;
  const commentA = dbRun("INSERT INTO task_comments (task_id, user_id, content, comment_type, tenant_id) VALUES (?, ?, ?, 'user', ?)", [taskA, userA, "Tenant A comment", tenantA]).lastInsertRowid;
  dbRun("INSERT INTO chat_members (chat_id, user_id, role, tenant_id, joined_at) VALUES (?, ?, 'admin', ?, datetime('now'))", [chatA, userA, tenantA]);

  const tokenA = signToken({ id: userA, email: "a@example.test", nickname: "User A", role: "admin", tenant_id: tenantA });
  const tokenAViewer = signToken({ id: userAViewer, email: "viewer@example.test", nickname: "Viewer A", role: "user", tenant_id: tenantA });
  const tokenB = signToken({ id: userB, email: "b@example.test", nickname: "User B", role: "user", tenant_id: tenantB });
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/chats", chatRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/knowledge", knowledgeRoutes);
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const register = await request(baseUrl, "", "/api/auth/register", { method: "POST", body: JSON.stringify({ email: "outside@example.test", password: "not-used" }) });
    expectStatus(register.status, 403, "public registration disabled");

    const outsiderRead = await request(baseUrl, tokenB, `/api/chats/${chatA}`);
    expectStatus(outsiderRead.status, 404, "cross-tenant user cannot read chat");

    const localizedTaskError = await request(baseUrl, tokenA, "/api/tasks", { method: "POST", headers: { "Accept-Language": "en" }, body: JSON.stringify({}) });
    expectStatus(localizedTaskError.status, 400, "English task validation returns a client error");
    assert.equal((await localizedTaskError.json()).error, "Title is required", "English task validation error is localized");

    const crossTenantAgent = await request(baseUrl, tokenA, "/api/chats", { method: "POST", body: JSON.stringify({ title: "invalid agent group", employee_ids: [employeeB] }) });
    expectStatus(crossTenantAgent.status, 400, "cross-tenant AI cannot join chat");

    const created = await request(baseUrl, tokenA, "/api/chats", { method: "POST", body: JSON.stringify({ title: "tenant group" }) });
    expectStatus(created.status, 200, "internal user can create chat");

    const chatList = await request(baseUrl, tokenA, "/api/chats");
    expectStatus(chatList.status, 200, "member can list own tenant chats");

    const forbiddenRole = await request(baseUrl, tokenA, `/api/chats/${chatA}/members`, {
      method: "POST",
      body: JSON.stringify({ user_id: userA, role: "owner" }),
    });
    expectStatus(forbiddenRole.status, 400, "unsupported chat role is rejected");

    const sent = await request(baseUrl, tokenA, `/api/chats/${chatA}/messages`, { method: "POST", body: JSON.stringify({ content: "test message", sender_name: "spoofed executive" }) });
    expectStatus(sent.status, 200, "member can send message");
    const storedMessages = dbAll("SELECT sender_name FROM messages WHERE chat_id = ? AND sender_type = 'user'", [chatA]) as Array<{ sender_name: string }>;
    assert.equal(storedMessages.at(-1)?.sender_name, "User A", "sender display name must come from authenticated server identity");

    const crossTenantAttachments = await request(baseUrl, tokenB, `/api/tasks/${taskA}/attachments`);
    expectStatus(crossTenantAttachments.status, 404, "cross-tenant user cannot enumerate task attachments");
    const clientPathAttachment = await request(baseUrl, tokenA, `/api/tasks/${taskA}/attachments`, {
      method: "POST",
      body: JSON.stringify({ filename: "untrusted.txt", file_path: "C:/sensitive.txt" }),
    });
    expectStatus(clientPathAttachment.status, 409, "client-controlled task attachment path is not accepted");

    const crossTaskDelete = await request(baseUrl, tokenB, `/api/tasks/${taskA}`, { method: "DELETE" });
    expectStatus(crossTaskDelete.status, 404, "cross-tenant user cannot delete task");
    const crossSubtaskCreate = await request(baseUrl, tokenB, `/api/tasks/${taskA}/subtasks`, { method: "POST", body: JSON.stringify({ title: "illegal" }) });
    expectStatus(crossSubtaskCreate.status, 404, "cross-tenant user cannot create subtask");
    const crossSubtaskDelete = await request(baseUrl, tokenB, `/api/tasks/${taskA}/subtasks/${subtaskA}`, { method: "DELETE" });
    expectStatus(crossSubtaskDelete.status, 404, "cross-tenant user cannot delete subtask");
    const crossCommentDelete = await request(baseUrl, tokenB, `/api/tasks/${taskA}/comments/${commentA}`, { method: "DELETE" });
    expectStatus(crossCommentDelete.status, 404, "cross-tenant user cannot delete comment");
    const crossAssigneeCreate = await request(baseUrl, tokenA, "/api/tasks", { method: "POST", body: JSON.stringify({ title: "invalid assignment", assigned_to: employeeB }) });
    expectStatus(crossAssigneeCreate.status, 400, "cross-tenant employee cannot be assigned on task creation");
    const crossAssigneeUpdate = await request(baseUrl, tokenA, `/api/tasks/${taskA}`, { method: "PUT", body: JSON.stringify({ assigned_to: employeeB }) });
    expectStatus(crossAssigneeUpdate.status, 400, "cross-tenant employee cannot be assigned on task update");

    const rejectedKnowledge = new FormData();
    rejectedKnowledge.append("file", new Blob(["not a PDF"], { type: "application/pdf" }), "spoofed.pdf");
    const badKnowledgeUpload = await fetch(`${baseUrl}/api/knowledge/files/upload`, { method: "POST", headers: { Authorization: `Bearer ${tokenA}` }, body: rejectedKnowledge });
    expectStatus(badKnowledgeUpload.status, 415, "knowledge file signature must match its extension");

    process.env.FILE_SCAN_MODE = "required";
    const scanRequiredKnowledge = new FormData();
    scanRequiredKnowledge.append("file", new Blob(["scan required"], { type: "text/plain" }), "scan-required.txt");
    const unavailableScanner = await fetch(`${baseUrl}/api/knowledge/files/upload`, { method: "POST", headers: { Authorization: `Bearer ${tokenA}` }, body: scanRequiredKnowledge });
    expectStatus(unavailableScanner.status, 503, "required security scan fails closed when scanner is unavailable");
    delete process.env.FILE_SCAN_MODE;

    process.env.NODE_ENV = "production";
    process.env.FILE_SCAN_MODE = "disabled";
    const privateScannerBypass = new FormData();
    privateScannerBypass.append("file", new Blob(["private scan required"], { type: "text/plain" }), "private-scan.txt");
    const privateScannerBlocked = await fetch(`${baseUrl}/api/knowledge/files/upload`, { method: "POST", headers: { Authorization: `Bearer ${tokenA}` }, body: privateScannerBypass });
    expectStatus(privateScannerBlocked.status, 503, "private production cannot downgrade required file scanning");
    process.env.NODE_ENV = "development";
    delete process.env.FILE_SCAN_MODE;

    const acceptedKnowledge = new FormData();
    acceptedKnowledge.append("folder", "/safety");
    acceptedKnowledge.append("file", new Blob(["controlled knowledge content"], { type: "text/plain" }), "safe.txt");
    const goodKnowledgeUpload = await fetch(`${baseUrl}/api/knowledge/files/upload`, { method: "POST", headers: { Authorization: `Bearer ${tokenA}` }, body: acceptedKnowledge });
    expectStatus(goodKnowledgeUpload.status, 200, "valid knowledge file can be stored under tenant scope");
    const knowledgeUploadData = await goodKnowledgeUpload.json() as { data: { id: number } };
    const storedKnowledge = dbGet("SELECT file_path FROM knowledge_files WHERE id = ? AND tenant_id = ?", [knowledgeUploadData.data.id, tenantA]) as { file_path: string };
    assert.ok(storedKnowledge.file_path.includes(path.join("tenants", String(tenantA))), "knowledge file must use a tenant-isolated physical directory");
    const knowledgeDownload = await request(baseUrl, tokenA, `/api/knowledge/files/${knowledgeUploadData.data.id}/download`);
    expectStatus(knowledgeDownload.status, 200, "tenant user can download authorized knowledge file");
    assert.equal(knowledgeDownload.headers.get("cache-control"), "private, no-store", "knowledge download must not be shared-cached");
    assert.equal(knowledgeDownload.headers.get("x-content-type-options"), "nosniff", "knowledge download must disable type sniffing");
    const crossKnowledgeDownload = await request(baseUrl, tokenB, `/api/knowledge/files/${knowledgeUploadData.data.id}/download`);
    expectStatus(crossKnowledgeDownload.status, 404, "cross-tenant user cannot download knowledge file");

    const nonAdminKnowledge = new FormData();
    nonAdminKnowledge.append("file", new Blob(["viewer attempt"], { type: "text/plain" }), "viewer.txt");
    const nonAdminUpload = await fetch(`${baseUrl}/api/knowledge/files/upload`, { method: "POST", headers: { Authorization: `Bearer ${tokenAViewer}` }, body: nonAdminKnowledge });
    expectStatus(nonAdminUpload.status, 403, "non-admin cannot publish a knowledge file");
    const invalidFolder = await request(baseUrl, tokenA, "/api/knowledge/files/folder", { method: "POST", body: JSON.stringify({ name: "..", parent: "/" }) });
    expectStatus(invalidFolder.status, 400, "knowledge folder traversal is rejected");
    dbRun("UPDATE knowledge_files SET file_path = ? WHERE id = ? AND tenant_id = ?", [path.join(tempRoot, "uploads", "tenants", String(tenantB), "other.txt"), knowledgeUploadData.data.id, tenantA]);
    const tamperedPathDownload = await request(baseUrl, tokenA, `/api/knowledge/files/${knowledgeUploadData.data.id}/download`);
    expectStatus(tamperedPathDownload.status, 404, "knowledge record cannot read a different tenant physical directory");

    dbRun("UPDATE tenants SET status = 'suspended' WHERE id = ?", [tenantA]);
    const disabledTenantRead = await request(baseUrl, tokenA, `/api/chats/${chatA}`);
    expectStatus(disabledTenantRead.status, 401, "existing JWT is rejected after tenant suspension");
    console.log("R0 access-control integration tests passed");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

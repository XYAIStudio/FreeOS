import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { dbAll, dbGet, dbRun } from "../db";
import { authenticate, AuthRequest } from "../middleware";
import { scanFileBuffer } from "../services/file-security";
import { extractText } from "../services/doc-parser";
import { localizedError } from "../utils/locale";

export const agentStudioRoutes = Router();
agentStudioRoutes.use(authenticate);

const allowedExtensions = new Set([".txt", ".md", ".csv", ".json", ".pdf", ".docx"]);
const referenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, allowedExtensions.has(path.extname(file.originalname).toLowerCase())),
});

function ensureSchema() {
  dbRun(`CREATE TABLE IF NOT EXISTS agent_reference_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    uploaded_by INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    scan_status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  try { dbRun("ALTER TABLE agent_reference_files ADD COLUMN extracted_text TEXT"); }
  catch (error: any) { if (!error.message?.includes("duplicate column")) throw error; }
  dbRun("CREATE INDEX IF NOT EXISTS idx_agent_reference_owner ON agent_reference_files(tenant_id, uploaded_by)");
}

function agentError(req: AuthRequest, zh: string, en: string) { return localizedError(req, zh, en); }

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeSlug(value: string): string {
  const ascii = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return ascii || randomUUID().slice(0, 8);
}

agentStudioRoutes.get("/references", (req: AuthRequest, res) => {
  try {
    ensureSchema();
    const files = dbAll(
      "SELECT id, original_name, file_type, file_size, scan_status, created_at FROM agent_reference_files WHERE tenant_id = ? AND uploaded_by = ? ORDER BY id DESC LIMIT 50",
      [req.user!.tenant_id, req.user!.id],
    );
    res.json({ success: true, data: files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

agentStudioRoutes.post("/references", referenceUpload.single("file"), async (req: AuthRequest, res) => {
  try {
    ensureSchema();
    if (!req.file) return res.status(400).json({ success: false, error: agentError(req, "请选择支持的参考资料文件", "Select a supported reference file") });
    const scan = await scanFileBuffer(req.file.buffer);
    if (scan.verdict === "blocked") {
      return res.status(scan.reason === "infected" ? 422 : 503).json({
        success: false,
        error: scan.reason === "infected" ? agentError(req, "文件安全扫描未通过", "The file did not pass the security scan") : agentError(req, "文件安全扫描服务不可用", "The file security scan is unavailable"),
      });
    }
    const extension = path.extname(req.file.originalname).toLowerCase();
    const directory = path.join(process.env.AGENT_STUDIO_UPLOAD_DIR || path.join(process.cwd(), "uploads", "agent-studio"), String(req.user!.tenant_id), String(req.user!.id));
    fs.mkdirSync(directory, { recursive: true });
    const storedPath = path.join(directory, randomUUID() + extension);
    fs.writeFileSync(storedPath, req.file.buffer, { mode: 0o640 });
    let extractedText: string;
    try {
      extractedText = await extractText(storedPath, extension);
    } catch (parseError: any) {
      fs.rmSync(storedPath, { force: true });
      return res.status(422).json({ success: false, error: agentError(req, `资料无法解析：${parseError.message}`, `The reference file could not be parsed: ${parseError.message}`) });
    }
    if (!extractedText) {
      fs.rmSync(storedPath, { force: true });
      return res.status(422).json({ success: false, error: agentError(req, "资料中没有可读取的文本内容", "The reference file contains no readable text") });
    }
    const inserted = dbRun(
      "INSERT INTO agent_reference_files (tenant_id, uploaded_by, original_name, stored_path, file_type, file_size, scan_status, extracted_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [req.user!.tenant_id, req.user!.id, path.basename(req.file.originalname), storedPath, extension, req.file.size, scan.verdict, extractedText],
    );
    res.json({ success: true, data: { id: inserted.lastInsertRowid, name: path.basename(req.file.originalname), size: req.file.size, scan: scan.verdict } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

agentStudioRoutes.post("/generate", (req: AuthRequest, res) => {
  try {
    ensureSchema();
    const name = cleanText(req.body?.name, 80);
    const positioning = cleanText(req.body?.positioning, 400);
    const industry = cleanText(req.body?.industry, 80) || "专业服务";
    const experience = cleanText(req.body?.experience, 12000);
    const imaUrl = cleanText(req.body?.ima_url, 1000);
    const capabilities = Array.isArray(req.body?.capabilities)
      ? req.body.capabilities.map((item: unknown) => cleanText(item, 80)).filter(Boolean).slice(0, 16)
      : [];
    const referenceIds = Array.isArray(req.body?.reference_ids)
      ? [...new Set(req.body.reference_ids.map(Number).filter(Number.isSafeInteger))].slice(0, 20)
      : [];

    if (!name || !positioning) return res.status(400).json({ success: false, error: agentError(req, "智能体名称和定位不能为空", "Agent name and positioning are required") });
    if (capabilities.length === 0) return res.status(400).json({ success: false, error: agentError(req, "请至少填写一项能力", "Add at least one capability") });
    if (!experience && referenceIds.length === 0 && !imaUrl) {
      return res.status(400).json({ success: false, error: agentError(req, "请提供行业经验、参考资料或 ima 知识库中的至少一项", "Provide industry experience, a reference file, or an ima knowledge base") });
    }

    let imaBinding: { url: string; status: string } | null = null;
    if (imaUrl) {
      let parsed: URL;
      try { parsed = new URL(imaUrl); } catch { return res.status(400).json({ success: false, error: agentError(req, "ima 知识库地址格式无效", "The ima knowledge base URL is invalid") }); }
      if (parsed.protocol !== "https:" || !parsed.hostname.toLowerCase().includes("ima")) {
        return res.status(400).json({ success: false, error: agentError(req, "ima 知识库必须使用包含 ima 域名的 HTTPS 地址", "The ima knowledge base must use an HTTPS URL containing an ima domain") });
      }
      imaBinding = { url: imaUrl, status: "linked_unverified" };
    }

    const placeholders = referenceIds.map(() => "?").join(",");
    const references = referenceIds.length
      ? dbAll(
          `SELECT id, original_name, file_type, scan_status, extracted_text FROM agent_reference_files WHERE tenant_id = ? AND uploaded_by = ? AND id IN (${placeholders})`,
          [req.user!.tenant_id, req.user!.id, ...referenceIds],
        ) as Array<{ id: number; original_name: string; file_type: string; scan_status: string; extracted_text: string }>
      : [];
    if (references.length !== referenceIds.length) {
      return res.status(400).json({ success: false, error: agentError(req, "部分参考资料不存在或不属于当前用户", "One or more reference files do not exist or are not owned by the current user") });
    }

    const agentType = `custom-${safeSlug(name)}-${Date.now().toString(36)}`;
    const blueprint = {
      schema: "openxyos.agent-blueprint.v1",
      creator_user_id: req.user!.id,
      name, industry, positioning, capabilities, experience,
      references: references.map(file => ({ id: file.id, name: file.original_name, type: file.file_type, scan: file.scan_status, excerpt: (file.extracted_text || "").slice(0, 6000) })),
      ima: imaBinding,
      governance: { high_risk_requires_human_review: true, external_write_disabled: true },
      lifecycle: "talent_market",
    };
    const description = [
      positioning,
      agentError(req, `行业：${industry}`, `Industry: ${industry}`),
      agentError(req, `核心能力：${capabilities.join("、")}`, `Core capabilities: ${capabilities.join(", ")}`),
      experience ? agentError(req, `行业经验与工作准则：${experience}`, `Industry experience and operating guidance: ${experience}`) : "",
      references.length ? agentError(req, `参考资料内容：${references.map(file => `【${file.original_name}】` + (file.extracted_text || "").slice(0, 6000)).join("\n")}`, `Reference materials: ${references.map(file => `[${file.original_name}]` + (file.extracted_text || "").slice(0, 6000)).join("\n")}`) : "",
      imaBinding ? agentError(req, `ima 知识库：已关联，运行前需完成可用性验证（${imaBinding.url}）`, `ima knowledge base: linked; availability must be verified before runtime (${imaBinding.url})`) : "",
      agentError(req, "治理边界：高风险结论必须提交人工复核，不执行外发、删除、支付或生产环境修改。", "Governance boundaries: high-risk conclusions require human review; external sending, deletion, payment, and production changes are disabled."),
    ].filter(Boolean).join("\n");

    const inserted = dbRun(
      `INSERT INTO talent_pool
       (tenant_id, talent_type, name, avatar_emoji, skills, category, description, source, rating, status, agent_type, capabilities, provider, integration_type)
       VALUES (?, 'ai', ?, '🤖', ?, ?, ?, 'agent-customization', 5, 'available', ?, ?, 'openXYOS', 'agent-blueprint-v1')`,
      [req.user!.tenant_id, name, capabilities.join(","), industry, description, agentType, JSON.stringify(blueprint)],
    );

    res.status(201).json({
      success: true,
      data: {
        talent_id: inserted.lastInsertRowid,
        agent_type: agentType,
        status: "available",
        market: "talent",
        ima_status: imaBinding?.status || "not_linked",
        next_step: agentError(req, "在人机资源的人才市场中招募，随后在备选员工中补充岗位职责和所属部门。", "Recruit this agent from the Human–AI resources talent market, then add its role responsibilities and department in the reserve employee pool."),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

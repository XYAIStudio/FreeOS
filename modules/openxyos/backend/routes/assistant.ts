import { Router } from "express";
import { dbRun, dbGet, dbAll } from "../db";
import { callLLM } from "../services/ai";
import { sendAssistantLog } from "../services/feishu";
import { lookupIP } from "../services/geoip";
import { authenticate, requireSuperAdmin, AuthRequest } from "../middleware";

export const assistantRoutes = Router();

const FEISHU_WEBHOOK = process.env.FEISHU_ASSISTANT_WEBHOOK || "";

const ASSISTANT_SYSTEM_PROMPT = `你是雄元智脑XYOS的智能助手"小雄"，由北京雄元科技有限公司开发。

你的职责：
1. 热情、专业地解答用户关于雄元智脑系统的问题
2. 介绍雄元科技的公司愿景和产品规划
3. 引导用户了解XYOS的核心功能（AI数字员工、组织架构、合同管理、知识库等）
4. 在对话中自然地获取用户的联系方式，便于后续回访

关于雄元科技：
- 北京雄元科技有限公司是一家专注于AI赋能企业效能管理的科技公司
- 公司的使命是"让AI成为企业可信赖的数字员工"
- 核心产品是雄元智脑XYOS企业效能管理系统
- XYOS包含82名AI数字员工，覆盖17个业务中心
- 支持组织管理、任务协作、合同管理、知识库、考勤、审批等
- 当前为免费测试版，付费商用需线下签约
- 官网：os.cnxy.tech，合作邮箱：hezuo@cnxy.tech

关于留资引导（必须执行）：
- 当用户询问价格、功能、试用、合作、购买等意向问题时，必须主动邀请留资
- 在对话中注意捕捉用户的意向信号
- 适时邀请用户留下联系方式：姓名、公司、电话、邮箱
- 自然引导，参考话术：
  "方便留个联系方式吗？我们可以安排专业顾问给您做详细演示"
  "如果您需要更详细的方案，可以留下邮箱，我把资料发给您"
  "留下您的手机号，我们的顾问会第一时间联系您"
- 用户留资后，记录下来并感谢

回复风格：
- 简洁友好，不要过于冗长
- 使用适当的emoji增加亲和力
- 对技术问题给出专业但不艰深的解答
- 不知道的问题诚实说明，并引导用户联系官方

回复格式要求（非常重要）：
- 每个要点或独立信息必须单独一行，用换行分隔
- 段落之间留一个空行
- 列表项每行一条，前面加"·"或数字
- 禁止把不同主题的内容挤在同一行
- 总长度控制在200字以内，但必须分行`;

// 智能助手对话（增强版：带会话追踪、IP地理位置、Token统计）
assistantRoutes.post("/chat", async (req, res) => {
  try {
    const { message, history = [], session_id } = req.body;

    if (!message || message.trim().length === 0) {
      return res.json({ reply: "您好！请问有什么可以帮您的？😊", lead_captured: false });
    }

    // IP 地理位置（异步，不阻塞回复）
    const ip = req.ip || req.socket.remoteAddress || "";
    let geo: { city?: string; region?: string; country?: string } = {};
    if (session_id) {
      lookupIP(ip).then(g => {
        geo = g;
        // 异步更新会话的地理位置（dbRun 为同步函数，用 try/catch 包裹）
        try {
          dbRun(
            `UPDATE assistant_conversations SET ip_address = ?, city = ?, region = ?, country = ?, user_agent = ? WHERE session_id = ? AND (city IS NULL OR city = '')`,
            [ip, geo.city || "", geo.region || "", geo.country || "", req.headers["user-agent"] || "", session_id]
          );
        } catch {}
      }).catch(() => {});
    }

    // 构建对话历史
    const messages: any[] = [
      { role: "system", content: ASSISTANT_SYSTEM_PROMPT }
    ];

    for (const h of (history || []).slice(-10)) {
      // 前端历史中的 bot 角色需映射为 LLM 接口认可的 assistant
      const role = h.role === "bot" ? "assistant" : h.role === "assistant" ? "assistant" : h.role === "user" ? "user" : "user";
      messages.push({ role, content: h.content });
    }
    messages.push({ role: "user", content: message });

    // 调用LLM
    let reply: string;
    let tokensUsed = 0;
    try {
      const result = await callLLM(messages, 0.7, 500);
      reply = result.content || "抱歉，我暂时无法回答这个问题，请稍后再试。";
      tokensUsed = result.tokens_used || 0;
    } catch {
      reply = "抱歉，AI服务暂时不可用，请稍后再试或直接联系客服：hezuo@cnxy.tech";
    }

    // 检测留资信息
    const leadInfo = extractLeadInfo(message, reply);
    let leadSaved = false;
    if (leadInfo) {
      try {
        dbRun(
          `INSERT INTO assistant_leads (name, company, phone, email, interest, source, status) VALUES (?, ?, ?, ?, ?, ?, 'new')`,
          [leadInfo.name || "", leadInfo.company || "", leadInfo.phone || "", leadInfo.email || "", leadInfo.interest || "", "chat_auto_extract"]
        );
        leadSaved = true;
      } catch { /* 留资写入失败不影响对话 */ }
    }

    // 异步持久化对话到 DB（不阻塞回复；dbRun 为同步函数，用 try/catch 包裹）
    if (session_id) {
      try {
        const msgs = [...(history || []), { role: "user", content: message }, { role: "assistant", content: reply }];
        dbRun(
          `INSERT INTO assistant_conversations (session_id, ip_address, city, region, country, user_agent, messages_json, message_count, total_tokens, lead_captured, lead_info)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(session_id) DO UPDATE SET
             messages_json = excluded.messages_json,
             message_count = excluded.message_count,
             total_tokens = assistant_conversations.total_tokens + excluded.total_tokens,
             lead_captured = MAX(assistant_conversations.lead_captured, excluded.lead_captured),
             lead_info = CASE WHEN excluded.lead_captured = 1 THEN excluded.lead_info ELSE assistant_conversations.lead_info END,
             ip_address = CASE WHEN assistant_conversations.ip_address IS NULL THEN excluded.ip_address ELSE assistant_conversations.ip_address END`,
          [session_id, ip, geo.city || "", geo.region || "", geo.country || "", req.headers["user-agent"] || "",
           JSON.stringify(msgs), msgs.length, tokensUsed, leadSaved ? 1 : 0, leadInfo ? JSON.stringify(leadInfo) : null]
        );
      } catch {}
    }

    res.json({
      reply,
      lead_captured: leadSaved,
      lead_info: leadInfo,
      tokens_used: tokensUsed,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 关闭对话 — 触发飞书推送 + 最终持久化
assistantRoutes.post("/close", async (req, res) => {
  try {
    const { messages = [], session_id } = req.body;

    if (!session_id || messages.length === 0) {
      return res.json({ success: false, message: "缺少 session_id 或 messages" });
    }

    // 获取 IP 地理位置
    const ip = req.ip || req.socket.remoteAddress || "";
    const geo = await lookupIP(ip);

    // 检测留资
    let leadCaptured = 0;
    let leadInfo: any = null;
    for (const m of messages) {
      if (m.role === "user") {
        const info = extractLeadInfo(m.content, "");
        if (info) {
          leadCaptured = 1;
          leadInfo = info;
          // 自动写入 assistant_leads
          try {
            dbRun(
              `INSERT INTO assistant_leads (name, company, phone, email, interest, source, status) VALUES (?, ?, ?, ?, ?, ?, 'new')`,
              [info.name || "", info.company || "", info.phone || "", info.email || "", info.interest || "", "chat_close"]
            );
          } catch { /* ignore */ }
          break;
        }
      }
    }

    // 持久化完整对话
    const userMsgs = messages.filter((m: any) => m.role === "user").length;
    dbRun(
      `INSERT OR REPLACE INTO assistant_conversations (session_id, ip_address, city, region, country, user_agent, messages_json, message_count, total_tokens, lead_captured, lead_info, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT total_tokens FROM assistant_conversations WHERE session_id = ?), 0), ?, ?, CURRENT_TIMESTAMP)`,
      [session_id, ip, geo.city, geo.region, geo.country, req.headers["user-agent"] || "",
       JSON.stringify(messages), messages.length, session_id, leadCaptured, leadInfo ? JSON.stringify(leadInfo) : null]
    );

    // 飞书推送（异步，不阻塞回复）
    if (FEISHU_WEBHOOK) {
      sendAssistantLog(FEISHU_WEBHOOK, {
        sessionId: session_id,
        ip,
        city: geo.city || "未知",
        region: geo.region || "",
        country: geo.country || "",
        messageCount: messages.length,
        leadCaptured: leadCaptured === 1,
        leadInfo,
        messages: messages.slice(0, 20), // 最多20条
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 手动提交留资
assistantRoutes.post("/lead", async (req, res) => {
  try {
    const { name, company, phone, email, interest, source } = req.body;
    dbRun(
      `INSERT INTO assistant_leads (name, company, phone, email, interest, source, status) VALUES (?, ?, ?, ?, ?, ?, 'new')`,
      [name || "", company || "", phone || "", email || "", interest || "", source || "manual"]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 获取留资列表（管理端）
assistantRoutes.get("/leads", authenticate, requireSuperAdmin, (_req: AuthRequest, res) => {
  const leads = dbAll("SELECT * FROM assistant_leads ORDER BY created_at DESC LIMIT 200");
  res.json({ success: true, data: leads || [] });
});

// 获取对话记录列表（管理端）
assistantRoutes.get("/conversations", authenticate, requireSuperAdmin, (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const hasLead = req.query.has_lead as string;
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: any[] = [];
  if (hasLead === "1") {
    where += " AND lead_captured = 1";
  } else if (hasLead === "0") {
    where += " AND lead_captured = 0";
  }

  const total = dbGet(`SELECT COUNT(*) as cnt FROM assistant_conversations ${where}`, params) as any;
  const rows = dbAll(
    `SELECT id, session_id, ip_address, city, region, country, message_count, total_tokens, lead_captured, lead_info, created_at
     FROM assistant_conversations ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) || [];

  // 手机号脱敏
  const masked = rows.map((r: any) => {
    if (r.lead_info) {
      try {
        const info = JSON.parse(r.lead_info);
        if (info.phone && info.phone.length >= 11) {
          info.phone = info.phone.slice(0, 3) + "****" + info.phone.slice(-4);
        }
        r.lead_info_masked = info;
      } catch { r.lead_info_masked = r.lead_info; }
    }
    return r;
  });

  res.json({
    success: true,
    data: masked,
    pagination: { page, limit, total: (total as any)?.cnt || 0, totalPages: Math.ceil(((total as any)?.cnt || 0) / limit) },
  });
});

// 获取单条对话详情（管理端）
assistantRoutes.get("/conversations/:id", authenticate, requireSuperAdmin, (req: AuthRequest, res) => {
  const row = dbGet("SELECT * FROM assistant_conversations WHERE id = ?", [req.params.id]) as any;
  if (!row) return res.status(404).json({ success: false, error: "记录不存在" });

  if (row.messages_json) {
    try { row.messages = JSON.parse(row.messages_json); } catch { row.messages = []; }
  }
  if (row.lead_info) {
    try {
      const info = JSON.parse(row.lead_info);
      if (info.phone && info.phone.length >= 11) {
        info.phone = info.phone.slice(0, 3) + "****" + info.phone.slice(-4);
      }
      row.lead_info_masked = info;
    } catch { row.lead_info_masked = row.lead_info; }
  }

  res.json({ success: true, data: row });
});

// 获取 Token 统计（管理端）
assistantRoutes.get("/stats", authenticate, requireSuperAdmin, (_req: AuthRequest, res) => {
  const total = dbGet("SELECT SUM(total_tokens) as total_tokens, COUNT(*) as total_conversations, SUM(CASE WHEN lead_captured=1 THEN 1 ELSE 0 END) as total_leads FROM assistant_conversations") as any;
  const daily = dbAll(
    `SELECT DATE(created_at) as day, COUNT(*) as conversations, SUM(total_tokens) as tokens, SUM(CASE WHEN lead_captured=1 THEN 1 ELSE 0 END) as leads
     FROM assistant_conversations WHERE created_at >= DATE('now', '-30 days') GROUP BY DATE(created_at) ORDER BY day DESC`
  ) || [];
  res.json({ success: true, data: { total: total || {}, daily } });
});

// ====== 工具函数 ======

function extractLeadInfo(userMsg: string, aiReply: string) {
  const phone = userMsg.match(/1[3-9]\d{9}/)?.[0] || "";
  const email = userMsg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || "";

  if (!phone && !email) return null;

  // 尝试提取姓名（中文2-4字）
  const nameMatch = userMsg.match(/(?:我是|我叫|姓名[：:]\s*)([\u4e00-\u9fa5]{2,4})/);
  const name = nameMatch?.[1] || "";

  // 尝试提取公司
  const companyMatch = userMsg.match(/(?:公司[：:]\s*|在\s*)([\u4e00-\u9fa5a-zA-Z]+(?:公司|科技|集团|有限|技术|网络))/);
  const company = companyMatch?.[1] || "";

  return { phone, email, name, company, source: "chat_auto_extract", interest: "" };
}

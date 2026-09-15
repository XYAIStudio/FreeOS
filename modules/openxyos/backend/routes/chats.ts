import { Router } from "express";
import { dbAll, dbGet, dbRun } from "../db";
import { authenticate, AuthRequest } from "../middleware";
import { getSingleEmployeeResponse, runGroupConversation, generateMeetingMinutes, isCasualChat, getCasualChatResponse } from "../services/ai";
import { broadcastToChat } from "../services/websocket";
import { logActivity, notifyChatMention } from "../services/notification";
import { saveShortMemory } from "../services/memory";
import { AuditTrailEngine } from "../services/audit-trail";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import PDFDocument from "pdfkit";
import { localizedError } from "../utils/locale";

export const chatRoutes = Router();

const chatError = (req: AuthRequest, zh: string, en: string) => localizedError(req, zh, en);

function cleanMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "").trim();
}

function parseTextRuns(text: string, fontSize: number = 22): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: fontSize }));
    }
    runs.push(new TextRun({ text: match[1], bold: true, size: fontSize }));
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size: fontSize }));
  }
  return runs.length > 0 ? runs : [new TextRun({ text: cleanMarkdown(text), size: fontSize })];
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line.split("|").filter(cell => cell.trim() !== "").map(cell => cell.trim());
}

type ChatAccess = Record<string, any> & { member_role: string };

function getChatAccess(req: AuthRequest, rawChatId: unknown): ChatAccess | null {
  const chatId = Number(rawChatId);
  if (!Number.isSafeInteger(chatId) || chatId <= 0) return null;
  return dbGet(
    `SELECT c.*, cm.role AS member_role
     FROM chats c
     INNER JOIN chat_members cm ON cm.chat_id = c.id AND cm.tenant_id = c.tenant_id
     WHERE c.id = ? AND c.tenant_id = ? AND cm.user_id = ?`,
    [chatId, req.user!.tenant_id, req.user!.id]
  ) as ChatAccess | null;
}

function requireChatMember(req: AuthRequest, res: any, rawChatId: unknown): ChatAccess | null {
  const chat = getChatAccess(req, rawChatId);
  if (!chat) {
    res.status(404).json({ success: false, error: chatError(req, "聊天不存在或无访问权限", "Chat not found or access is denied") });
    return null;
  }
  return chat;
}

function requireChatManager(req: AuthRequest, res: any, rawChatId: unknown): ChatAccess | null {
  const chat = requireChatMember(req, res, rawChatId);
  if (!chat) return null;
  if (!['admin', 'owner'].includes(chat.member_role)) {
    res.status(403).json({ success: false, error: chatError(req, "需要群管理权限", "Group management permission is required") });
    return null;
  }
  return chat;
}

chatRoutes.use(authenticate);

chatRoutes.get("/", (req: AuthRequest, res) => {
  try {
    const chats = dbAll(
      `SELECT c.*,
        (SELECT content FROM messages WHERE chat_id = c.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT sender_name FROM messages WHERE chat_id = c.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_sender,
        (SELECT created_at FROM messages WHERE chat_id = c.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) as member_count,
        (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL AND m.id > COALESCE((SELECT last_read_message_id FROM chat_read_markers WHERE chat_id = c.id AND user_id = ?), 0)) as unread_count
       FROM chats c
       INNER JOIN chat_members self_member ON self_member.chat_id = c.id
         AND self_member.tenant_id = c.tenant_id AND self_member.user_id = ?
       WHERE c.tenant_id = ? ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC`,
      [req.user!.id, req.user!.id, req.user!.tenant_id]
    );
    res.json({ success: true, data: chats });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.post("/", (req: AuthRequest, res) => {
  try {
    const { title, type, employee_ids } = req.body;
    if (!title) return res.status(400).json({ success: false, error: chatError(req, "标题必填", "Title is required") });
    const chatType = type || "group";
    const employeeIds = Array.isArray(employee_ids)
      ? [...new Set(employee_ids.map((id: unknown) => Number(id)).filter(id => Number.isSafeInteger(id) && id > 0))]
      : [];
    if (Array.isArray(employee_ids) && employeeIds.length !== employee_ids.length) {
      return res.status(400).json({ success: false, error: chatError(req, "AI员工编号无效", "Invalid AI employee ID") });
    }
    if (employeeIds.length) {
      const placeholders = employeeIds.map(() => "?").join(",");
      const existingEmployees = dbAll(
        `SELECT id FROM employees WHERE tenant_id = ? AND employee_type = 'ai' AND status = 'active' AND id IN (${placeholders})`,
        [req.user!.tenant_id, ...employeeIds]
      ) as Array<{ id: number }>;
      if (existingEmployees.length !== employeeIds.length) {
        return res.status(400).json({ success: false, error: chatError(req, "存在无效、停用或非本集团的AI员工", "An AI employee is invalid, inactive, or outside the current group") });
      }
    }
    const result = dbRun(
      "INSERT INTO chats (company_id, title, type, created_by, tenant_id) VALUES (?, ?, ?, ?, ?)",
      [1, title, chatType, req.user!.id, req.user!.tenant_id]
    );
    const chatId = result.lastInsertRowid;
    dbRun("INSERT INTO chat_members (chat_id, user_id, role, tenant_id, joined_at) VALUES (?, ?, 'admin', ?, datetime('now'))", [chatId, req.user!.id, req.user!.tenant_id]);
    if (employeeIds.length) {
      for (const eid of employeeIds) {
        dbRun("INSERT INTO chat_members (chat_id, employee_id, role, tenant_id, joined_at) VALUES (?, ?, 'member', ?, datetime('now'))", [chatId, eid, req.user!.tenant_id]);
      }
    }
    res.json({ success: true, data: { id: chatId } });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.get("/:id", (req: AuthRequest, res) => {
  try {
    const chat = requireChatMember(req, res, req.params.id);
    if (!chat) return;
    res.json({ success: true, data: chat });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.put("/:id", (req: AuthRequest, res) => {
  try {
    if (!requireChatManager(req, res, req.params.id)) return;
    const { title } = req.body;
    if (!title) return res.status(400).json({ success: false, error: chatError(req, "标题必填", "Title is required") });
    dbRun("UPDATE chats SET title = ? WHERE id = ? AND tenant_id = ?", [title, req.params.id, req.user!.tenant_id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.delete("/:id", (req: AuthRequest, res) => {
  try {
    const chat = requireChatManager(req, res, req.params.id);
    if (!chat) return;
    dbRun("DELETE FROM messages WHERE chat_id = ? AND tenant_id = ?", [chat.id, req.user!.tenant_id]);
    dbRun("DELETE FROM chat_members WHERE chat_id = ? AND tenant_id = ?", [chat.id, req.user!.tenant_id]);
    dbRun("DELETE FROM chats WHERE id = ? AND tenant_id = ?", [chat.id, req.user!.tenant_id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.get("/:id/messages", (req: AuthRequest, res) => {
  try {
    const chat = requireChatMember(req, res, req.params.id);
    if (!chat) return;
    const limit = parseInt(req.query.limit as string) || 100;
    const messages = dbAll(
      "SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT ?",
      [chat.id, req.user!.tenant_id, limit]
    );
    const enrichedMessages = (messages as any[]).map(msg => {
      const reactions = dbAll(
        "SELECT mr.emoji, COUNT(*) as count, GROUP_CONCAT(u.nickname) as users FROM message_reactions mr LEFT JOIN users u ON mr.user_id = u.id AND u.tenant_id = mr.tenant_id WHERE mr.message_id = ? AND mr.tenant_id = ? GROUP BY mr.emoji",
        [msg.id, req.user!.tenant_id]
      );
      let reply_to: any = null;
      if (msg.reply_to_id) {
        const replied = dbGet("SELECT sender_name, content FROM messages WHERE id = ? AND chat_id = ? AND tenant_id = ?", [msg.reply_to_id, chat.id, req.user!.tenant_id]) as any;
        if (replied) reply_to = { sender_name: replied.sender_name, content: replied.content };
      }
      return { ...msg, reactions, reply_to };
    });
    res.json({ success: true, data: { chat, messages: enrichedMessages } });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

// 判断用户是否在确认（结束讨论）
function isUserConfirming(content: string): boolean {
  const confirmWords = ["确认", "没问题", "可以", "同意", "通过", "ok", "OK", "好的", "就这样", "定稿", "结束"];
  const c = content.trim().toLowerCase();
  return confirmWords.some(w => c.includes(w) || c === w);
}

chatRoutes.post("/:id/messages", async (req: AuthRequest, res) => {
  try {
    const { content, reply_to_id } = req.body;
    if (!content) return res.status(400).json({ success: false, error: chatError(req, "内容必填", "Content is required") });

    const chat = requireChatMember(req, res, req.params.id);
    if (!chat) return;
    const chatId = chat.id;

    // 保存用户消息
    const userMsgResult = dbRun(
      "INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, reply_to_id, tenant_id) VALUES (?, ?, 'user', ?, ?, ?, ?)",
      [chatId, req.user!.id, req.user!.nickname, content, reply_to_id || null, req.user!.tenant_id]
    );

    // 查询被引用消息用于广播
    let replyToData: any = null;
    if (reply_to_id) {
      const repliedMsg = dbGet("SELECT id, sender_name, content FROM messages WHERE id = ? AND chat_id = ? AND tenant_id = ?", [reply_to_id, chatId, req.user!.tenant_id]) as any;
      if (repliedMsg) {
        replyToData = { sender_name: repliedMsg.sender_name, content: repliedMsg.content };
      }
    }

    // V0.50：群聊内容仅属于沙箱对话，不能自动发布至正式知识中心。

    logActivity({ userId: req.user!.id, action: "message_sent", entityType: "chat", entityId: chatId, tenantId: req.user!.tenant_id });

    // 审计归档：记录用户消息
    AuditTrailEngine.archiveMessage({
      tenantId: req.user!.tenant_id,
      chatId: chatId,
      messageId: userMsgResult.lastInsertRowid,
      senderType: 'user',
      senderId: req.user!.id,
      senderName: req.user!.nickname,
      content: content,
      messageType: 'text',
      createdAt: new Date().toISOString()
    });

    broadcastToChat(chatId, {
      type: "new_message",
      chatId,
      message: { id: userMsgResult.lastInsertRowid, sender_type: "user", sender_name: req.user!.nickname, content, reply_to_id: reply_to_id || null, reply_to: replyToData, created_at: new Date().toISOString() },
    }, req.user!.id);

    // ========== ZCode式实时思考进度追踪：用户消息一旦入库立即开启 ==========
    const sendStart = Date.now();
    let aiProgressSeq = 0; // 步骤序号，前端用于稳定追踪
    const pushProgress = (phase: string, detail: string, stepKey?: string, agentResult?: any) => {
      aiProgressSeq++;
      const dbRun2 = dbRun;
      try {
        const ins = dbRun2(
          "INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, NULL, 'system', ?, ?, 'ai_progress', ?)",
          [chatId, "AI进度", detail, req.user!.tenant_id]
        );
        broadcastToChat(chatId, {
          type: "new_message",
          chatId,
          message: {
            id: ins.lastInsertRowid,
            sender_type: "system",
            sender_name: "AI进度",
            content: detail,
            message_type: "ai_progress",
            phase,
            step_key: stepKey || (phase + "_" + aiProgressSeq),
            step_seq: aiProgressSeq,
            elapsed_ms: Date.now() - sendStart,
            agent_result: agentResult || null,
            created_at: new Date().toISOString()
          },
        });
      } catch(e) {
        console.error("[AI进度] 广播失败:", e);
      }
    };

    // 立即广播起始步骤（先于任何判断分支，确保用户一按下发送就能看见进度）
    pushProgress("receiving", "📡 已接收消息，正在识别协作团队...", "receiving");

    // 获取聊天成员中的AI员工
    const chatEmployees = dbAll(
      `SELECT e.* FROM employees e INNER JOIN chat_members cm ON cm.employee_id = e.id AND cm.tenant_id = e.tenant_id WHERE cm.chat_id = ? AND cm.tenant_id = ? AND e.employee_type = 'ai' AND e.status = 'active'`,
      [chatId, req.user!.tenant_id]
    ) as any[];

    if (chatEmployees.length === 0) {
      pushProgress("empty", "⚠️ 当前群聊尚未添加AI协作成员", "empty");
      const allMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at ASC", [chatId, req.user!.tenant_id]);
      return res.json({ success: true, data: allMessages });
    }

    pushProgress("team_identified", `👥 已识别协作团队：${chatEmployees.map((e:any)=>e.name).join("、")}（${chatEmployees.length}位成员）`, "team_identified");

    // V4: 检测 @提及，如果 @了特定员工，仅该员工回复
    const mentionMatch = content.match(/@(\S+)/);
    let mentionedEmployee: any = null;
    if (mentionMatch && chat.type === "group") {
      const mentionedName = mentionMatch[1];
      mentionedEmployee = chatEmployees.find((e: any) => 
        e.name === mentionedName || e.name.includes(mentionedName)
      );
      if (mentionedEmployee) {
        console.log(`[Chat] @${mentionedName} → ${mentionedEmployee.name}`);
      }
    }

    // V4: @提及模式 — 仅被@的员工回复
    if (mentionedEmployee) {
      pushProgress("mention_start", `🎯 检测到 @${mentionedEmployee.name}(${mentionedEmployee.role})，将直接由该员工回复`, "mention_start");
      const historyRows = dbAll("SELECT content, sender_type FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 10", [chatId, req.user!.tenant_id]) as any[];
      const chatHistory = historyRows.reverse().map(m => ({ role: m.sender_type === "user" ? "user" as const : "assistant" as const, content: m.content }));
      pushProgress("mention_reasoning", `💭 ${mentionedEmployee.name} 正在分析回复...`, "mention_reasoning");
      const reply = await getSingleEmployeeResponse(mentionedEmployee, content, chatHistory);
      const insertResult = dbRun("INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, ?, 'employee', ?, ?, 'ai_mention', ?)", [chatId, mentionedEmployee.id, `${mentionedEmployee.name} · ${mentionedEmployee.role}`, reply, req.user!.tenant_id]);
      
      broadcastToChat(chatId, {
        type: "new_message", chatId,
        message: { id: insertResult.lastInsertRowid, sender_type: "employee", sender_name: `${mentionedEmployee.name} · ${mentionedEmployee.role}`, content: reply, message_type: "ai_mention", created_at: new Date().toISOString() },
      });
      pushProgress("mention_done", `✓ ${mentionedEmployee.name} 已回复（${reply.length}字，总用时 ${Math.round((Date.now()-sendStart)/1000)}秒）`, "mention_done");

      // 如果被@的员工有关联人类用户，发送通知
      const linkedUser = dbGet("SELECT user_id FROM chat_members WHERE chat_id = ? AND employee_id = ? AND user_id IS NOT NULL", [chatId, mentionedEmployee.id]) as any;
      if (linkedUser) {
        notifyChatMention(chatId, chat.title, linkedUser.user_id, req.user!.nickname);
      }
      
      const allMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at ASC", [chatId, req.user!.tenant_id]);
      return res.json({ success: true, data: allMessages, mentioned: mentionedEmployee.name });
    }

    // 单聊模式
    if (chat.type === "single" || chatEmployees.length === 1) {
      const employee = chatEmployees[0];
      pushProgress("single_start", `💬 单聊模式：${employee.name}(${employee.role}) 正在独立分析...`, "single_start");
      const historyRows = dbAll("SELECT content, sender_type FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 10", [chatId, req.user!.tenant_id]) as any[];
      const chatHistory = historyRows.reverse().map(m => ({ role: m.sender_type === "user" ? "user" as const : "assistant" as const, content: m.content }));
      const reply = await getSingleEmployeeResponse(employee, content, chatHistory);
      const insertResult = dbRun("INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, ?, 'employee', ?, ?, 'ai', ?)", [chatId, employee.id, `${employee.name} · ${employee.role}`, reply, req.user!.tenant_id]);
      
      // 自动保存到AI员工记忆
      if (reply.length > 10) {
        saveShortMemory(employee.id, 'conversation', reply, undefined, { chat_id: chatId, message_id: insertResult.lastInsertRowid }, req.user!.tenant_id);
      }
      
      broadcastToChat(chatId, { type: "new_message", chatId, message: { id: insertResult.lastInsertRowid, sender_type: "employee", sender_name: `${employee.name} · ${employee.role}`, content: reply, message_type: "ai", created_at: new Date().toISOString() } });
      pushProgress("single_done", `✓ ${employee.name} 已回复（${reply.length}字，总用时 ${Math.round((Date.now()-sendStart)/1000)}秒）`, "single_done");
      
      // 审计归档：记录AI回复
      AuditTrailEngine.archiveMessage({
        tenantId: req.user!.tenant_id,
        chatId: chatId,
        messageId: insertResult.lastInsertRowid,
        senderType: 'employee',
        senderId: employee.id,
        senderName: `${employee.name} · ${employee.role}`,
        content: reply,
        messageType: 'ai',
        createdAt: new Date().toISOString()
      });
      
      const allMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at ASC", [chatId, req.user!.tenant_id]);
      return res.json({ success: true, data: allMessages });
    }

    // 群聊模式
    const recentMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 30", [chatId, req.user!.tenant_id]) as any[];

    // 检查是否是确认（结束讨论，生成会议纪要）
    const lastAiSummary = [...recentMessages].reverse().find(m => m.message_type === "ai_summary");
    if (lastAiSummary && isUserConfirming(content)) {
      // 获取讨论主题（第一条用户消息）
      const firstUserMsg = [...recentMessages].reverse().find(m => m.sender_type === "user");
      const topic = firstUserMsg?.content?.substring(0, 30) || "讨论";
      
      // 生成会议纪要
      const minutes = await generateMeetingMinutes(content, chatEmployees, { steps: [], summary: lastAiSummary.content });
      
      // 保存会议纪要到聊天
      const insertResult = dbRun("INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, NULL, 'system', '系统', ?, 'meeting_minutes', ?)", [chatId, minutes, req.user!.tenant_id]);
      broadcastToChat(chatId, { type: "new_message", chatId, message: { id: insertResult.lastInsertRowid, sender_type: "system", sender_name: "系统", content: minutes, message_type: "meeting_minutes", created_at: new Date().toISOString() } });

      // 自动保存到知识库 - 会议纪要文件夹
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const minutesTitle = `会议纪要_${dateStr}_${topic}`;
      dbRun(
        "INSERT INTO knowledge_notes (title, content, tags, source, tenant_id) VALUES (?, ?, ?, ?, ?)",
        [minutesTitle, minutes, "会议纪要,自动生成", `群聊:${chat.title}`, req.user!.tenant_id]
      );

      const allMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at ASC", [chatId, req.user!.tenant_id]);
      return res.json({ success: true, data: allMessages, minutesGenerated: true });
    }

    // 获取历史上下文（更多历史记录，包含讨论上下文）
    const historyRows = dbAll("SELECT content, sender_type, sender_name, message_type FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 30", [chatId, req.user!.tenant_id]) as any[];
    const chatHistory = historyRows.reverse().map(m => ({
      role: m.sender_type === "user" ? "user" as const : "assistant" as const,
      content: m.message_type === "ai_summary" ? `[总结] ${m.content}` : m.content,
    }));

    // 检测是否为闲聊
    if (isCasualChat(content)) {
      pushProgress("casual_start", `💬 检测为闲聊消息，AI员工自由互动中...`, "casual_start");
      const casualResponses = await getCasualChatResponse(chatEmployees, content, chatHistory);
      
      for (const resp of casualResponses) {
        const insertResult = dbRun(
          "INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, ?, 'employee', ?, ?, 'ai', ?)",
          [chatId, resp.employee.id, `${resp.employee.name} · ${resp.employee.role}`, resp.content, req.user!.tenant_id]
        );
        
        broadcastToChat(chatId, {
          type: "new_message",
          chatId,
          message: { id: insertResult.lastInsertRowid, sender_type: "employee", sender_name: `${resp.employee.name} · ${resp.employee.role}`, content: resp.content, message_type: "ai", created_at: new Date().toISOString() },
        });
      }
      pushProgress("casual_done", `✓ 闲聊互动完成（总用时 ${Math.round((Date.now()-sendStart)/1000)}秒）`, "casual_done");
      
      const allMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at ASC", [chatId, req.user!.tenant_id]);
      return res.json({ success: true, data: allMessages });
    }

    // 公共版群聊：每位参与智能助手独立提供建议，不执行专有治理或自动决策。
    let result: any;
    const progressCb = (phase: string, detail: string, stepKey?: string, agentResult?: any) => {
      pushProgress(phase, detail, stepKey);
    };
    pushProgress("group_start", "🤝 正在征询群内智能助手的独立建议…", "group_start");
    result = await runGroupConversation(content, chatEmployees, chatHistory, progressCb);
    pushProgress("group_done", `✨ 协作完成（总用时 ${Math.round((Date.now() - sendStart)/1000)} 秒）`, "group_done");

    // 依次保存每个步骤的消息
    for (const step of result.steps) {
      const msgContent = step.content;
      const msgType = "ai_reply";

      if (!msgContent) continue;

      const insertResult = dbRun(
        "INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, ?, 'employee', ?, ?, ?, ?)",
        [chatId, chatEmployees[0]?.id || null, `${step.employee_name} · ${step.employee_role}`, msgContent, msgType, req.user!.tenant_id]
      );

      // 自动保存到AI员工记忆
      const stepEmployee = chatEmployees.find(e => e.name === step.employee_name);
      if (stepEmployee && msgContent.length > 10) {
        saveShortMemory(
          stepEmployee.id,
          "conversation",
          msgContent,
          undefined,
          { chat_id: chatId, message_id: insertResult.lastInsertRowid },
          req.user!.tenant_id
        );
      }

      broadcastToChat(chatId, {
        type: "new_message",
        chatId,
        message: { id: insertResult.lastInsertRowid, sender_type: "employee", sender_name: `${step.employee_name} · ${step.employee_role}`, content: msgContent, message_type: msgType, created_at: new Date().toISOString() },
      });
      
      // 审计归档：记录群聊AI消息
      AuditTrailEngine.archiveMessage({
        tenantId: req.user!.tenant_id,
        chatId: chatId,
        messageId: insertResult.lastInsertRowid,
        senderType: 'employee',
        senderId: stepEmployee?.id || 0,
        senderName: `${step.employee_name} · ${step.employee_role}`,
        content: msgContent,
        messageType: msgType,
        createdAt: new Date().toISOString()
      });
    }

    const allMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at ASC", [chatId, req.user!.tenant_id]);
    res.json({ success: true, data: allMessages });
  } catch (err: any) {
    console.error("[Chat] 发送消息失败:", err);
    res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") });
  }
});

// 生成会议纪要
chatRoutes.post("/:id/minutes", async (req: AuthRequest, res) => {
  try {
    const chat = requireChatMember(req, res, req.params.id);
    if (!chat) return;
    const chatId = chat.id;
    const chatEmployees = dbAll(
      `SELECT e.* FROM employees e INNER JOIN chat_members cm ON cm.employee_id = e.id AND cm.tenant_id = e.tenant_id WHERE cm.chat_id = ? AND cm.tenant_id = ? AND e.employee_type = 'ai' AND e.status = 'active'`,
      [chatId, req.user!.tenant_id]
    ) as any[];

    const recentMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 30", [chatId, req.user!.tenant_id]) as any[];
    const lastUserMsg = [...recentMessages].reverse().find(m => m.sender_type === "user");
    const lastSummary = [...recentMessages].reverse().find(m => m.message_type === "ai_summary");

    const steps = recentMessages.reverse().filter(m => m.sender_type === "employee").map(m => ({
      employee_name: m.sender_name?.split(" · ")[0] || "未知",
      employee_role: m.sender_name?.split(" · ")[1] || "",
      agent_type: "",
      content: m.content,
    }));

    const minutes = await generateMeetingMinutes(lastUserMsg?.content || "讨论", chatEmployees, { steps, summary: lastSummary?.content || "" });
    const insertResult = dbRun("INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, NULL, 'system', '系统', ?, 'meeting_minutes', ?)", [chatId, minutes, req.user!.tenant_id]);
    broadcastToChat(chatId, { type: "new_message", chatId, message: { id: insertResult.lastInsertRowid, sender_type: "system", sender_name: "系统", content: minutes, message_type: "meeting_minutes", created_at: new Date().toISOString() } });

    // 会议纪要仅保留在当前群聊沙箱；是否进入正式知识中心必须走后续人工审核流程。

    res.json({ success: true, data: { minutes, messageId: insertResult.lastInsertRowid } });
  } catch (err: any) {
    console.error("[Chat] 生成会议纪要失败:", err);
    res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") });
  }
});

chatRoutes.get("/:id/members", (req: AuthRequest, res) => {
  try {
    const chat = requireChatMember(req, res, req.params.id);
    if (!chat) return;
    const members = dbAll(
      `SELECT cm.*, CASE WHEN cm.user_id IS NOT NULL THEN (SELECT nickname FROM users WHERE id = cm.user_id AND tenant_id = cm.tenant_id) ELSE NULL END as user_name, CASE WHEN cm.employee_id IS NOT NULL THEN (SELECT name FROM employees WHERE id = cm.employee_id AND tenant_id = cm.tenant_id) ELSE NULL END as employee_name, CASE WHEN cm.employee_id IS NOT NULL THEN (SELECT avatar_emoji FROM employees WHERE id = cm.employee_id AND tenant_id = cm.tenant_id) ELSE NULL END as avatar_emoji, CASE WHEN cm.employee_id IS NOT NULL THEN (SELECT role FROM employees WHERE id = cm.employee_id AND tenant_id = cm.tenant_id) ELSE NULL END as employee_role, CASE WHEN cm.employee_id IS NOT NULL THEN (SELECT agent_type FROM employees WHERE id = cm.employee_id AND tenant_id = cm.tenant_id) ELSE NULL END as agent_type FROM chat_members cm WHERE cm.chat_id = ? AND cm.tenant_id = ?`,
      [chat.id, req.user!.tenant_id]
    );
    res.json({ success: true, data: members });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.post("/:id/members", (req: AuthRequest, res) => {
  try {
    const chat = requireChatManager(req, res, req.params.id);
    if (!chat) return;
    const { user_id, employee_id, role } = req.body;
    if (!user_id && !employee_id) return res.status(400).json({ success: false, error: chatError(req, "用户或员工ID必填", "A user or employee ID is required") });
    if (user_id && employee_id) return res.status(400).json({ success: false, error: chatError(req, "一次只能添加一个内部人类用户或一个AI员工", "Add either one internal human user or one AI employee at a time") });
    if (role && !["admin", "member"].includes(role)) return res.status(400).json({ success: false, error: chatError(req, "角色必须是 admin 或 member", "Role must be admin or member") });
    if (user_id && !dbGet("SELECT 1 FROM users WHERE id = ? AND tenant_id = ?", [user_id, req.user!.tenant_id])) return res.status(404).json({ success: false, error: chatError(req, "内部用户不存在", "Internal user not found") });
    if (employee_id && !dbGet("SELECT 1 FROM employees WHERE id = ? AND tenant_id = ? AND employee_type = 'ai' AND status = 'active'", [employee_id, req.user!.tenant_id])) return res.status(404).json({ success: false, error: chatError(req, "内部AI员工不存在或未启用", "Internal AI employee not found or inactive") });
    const existing = user_id
      ? dbGet("SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ? AND tenant_id = ?", [chat.id, user_id, req.user!.tenant_id])
      : dbGet("SELECT id FROM chat_members WHERE chat_id = ? AND employee_id = ? AND tenant_id = ?", [chat.id, employee_id, req.user!.tenant_id]);
    if (existing) return res.status(409).json({ success: false, error: chatError(req, "成员已在群内", "Member is already in the group") });
    dbRun("INSERT INTO chat_members (chat_id, user_id, employee_id, role, tenant_id, joined_at) VALUES (?, ?, ?, ?, ?, datetime('now'))", [chat.id, user_id || null, employee_id || null, role || "member", req.user!.tenant_id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.delete("/:id/members/:memberId", (req: AuthRequest, res) => {
  try {
    const chat = requireChatManager(req, res, req.params.id);
    if (!chat) return;
    dbRun("DELETE FROM chat_members WHERE id = ? AND chat_id = ? AND tenant_id = ?", [req.params.memberId, chat.id, req.user!.tenant_id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.post("/:id/messages/:messageId/reactions", (req: AuthRequest, res) => {
  try {
    const chat = requireChatMember(req, res, req.params.id);
    if (!chat) return;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, error: chatError(req, "表情必填", "Reaction emoji is required") });
    const message = dbGet("SELECT id FROM messages WHERE id = ? AND chat_id = ? AND tenant_id = ?", [req.params.messageId, chat.id, req.user!.tenant_id]);
    if (!message) return res.status(404).json({ success: false, error: chatError(req, "消息不存在", "Message not found") });
    const existing = dbGet("SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ? AND tenant_id = ?", [req.params.messageId, req.user!.id, emoji, req.user!.tenant_id]);
    if (existing) { dbRun("DELETE FROM message_reactions WHERE id = ? AND tenant_id = ?", [(existing as any).id, req.user!.tenant_id]); }
    else { dbRun("INSERT INTO message_reactions (message_id, user_id, emoji, tenant_id) VALUES (?, ?, ?, ?)", [req.params.messageId, req.user!.id, emoji, req.user!.tenant_id]); }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.put("/:id/messages/:messageId", (req: AuthRequest, res) => {
  try {
    const chat = requireChatMember(req, res, req.params.id);
    if (!chat) return;
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, error: chatError(req, "内容必填", "Content is required") });
    const msg = dbGet("SELECT * FROM messages WHERE id = ? AND chat_id = ? AND tenant_id = ?", [req.params.messageId, chat.id, req.user!.tenant_id]) as any;
    if (!msg) return res.status(404).json({ success: false, error: chatError(req, "消息不存在", "Message not found") });
    if (msg.sender_type !== "user" || (msg.sender_id !== req.user!.id && !['admin', 'owner'].includes(chat.member_role))) return res.status(403).json({ success: false, error: chatError(req, "无权编辑此消息", "You are not allowed to edit this message") });
    dbRun("UPDATE messages SET content = ? WHERE id = ? AND chat_id = ? AND tenant_id = ?", [content, msg.id, chat.id, req.user!.tenant_id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.post("/:id/messages/:messageId/import-knowledge", (req: AuthRequest, res) => {
  try {
    const chatAccess = requireChatManager(req, res, req.params.id);
    if (!chatAccess) return;
    // 正式知识中心尚未具备 V0.80 所需的定密、审核、版本和撤销机制，
    // 因此 V0.50 不允许把群聊材料直接写入可检索知识库。
    res.status(409).json({ success: false, error: chatError(req, "群聊材料需在 V0.80 知识审核流程上线后方可发布", "Group chat material can be published after the V0.80 knowledge review flow is available") });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

chatRoutes.get("/:id/messages/:messageId/export", (req: AuthRequest, res) => {
  try {
    const chat = requireChatMember(req, res, req.params.id);
    if (!chat) return;
    const format = (req.query.format as string) || "md";
    const msg = dbGet("SELECT * FROM messages WHERE id = ? AND chat_id = ? AND tenant_id = ?", [req.params.messageId, chat.id, req.user!.tenant_id]) as any;
    if (!msg) return res.status(404).json({ success: false, error: chatError(req, "消息不存在", "Message not found") });
    const filename = `会议纪要_${new Date().toISOString().slice(0, 10)}_${chat?.title || "讨论"}`;

    if (format === "md") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}.md"`);
      res.send(msg.content);
    } else if (format === "docx") {
      const lines = msg.content.split("\n");
      const children: Paragraph[] = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith("# ")) {
          children.push(new Paragraph({ children: parseTextRuns(line.replace("# ", ""), 32), heading: HeadingLevel.HEADING_1 }));
        } else if (line.startsWith("## ")) {
          children.push(new Paragraph({ children: parseTextRuns(line.replace("## ", ""), 28), heading: HeadingLevel.HEADING_2 }));
        } else if (line.startsWith("### ")) {
          children.push(new Paragraph({ children: parseTextRuns(line.replace("### ", ""), 24), heading: HeadingLevel.HEADING_3 }));
        } else if (line.startsWith("---")) {
          children.push(new Paragraph({ children: [new TextRun({ text: "────────────────────────────────" })], alignment: AlignmentType.CENTER }));
        } else if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
          const headerCells = parseTableRow(line);
          i += 2;
          const dataRows: string[][] = [];
          while (i < lines.length && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
            dataRows.push(parseTableRow(lines[i]));
            i++;
          }
          i--;
          const tableRows = [
            new TableRow({ children: headerCells.map(cell => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cleanMarkdown(cell), bold: true, size: 20 })] })], width: { size: Math.floor(9000 / headerCells.length), type: WidthType.DXA } })), tableHeader: true }),
            ...dataRows.map(row => new TableRow({ children: row.map((cell, idx) => new TableCell({ children: [new Paragraph({ children: parseTextRuns(cell, 20) })], width: { size: Math.floor(9000 / (headerCells.length || 1)), type: WidthType.DXA } })) }))
          ];
          children.push(new Table({ rows: tableRows, width: { size: 9000, type: WidthType.DXA } }) as any);
        } else if (line.trim() === "") {
          children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
        } else {
          children.push(new Paragraph({ children: parseTextRuns(line, 22) }));
        }
        i++;
      }
      const doc = new Document({ sections: [{ children }] });
      Packer.toBuffer(doc).then(buffer => {
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}.docx"`);
        res.send(Buffer.from(buffer));
      });
    } else if (format === "pdf") {
      generatePdf(msg.content, filename, res);
    } else {
      res.status(400).json({ success: false, error: chatError(req, "不支持的格式", "Unsupported format") });
    }
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

function generatePdf(content: string, filename: string, res: any) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}.pdf"`);
  
  const fontPath = "C:\\Windows\\Fonts\\simhei.ttf";
  const pdf = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  pdf.pipe(res);
  pdf.registerFont("Chinese", fontPath);
  
  const pageWidth = pdf.page.width - 100;
  const lines = content.split("\n");
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    if (pdf.y > pdf.page.height - 80) {
      pdf.addPage();
    }
    
    if (line.startsWith("# ")) {
      pdf.moveDown(0.5);
      pdf.fontSize(20).font("Chinese").text(cleanMarkdown(line.replace("# ", "")), 50, pdf.y, { align: "left", width: pageWidth });
      pdf.moveDown(0.3);
    } else if (line.startsWith("## ")) {
      pdf.moveDown(0.4);
      pdf.fontSize(16).font("Chinese").text(cleanMarkdown(line.replace("## ", "")), 50, pdf.y, { align: "left", width: pageWidth });
      pdf.moveDown(0.2);
    } else if (line.startsWith("### ")) {
      pdf.moveDown(0.3);
      pdf.fontSize(14).font("Chinese").text(cleanMarkdown(line.replace("### ", "")), 50, pdf.y, { align: "left", width: pageWidth });
      pdf.moveDown(0.2);
    } else if (line.startsWith("#### ")) {
      pdf.moveDown(0.2);
      pdf.fontSize(12).font("Chinese").text(cleanMarkdown(line.replace("#### ", "")), 50, pdf.y, { align: "left", width: pageWidth });
      pdf.moveDown(0.1);
    } else if (line.startsWith("---")) {
      pdf.moveDown(0.5);
      const y = pdf.y;
      pdf.moveTo(50, y).lineTo(pdf.page.width - 50, y).lineWidth(0.5).stroke();
      pdf.moveDown(0.5);
    } else if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      i = renderPdfTable(pdf, lines, i, pageWidth);
      pdf.moveDown(0.5);
    } else if (line.trim() === "") {
      pdf.moveDown(0.3);
    } else if (line.match(/^\s*[\*\-]\s/) || line.match(/^\s*\d+\.\s/)) {
      const bulletLine = line.replace(/^\s*[\*\-]\s/, "  • ").replace(/^\s*\d+\.\s/, (m) => "  " + m.trim() + " ");
      pdf.fontSize(11).font("Chinese").text(cleanMarkdown(bulletLine), 50, pdf.y, { align: "left", width: pageWidth, lineGap: 3 });
    } else {
      pdf.fontSize(11).font("Chinese").text(cleanMarkdown(line), 50, pdf.y, { align: "left", width: pageWidth, lineGap: 3 });
    }
    
    i++;
  }
  
  pdf.end();
}

function renderPdfTable(pdf: any, lines: string[], startIndex: number, pageWidth: number): number {
  const headerLine = lines[startIndex];
  const headerCells = parseTableRow(headerLine);
  const colCount = headerCells.length;
  const cellPadding = 4;
  const cellFontSize = 9;
  
  const dataRows: string[][] = [];
  let i = startIndex + 2;
  while (i < lines.length && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
    dataRows.push(parseTableRow(lines[i]));
    i++;
  }
  
  const getColWidths = (): number[] => {
    if (colCount <= 2) return Array(colCount).fill(pageWidth / colCount);
    
    const headerLower = headerCells.map(h => cleanMarkdown(h).toLowerCase());
    
    const weights = headerCells.map((h, idx) => {
      const text = headerLower[idx];
      if (text.includes('序') || text.includes('编号') || text === '#' || text === 'no' || text === 'id') return 0.5;
      if (text.includes('任务') || text.includes('内容') || text.includes('事项') || text.includes('工作')) return 2.5;
      if (text.includes('责任') || text.includes('负责人') || text.includes('人员')) return 1.2;
      if (text.includes('日期') || text.includes('时间') || text.includes('截止')) return 1.2;
      if (text.includes('交付') || text.includes('产出') || text.includes('备注') || text.includes('说明')) return 1.8;
      return 1.0;
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => (w / totalWeight) * pageWidth);
  };
  
  const colWidths = getColWidths();
  
  const drawTableRow = (cells: string[], isHeader: boolean) => {
    if (pdf.y + 30 > pdf.page.height - 60) {
      pdf.addPage();
    }
    
    const startY = pdf.y;
    let maxCellHeight = 0;
    
    const cellTexts = cells.map(cell => cleanMarkdown(cell));
    
    cellTexts.forEach((text, idx) => {
      pdf.fontSize(cellFontSize).font("Chinese");
      const textHeight = pdf.heightOfString(text, { width: colWidths[idx] - cellPadding * 2 });
      maxCellHeight = Math.max(maxCellHeight, textHeight + cellPadding * 2);
    });
    maxCellHeight = Math.max(maxCellHeight, 20);
    
    let xPos = 50;
    pdf.rect(50, startY, pageWidth, maxCellHeight).lineWidth(0.3).stroke();
    
    cellTexts.forEach((text, idx) => {
      pdf.fontSize(cellFontSize).font("Chinese");
      if (isHeader) {
        pdf.text(text, xPos + cellPadding, startY + cellPadding, { width: colWidths[idx] - cellPadding * 2, align: "center" });
      } else {
        const align = idx === 0 ? "center" : "left";
        pdf.text(text, xPos + cellPadding, startY + cellPadding, { width: colWidths[idx] - cellPadding * 2, align });
      }
      xPos += colWidths[idx];
    });
    
    xPos = 50;
    for (let j = 0; j < colCount - 1; j++) {
      xPos += colWidths[j];
      pdf.moveTo(xPos, startY).lineTo(xPos, startY + maxCellHeight).lineWidth(0.3).stroke();
    }
    
    pdf.y = startY + maxCellHeight;
  };
  
  drawTableRow(headerCells.map(h => h), true);
  
  for (const row of dataRows) {
    const paddedRow = [...row];
    while (paddedRow.length < colCount) paddedRow.push("");
    drawTableRow(paddedRow, false);
  }
  
  return i - 1;
}

// ===== P22 群聊增强 API =====

// 设置/获取群公告
chatRoutes.put("/:id/announcement", (req: AuthRequest, res) => {
  try {
    const chat = requireChatManager(req, res, req.params.id);
    if (!chat) return;
    const chatId = chat.id;
    const { announcement } = req.body;
    dbRun("UPDATE chats SET announcement = ? WHERE id = ? AND tenant_id = ?", [announcement || null, chatId, req.user!.tenant_id]);
    broadcastToChat(chatId, { type: "announcement_updated", chatId, announcement });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

// 置顶/取消置顶消息
chatRoutes.post("/:id/messages/:messageId/pin", (req: AuthRequest, res) => {
  try {
    const chat = requireChatManager(req, res, req.params.id);
    if (!chat) return;
    const chatId = chat.id;
    const messageId = parseInt(req.params.messageId);
    if (!dbGet("SELECT 1 FROM messages WHERE id = ? AND chat_id = ? AND tenant_id = ?", [messageId, chatId, req.user!.tenant_id])) return res.status(404).json({ success: false, error: chatError(req, "消息不存在", "Message not found") });

    const newPinned = chat.pinned_message_id === messageId ? null : messageId;
    dbRun("UPDATE chats SET pinned_message_id = ? WHERE id = ? AND tenant_id = ?", [newPinned, chatId, req.user!.tenant_id]);
    broadcastToChat(chatId, { type: "message_pinned", chatId, pinned_message_id: newPinned });
    res.json({ success: true, data: { pinned_message_id: newPinned } });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

// 软删除消息
chatRoutes.delete("/:id/messages/:messageId", (req: AuthRequest, res) => {
  try {
    const chat = requireChatMember(req, res, req.params.id);
    if (!chat) return;
    const chatId = chat.id;
    const messageId = parseInt(req.params.messageId);
    const msg = dbGet("SELECT * FROM messages WHERE id = ? AND chat_id = ? AND tenant_id = ?", [messageId, chatId, req.user!.tenant_id]) as any;
    if (!msg) return res.status(404).json({ success: false, error: chatError(req, "消息不存在", "Message not found") });

    const isOwner = msg.sender_type === "user" && msg.sender_id === req.user!.id;
    const isAdmin = ['admin', 'owner'].includes(chat.member_role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: chatError(req, "无权删除此消息", "You are not allowed to delete this message") });
    }

    dbRun("UPDATE messages SET deleted_at = datetime('now'), content = '[消息已删除]' WHERE id = ? AND chat_id = ? AND tenant_id = ?", [messageId, chatId, req.user!.tenant_id]);
    broadcastToChat(chatId, { type: "message_deleted", chatId, messageId });
    logActivity({ userId: req.user!.id, action: "message_deleted", entityType: "chat", entityId: chatId, tenantId: req.user!.tenant_id });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

// 成员角色管理（提升/降级管理员）
chatRoutes.put("/:id/members/:memberId/role", (req: AuthRequest, res) => {
  try {
    const chat = requireChatManager(req, res, req.params.id);
    if (!chat) return;
    const chatId = chat.id;
    const memberId = parseInt(req.params.memberId);
    const { role } = req.body;
    if (!role || !["admin", "member"].includes(role)) {
      return res.status(400).json({ success: false, error: chatError(req, "角色必须是 admin 或 member", "Role must be admin or member") });
    }

    const target = dbGet("SELECT * FROM chat_members WHERE id = ? AND chat_id = ? AND tenant_id = ?", [memberId, chatId, req.user!.tenant_id]) as any;
    if (!target) return res.status(404).json({ success: false, error: chatError(req, "成员不存在", "Member not found") });

    dbRun("UPDATE chat_members SET role = ? WHERE id = ? AND chat_id = ? AND tenant_id = ?", [role, memberId, chatId, req.user!.tenant_id]);
    broadcastToChat(chatId, { type: "member_role_changed", chatId, memberId, role });
    logActivity({ userId: req.user!.id, action: "member_role_changed", entityType: "chat", entityId: chatId, details: JSON.stringify({ memberId, role }), tenantId: req.user!.tenant_id });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

// @全体成员
chatRoutes.post("/:id/at-all", async (req: AuthRequest, res) => {
  try {
    const chatAccess = requireChatManager(req, res, req.params.id);
    if (!chatAccess) return;
    const chatId = chatAccess.id;
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, error: chatError(req, "内容必填", "Content is required") });

    const fullContent = `@全体成员 ${content}`;
    const result = dbRun(
      "INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, tenant_id) VALUES (?, ?, 'user', ?, ?, ?)",
      [chatId, req.user!.id, req.user!.nickname, fullContent, req.user!.tenant_id]
    );

    const sendStart = Date.now();
    let aiProgressSeq = 0;
    const pushProgress = (phase: string, detail: string, stepKey?: string, agentResult?: any) => {
      aiProgressSeq++;
      try {
        const ins = dbRun(
          "INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, NULL, 'system', ?, ?, 'ai_progress', ?)",
          [chatId, "AI进度", detail, req.user!.tenant_id]
        );
        broadcastToChat(chatId, {
          type: "new_message", chatId,
          message: { id: ins.lastInsertRowid, sender_type: "system", sender_name: "AI进度", content: detail,
            message_type: "ai_progress", phase, step_key: stepKey || (phase + "_" + aiProgressSeq),
            step_seq: aiProgressSeq, elapsed_ms: Date.now() - sendStart,
            agent_result: agentResult || null, created_at: new Date().toISOString() },
        });
      } catch(e) {}
    };

    // 通知所有人类群成员
    const allMembers = dbAll(
      "SELECT user_id FROM chat_members WHERE chat_id = ? AND tenant_id = ? AND user_id IS NOT NULL",
      [chatId, req.user!.tenant_id]
    ) as any[];
    const chat = dbGet("SELECT title FROM chats WHERE id = ? AND tenant_id = ?", [chatId, req.user!.tenant_id]) as any;

    for (const m of allMembers) {
      if (m.user_id !== req.user!.id) {
        notifyChatMention(chatId, chat?.title || "群聊", m.user_id, `@全体成员 ${req.user!.nickname}`);
      }
    }

    broadcastToChat(chatId, {
      type: "new_message", chatId,
      message: { id: result.lastInsertRowid, sender_type: "user", sender_name: req.user!.nickname, content: fullContent, created_at: new Date().toISOString(), at_all: true },
    });
    logActivity({ userId: req.user!.id, action: "at_all", entityType: "chat", entityId: chatId, tenantId: req.user!.tenant_id });

    pushProgress("receiving", "📡 @全体成员已发送，正在识别协作团队...", "atall_receiving");

    // @全体成员触发AI员工回复（排除@全体成员自身的匹配）
    const chatEmployees = dbAll(
      `SELECT e.* FROM employees e INNER JOIN chat_members cm ON cm.employee_id = e.id AND cm.tenant_id = e.tenant_id WHERE cm.chat_id = ? AND cm.tenant_id = ? AND e.employee_type = 'ai' AND e.status = 'active'`,
      [chatId, req.user!.tenant_id]
    ) as any[];

    if (chatEmployees.length === 0) {
      pushProgress("empty", "⚠️ 当前群聊尚未添加AI协作成员", "atall_empty");
      const allMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at ASC", [chatId, req.user!.tenant_id]);
      return res.json({ success: true, data: allMessages });
    }

    pushProgress("team_identified", `👥 已识别协作团队：${chatEmployees.map((e:any)=>e.name).join("、")}（${chatEmployees.length}位成员）`, "atall_team");

    // 检测除@全体成员外的特定@提及
    const contentWithoutAtAll = content.replace(/^@全体成员\s*/, "");
    const mentionMatch = contentWithoutAtAll.match(/@(\S+)/);
    let mentionedEmployee: any = null;

    if (mentionMatch) {
      const mentionedName = mentionMatch[1];
      mentionedEmployee = chatEmployees.find((e: any) =>
        e.name === mentionedName || e.name.includes(mentionedName)
      );
    }

    // 如果@了特定员工，仅该员工回复
    if (mentionedEmployee) {
      pushProgress("atall_mention_start", `🎯 检测到 @${mentionedEmployee.name}(${mentionedEmployee.role})，将直接由该员工回复`, "atall_mention_start");
      const historyRows = dbAll("SELECT content, sender_type FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 10", [chatId, req.user!.tenant_id]) as any[];
      const chatHistory = historyRows.reverse().map(m => ({ role: m.sender_type === "user" ? "user" as const : "assistant" as const, content: m.content }));
      const reply = await getSingleEmployeeResponse(mentionedEmployee, fullContent, chatHistory);
      dbRun("INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, ?, 'employee', ?, ?, 'ai_mention', ?)", [chatId, mentionedEmployee.id, `${mentionedEmployee.name} · ${mentionedEmployee.role}`, reply, req.user!.tenant_id]);
      broadcastToChat(chatId, {
        type: "new_message", chatId,
        message: { id: Date.now(), sender_type: "employee", sender_name: `${mentionedEmployee.name} · ${mentionedEmployee.role}`, content: reply, message_type: "ai_mention", created_at: new Date().toISOString() },
      });
      pushProgress("atall_mention_done", `✓ ${mentionedEmployee.name} 已回复（${reply.length}字，总用时 ${Math.round((Date.now()-sendStart)/1000)}秒）`, "atall_mention_done");
      const allMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at ASC", [chatId, req.user!.tenant_id]);
      return res.json({ success: true, data: allMessages, mentioned: mentionedEmployee.name });
    }

    // 群聊模式：触发所有AI员工回复
    const recentMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 30", [chatId, req.user!.tenant_id]) as any[];
    const historyRows = dbAll("SELECT content, sender_type, sender_name, message_type FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 30", [chatId, req.user!.tenant_id]) as any[];
    const chatHistory = historyRows.reverse().map(m => ({
      role: m.sender_type === "user" ? "user" as const : "assistant" as const,
      content: m.message_type === "ai_summary" ? `[总结] ${m.content}` : m.content,
    }));

    if (isCasualChat(fullContent)) {
      pushProgress("atall_casual", `💬 检测为闲聊消息，AI员工自由互动中...`, "atall_casual");
      const casualResponses = await getCasualChatResponse(chatEmployees, fullContent, chatHistory);
      for (const resp of casualResponses) {
        const insertResult = dbRun(
          "INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, ?, 'employee', ?, ?, 'ai', ?)",
          [chatId, resp.employee.id, `${resp.employee.name} · ${resp.employee.role}`, resp.content, req.user!.tenant_id]
        );
        broadcastToChat(chatId, {
          type: "new_message", chatId,
          message: { id: insertResult.lastInsertRowid, sender_type: "employee", sender_name: `${resp.employee.name} · ${resp.employee.role}`, content: resp.content, message_type: "ai", created_at: new Date().toISOString() },
        });
      }
      pushProgress("atall_casual_done", `✓ 闲聊互动完成（总用时 ${Math.round((Date.now()-sendStart)/1000)}秒）`, "atall_casual_done");
    } else {
      pushProgress("atall_group", "🤝 正在征询群内智能助手的独立建议…", "atall_group");
      const progressCb = (phase: string, detail: string, stepKey?: string, agentResult?: any) => {
        pushProgress(phase, detail, stepKey);
      };
      const result2 = await runGroupConversation(fullContent, chatEmployees, chatHistory, progressCb);
      pushProgress("atall_group_done", `✨ 协作完成（总用时 ${Math.round((Date.now()-sendStart)/1000)}秒）`, "atall_group_done");
      for (const step of result2.steps) {
        const msgContent = step.content;
        const msgType = "ai_reply";
        if (!msgContent) continue;
        const insertResult = dbRun(
          "INSERT INTO messages (chat_id, sender_id, sender_type, sender_name, content, message_type, tenant_id) VALUES (?, ?, 'employee', ?, ?, ?, ?)",
          [chatId, chatEmployees[0]?.id || null, `${step.employee_name} · ${step.employee_role}`, msgContent, msgType, req.user!.tenant_id]
        );
        broadcastToChat(chatId, {
          type: "new_message", chatId,
          message: { id: insertResult.lastInsertRowid, sender_type: "employee", sender_name: `${step.employee_name} · ${step.employee_role}`, content: msgContent, message_type: msgType, created_at: new Date().toISOString() },
        });
      }
    }

    const allMessages = dbAll("SELECT * FROM messages WHERE chat_id = ? AND tenant_id = ? ORDER BY created_at ASC", [chatId, req.user!.tenant_id]);
    res.json({ success: true, data: allMessages });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

// 更新已读标记
chatRoutes.post("/:id/read-marker", (req: AuthRequest, res) => {
  try {
    const chat = requireChatMember(req, res, req.params.id);
    if (!chat) return;
    const chatId = chat.id;
    const { message_id } = req.body;
    if (message_id && !dbGet("SELECT 1 FROM messages WHERE id = ? AND chat_id = ? AND tenant_id = ?", [message_id, chatId, req.user!.tenant_id])) return res.status(404).json({ success: false, error: chatError(req, "消息不存在", "Message not found") });
    dbRun(
      "INSERT INTO chat_read_markers (chat_id, user_id, last_read_message_id, last_read_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(chat_id, user_id) DO UPDATE SET last_read_message_id = MAX(last_read_message_id, ?), last_read_at = datetime('now')",
      [chatId, req.user!.id, message_id || 0, message_id || 0]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: chatError(req, "聊天服务暂时不可用，请稍后重试", "Chat service is temporarily unavailable. Please try again") }); }
});

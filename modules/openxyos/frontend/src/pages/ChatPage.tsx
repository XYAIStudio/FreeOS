import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, Send, Bot, Users, Loader2, Plus, Hash, Smile, Reply, X, Check, FileText, Copy, Download, ChevronRight, Lightbulb, ClipboardCheck, Edit2, UserPlus, Building2, ChevronDown, Forward, BookOpen, PanelLeftOpen, MessageCircle, ChevronLeft, Megaphone, Pin, Trash2, Shield, AtSign, Search } from "lucide-react";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";
import { useChatWebSocket } from "../hooks/useWebSocket";
import Avatar from "../components/Avatar";
import MentionInput from "../components/MentionInput";
import { useLocale } from "../i18n";

interface Chat { id: number; title: string; type: string; last_message?: string; last_sender?: string; member_count?: number; unread_count?: number; announcement?: string; pinned_message_id?: number; }
interface ChatMember { id: number; user_id: number | null; employee_id: number | null; role: string; user_name?: string; employee_name?: string; avatar_emoji?: string; employee_role?: string; agent_type?: string; }
interface Msg {
  id: number; sender_type: string; sender_name: string; content: string;
  message_type?: string; created_at: string;
  reactions?: { emoji: string; count: number; users: string }[];
  thread_count?: number;
  reply_to_id?: number;
  at_all?: boolean;
}
interface Employee {
  id: number; name: string; role: string; agent_type: string;
  avatar_emoji: string; avatar_url?: string; skills: string; department_id: number; employee_type: string;
  is_online?: boolean;
}
interface Department {
  id: number; name: string; parent_id: number | null; employees: Employee[];
  children?: Department[];
}

const ROLE_COLORS: Record<string, string> = {
  ceo: "#722ED1", cto: "#165DFF", cfo: "#FF7D00", cmo: "#F53F3F",
  product_manager: "#10B981", frontend_dev: "#165DFF", backend_dev: "#722ED1",
  hr: "#06B6D4", qa: "#FF7D00", knowledge: "#10B981", default: "#86909C",
};

function getColor(agentType: string): string {
  return ROLE_COLORS[agentType] || ROLE_COLORS.default;
}

const QUICK_REACTIONS = ["👍", "❤️", "😊", "🎉", "👏", "🤔"];

export default function ChatPage() {
  const { user } = useAuthStore();
  const { t, isEnglish } = useLocale();
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const [showReactions, setShowReactions] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [generatingMinutes, setGeneratingMinutes] = useState(false);
  const [renamingChat, setRenamingChat] = useState<Chat | null>(null);
  const [newChatName, setNewChatName] = useState("");
  const [expandedDepts, setExpandedDepts] = useState<Set<number>>(new Set());
  const [leftTab, setLeftTab] = useState<"employees" | "chats">("employees");
  const [editingMinutesId, setEditingMinutesId] = useState<number | null>(null);
  const [editingMinutesContent, setEditingMinutesContent] = useState("");
  const [importingKnowledge, setImportingKnowledge] = useState<number | null>(null);
  const [importKnowledgeTitle, setImportKnowledgeTitle] = useState("");
  const [showImportModal, setShowImportModal] = useState<{ messageId: number; content: string } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<number | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Msg | null>(null);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwardResults, setForwardResults] = useState<Employee[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const [savingKnowledge, setSavingKnowledge] = useState<number | null>(null);
  const [expandedMsgs, setExpandedMsgs] = useState<Set<number>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // P22 群聊增强状态
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [chatMembers, setChatMembers] = useState<ChatMember[]>([]);
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const msgEnd = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoSelectRef = useRef(false);

  // 从URL参数自动选中聊天（来源于组织架构等页面点击"发起聊天"）
  useEffect(() => {
    const chatId = searchParams.get("open");
    if (!chatId || autoSelectRef.current || loading) return;
    const target = chats.find(c => c.id === Number(chatId));
    if (target) {
      autoSelectRef.current = true;
      selectChat(target);
      setSearchParams({}, { replace: true }); // 清除URL参数
    }
  }, [chats, loading, searchParams]);

  // 移动端选择会话/员工后自动关闭侧边栏抽屉
  const closeMobileSidebarOnSelect = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileSidebarOpen(false);
    }
  };

  useEffect(() => {
    authFetch("/api/chats").then(r => r.json()).then(d => {
      if (d.success) setChats(d.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
    loadEmployees();
  }, []);

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // P22: WebSocket 实时更新
  const [wsConnected, setWsConnected] = useState(false);
  useChatWebSocket(active?.id || null, (msg) => {
    if (msg.type === "connected") {
      setWsConnected(true);
      return;
    }
    // 消息变更时刷新消息列表
    if (["new_message", "message_deleted"].includes(msg.type)) {
      loadMessages();
    }
    // 公告变更时刷新聊天信息
    if (msg.type === "announcement_updated") {
      setActive(prev => prev ? { ...prev, announcement: msg.announcement } : null);
    }
  });

  // P22: 加载群成员列表
  const loadMembers = async () => {
    if (!active) return;
    const r = await authFetch(`/api/chats/${active.id}/members`);
    const d = await r.json();
    if (d.success) setChatMembers(d.data || []);
  };

  // P22: 设置公告
  const saveAnnouncement = async () => {
    if (!active) return;
    await authFetch(`/api/chats/${active.id}/announcement`, {
      method: "PUT",
      body: JSON.stringify({ announcement: announcementText }),
    });
    setActive(prev => prev ? { ...prev, announcement: announcementText || undefined } : null);
    setEditingAnnouncement(false);
  };

  // P22: 清除公告
  const saveAnnouncementWithClear = async () => {
    if (!active) return;
    await authFetch(`/api/chats/${active.id}/announcement`, {
      method: "PUT",
      body: JSON.stringify({ announcement: null }),
    });
    setActive(prev => prev ? { ...prev, announcement: undefined } : null);
  };

  // P22: 置顶消息
  const togglePin = async (messageId: number) => {
    if (!active) return;
    await authFetch(`/api/chats/${active.id}/messages/${messageId}/pin`, { method: "POST" });
    reloadChat();
  };

  // P22: 删除消息
  const deleteMessage = async (messageId: number) => {
    if (!active || !confirm(t("确认删除这条消息？", "Delete this message?"))) return;
    await authFetch(`/api/chats/${active.id}/messages/${messageId}`, { method: "DELETE" });
    loadMessages();
  };

  // P22: @全体成员（已移至 MentionInput @提选项中，handleSend 自动检测）

  // P22: 提升/降级管理员
  const toggleAdmin = async (memberId: number, currentRole: string) => {
    if (!active) return;
    const newRole = currentRole === "admin" ? "member" : "admin";
    await authFetch(`/api/chats/${active.id}/members/${memberId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role: newRole }),
    });
    loadMembers();
  };

  // P22: 刷新聊天信息
  const reloadChat = async () => {
    if (!active) return;
    const r = await authFetch(`/api/chats/${active.id}`);
    const d = await r.json();
    if (d.success) setActive(d.data);
  };

  // P22: 刷新消息列表（复用 selectChat 逻辑但保留 active）
  const loadMessages = async () => {
    if (!active) return;
    const r = await authFetch(`/api/chats/${active.id}/messages?limit=50`);
    const d = await r.json();
    if (d.success) setMessages(d.data.messages || []);
  };

  // P22: 标记已读
  const markRead = async (chatId: number) => {
    const messages = await authFetch(`/api/chats/${chatId}/messages?limit=1`);
    const d = await messages.json();
    const lastMsgId = d.data?.messages?.[d.data.messages.length - 1]?.id;
    if (lastMsgId) {
      await authFetch(`/api/chats/${chatId}/read-marker`, {
        method: "POST",
        body: JSON.stringify({ message_id: lastMsgId }),
      });
    }
    // 刷新列表以更新未读数
    const r = await authFetch("/api/chats");
    const cd = await r.json();
    if (cd.success) setChats(cd.data || []);
  };

  const flattenDepartments = (nodes: Department[]): Department[] => {
    const result: Department[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children) result.push(...flattenDepartments(node.children));
    }
    return result;
  };

  const loadEmployees = async () => {
    const r = await authFetch("/api/org/tree");
    const d = await r.json();
    if (d.success) {
      const tree = d.data || [];
      const allDepts = flattenDepartments(tree);
      setDepartments(allDepts);
      setExpandedDepts(new Set(allDepts.filter(d => d.employees.length > 0).map(d => d.id)));
      const allEmps: Employee[] = [];
      const extractEmployees = (depts: Department[]) => {
        for (const dept of depts) {
          allEmps.push(...dept.employees);
          if (dept.children) extractEmployees(dept.children);
        }
      };
      extractEmployees(tree);
      setEmployees(allEmps);
    }
  };

  const selectChat = async (chat: Chat) => {
    setActive(chat);
    setReplyTo(null);
    closeMobileSidebarOnSelect();
    const r = await authFetch(`/api/chats/${chat.id}/messages?limit=50`);
    const d = await r.json();
    if (d.success) setMessages(d.data.messages || []);
    // P22: 加载群成员 + 标记已读
    if (chat.type === "group") loadMembersForChat(chat.id);
    markRead(chat.id);
  };

  // P22: 专门加载成员（避免与 selectChat 的状态闭包冲突）
  const loadMembersForChat = async (chatId: number) => {
    const r = await authFetch(`/api/chats/${chatId}/members`);
    const d = await r.json();
    if (d.success) setChatMembers(d.data || []);
  };

  const startSingleChat = async (emp: Employee) => {
    closeMobileSidebarOnSelect();
    const existingChat = chats.find(c => c.type === "single" && c.title.includes(emp.name));
    if (existingChat) {
      selectChat(existingChat);
      return;
    }
    const title = t("与" + emp.name + "的对话", "Chat with " + emp.name);
    const r = await authFetch("/api/chats", {
      method: "POST",
      body: JSON.stringify({ title, type: "single", employee_ids: [emp.id] }),
    });
    const d = await r.json();
    if (d.success) {
      const newChat: Chat = { id: d.data.id, title, type: "single" };
      setChats(prev => [newChat, ...prev]);
      selectChat(newChat);
    }
  };

  const toggleEmployee = (id: number) => {
    setSelectedEmployees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const createGroup = async () => {
    if (selectedEmployees.length === 0) return;
    const title = groupName.trim() || t("群聊：" + selectedEmployees.map(id => employees.find(e => e.id === id)?.name).filter(Boolean).join("、"), "Group: " + selectedEmployees.map(id => employees.find(e => e.id === id)?.name).filter(Boolean).join(", "));
    const r = await authFetch("/api/chats", {
      method: "POST",
      body: JSON.stringify({ title, type: "group", employee_ids: selectedEmployees }),
    });
    const d = await r.json();
    if (d.success) {
      const newChat: Chat = { id: d.data.id, title, type: "group" };
      setChats(prev => [newChat, ...prev]);
      setShowCreateGroup(false);
      setSelectedEmployees([]);
      setGroupName("");
      selectChat(newChat);
    }
  };

  const renameChat = async () => {
    if (!renamingChat || !newChatName.trim()) return;
    await authFetch(`/api/chats/${renamingChat.id}`, {
      method: "PUT",
      body: JSON.stringify({ title: newChatName.trim() }),
    });
    setChats(prev => prev.map(c => c.id === renamingChat.id ? { ...c, title: newChatName.trim() } : c));
    if (active?.id === renamingChat.id) {
      setActive(prev => prev ? { ...prev, title: newChatName.trim() } : null);
    }
    setRenamingChat(null);
    setNewChatName("");
  };

  const handleSend = async () => {
    if (!input.trim() || !active || sending) return;
    const text = input.trim();
    const replyingTo = replyTo;
    setInput("");
    setSending(true);
    setReplyTo(null);
    const tempMsg: Msg = { id: Date.now(), sender_type: "user", sender_name: user?.nickname || t("我", "Me"), content: text, reply_to_id: replyingTo?.id, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);
    try {
      // 检测 @全体成员 前缀，自动路由到 /at-all 端点
      const isAtAll = text.startsWith("@全体成员") || text.toLowerCase().startsWith("@all");
      const endpoint = isAtAll
        ? `/api/chats/${active.id}/at-all`
        : `/api/chats/${active.id}/messages`;
      const body: any = { content: text, sender_name: user?.nickname };
      if (replyingTo?.id) body.reply_to_id = replyingTo.id;
      const r = await authFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) setMessages(d.data || []);
    } catch {}
    setSending(false);
  };

  const handleReaction = async (messageId: number, emoji: string) => {
    if (!active) return;
    await authFetch(`/api/chats/${active.id}/messages/${messageId}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) });
    setShowReactions(null);
    selectChat(active);
  };

  const handleCopy = async (msg: Msg) => {
    const text = msg.content.replace(/\*\*/g, "").replace(/`/g, "");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // WebView / non-HTTPS fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    alert(t("已复制到剪贴板", "Copied to clipboard"));
  };

  const handleForward = (msg: Msg) => {
    setForwardMsg(msg);
    setForwardSearch("");
    setForwardResults([]);
  };

  const doForward = async (targetChatId: number, targetName?: string) => {
    if (!forwardMsg) return;
    const label = targetName ? t("[转发给" + targetName + "]", "[Forwarded to " + targetName + "]") : t("[转发]", "[Forwarded]");
    await authFetch(`/api/chats/${targetChatId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: `${label} ${forwardMsg.content}`, sender_name: user?.nickname }),
    });
    setForwardMsg(null);
    setForwardSearch("");
    setForwardResults([]);
    alert(t("已转发", "Forwarded"));
  };

  // Forward: search employees and find/create target chat
  const forwardToEmployee = async (emp: Employee) => {
    if (!forwardMsg) return;
    // Look for existing single chat with this employee
    const existing = chats.find(c => c.type === "single" && c.title.includes(emp.name));
    if (existing) {
      await doForward(existing.id, emp.name);
      return;
    }
    // Create new single chat then forward
    const title = t("与" + emp.name + "的对话", "Chat with " + emp.name);
    const r = await authFetch("/api/chats", {
      method: "POST",
      body: JSON.stringify({ title, type: "single", employee_ids: [emp.id] }),
    });
    const d = await r.json();
    if (d.success && d.data?.id) {
      setChats(prev => [d.data, ...prev]);
      await doForward(d.data.id, emp.name);
    } else {
      alert(t("创建会话失败", "Unable to create chat"));
    }
  };

  const handleSaveKnowledge = async (msg: Msg) => {
    setSavingKnowledge(msg.id);
    try {
      const title = (active?.title || t("聊天", "Chat")) + " - " + (msg.sender_name || t("消息", "Message")) + " - " + new Date(msg.created_at).toLocaleDateString();
      const r = await authFetch("/api/knowledge", {
        method: "POST",
        body: JSON.stringify({ title, content: msg.content, source: `chat:${active?.id}`, tags: t("聊天记录,转发", "chat history,forwarded") }),
      });
      const d = await r.json();
      if (d.success) {
        alert(t("已存入知识库", "Saved to knowledge base"));
      } else {
        alert(d.error || t("保存失败", "Save failed"));
      }
    } catch { alert(t("保存失败，请检查网络连接", "Save failed. Check your network connection.")); }
    setSavingKnowledge(null);
  };

  const handleExportMsg = async (msg: Msg, format: "txt" | "md") => {
    const text = format === "md" ? msg.content : msg.content.replace(/\*\*/g, "").replace(/`/g, "").replace(/#{1,6}\s/g, "");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("消息_", "message_") + msg.id + "." + format;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpand = (msgId: number) => {
    setExpandedMsgs(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const generateMinutes = async () => {
    if (!active || generatingMinutes) return;
    setGeneratingMinutes(true);
    try {
      const lastUserMsg = [...messages].reverse().find(m => m.sender_type === "user");
      const r = await authFetch(`/api/chats/${active.id}/minutes`, {
        method: "POST",
        body: JSON.stringify({ userMessage: lastUserMsg?.content || "" }),
      });
      const d = await r.json();
      if (d.success) {
        const r2 = await authFetch(`/api/chats/${active.id}/messages?limit=50`);
        const d2 = await r2.json();
        if (d2.success) setMessages(d2.data.messages || []);
      }
    } catch {}
    setGeneratingMinutes(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => alert(t("已复制到剪贴板", "Copied to clipboard")));
  };

  const exportMinutes = async (messageId: number, format: string) => {
    if (!active) return;
    setShowExportMenu(null);
    const url = `/api/chats/${active.id}/messages/${messageId}/export?format=${format}`;
    const r = await authFetch(url);
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = t("会议纪要-", "meeting-minutes-") + new Date().toISOString().slice(0, 10) + "." + format;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveEditedMinutes = async (messageId: number) => {
    if (!active || !editingMinutesContent.trim()) return;
    await authFetch(`/api/chats/${active.id}/messages/${messageId}`, {
      method: "PUT",
      body: JSON.stringify({ content: editingMinutesContent }),
    });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: editingMinutesContent } : m));
    setEditingMinutesId(null);
  };

  const importToKnowledge = async (messageId: number) => {
    if (!active) return;
    setImportingKnowledge(messageId);
    const title = importKnowledgeTitle.trim() || undefined;
    const r = await authFetch(`/api/chats/${active.id}/messages/${messageId}/import-knowledge`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    const d = await r.json();
    setImportingKnowledge(null);
    setShowImportModal(null);
    setImportKnowledgeTitle("");
    if (d.success) alert(t("已导入知识库：", "Imported into knowledge base: ") + d.data.title);
  };

  // Shared @mention highlighting helper
  const highlightMentions = (text: string) => {
    const parts = text.split(/(@\S+)/g);
    const memberNames = new Set(chatMembers.map((m) => m.employee_name || m.user_name || "").filter(Boolean));
    return parts.map((part, i) => {
      if (part.startsWith("@") && part.length > 1) {
        const name = part.slice(1);
        // @全体成员 特殊高亮：白色文字+金色徽章，绿色/蓝色底色均清晰
        if (name === "全体成员" || (isEnglish && name.toLowerCase() === "all")) {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-500/25 text-white text-[12px] font-bold border border-yellow-300/40"
            >
              <AtSign size={11} className="shrink-0" />
              {part}
            </span>
          );
        }
        const isMember = memberNames.has(name);
        return (
          <span
            key={i}
            className={`${isMember ? "text-blue-600 font-semibold bg-blue-50 px-0.5 rounded" : "text-blue-500 font-medium"}`}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderMessageContent = (msg: Msg) => {
    const isUser = msg.sender_type === "user";
    const isThink = msg.message_type === "ai_think";
    const isAssign = msg.message_type === "ai_assign";
    const isReview = msg.message_type === "ai_review";
    const isSummary = msg.message_type === "ai_summary";
    const isMinutes = msg.message_type === "meeting_minutes";

    if (isThink) {
      return (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 italic">
          <Lightbulb size={14} className="shrink-0 mt-0.5" />
          <span>{highlightMentions(msg.content)}</span>
        </div>
      );
    }

    if (isAssign) {
      return (
        <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded">
          <div className="text-xs font-semibold text-purple-700 mb-1">{t("📋 任务分配", "📋 Task assignment")}</div>
          <div className="text-sm text-purple-900 whitespace-pre-wrap">{highlightMentions(msg.content.replace("📋 **任务分配**\n\n", ""))}</div>
        </div>
      );
    }

    if (isReview) {
      return (
        <div className="px-3 py-2 bg-cyan-50 border border-cyan-200 rounded">
          <div className="text-xs font-semibold text-cyan-700 mb-1">{t("🔍 点评", "🔍 Review")}</div>
          <div className="text-sm text-cyan-900 whitespace-pre-wrap">{highlightMentions(msg.content)}</div>
        </div>
      );
    }

    if (isSummary) {
      return (
        <div className="px-3 py-2 bg-green-50 border border-green-200 rounded">
          <div className="text-xs font-semibold text-green-700 mb-1">{t("📊 总结汇报", "📊 Summary")}</div>
          <div className="text-sm text-green-900 whitespace-pre-wrap">{highlightMentions(msg.content.replace("📊 **总结汇报**\n\n", ""))}</div>
          <div className="mt-2 pt-2 border-t border-green-200 flex items-center gap-2">
            <span className="text-[10px] text-green-600">{t("请审核，如需修改请回复，确认请回复“确认”", "Please review. Reply with changes if needed, or reply “Confirm” to approve.")}</span>
          </div>
        </div>
      );
    }

    if (isMinutes) {
      const isEditing = editingMinutesId === msg.id;
      return (
        <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">{t("会议纪要", "Meeting minutes")}</span>
            </div>
            <div className="flex items-center gap-1">
              {isEditing ? (
                <>
                  <button onClick={() => saveEditedMinutes(msg.id)} className="px-2 py-1 text-[10px] bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1">
                    <Check size={10} /> {t("保存", "Save")}
                  </button>
                  <button onClick={() => setEditingMinutesId(null)} className="px-2 py-1 text-[10px] bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-1">
                    <X size={10} /> {t("取消", "Cancel")}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditingMinutesId(msg.id); setEditingMinutesContent(msg.content); }} className="px-2 py-1 text-[10px] bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1">
                    <Edit2 size={10} /> {t("编辑", "Edit")}
                  </button>
                  <button onClick={() => copyToClipboard(msg.content)} className="px-2 py-1 text-[10px] bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1">
                    <Copy size={10} /> {t("复制", "Copy")}
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowExportMenu(showExportMenu === msg.id ? null : msg.id)} className="px-2 py-1 text-[10px] bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1">
                      <Download size={10} /> {t("导出", "Export")} <ChevronDown size={8} />
                    </button>
                    {showExportMenu === msg.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-border shadow-lg rounded z-20 py-1 min-w-[80px]">
                        <button onClick={() => exportMinutes(msg.id, "md")} className="w-full px-3 py-1.5 text-[10px] text-left hover:bg-blue-50 text-blue-700">.md {t("文档", "document")}</button>
                        <button onClick={() => exportMinutes(msg.id, "docx")} className="w-full px-3 py-1.5 text-[10px] text-left hover:bg-blue-50 text-blue-700">.docx {t("文档", "document")}</button>
                        <button onClick={() => exportMinutes(msg.id, "pdf")} className="w-full px-3 py-1.5 text-[10px] text-left hover:bg-blue-50 text-blue-700">.pdf {t("文档", "document")}</button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setShowImportModal({ messageId: msg.id, content: msg.content }); setImportKnowledgeTitle(""); }} className="px-2 py-1 text-[10px] bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center gap-1">
                    <FileText size={10} /> {t("入知识库", "Save to knowledge")}
                  </button>
                </>
              )}
            </div>
          </div>
          {isEditing ? (
            <textarea
              value={editingMinutesContent}
              onChange={e => setEditingMinutesContent(e.target.value)}
              className="w-full min-h-[300px] px-3 py-2 text-sm text-blue-900 bg-white border border-blue-300 rounded focus:outline-none focus:border-blue-500 font-mono"
            />
          ) : (
            <div className="text-sm text-blue-900 whitespace-pre-wrap max-h-96 overflow-y-auto">{highlightMentions(msg.content)}</div>
          )}
        </div>
      );
    }

    // Plain text message — highlight @mentions, reply quotes, and [转发xxx] prefix
    // Reply reference quote line
    const replyRef = msg.reply_to_id
      ? messages.find(m => m.id === msg.reply_to_id)
      : null;

    const forwardMatch = msg.content.match(/^(\[转发[^\]]*\])\s*/);
    if (forwardMatch) {
      const rest = msg.content.slice(forwardMatch[0].length);
      return (
        <div className="whitespace-pre-wrap">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[11px] font-medium mr-1 align-middle">
            <Forward size={10} /> {forwardMatch[1]}
          </span>
          {highlightMentions(rest)}
        </div>
      );
    }

    return (
      <div className="whitespace-pre-wrap">
        {replyRef && (
          <div className="flex items-start gap-2 mb-1.5 px-2 py-1 rounded bg-bg border-l-2 border-primary/40 text-text-muted">
            <Reply size={12} className="shrink-0 mt-0.5 text-primary/60" />
            <div className="min-w-0 text-[11px] leading-relaxed">
              <span className="font-medium text-text">{replyRef.sender_name || t("未知", "Unknown")}</span>
              <span className="mx-1">:</span>
              <span className="line-clamp-2">{replyRef.content.replace(/\*\*/g, "").replace(/`/g, "").substring(0, 80)}</span>
            </div>
          </div>
        )}
        {highlightMentions(msg.content)}
      </div>
    );
  };

  const getMessageStyles = (msg: Msg) => {
    const isUser = msg.sender_type === "user";
    const isThink = msg.message_type === "ai_think";
    const isAssign = msg.message_type === "ai_assign";
    const isReview = msg.message_type === "ai_review";
    const isSummary = msg.message_type === "ai_summary";
    const isMinutes = msg.message_type === "meeting_minutes";

    if (isUser) return "bg-primary text-white";
    if (isThink || isAssign || isReview || isSummary || isMinutes) return "bg-transparent border-0 p-0";
    return "bg-bg-card border border-border text-text";
  };

  const getRoleColor = (senderName: string) => {
    if (senderName.includes("CEO") || senderName.includes("陈远")) return ROLE_COLORS.ceo;
    if (senderName.includes("CTO") || senderName.includes("林技")) return ROLE_COLORS.cto;
    if (senderName.includes("CFO") || senderName.includes("王财")) return ROLE_COLORS.cfo;
    if (senderName.includes("产品") || senderName.includes("赵产")) return ROLE_COLORS.product_manager;
    if (senderName.includes("市场") || senderName.includes("刘市")) return ROLE_COLORS.cmo;
    if (senderName.includes("HR") || senderName.includes("孙人")) return ROLE_COLORS.hr;
    if (senderName.includes("前端") || senderName.includes("周前")) return ROLE_COLORS.frontend_dev;
    if (senderName.includes("后端") || senderName.includes("吴后")) return ROLE_COLORS.backend_dev;
    if (senderName.includes("测试") || senderName.includes("郑测")) return ROLE_COLORS.qa;
    if (senderName.includes("知识") || senderName.includes("李知")) return ROLE_COLORS.knowledge;
    return ROLE_COLORS.default;
  };

  const toggleDept = (deptId: number) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  const renderEmployeeList = () => {
    if (departments.length === 0) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-text-muted" />
        </div>
      );
    }

    const deptWithEmps = departments.filter(d => d.employees.length > 0);

    return (
      <div className="space-y-1">
        {deptWithEmps.map(dept => (
          <div key={dept.id}>
            <button
              onClick={() => toggleDept(dept.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-muted hover:bg-bg rounded"
            >
              {expandedDepts.has(dept.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Building2 size={12} />
              <span className="truncate">{dept.name}</span>
              <span className="ml-auto text-[10px] text-text-muted shrink-0">{dept.employees.length}</span>
            </button>
            {expandedDepts.has(dept.id) && (
              <div className="ml-4 space-y-0.5">
                {dept.employees.map(emp => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-bg group"
                    onClick={() => startSingleChat(emp)}
                  >
                    <Avatar id={emp.id} name={emp.name} size={28} className="rounded" customSrc={emp.avatar_url || undefined} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-text truncate">{emp.name}</p>
                        {emp.employee_type === "ai" && (
                          <span className="text-[8px] font-bold px-1 py-0.5 bg-emerald-500/10 text-emerald-500 rounded shrink-0">AI</span>
                        )}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${emp.is_online ? "bg-green-500" : "bg-gray-300"}`}
                          title={emp.is_online ? t("在线", "Online") : t("离线", "Offline")} />
                      </div>
                      <p className="text-[10px] text-text-muted truncate">{emp.role}</p>
                    </div>
                    <MessageSquare size={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // 侧边栏内容（桌面端内联与移动端抽屉共用）
  // collapsed=true 时仅显示图标列（窄模式）
  const renderSidebarContent = (collapsed: boolean) => {
    if (collapsed) {
      // 折叠态：仅图标列
      return (
        <>
          <div className="px-2 py-3 border-b border-border flex flex-col items-center gap-3">
            <button
              onClick={() => { setLeftTab("employees"); loadEmployees(); }}
              className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${leftTab === "employees" ? "bg-primary text-white" : "text-text-muted hover:text-text hover:bg-bg"}`}
              title={t("员工列表", "Employee list")}
            >
              <Users size={16} />
            </button>
            <button
              onClick={() => setLeftTab("chats")}
              className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${leftTab === "chats" ? "bg-primary text-white" : "text-text-muted hover:text-text hover:bg-bg"}`}
              title={t("会话列表", "Chat list")}
            >
              <MessageCircle size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-1.5">
            {leftTab === "employees" ? (
              <div className="flex flex-col items-center gap-1">
                {departments.filter(d => d.employees.length > 0).map(dept =>
                  dept.employees.map(emp => (
                    <div
                      key={emp.id}
                      className="w-9 h-9 rounded flex items-center justify-center cursor-pointer hover:bg-bg shrink-0"
                      style={{
                        background: emp.employee_type === "human" ? "#86909C20" : getColor(emp.agent_type) + "20",
                        color: emp.employee_type === "human" ? "#86909C" : getColor(emp.agent_type)
                      }}
                      onClick={() => startSingleChat(emp)}
                      title={`${emp.name} - ${emp.role}`}
                    >
                      <Avatar id={emp.id} name={emp.name} size={24} customSrc={emp.avatar_url || undefined} />
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                {chats.map(chat => (
                  <div key={chat.id} className="relative">
                  <button
                    onClick={() => selectChat(chat)}
                    className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${active?.id === chat.id ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-bg"}`}
                    title={chat.title}
                  >
                    {chat.type === "single" ? <Bot size={16} /> : <Hash size={16} />}
                  </button>
                  {chat.unread_count && chat.unread_count > 0 && chat.id !== active?.id && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-bold min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center">{chat.unread_count > 99 ? "99+" : chat.unread_count}</span>
                  )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="py-2 border-t border-border flex justify-center">
            <button
              onClick={() => { setShowCreateGroup(true); loadEmployees(); }}
              className="w-9 h-9 rounded bg-primary text-white flex items-center justify-center hover:opacity-90"
              title={t("创建群组", "Create group")}
            >
              <UserPlus size={16} />
            </button>
          </div>
        </>
      );
    }

    // 展开态：完整侧边栏
    return (
      <>
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text mb-2">{t("沟通协作", "Collaboration")}</h2>
          <div className="flex items-center gap-1 bg-bg rounded p-0.5">
            <button
              onClick={() => { setLeftTab("employees"); loadEmployees(); }}
              className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${leftTab === "employees" ? "bg-primary text-white" : "text-text-muted hover:text-text"}`}
            >
              {t("员工列表", "Employee list")}
            </button>
            <button
              onClick={() => setLeftTab("chats")}
              className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${leftTab === "chats" ? "bg-primary text-white" : "text-text-muted hover:text-text"}`}
            >
              {t("会话列表", "Chat list")}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5 px-1.5">
          {leftTab === "employees" ? (
            renderEmployeeList()
          ) : (
            <div className="space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-text-muted" /></div>
              ) : chats.map(chat => (
                <div key={chat.id} className="group relative">
                  <button onClick={() => selectChat(chat)}
                    className={`w-full text-left px-3 py-2.5 rounded transition-colors ${active?.id === chat.id ? "bg-primary/10" : "hover:bg-bg"}`}>
                    <div className="flex items-center gap-2">
                      {chat.type === "single" ? <Bot size={14} className="text-primary shrink-0" /> : <Hash size={14} className="text-text-muted shrink-0" />}
                      <span className="text-xs font-medium text-text truncate flex-1">{chat.title}</span>
                      {chat.unread_count && chat.unread_count > 0 && chat.id !== active?.id && (
                        <span className="bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shrink-0">{chat.unread_count > 99 ? "99+" : chat.unread_count}</span>
                      )}
                      {chat.announcement && (
                        <span title={chat.announcement}><Megaphone size={10} className="text-amber-500 shrink-0" /></span>
                      )}
                    </div>
                    {chat.last_message && (
                      <div className="flex items-center gap-1.5 mt-1.5 pl-5">
                        <span className="text-[10px] text-primary">{chat.last_sender}:</span>
                        <p className="text-[10px] text-text-muted truncate flex-1">{chat.last_message}</p>
                      </div>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenamingChat(chat); setNewChatName(chat.title); }}
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-bg text-text-muted"
                    title={t("重命名", "Rename")}
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-3 py-2 border-t border-border">
          <button
            onClick={() => { setShowCreateGroup(true); loadEmployees(); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white text-xs rounded hover:opacity-90"
          >
            <UserPlus size={14} /> {t("创建群组", "Create group")}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="flex h-full">
      {/* 移动端遮罩层 */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* 桌面端内联侧边栏（可折叠） */}
      <div className={`hidden md:flex flex-col bg-bg-card border-r border-border shrink-0 transition-all duration-200 ${sidebarCollapsed ? "w-14" : "w-64"}`} style={{ position: "relative", overflow: "visible" }}>
        {/* 折叠按钮 */}
        <button
          data-testid="chat-sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-bg-card border border-border flex items-center justify-center text-text-muted hover:text-primary hover:border-primary z-20 shadow-sm transition-colors"
          title={sidebarCollapsed ? t("展开侧边栏", "Expand sidebar") : t("折叠侧边栏", "Collapse sidebar")}
        >
          <ChevronLeft size={12} className={`transition-transform duration-200 ${sidebarCollapsed ? "rotate-180" : ""}`} />
        </button>
        {renderSidebarContent(sidebarCollapsed)}
      </div>

      {/* 移动端抽屉侧边栏 */}
      <div className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-bg-card border-r border-border flex flex-col transition-transform duration-300 ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {renderSidebarContent(false)}
      </div>


      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            <div className="text-center px-4">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden mb-4 mx-auto flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs rounded hover:opacity-90"
              >
                <MessageCircle size={14} /> {t("打开列表", "Open list")}
              </button>
              <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t("选择员工开始单聊，或创建群组进行协作", "Choose an employee to start a direct chat, or create a group to collaborate.")}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-border bg-bg-card flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* 移动端打开侧边栏按钮 */}
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="md:hidden p-1.5 rounded hover:bg-bg text-text-muted shrink-0"
                  title={t("打开会话列表", "Open chat list")}
                >
                  <MessageCircle size={16} />
                </button>
                {/* 桌面端展开/收起按钮（折叠态时显示） */}
                {sidebarCollapsed && (
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="hidden md:flex p-1.5 rounded hover:bg-bg text-text-muted shrink-0"
                    title={t("展开侧边栏", "Expand sidebar")}
                  >
                    <PanelLeftOpen size={16} />
                  </button>
                )}
                {active.type === "single" ? <Bot size={16} className="text-primary shrink-0" /> : <Hash size={16} className="text-primary shrink-0" />}
                <h3 className="text-sm font-semibold text-text truncate">{active.title}</h3>
                <span className="text-[10px] text-text-muted px-2 py-1 rounded bg-bg shrink-0"><Users size={10} className="inline mr-1" />{active.member_count || 0}</span>
                <button
                  onClick={() => { setRenamingChat(active); setNewChatName(active.title); }}
                  className="p-1 rounded hover:bg-bg text-text-muted shrink-0"
                  title={t("重命名", "Rename")}
                >
                  <Edit2 size={12} />
                </button>
              </div>
              {active.type === "group" && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => { setShowMembersPanel(true); loadMembersForChat(active.id); }}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-text-muted bg-bg border border-border rounded hover:bg-bg-hover" title={t("成员管理", "Manage members")}>
                    <Users size={12} /> {t("成员", "Members")}
                  </button>
                  <button onClick={generateMinutes} disabled={generatingMinutes}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50">
                    {generatingMinutes ? <Loader2 size={12} className="animate-spin" /> : <ClipboardCheck size={12} />}
                    {t("会议纪要", "Meeting minutes")}
                  </button>
                </div>
              )}
            </div>

            {/* P22: 公告横幅 */}
            {active.type === "group" && active.announcement && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                <Megaphone size={14} className="text-amber-600 shrink-0" />
                <span className="text-xs text-amber-800 flex-1 truncate">{active.announcement}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditingAnnouncement(true); setAnnouncementText(active.announcement || ""); }}
                    className="text-[10px] text-amber-600 hover:text-amber-800 px-1.5 py-0.5 rounded hover:bg-amber-100">{t("编辑", "Edit")}</button>
                  <button onClick={() => saveAnnouncementWithClear()}
                    className="text-[10px] text-amber-400 hover:text-amber-600 px-1 py-0.5">×</button>
                </div>
              </div>
            )}
            {/* P22: 无公告时显示设置入口 */}
            {active.type === "group" && !active.announcement && (
              <button onClick={() => { setEditingAnnouncement(true); setAnnouncementText(""); }}
                className="px-5 py-1.5 text-[10px] text-text-muted hover:text-text hover:bg-bg flex items-center gap-1.5 border-b border-border">
                <Megaphone size={11} /> {t("设置群公告...", "Set group announcement...")}
              </button>
            )}

            {/* P22: 置顶消息 */}
            {active.type === "group" && active.pinned_message_id && (
              (() => {
                const pinnedMsg = messages.find(m => m.id === active.pinned_message_id);
                return pinnedMsg ? (
                  <div className="px-5 py-1.5 bg-primary/5 border-b border-border flex items-center gap-2">
                    <Pin size={12} className="text-primary shrink-0" />
                    <span className="text-[11px] text-text-muted truncate flex-1">
                      <span className="text-primary font-medium">{pinnedMsg.sender_name}:</span> {pinnedMsg.content.substring(0, 80)}
                    </span>
                    <button onClick={() => togglePin(active.pinned_message_id!)}
                      className="text-[10px] text-text-muted hover:text-text px-1">{t("取消置顶", "Unpin")}</button>
                  </div>
                ) : null;
              })()
            )}

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {messages.map(msg => {
                const isUser = msg.sender_type === "user";
                const isThink = msg.message_type === "ai_think";
                const isSystem = msg.sender_type === "system";
                const color = isUser ? "var(--primary)" : getRoleColor(msg.sender_name || "");

                if (isThink) {
                  return (
                    <div key={msg.id} className="pl-10">
                      {renderMessageContent(msg)}
                    </div>
                  );
                }

                if (isSystem || msg.message_type === "meeting_minutes") {
                  return (
                    <div key={msg.id} className="py-2">
                      {renderMessageContent(msg)}
                    </div>
                  );
                }

                const isAssign = msg.message_type === "ai_assign";
                const isReview = msg.message_type === "ai_review";
                const isSummary = msg.message_type === "ai_summary";

                if (isAssign || isReview || isSummary) {
                  return (
                    <div key={msg.id} className="flex gap-3 py-2">
                      <div className="w-9 h-9 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: color }}>
                        <Bot size={14} />
                      </div>
                      <div className="max-w-[80%]">
                        <p className="text-[10px] mb-1 font-medium" style={{ color }}>{msg.sender_name}</p>
                        {renderMessageContent(msg)}
                      </div>
                    </div>
                  );
                }

                const isLong = !isUser && msg.content.length > 500;
                const isExpanded = expandedMsgs.has(msg.id);

                return (
                  <div key={msg.id} className={`group relative flex gap-3 ${isUser ? "flex-row-reverse" : ""} py-2 px-2 rounded hover:bg-bg/50`}>
                    <div className="w-9 h-9 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: isUser ? "var(--primary)" : color }}>
                      {isUser ? (user?.nickname?.[0] || t("我", "Me")) : <Bot size={14} />}
                    </div>
                    <div className={`max-w-[80%] ${isUser ? "items-end" : ""}`}>
                      {!isUser && msg.sender_name && <p className="text-[10px] mb-1 font-medium" style={{ color }}>{msg.sender_name}</p>}
                      <div className={`rounded px-3.5 py-2.5 text-sm leading-relaxed ${getMessageStyles(msg)} ${isLong && !isExpanded ? "max-h-[300px] overflow-hidden relative" : ""}`}>
                        {renderMessageContent(msg)}
                        {isLong && !isExpanded && (
                          <div className="absolute bottom-0 left-0 right-0 h-16 flex items-end justify-center pb-2" style={{ background: 'linear-gradient(to top, var(--bg-card, white) 0%, transparent 100%)' }}>
                            <button onClick={() => toggleExpand(msg.id)} className="text-xs text-primary hover:underline font-medium">
                              {t("展开全文 ↓", "Show full message ↓")}
                            </button>
                          </div>
                        )}
                      </div>
                      {isLong && isExpanded && (
                        <button onClick={() => toggleExpand(msg.id)} className="text-xs text-primary hover:underline mt-1 font-medium">
                          {t("收起 ↑", "Collapse ↑")}
                        </button>
                      )}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {msg.reactions.map((r, idx) => (
                            <button key={idx} onClick={() => handleReaction(msg.id, r.emoji)} className="flex items-center gap-1 px-2 py-1 rounded bg-bg border border-border hover:border-primary text-[10px]">
                              <span>{r.emoji}</span><span className="text-text-muted">{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={`absolute top-1 ${isUser ? "left-1" : "right-1"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-bg-card border border-border rounded-lg shadow-sm px-1 py-0.5`}>
                      <button onClick={() => handleCopy(msg)} className="p-1.5 rounded hover:bg-bg text-text-muted" title={t("复制", "Copy")}><Copy size={12} /></button>
                      <button onClick={() => handleForward(msg)} className="p-1.5 rounded hover:bg-bg text-text-muted" title={t("转发", "Forward")}><Forward size={12} /></button>
                      <button onClick={() => handleSaveKnowledge(msg)} disabled={savingKnowledge === msg.id} className="p-1.5 rounded hover:bg-bg text-text-muted disabled:opacity-50" title={t("存入知识库", "Save to knowledge")}>{savingKnowledge === msg.id ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}</button>
                      <button onClick={() => setShowExportMenu(showExportMenu === msg.id ? null : msg.id)} className="p-1.5 rounded hover:bg-bg text-text-muted" title={t("导出", "Export")}><Download size={12} /></button>
                      <button onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)} className="p-1.5 rounded hover:bg-bg text-text-muted" title={t("表情", "React")}><Smile size={12} /></button>
                      <button onClick={() => setReplyTo(msg)} className="p-1.5 rounded hover:bg-bg text-text-muted" title={t("回复", "Reply")}><Reply size={12} /></button>
                      {active.type === "group" && (
                        <>
                          <button onClick={() => togglePin(msg.id)} className="p-1.5 rounded hover:bg-bg text-text-muted" title={t("置顶", "Pin")}><Pin size={12} /></button>
                          <button onClick={() => deleteMessage(msg.id)} className="p-1.5 rounded hover:bg-bg text-red-400 hover:text-red-600" title={t("删除", "Delete")}><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                    {showReactions === msg.id && (
                      <div className={`absolute ${isUser ? "left-1" : "right-1"} top-9 bg-bg-card border border-border shadow-lg p-2 flex gap-1 z-10 rounded`}>
                        {QUICK_REACTIONS.map(emoji => (
                          <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="w-8 h-8 rounded hover:bg-bg flex items-center justify-center text-sm">{emoji}</button>
                        ))}
                      </div>
                    )}
                    {showExportMenu === msg.id && (
                      <div className={`absolute ${isUser ? "left-1" : "right-1"} top-9 bg-bg-card border border-border shadow-lg p-1 z-10 rounded`}>
                        <button onClick={() => { handleExportMsg(msg, "md"); setShowExportMenu(null); }} className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg rounded">{t("导出为 Markdown", "Export as Markdown")}</button>
                        <button onClick={() => { handleExportMsg(msg, "txt"); setShowExportMenu(null); }} className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg rounded">{t("导出为 TXT", "Export as TXT")}</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {sending && (
                <div className="flex gap-3 py-2 px-2">
                  <div className="w-9 h-9 rounded bg-gray-200 flex items-center justify-center"><Loader2 size={14} className="animate-spin text-text-muted" /></div>
                  <div className="flex items-center gap-2 text-xs text-text-muted"><span>{t("AI正在思考...", "AI is thinking...")}</span></div>
                </div>
              )}
              <div ref={msgEnd} />
            </div>

            <div className="px-4 py-3 border-t border-border bg-bg-card">
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-bg rounded">
                  <Reply size={12} className="text-text-muted" />
                  <span className="text-[11px] text-text-muted truncate flex-1">{t("回复 ", "Reply to ") + replyTo.sender_name + ": " + replyTo.content.substring(0, 50) + "..."}</span>
                  <button onClick={() => setReplyTo(null)} className="text-text-muted hover:text-text px-1.5">×</button>
                </div>
              )}
              <div className="flex items-end gap-2.5">
                <MentionInput
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  placeholder={t("输入消息... @成员可提及, AI员工将智能回复", "Write a message... mention members with @, and AI employees can reply intelligently")}
                  disabled={sending}
                  members={active.type === "group" ? chatMembers.map((m) => ({
                    id: m.id,
                    name: m.employee_name || m.user_name || "",
                    employee_name: m.employee_name,
                    user_name: m.user_name,
                    avatar_emoji: m.avatar_emoji,
                    employee_role: m.employee_role,
                    agent_type: m.agent_type,
                  })) : []}
                />
                <button onClick={handleSend} disabled={sending || !input.trim()} className="p-2.5 rounded bg-primary text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0">
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateGroup(false)}>
          <div className="bg-bg-card shadow-xl w-96 max-h-[80vh] flex flex-col rounded" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-text">{t("创建群组", "Create group")}</h2>
              <button onClick={() => setShowCreateGroup(false)} className="text-text-muted hover:text-text p-1.5 rounded hover:bg-bg"><X size={16} /></button>
            </div>
            <div className="px-5 py-3">
              <label className="block text-xs font-medium text-text mb-1.5">{t("群组名称", "Group name")}</label>
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder={t("可选，自动生成", "Optional; generated automatically")} className="w-full px-3 py-2.5 border border-border rounded text-sm outline-none focus:border-primary" />
            </div>
            <div className="px-5 pb-2"><p className="text-[11px] text-text-muted">{t("选择成员（可选AI员工和人类员工）", "Choose members (AI and human employees are supported)")}</p></div>
            <div className="flex-1 overflow-y-auto px-5 pb-3">
              <div className="space-y-1">
                {departments.map(dept => (
                  <div key={dept.id}>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium text-text-muted">
                      <Building2 size={10} />
                      <span>{dept.name}</span>
                    </div>
                    <div className="ml-4 space-y-0.5">
                      {dept.employees.map(emp => {
                        const selected = selectedEmployees.includes(emp.id);
                        return (
                          <button key={emp.id} onClick={() => toggleEmployee(emp.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded border transition-all text-left ${selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-bg"}`}>
                            <Avatar id={emp.id} name={emp.name} size={28} className="rounded" customSrc={emp.avatar_url || undefined} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-medium text-text truncate">{emp.name}</p>
                                {emp.employee_type === "ai" && (
                                  <span className="text-[8px] font-bold px-1 py-0.5 bg-emerald-500/10 text-emerald-500 rounded shrink-0">AI</span>
                                )}
                              </div>
                              <p className="text-[10px] text-text-muted truncate">{emp.role}</p>
                            </div>
                            {selected && <Check size={14} className="text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-border flex items-center justify-between">
              <p className="text-[11px] text-text-muted">{t("已选 ", "Selected ") + selectedEmployees.length + t(" 人", "")}</p>
              <div className="flex gap-2.5">
                <button onClick={() => setShowCreateGroup(false)} className="px-3.5 py-2 text-xs text-text-muted hover:bg-bg rounded">{t("取消", "Cancel")}</button>
                <button onClick={createGroup} disabled={selectedEmployees.length === 0} className="px-3.5 py-2 bg-primary text-white text-xs rounded font-medium hover:opacity-90 disabled:opacity-50">{t("创建群组", "Create group")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renamingChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRenamingChat(null)}>
          <div className="bg-bg-card shadow-xl w-80 p-5 rounded" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-text mb-3">{t("重命名会话", "Rename chat")}</h2>
            <input
              type="text"
              value={newChatName}
              onChange={e => setNewChatName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") renameChat(); }}
              className="w-full px-3 py-2.5 border border-border rounded text-sm outline-none focus:border-primary mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenamingChat(null)} className="px-3.5 py-2 text-xs text-text-muted hover:bg-bg rounded">{t("取消", "Cancel")}</button>
              <button onClick={renameChat} disabled={!newChatName.trim()} className="px-3.5 py-2 bg-primary text-white text-xs rounded font-medium hover:opacity-90 disabled:opacity-50">{t("确认", "Confirm")}</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImportModal(null)}>
          <div className="bg-bg-card shadow-xl w-96 p-5 rounded" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text">{t("导入知识库", "Import to knowledge")}</h2>
              <button onClick={() => setShowImportModal(null)} className="text-text-muted hover:text-text p-1 rounded hover:bg-bg"><X size={16} /></button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-text mb-1.5">{t("笔记标题", "Note title")}</label>
              <input
                type="text"
                value={importKnowledgeTitle}
                onChange={e => setImportKnowledgeTitle(e.target.value)}
                placeholder={t("会议纪要_" + new Date().toISOString().slice(0, 10) + "_讨论", "meeting-minutes_" + new Date().toISOString().slice(0, 10) + "_discussion")}
                className="w-full px-3 py-2.5 border border-border rounded text-sm outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div className="mb-4 p-3 bg-bg rounded text-xs text-text-muted max-h-32 overflow-y-auto">
              {showImportModal.content.substring(0, 200)}...
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImportModal(null)} className="px-3.5 py-2 text-xs text-text-muted hover:bg-bg rounded">{t("取消", "Cancel")}</button>
              <button onClick={() => importToKnowledge(showImportModal.messageId)} disabled={importingKnowledge === showImportModal.messageId}
                className="px-3.5 py-2 bg-purple-600 text-white text-xs rounded font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
                {importingKnowledge === showImportModal.messageId ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                {t("导入", "Import")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal — search employees & existing chats */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setForwardMsg(null); setForwardSearch(""); setForwardResults([]); }}>
          <div className="bg-bg-card shadow-xl w-96 max-h-[80vh] flex flex-col rounded-lg" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-sm font-bold text-text">{t("转发消息", "Forward message")}</h2>
              <button onClick={() => { setForwardMsg(null); setForwardSearch(""); setForwardResults([]); }} className="p-1 rounded hover:bg-bg text-text-muted"><X size={16} /></button>
            </div>
            <div className="p-3 bg-bg border-b border-border shrink-0">
              <div className="text-xs text-text-muted mb-2 max-h-16 overflow-y-auto line-clamp-2">{forwardMsg.content.substring(0, 150)}</div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  autoFocus
                  value={forwardSearch}
                  onChange={e => {
                    const q = e.target.value;
                    setForwardSearch(q);
                    if (!q.trim()) { setForwardResults([]); return; }
                    const lower = q.toLowerCase();
                    setForwardResults(employees.filter(emp =>
                      emp.name.toLowerCase().includes(lower) ||
                      (emp.role || "").toLowerCase().includes(lower) ||
                      (emp.agent_type || "").toLowerCase().includes(lower)
                    ));
                  }}
                  placeholder={t("搜索员工姓名、角色...", "Search employee name or role...")}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded border border-border bg-white focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {forwardSearch.trim() ? (
                forwardResults.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">{t("未找到匹配的员工", "No matching employees")}</p>
                ) : (
                  forwardResults.map(emp => (
                    <button
                      key={emp.id}
                      disabled={forwarding}
                      onClick={async () => { setForwarding(true); await forwardToEmployee(emp); setForwarding(false); }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-bg text-xs flex items-center gap-2.5 disabled:opacity-50"
                    >
                      <Avatar id={emp.id} name={emp.name} size={28} className="rounded shrink-0" customSrc={emp.avatar_url || undefined} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-text truncate">{emp.name}</span>
                          {emp.employee_type === "ai" && (
                            <span className="text-[8px] font-bold px-1 py-0.5 bg-emerald-500/10 text-emerald-500 rounded shrink-0">AI</span>
                          )}
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${emp.is_online ? "bg-green-500" : "bg-gray-300"}`} />
                        </div>
                        <p className="text-[10px] text-text-muted truncate">{emp.role || emp.agent_type || ""}</p>
                      </div>
                    </button>
                  ))
                )
              ) : (
                <>
                  <p className="text-[10px] text-text-muted px-2 pt-1 pb-0.5">{t("最近会话", "Recent chats")}</p>
                  {chats.filter(c => c.id !== active?.id).slice(0, 10).map(chat => (
                    <button
                      key={chat.id}
                      disabled={forwarding}
                      onClick={async () => { setForwarding(true); await doForward(chat.id, chat.title); setForwarding(false); }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-bg text-xs flex items-center gap-2 disabled:opacity-50"
                    >
                      {chat.type === "single" ? <Bot size={12} className="text-text-muted shrink-0" /> : <Hash size={12} className="text-text-muted shrink-0" />}
                      <span className="truncate">{chat.title}</span>
                    </button>
                  ))}
                  {chats.length <= 1 && <p className="text-xs text-text-muted text-center py-2">{t("暂无其他会话，上方搜索员工直接转发", "No other chats. Search for an employee above to forward directly.")}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* P22: 成员管理面板 */}
      {showMembersPanel && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowMembersPanel(false)}>
          <div className="bg-bg-card shadow-xl w-96 max-h-[80vh] flex flex-col rounded" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <h2 className="text-sm font-bold text-text">{t("群成员", "Group members")} ({chatMembers.length})</h2>
              </div>
              <button onClick={() => setShowMembersPanel(false)} className="text-text-muted hover:text-text p-1.5 rounded hover:bg-bg"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="space-y-1.5">
                {chatMembers.map(m => {
                  const isAdmin = m.role === "admin";
                  const name = m.user_name || m.employee_name || t("未知", "Unknown");
                  const role = m.employee_role || t("成员", "Member");
                  const isMe = m.user_id === user?.id;
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-bg">
                      <div className={`w-9 h-9 rounded flex items-center justify-center text-white text-xs font-bold shrink-0 ${isAdmin ? "bg-amber-500" : "bg-gray-400"}`}>
                        {name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-text truncate">{name}</span>
                          {isAdmin && <Shield size={10} className="text-amber-500 shrink-0" />}
                          {isMe && <span className="text-[9px] text-text-muted bg-bg px-1 rounded shrink-0">{t("我", "Me")}</span>}
                        </div>
                        <span className="text-[10px] text-text-muted">{role}</span>
                      </div>
                      {!isMe && (
                        <button onClick={() => toggleAdmin(m.id, m.role)}
                          className={`text-[10px] px-2 py-1 rounded ${isAdmin ? "text-amber-600 hover:bg-amber-50" : "text-text-muted hover:bg-bg"}`}>
                          {isAdmin ? t("取消管理", "Remove admin") : t("设为管理", "Make admin")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* P22: 公告编辑弹窗 */}
      {editingAnnouncement && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingAnnouncement(false)}>
          <div className="bg-bg-card shadow-xl w-96 p-5 rounded" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-amber-500" />
                <h2 className="text-sm font-bold text-text">{t("编辑群公告", "Edit group announcement")}</h2>
              </div>
              <button onClick={() => setEditingAnnouncement(false)} className="text-text-muted hover:text-text p-1 rounded hover:bg-bg"><X size={16} /></button>
            </div>
            <textarea value={announcementText} onChange={e => setAnnouncementText(e.target.value)}
              placeholder={t("输入群公告内容...", "Write a group announcement...")}
              className="w-full h-24 px-3 py-2.5 border border-border rounded text-sm outline-none focus:border-primary resize-none mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingAnnouncement(false)} className="px-3.5 py-2 text-xs text-text-muted hover:bg-bg rounded">{t("取消", "Cancel")}</button>
              <button onClick={saveAnnouncement} className="px-3.5 py-2 bg-amber-500 text-white text-xs rounded font-medium hover:bg-amber-600">{t("保存公告", "Save announcement")}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

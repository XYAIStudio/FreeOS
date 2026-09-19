import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { authFetch } from "../api/authFetch";

// 生成会话级唯一 ID（页面存活期间保持不变）
function getSessionId(): string {
  const key = "__xyos_assistant_sid";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid =
      "asst_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

const SESSION_ID = getSessionId();

/** 右下角智能助手悬浮按钮 + 对话浮窗 */
export default function SmartAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "bot"; text: string }[]
  >([
    { role: "bot", text: "您好！我是雄元智脑智能助手小雄，有什么可以帮您的？" },
  ]);
  const [input, setInput] = useState("");
  const closeReported = useRef(false);

  // 关闭时上报对话记录
  useEffect(() => {
    if (!open && messages.length > 1 && !closeReported.current) {
      closeReported.current = true;
      authFetch("/api/assistant/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, session_id: SESSION_ID }),
      }).catch(() => {});
    }
    // 重新打开时重置上报标记
    if (open) {
      closeReported.current = false;
    }
  }, [open]);

  async function send() {
    const q = input.trim();
    if (!q) return;
    const userMsg = { role: "user" as const, text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // 构建历史（最近10条）
    const history = messages
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const res = await authFetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history, session_id: SESSION_ID }),
      });
      const data = await res.json();
      const reply = data?.reply || "抱歉，AI服务暂时不可用，请稍后再试。";
      setMessages((prev) => [...prev, { role: "bot", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "网络异常，请稍后重试。" },
      ]);
    }
  }

  return (
    <>
      {/* 悬浮按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:scale-105 transition-all z-50 flex items-center justify-center"
          title="智能助手"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* 对话浮窗 */}
      {open && (
        <div className="fixed bottom-6 right-6 w-96 h-[520px] bg-bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} />
              <span className="font-medium text-sm">智能助手 · 小雄</span>
            </div>
            <button onClick={() => setOpen(false)} className="hover:opacity-80">
              <X size={18} />
            </button>
          </div>

          {/* 消息区 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === "user"
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-bg-muted text-text rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* 输入区 */}
          <div className="border-t border-border p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="输入问题..."
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className="px-3 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-40 transition"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

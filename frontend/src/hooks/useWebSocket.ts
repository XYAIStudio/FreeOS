import { useEffect, useRef, useCallback } from "react";

type WsEventType =
  | "new_message"
  | "message_deleted"
  | "message_pinned"
  | "announcement_updated"
  | "member_role_changed"
  | "typing"
  | "connected";

interface WsMessage {
  type: WsEventType;
  chatId: number;
  [key: string]: any;
}

type Handler = (msg: WsMessage) => void;

function getWsConnection(): { url: string; protocols: string[] } | null {
  if (typeof window === "undefined") return null;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  const token = localStorage.getItem("token");
  if (!token) return null;
  // JWT must never be placed in a URL: reverse-proxy access logs, browser
  // history and telemetry can retain query strings. The protocol header is
  // available to the WebSocket handshake but is not part of the request URI.
  return { url: `${protocol}://${host}/ws`, protocols: [`xyos-auth.${token}`] };
}

let globalWs: WebSocket | null = null;
let globalHandlers: Map<string, Handler> = new Map();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let handlerIdCounter = 0;

function connectGlobal() {
  if (globalWs?.readyState === WebSocket.OPEN || globalWs?.readyState === WebSocket.CONNECTING) return;

  try {
    const connection = getWsConnection();
    if (!connection) return;
    globalWs = new WebSocket(connection.url, connection.protocols);
  } catch {
    scheduleReconnect();
    return;
  }

  globalWs.onopen = () => {
    globalHandlers.forEach((h) => h({ type: "connected", chatId: 0 }));
  };

  globalWs.onmessage = (event) => {
    try {
      const msg: WsMessage = JSON.parse(event.data);
      globalHandlers.forEach((h) => h(msg));
    } catch {}
  };

  globalWs.onclose = () => {
    globalWs = null;
    scheduleReconnect();
  };

  globalWs.onerror = () => {
    globalWs?.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectGlobal();
  }, 5000);
}

/**
 * 群聊 WebSocket Hook
 * 自动连接全局 WebSocket，返回按 chatId 过滤的回调注册
 *
 * @param chatId - 当前活跃群聊 ID（null 表示不订阅）
 * @param onMessage - 收到消息时回调
 */
export function useChatWebSocket(chatId: number | null, onMessage: Handler) {
  const handlerIdRef = useRef<string>("");
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!chatId) return;

    // 确保全局连接
    connectGlobal();

    // 注册处理器
    const id = `chat_ws_${++handlerIdCounter}`;
    handlerIdRef.current = id;
    globalHandlers.set(id, (msg) => {
      if (!msg.chatId || msg.chatId === chatId) {
        onMessageRef.current(msg);
      }
    });

    return () => {
      globalHandlers.delete(id);
    };
  }, [chatId]);
}

/**
 * 发送 WebSocket 消息
 */
export function sendWsMessage(data: object) {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(data));
  }
}

/**
 * 主动断开 WebSocket（用于登出等场景）
 */
export function disconnectWs() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  globalWs?.close();
  globalWs = null;
}

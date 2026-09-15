import { create } from "zustand";
import { authFetch } from "../api/authFetch";

interface User {
  id: number;
  email: string;
  nickname: string;
  role: string;
  tenant_id: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => void;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  loading: true,

      login: async (email, password) => {
        const res = await authFetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const body = await res.text();
        if (!body) throw new Error("后端服务未连接，请先启动 API 服务");
        let data: any;
        try { data = JSON.parse(body); } catch { throw new Error("后端返回了无法识别的响应"); }
        if (!res.ok || !data.success) throw new Error(data.error || "登录失败");
        const token = data.data.tokens?.accessToken || data.data.token;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(data.data.user));
        set({ user: data.data.user, token });
        // 记录登录事件
        authFetch("/api/admin/visitor-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type: "login", user_id: data.data.user.id, tenant_id: data.data.user.tenant_id }),
        }).catch(() => {});
      },

      register: async (email, password, nickname) => {
        const res = await authFetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, nickname }),
        });
        const body = await res.text();
        if (!body) throw new Error("后端服务未连接，请先启动 API 服务");
        let data: any;
        try { data = JSON.parse(body); } catch { throw new Error("后端返回了无法识别的响应"); }
        if (!res.ok || !data.success) throw new Error(data.error || "登录失败");
        localStorage.setItem("token", data.data.token);
        localStorage.setItem("user", JSON.stringify(data.data.user));
        set({ user: data.data.user, token: data.data.token });
        // 记录注册事件
        authFetch("/api/admin/visitor-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type: "register", user_id: data.data.user.id, tenant_id: data.data.user.tenant_id }),
        }).catch(() => {});
      },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ user: null, token: null });
  },

  init: () => {
    try {
      const raw = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      if (raw && token) {
        set({ user: JSON.parse(raw), token, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },
}));

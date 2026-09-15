// __API_BASE__ is injected by HarmonyOS WebView at runtime.
// In browser dev mode, Vite proxy handles /api → backend.
declare global {
  interface Window {
    __API_BASE__?: string;
  }
}

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;

  const apiBase = (typeof window !== "undefined" && window.__API_BASE__) || "";
  const fullUrl = apiBase && !url.startsWith("http") ? apiBase + url : url;

  const headers: Record<string, string> = isFormData
    ? { ...((options.headers as Record<string, string>) || {}) }
    : {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
      };

  headers["Accept-Language"] = localStorage.getItem("openxyos.locale") === "en" ? "en" : "zh-CN";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(fullUrl, { ...options, headers, credentials: "include" });
}

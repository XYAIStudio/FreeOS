// __API_BASE__ is injected by HarmonyOS WebView at runtime.
// In browser dev mode, Vite proxy handles /api → backend.
declare global {
  interface Window {
    __API_BASE__?: string;
  }
}

const freeosOrganization =
  import.meta.env.VITE_FREEOS_ORG_INTEGRATED === "true";

function organizationUrl(url: string): string {
  if (!freeosOrganization || !url.startsWith("/api/")) return url;
  // The organization room keeps its own guestbook. Proxy same-origin
  // through /organization-app so studio credentials never gate this door.
  return `/organization-app${url}`;
}

export function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;

  const apiBase = (typeof window !== "undefined" && window.__API_BASE__) || "";
  const mappedUrl = organizationUrl(url);
  const fullUrl =
    apiBase && !mappedUrl.startsWith("http") ? apiBase + mappedUrl : mappedUrl;

  const headers: Record<string, string> = isFormData
    ? { ...((options.headers as Record<string, string>) || {}) }
    : {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
      };

  headers["Accept-Language"] =
    localStorage.getItem("openxyos.locale") === "en" ? "en" : "zh-CN";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(fullUrl, { ...options, headers, credentials: "include" });
}

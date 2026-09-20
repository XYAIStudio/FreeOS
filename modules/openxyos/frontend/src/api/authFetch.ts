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
  // FreeOS owns paid services such as creation, governance, and code export.
  // The bundled OpenXYOS instance remains the user's local, self-owned test
  // environment, so its account, registration, and business APIs must never
  // be gated by a FreeOS account. Keep them on the same origin through the
  // private sidecar proxy rather than exposing its loopback port.
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

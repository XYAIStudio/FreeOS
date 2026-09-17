export const DEFAULT_ORG_URL = "http://127.0.0.1:3780/";
export const OPENXYOS_OPEN_TAB = "openxyos:open-tab";
export const OPENXYOS_NAVIGATED = "openxyos:navigated";
export const FREEOS_EMBED_PARAM = "freeos_embed";
export const FREEOS_DISABLED_PARAM = "freeos_disabled";
export const FREEOS_SYNC_PARAM = "freeos_sync";

export type OrgBrowserTab = {
  id: string;
  url: string;
  title: string;
  /** Last URL assigned to the iframe src (not updated by in-page SPA nav). */
  srcUrl: string;
};

export function nextOrgTabId(now = Date.now(), nonce = Math.random()): string {
  return `org-tab-${now.toString(36)}-${nonce.toString(36).slice(2, 8)}`;
}

export function originOf(url: string): string {
  return new URL(url).origin;
}

export function sidecarOriginOf(sidecarUrl: string): string {
  try {
    return originOf(sidecarUrl.includes("://") ? sidecarUrl : DEFAULT_ORG_URL);
  } catch {
    return originOf(DEFAULT_ORG_URL);
  }
}

export function isHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeOrgUrl(
  raw: string,
  fallback = DEFAULT_ORG_URL,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fallback;
    }
    return parsed.href;
  } catch {
    return fallback;
  }
}

export function isSidecarOriginUrl(
  url: string,
  sidecarOrigin: string,
): boolean {
  try {
    return originOf(url) === sidecarOrigin.replace(/\/$/, "");
  } catch {
    return false;
  }
}

export function tabTitleFromUrl(url: string, homeTitle: string): string {
  try {
    const host = new URL(url).hostname;
    if (host === "127.0.0.1" || host === "localhost" || host === "[::1]") {
      return homeTitle;
    }
    return host || homeTitle;
  } catch {
    return homeTitle;
  }
}

export function stripEmbedParams(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete(FREEOS_EMBED_PARAM);
    parsed.searchParams.delete(FREEOS_DISABLED_PARAM);
    parsed.searchParams.delete(FREEOS_SYNC_PARAM);
    return parsed.href;
  } catch {
    return url;
  }
}

export function buildEmbedSrc(
  url: string,
  opts: {
    sidecarOrigin: string;
    disabledKeys: string[];
    nonce: string;
  },
): string {
  const parsed = new URL(normalizeOrgUrl(url));
  if (!isSidecarOriginUrl(parsed.href, opts.sidecarOrigin)) {
    return parsed.href;
  }
  parsed.searchParams.set(FREEOS_EMBED_PARAM, "1");
  if (opts.disabledKeys.length) {
    parsed.searchParams.set(FREEOS_DISABLED_PARAM, opts.disabledKeys.join(","));
  } else {
    parsed.searchParams.delete(FREEOS_DISABLED_PARAM);
  }
  if (opts.nonce) {
    parsed.searchParams.set(FREEOS_SYNC_PARAM, opts.nonce);
  } else {
    parsed.searchParams.delete(FREEOS_SYNC_PARAM);
  }
  return parsed.href;
}

export function iframeSandboxFor(
  url: string,
  sidecarOrigin: string,
): string | undefined {
  if (isSidecarOriginUrl(url, sidecarOrigin)) return undefined;
  return "allow-scripts allow-same-origin allow-forms allow-downloads allow-modals";
}

export function parseOrgOpenTabMessage(
  data: unknown,
): { url: string; title?: string } | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { type?: unknown; url?: unknown; title?: unknown };
  if (row.type !== OPENXYOS_OPEN_TAB) return null;
  if (typeof row.url !== "string") return null;
  const url = normalizeOrgUrl(row.url, "");
  if (!url || !isHttpUrl(url)) return null;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  return title ? { url, title } : { url };
}

export function parseOrgNavigatedMessage(
  data: unknown,
): { url: string; title?: string } | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { type?: unknown; url?: unknown; title?: unknown };
  if (row.type !== OPENXYOS_NAVIGATED) return null;
  if (typeof row.url !== "string") return null;
  const url = stripEmbedParams(normalizeOrgUrl(row.url, ""));
  if (!url || !isHttpUrl(url)) return null;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  return title ? { url, title } : { url };
}

export function openOrgTab(
  tabs: OrgBrowserTab[],
  url: string,
  title: string,
  reuse = true,
): { tabs: OrgBrowserTab[]; activeId: string } {
  const href = normalizeOrgUrl(url);
  if (reuse) {
    const existing = tabs.find((tab) => tab.url === href);
    if (existing) {
      return { tabs, activeId: existing.id };
    }
  }
  const tab: OrgBrowserTab = {
    id: nextOrgTabId(),
    url: href,
    title: title || tabTitleFromUrl(href, "openXYOS"),
    srcUrl: href,
  };
  return { tabs: [...tabs, tab], activeId: tab.id };
}

export function closeOrgTab(
  tabs: OrgBrowserTab[],
  activeId: string,
  tabId: string,
): { tabs: OrgBrowserTab[]; activeId: string } {
  if (tabs.length <= 1) return { tabs, activeId };
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) return { tabs, activeId };
  const next = tabs.filter((tab) => tab.id !== tabId);
  if (activeId !== tabId) return { tabs: next, activeId };
  const fallback = next[Math.min(index, next.length - 1)];
  return { tabs: next, activeId: fallback?.id ?? activeId };
}

export function navigateOrgTab(
  tabs: OrgBrowserTab[],
  tabId: string,
  url: string,
  title: string,
  reload = true,
): OrgBrowserTab[] {
  const href = normalizeOrgUrl(url);
  return tabs.map((tab) =>
    tab.id === tabId
      ? {
          ...tab,
          url: href,
          title: title || tab.title,
          srcUrl: reload ? href : tab.srcUrl,
        }
      : tab,
  );
}

export function createHomeTab(
  sidecarUrl: string,
  title: string,
): OrgBrowserTab {
  const url = normalizeOrgUrl(sidecarUrl || DEFAULT_ORG_URL);
  return {
    id: "org-home",
    url,
    title,
    srcUrl: url,
  };
}

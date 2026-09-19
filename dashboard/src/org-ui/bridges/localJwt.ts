/** Standalone IdentityBridge: local JWT, distinct from the Dashboard session. */

import type {
  IdentityBridge,
  OrgFetcher,
  OrgLocale,
  OrgSession,
  ShellAdapter,
} from "../shell";

/** Must not reuse Dashboard `auth_token` — standalone keeps its own session. */
export const STANDALONE_TOKEN_KEY = "openxyos.standalone.jwt";
export const STANDALONE_SESSION_KEY = "openxyos.standalone.session";

export class StandaloneUnauthorizedError extends Error {
  constructor(message = "standalone session expired") {
    super(message);
    this.name = "StandaloneUnauthorizedError";
  }
}

export interface LocalJwtStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalJwtBridge extends ShellAdapter {
  setSession(token: string, session: OrgSession): void;
  clearSession(): void;
  hasToken(): boolean;
}

const EMPTY_SESSION: OrgSession = {
  userId: 0,
  displayName: "",
  role: "user",
  isAdmin: false,
};

function memoryStorage(): LocalJwtStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function defaultStorage(): LocalJwtStorage {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    /* private mode / SSR */
  }
  return memoryStorage();
}

function readSession(storage: LocalJwtStorage): OrgSession {
  const raw = storage.getItem(STANDALONE_SESSION_KEY);
  if (!raw) return EMPTY_SESSION;
  try {
    const parsed = JSON.parse(raw) as Partial<OrgSession>;
    return {
      userId: Number(parsed.userId || 0),
      displayName: String(parsed.displayName || ""),
      role: String(parsed.role || "user"),
      isAdmin: Boolean(parsed.isAdmin),
    };
  } catch {
    return EMPTY_SESSION;
  }
}

/**
 * Local-JWT IdentityBridge for `freeos org export-standalone`.
 * Token key is `openxyos.standalone.jwt` — never Dashboard `auth_token`.
 */
export function createLocalJwtBridge(opts?: {
  apiBase?: string;
  locale?: OrgLocale;
  timeZone?: string;
  storage?: LocalJwtStorage;
  navigate?: (path: string) => void;
}): LocalJwtBridge {
  const storage = opts?.storage ?? defaultStorage();
  const apiBase = (opts?.apiBase || "/api").replace(/\/$/, "");
  const locale = opts?.locale ?? "en";
  const timeZone = opts?.timeZone ?? "Asia/Shanghai";
  const navigate = opts?.navigate ?? (() => undefined);

  const bridge: LocalJwtBridge = {
    locale,
    timeZone,
    showHostActions: false,
    navigate,
    apiBase() {
      return apiBase;
    },
    getSession() {
      return readSession(storage);
    },
    authHeaders() {
      const headers: Record<string, string> = {};
      const token = storage.getItem(STANDALONE_TOKEN_KEY) || "";
      if (token) headers.Authorization = `Bearer ${token}`;
      return headers;
    },
    setSession(token, session) {
      storage.setItem(STANDALONE_TOKEN_KEY, token);
      storage.setItem(STANDALONE_SESSION_KEY, JSON.stringify(session));
    },
    clearSession() {
      storage.removeItem(STANDALONE_TOKEN_KEY);
      storage.removeItem(STANDALONE_SESSION_KEY);
    },
    hasToken() {
      return Boolean(storage.getItem(STANDALONE_TOKEN_KEY));
    },
  };
  return bridge;
}

/** `createOrgApiClient` adapter: same-origin `/api` + standalone Bearer token. */
export function createBridgeFetcher(bridge: IdentityBridge): OrgFetcher {
  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const base = bridge.apiBase().replace(/\/$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    const headers = new Headers(init?.headers);
    for (const [key, value] of Object.entries(bridge.authHeaders())) {
      if (!headers.has(key)) headers.set(key, value);
    }
    const response = await fetch(`${base}${suffix}`, { ...init, headers });
    if (response.status === 401) {
      throw new StandaloneUnauthorizedError();
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Request failed: ${response.status} ${response.statusText}${
          text ? ` - ${text}` : ""
        }`,
      );
    }
    if (response.status === 204) {
      return undefined as T;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return (await response.text()) as unknown as T;
    }
    return (await response.json()) as T;
  };
}

export function sessionFromLoginUser(user: {
  id?: number;
  username?: string;
  display_name?: string;
  role?: string;
}): OrgSession {
  const role = user.role || "user";
  return {
    userId: Number(user.id || 0),
    displayName: user.display_name || user.username || "",
    role,
    isAdmin: role === "admin",
  };
}

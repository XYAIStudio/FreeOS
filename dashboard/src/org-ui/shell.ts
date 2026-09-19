/** Identity + shell contracts for embedded Dashboard and standalone export. */

export type OrgLocale = "zh" | "en";

export interface OrgSession {
  userId: number;
  displayName: string;
  role: string;
  isAdmin: boolean;
}

export interface IdentityBridge {
  getSession(): OrgSession;
  authHeaders(): Record<string, string>;
  apiBase(): string;
}

export interface ShellAdapter extends IdentityBridge {
  locale: OrgLocale;
  timeZone: string;
  navigate(path: string): void;
  /** Host-only actions (loop / assemble) stay off in standalone export. */
  showHostActions: boolean;
}

export type OrgFetcher = <T>(path: string, init?: RequestInit) => Promise<T>;

import type { OrgFetcher } from "../shell";

export type AnnouncementType = "notice" | "policy" | "news" | "emergency";
export type AnnouncementPriority = "low" | "normal" | "important" | "urgent";

export interface Announcement {
  id: number;
  title: string;
  content: string;
  type: AnnouncementType | string;
  priority: AnnouncementPriority | string;
  is_pinned: number;
  is_read?: boolean;
  read_count?: number;
  total_users?: number;
  read_percent?: number;
  published_at: string;
  expires_at: string | null;
  creator_name?: string;
  created_at?: string;
  updated_at?: string | null;
}

export interface AnnouncementListData {
  list: Announcement[];
  total: number;
  page: number;
  limit: number;
}

export interface AnnouncementWrite {
  title: string;
  content: string;
  type: string;
  priority: string;
  is_pinned: boolean | number;
  expires_at: string | null;
}

export interface OrgEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface OrgAnnouncementsClient {
  list(params: {
    page: number;
    limit: number;
    type: string;
    search?: string;
  }): Promise<AnnouncementListData>;
  get(id: number): Promise<Announcement>;
  unread(): Promise<{ count: number }>;
  markRead(id: number): Promise<void>;
  markAllRead(): Promise<{ marked: number }>;
  create(body: AnnouncementWrite): Promise<Announcement>;
  update(id: number, body: AnnouncementWrite): Promise<Announcement>;
  remove(id: number): Promise<void>;
  togglePin(id: number): Promise<{ is_pinned: boolean }>;
  pinned(): Promise<Announcement[]>;
}

export interface OrgApiClient {
  announcements: OrgAnnouncementsClient;
}

async function unwrap<T>(payload: OrgEnvelope<T>): Promise<T> {
  if (!payload.success) {
    throw new Error(payload.error || "request failed");
  }
  return payload.data as T;
}

/**
 * Factory used by Dashboard (FreeOS JWT via `request`) and standalone export.
 * Default prefix matches the in-host BFF; standalone can pass `/announcements`.
 */
export function createOrgApiClient(opts: {
  fetchJson: OrgFetcher;
  announcementsPrefix?: string;
}): OrgApiClient {
  const prefix = opts.announcementsPrefix ?? "/org-module/announcements";
  const fetchJson = opts.fetchJson;

  const announcements: OrgAnnouncementsClient = {
    async list(params) {
      const query = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        type: params.type,
      });
      if (params.search) query.set("search", params.search);
      return unwrap(
        await fetchJson<OrgEnvelope<AnnouncementListData>>(
          `${prefix}?${query.toString()}`,
        ),
      );
    },
    async get(id) {
      return unwrap(
        await fetchJson<OrgEnvelope<Announcement>>(`${prefix}/${id}`),
      );
    },
    async unread() {
      return unwrap(
        await fetchJson<OrgEnvelope<{ count: number }>>(
          `${prefix}/action/unread`,
        ),
      );
    },
    async markRead(id) {
      await unwrap(
        await fetchJson<OrgEnvelope<undefined>>(`${prefix}/${id}/read`, {
          method: "POST",
        }),
      );
    },
    async markAllRead() {
      return unwrap(
        await fetchJson<OrgEnvelope<{ marked: number }>>(`${prefix}/read-all`, {
          method: "POST",
        }),
      );
    },
    async create(body) {
      return unwrap(
        await fetchJson<OrgEnvelope<Announcement>>(prefix, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
    async update(id, body) {
      return unwrap(
        await fetchJson<OrgEnvelope<Announcement>>(`${prefix}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
    async remove(id) {
      await unwrap(
        await fetchJson<OrgEnvelope<undefined>>(`${prefix}/${id}`, {
          method: "DELETE",
        }),
      );
    },
    async togglePin(id) {
      return unwrap(
        await fetchJson<OrgEnvelope<{ is_pinned: boolean }>>(
          `${prefix}/${id}/toggle-pin`,
          { method: "PUT" },
        ),
      );
    },
    async pinned() {
      return unwrap(
        await fetchJson<OrgEnvelope<Announcement[]>>(`${prefix}/pinned`),
      );
    },
  };

  return { announcements };
}

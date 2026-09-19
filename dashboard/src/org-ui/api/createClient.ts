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

export interface OrgEmployee {
  id: number;
  name: string;
  role: string;
  description?: string;
  employee_type: string;
  agent_type?: string | null;
  skills?: string;
  avatar_emoji?: string;
  department_id: number;
  department_name?: string | null;
  status: string;
  is_online?: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface OrgDepartment {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  description?: string;
  department_code?: string | null;
  function_type?: string;
  level?: number;
  children?: OrgDepartment[];
  employees?: OrgEmployee[];
}

export interface DepartmentWrite {
  name?: string;
  parent_id?: number | null;
  sort_order?: number;
  description?: string;
  department_code?: string | null;
  function_type?: string;
  level?: number;
}

export interface EmployeeWrite {
  name?: string;
  department_id?: number;
  role?: string;
  description?: string;
  employee_type?: string;
  agent_type?: string | null;
  skills?: string;
  avatar_emoji?: string;
  status?: string;
}

export interface OrgChartClient {
  tree(): Promise<OrgDepartment[]>;
  listDepartments(): Promise<OrgDepartment[]>;
  createDepartment(body: DepartmentWrite): Promise<OrgDepartment>;
  updateDepartment(id: number, body: DepartmentWrite): Promise<OrgDepartment>;
  removeDepartment(id: number): Promise<void>;
  createEmployee(body: EmployeeWrite): Promise<OrgEmployee>;
  updateEmployee(id: number, body: EmployeeWrite): Promise<OrgEmployee>;
  removeEmployee(id: number): Promise<void>;
}

export interface EmployeeListParams {
  type?: string;
  department_id?: number;
  status?: string;
  search?: string;
}

export interface EmployeeStats {
  total: number;
  ai: number;
  human: number;
  byDepartment: { department: string; count: number }[];
  byRole: { role: string; count: number }[];
}

export interface OrgEmployeesClient {
  list(params?: EmployeeListParams): Promise<OrgEmployee[]>;
  get(id: number): Promise<OrgEmployee>;
  stats(): Promise<EmployeeStats>;
  listDepartments(): Promise<OrgDepartment[]>;
  create(body: EmployeeWrite): Promise<OrgEmployee>;
  update(id: number, body: EmployeeWrite): Promise<OrgEmployee>;
  remove(id: number): Promise<void>;
}

export interface OrgApiClient {
  announcements: OrgAnnouncementsClient;
  org: OrgChartClient;
  employees: OrgEmployeesClient;
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
  orgPrefix?: string;
}): OrgApiClient {
  const prefix = opts.announcementsPrefix ?? "/org-module/announcements";
  const orgPrefix = opts.orgPrefix ?? "/org-module/org";
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

  const org: OrgChartClient = {
    async tree() {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgDepartment[]>>(`${orgPrefix}/tree`),
      );
    },
    async listDepartments() {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgDepartment[]>>(
          `${orgPrefix}/departments`,
        ),
      );
    },
    async createDepartment(body) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgDepartment>>(
          `${orgPrefix}/departments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
      );
    },
    async updateDepartment(id, body) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgDepartment>>(
          `${orgPrefix}/departments/${id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
      );
    },
    async removeDepartment(id) {
      await unwrap(
        await fetchJson<OrgEnvelope<undefined>>(
          `${orgPrefix}/departments/${id}`,
          { method: "DELETE" },
        ),
      );
    },
    async createEmployee(body) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgEmployee>>(`${orgPrefix}/employees`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
    async updateEmployee(id, body) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgEmployee>>(
          `${orgPrefix}/employees/${id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
      );
    },
    async removeEmployee(id) {
      await unwrap(
        await fetchJson<OrgEnvelope<undefined>>(
          `${orgPrefix}/employees/${id}`,
          { method: "DELETE" },
        ),
      );
    },
  };

  const employees: OrgEmployeesClient = {
    async list(params = {}) {
      const query = new URLSearchParams();
      if (params.type) query.set("type", params.type);
      if (params.department_id != null) {
        query.set("department_id", String(params.department_id));
      }
      if (params.status) query.set("status", params.status);
      if (params.search) query.set("search", params.search);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return unwrap(
        await fetchJson<OrgEnvelope<OrgEmployee[]>>(
          `${orgPrefix}/employees${suffix}`,
        ),
      );
    },
    async get(id) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgEmployee>>(
          `${orgPrefix}/employees/${id}`,
        ),
      );
    },
    async stats() {
      return unwrap(
        await fetchJson<OrgEnvelope<EmployeeStats>>(
          `${orgPrefix}/employees/stats`,
        ),
      );
    },
    async listDepartments() {
      return org.listDepartments();
    },
    async create(body) {
      return org.createEmployee(body);
    },
    async update(id, body) {
      return org.updateEmployee(id, body);
    },
    async remove(id) {
      return org.removeEmployee(id);
    },
  };

  return { announcements, org, employees };
}

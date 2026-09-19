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

export type GovernancePauseStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export interface GovernancePause {
  pause_id: string;
  tool_name: string;
  category: string;
  action: string;
  actor_id: string;
  tenant_id: string;
  args_digest: string;
  reason: string;
  status: GovernancePauseStatus | string;
  created_at: number;
  resolved_at: number | null;
  ttl_seconds: number;
}

export interface GovernanceAuditEvent {
  audit_id?: string;
  event?: string;
  tool_name?: string;
  category?: string;
  action?: string;
  actor_id?: string;
  tenant_id?: string;
  args_digest?: string;
  result?: string;
  execute?: boolean;
  reason?: string;
  pause_id?: string;
  rule_source?: string;
  ts?: number;
  [key: string]: unknown;
}

export interface GovernanceDecision {
  status: string;
  execute: boolean;
  blocked: boolean;
  reason: string;
  category?: string;
  pause_id?: string;
  rule_source?: string;
  sidecar_reached?: boolean;
  audit_id?: string;
}

export interface GovernancePauseList {
  pauses: GovernancePause[];
  enabled?: boolean;
}

export interface GovernanceAuditList {
  events: GovernanceAuditEvent[];
}

export interface OrgGovernanceClient {
  pauses(status?: string): Promise<GovernancePauseList>;
  audit(limit?: number): Promise<GovernanceAuditList>;
  resolve(pauseId: string, approve: boolean): Promise<GovernanceDecision>;
}

export interface OrgSkill {
  slug: string;
  module_key: string;
  name: string;
  description: string;
  label_en: string;
  label_zh: string;
  directory: string;
  skill_md: string;
  published: boolean;
  plugin_dir: string | null;
  content?: string;
}

export interface OrgSkillCatalogRow {
  key: string;
  slug: string;
  label: string;
  label_zh: string;
  description: string;
  description_zh: string;
  generated: boolean;
  published: boolean;
}

export interface HostSkillPackage {
  id: string;
  name: string;
  description: string;
  skill_count: number;
}

export interface OrgSkillList {
  out_dir: string;
  skills: OrgSkill[];
  catalog: OrgSkillCatalogRow[];
  host_packages: HostSkillPackage[];
}

export interface OrgSkillGenerateResult {
  out_dir: string;
  skills: Array<{
    slug: string;
    module_key: string;
    directory: string;
  }>;
}

export interface OrgSkillPublishResult {
  plugin_id: string;
  module_key: string;
  source_skill: string;
  output_dir: string;
  notes?: string[];
}

export interface OrgSkillsClient {
  list(): Promise<OrgSkillList>;
  get(slug: string): Promise<OrgSkill>;
  generate(modules?: string[]): Promise<OrgSkillGenerateResult>;
  publish(opts: {
    slug?: string;
    skillDir?: string;
  }): Promise<OrgSkillPublishResult>;
}

export interface OrgKnowledgeCapability {
  feature_enabled: boolean;
  usable: boolean;
  prerequisites_ok: boolean;
  selected_model: string;
  backend: string;
}

export interface OrgKnowledgeBase {
  id: string;
  knowledge_base_id: string;
  name: string;
  description: string;
  shared: boolean;
  default_open: boolean;
  icon_name: string;
  document_count: number;
  owner_user_id: number;
  owned: boolean;
  documents?: OrgKnowledgeDocument[];
}

export interface OrgKnowledgeDocument {
  id: string;
  document_id: string;
  kb_id: string;
  filename: string;
  path: string;
  content_type: string;
  byte_size: number;
  is_dir: boolean;
  status: string;
  chunk_count: number;
  created_at: number;
  kind: "note" | "file" | string;
}

export interface OrgKnowledgePreview {
  id: string;
  document_id: string;
  kb_id: string;
  filename: string;
  content_type: string;
  text: string;
  kind: "note" | "file" | string;
}

export interface OrgKnowledgeStats {
  bases: number;
  documents: number;
  shared: number;
  owned: number;
}

export interface OrgKnowledgeList {
  host_route: string;
  store: string;
  capability: OrgKnowledgeCapability;
  bases: OrgKnowledgeBase[];
  stats: OrgKnowledgeStats;
}

export interface OrgKnowledgeWrite {
  name: string;
  description?: string;
  shared?: boolean;
}

export interface OrgKnowledgeNoteWrite {
  title: string;
  content?: string;
}

export interface OrgKnowledgeClient {
  list(): Promise<OrgKnowledgeList>;
  get(kbId: string): Promise<OrgKnowledgeBase>;
  preview(kbId: string, docId: string): Promise<OrgKnowledgePreview>;
  createBase(body: OrgKnowledgeWrite): Promise<OrgKnowledgeBase>;
  createNote(
    kbId: string,
    body: OrgKnowledgeNoteWrite,
  ): Promise<OrgKnowledgeDocument>;
}

export type OrgTaskStatus = "todo" | "in_progress" | "review" | "done";
export type OrgTaskPriority = "low" | "medium" | "high" | "critical";

export interface OrgTask {
  id: number;
  title: string;
  description?: string;
  status: OrgTaskStatus | string;
  priority: OrgTaskPriority | string;
  assigned_to?: number | null;
  assignee_name?: string | null;
  created_by?: number;
  creator_name?: string;
  created_at?: string;
  updated_at?: string | null;
  subtask_count?: number;
  subtask_done?: number;
  comment_count?: number;
  subtasks?: OrgTaskSubtask[];
  comments?: OrgTaskComment[];
}

export interface OrgTaskSubtask {
  id: number;
  task_id: number;
  title: string;
  completed: number;
  sort_order: number;
}

export interface OrgTaskComment {
  id: number;
  task_id: number;
  user_id?: number | null;
  user_name?: string;
  content: string;
  comment_type: string;
  created_at: string;
}

export interface OrgTaskStats {
  total: number;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
}

export interface OrgTaskWrite {
  title?: string;
  description?: string;
  priority?: string;
  assigned_to?: number | null;
}

export interface OrgTaskListParams {
  status?: string;
  priority?: string;
  assigned_to?: number;
  search?: string;
}

export interface OrgTasksClient {
  list(params?: OrgTaskListParams): Promise<OrgTask[]>;
  stats(): Promise<OrgTaskStats>;
  get(id: number): Promise<OrgTask>;
  create(body: OrgTaskWrite): Promise<OrgTask>;
  update(id: number, body: OrgTaskWrite): Promise<OrgTask>;
  remove(id: number): Promise<void>;
  transition(id: number, to: string): Promise<OrgTask>;
  addSubtask(id: number, title: string): Promise<OrgTaskSubtask>;
  updateSubtask(
    id: number,
    subtaskId: number,
    body: { title?: string; completed?: boolean | number },
  ): Promise<OrgTaskSubtask>;
  removeSubtask(id: number, subtaskId: number): Promise<void>;
  addComment(id: number, content: string): Promise<OrgTaskComment>;
}

export type OrgReflectionType =
  | "task_completion"
  | "error_learning"
  | "knowledge_capture"
  | "improvement";

export interface OrgReflection {
  id: number;
  employee_id: number;
  task_id?: number | null;
  reflection_type: string;
  success_factors?: string | null;
  failure_reasons?: string | null;
  knowledge_gaps?: string | null;
  improvement_plans?: string | null;
  extracted_skills?: string | null;
  learned_knowledge?: string | null;
  importance_score: number;
  created_at?: string;
}

export interface OrgReflectionStats {
  total: number;
  task_completion: number;
  error_learning: number;
  knowledge_capture: number;
  improvement: number;
}

export interface OrgReflectionWrite {
  employee_id?: number | null;
  task_id?: number | null;
  reflection_type?: string;
  success_factors?: string;
  failure_reasons?: string;
  knowledge_gaps?: string;
  improvement_plans?: string;
  extracted_skills?: string;
  learned_knowledge?: string;
  importance_score?: number;
}

export interface OrgReflectionListParams {
  employee_id?: number;
  type?: string;
  search?: string;
}

export interface OrgReflectionsClient {
  list(params?: OrgReflectionListParams): Promise<OrgReflection[]>;
  stats(): Promise<OrgReflectionStats>;
  get(id: number): Promise<OrgReflection>;
  create(body: OrgReflectionWrite): Promise<OrgReflection>;
  remove(id: number): Promise<void>;
}

export interface OrgCapability {
  key: string;
  label: string;
  label_zh: string;
  description: string;
  description_zh: string;
  locked: boolean;
}

export interface OrgPrefs {
  name: string;
  description: string;
}

export interface OrgSystemSettingsLinks {
  overview: string;
  models: string;
  users: string;
}

export interface OrgSettingsSnapshot {
  scope: string;
  catalog: OrgCapability[];
  modules: Record<string, boolean>;
  prefs: OrgPrefs;
  system_settings: OrgSystemSettingsLinks;
  not_on_this_page: string[];
}

export interface OrgPrefsWrite {
  name?: string;
  description?: string;
}

export interface OrgSettingsClient {
  snapshot(): Promise<OrgSettingsSnapshot>;
  savePrefs(body: OrgPrefsWrite): Promise<OrgPrefs>;
  saveModules(
    updates: Record<string, boolean>,
  ): Promise<Record<string, boolean>>;
}

export interface OrgApiClient {
  announcements: OrgAnnouncementsClient;
  org: OrgChartClient;
  employees: OrgEmployeesClient;
  governance: OrgGovernanceClient;
  skills: OrgSkillsClient;
  knowledge: OrgKnowledgeClient;
  tasks: OrgTasksClient;
  reflections: OrgReflectionsClient;
  settings: OrgSettingsClient;
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
  governancePrefix?: string;
  skillsPrefix?: string;
  knowledgePrefix?: string;
  tasksPrefix?: string;
  reflectionsPrefix?: string;
  settingsPrefix?: string;
}): OrgApiClient {
  const prefix = opts.announcementsPrefix ?? "/org-module/announcements";
  const orgPrefix = opts.orgPrefix ?? "/org-module/org";
  const governancePrefix = opts.governancePrefix ?? "/org-module/governance";
  const skillsPrefix = opts.skillsPrefix ?? "/org-module/skills";
  const knowledgePrefix = opts.knowledgePrefix ?? "/org-module/knowledge";
  const tasksPrefix = opts.tasksPrefix ?? "/org-module/tasks";
  const reflectionsPrefix = opts.reflectionsPrefix ?? "/org-module/reflections";
  const settingsPrefix = opts.settingsPrefix ?? "/org-module";
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

  const governance: OrgGovernanceClient = {
    async pauses(status) {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      return fetchJson<GovernancePauseList>(
        `${governancePrefix}/pauses${query}`,
      );
    },
    async audit(limit = 50) {
      return fetchJson<GovernanceAuditList>(
        `${governancePrefix}/audit?limit=${limit}`,
      );
    },
    async resolve(pauseId, approve) {
      return fetchJson<GovernanceDecision>(`${governancePrefix}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pause_id: pauseId, approve }),
      });
    },
  };

  const skills: OrgSkillsClient = {
    async list() {
      return fetchJson<OrgSkillList>(skillsPrefix);
    },
    async get(slug) {
      return fetchJson<OrgSkill>(`${skillsPrefix}/${encodeURIComponent(slug)}`);
    },
    async generate(modules) {
      return fetchJson<OrgSkillGenerateResult>(`${skillsPrefix}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modules ? { modules } : {}),
      });
    },
    async publish(opts) {
      return fetchJson<OrgSkillPublishResult>(`${skillsPrefix}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: opts.slug || "",
          skill_dir: opts.skillDir || "",
        }),
      });
    },
  };

  const knowledge: OrgKnowledgeClient = {
    async list() {
      return fetchJson<OrgKnowledgeList>(knowledgePrefix);
    },
    async get(kbId) {
      return fetchJson<OrgKnowledgeBase>(
        `${knowledgePrefix}/${encodeURIComponent(kbId)}`,
      );
    },
    async preview(kbId, docId) {
      return fetchJson<OrgKnowledgePreview>(
        `${knowledgePrefix}/${encodeURIComponent(
          kbId,
        )}/documents/${encodeURIComponent(docId)}`,
      );
    },
    async createBase(body) {
      return fetchJson<OrgKnowledgeBase>(knowledgePrefix, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: body.name,
          description: body.description || "",
          shared: Boolean(body.shared),
        }),
      });
    },
    async createNote(kbId, body) {
      return fetchJson<OrgKnowledgeDocument>(
        `${knowledgePrefix}/${encodeURIComponent(kbId)}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: body.title,
            content: body.content || "",
          }),
        },
      );
    },
  };

  const tasks: OrgTasksClient = {
    async list(params = {}) {
      const query = new URLSearchParams();
      if (params.status) query.set("status", params.status);
      if (params.priority) query.set("priority", params.priority);
      if (params.assigned_to != null) {
        query.set("assigned_to", String(params.assigned_to));
      }
      if (params.search) query.set("search", params.search);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return unwrap(
        await fetchJson<OrgEnvelope<OrgTask[]>>(`${tasksPrefix}${suffix}`),
      );
    },
    async stats() {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgTaskStats>>(`${tasksPrefix}/stats`),
      );
    },
    async get(id) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgTask>>(`${tasksPrefix}/${id}`),
      );
    },
    async create(body) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgTask>>(tasksPrefix, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
    async update(id, body) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgTask>>(`${tasksPrefix}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
    async remove(id) {
      await unwrap(
        await fetchJson<OrgEnvelope<undefined>>(`${tasksPrefix}/${id}`, {
          method: "DELETE",
        }),
      );
    },
    async transition(id, to) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgTask>>(
          `${tasksPrefix}/${id}/transition`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to }),
          },
        ),
      );
    },
    async addSubtask(id, title) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgTaskSubtask>>(
          `${tasksPrefix}/${id}/subtasks`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          },
        ),
      );
    },
    async updateSubtask(id, subtaskId, body) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgTaskSubtask>>(
          `${tasksPrefix}/${id}/subtasks/${subtaskId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
      );
    },
    async removeSubtask(id, subtaskId) {
      await unwrap(
        await fetchJson<OrgEnvelope<undefined>>(
          `${tasksPrefix}/${id}/subtasks/${subtaskId}`,
          { method: "DELETE" },
        ),
      );
    },
    async addComment(id, content) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgTaskComment>>(
          `${tasksPrefix}/${id}/comments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          },
        ),
      );
    },
  };

  const reflections: OrgReflectionsClient = {
    async list(params = {}) {
      const query = new URLSearchParams();
      if (params.employee_id != null) {
        query.set("employee_id", String(params.employee_id));
      }
      if (params.type) query.set("type", params.type);
      if (params.search) query.set("search", params.search);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return unwrap(
        await fetchJson<OrgEnvelope<OrgReflection[]>>(
          `${reflectionsPrefix}${suffix}`,
        ),
      );
    },
    async stats() {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgReflectionStats>>(
          `${reflectionsPrefix}/stats`,
        ),
      );
    },
    async get(id) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgReflection>>(
          `${reflectionsPrefix}/${id}`,
        ),
      );
    },
    async create(body) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgReflection>>(reflectionsPrefix, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
    async remove(id) {
      await unwrap(
        await fetchJson<OrgEnvelope<undefined>>(`${reflectionsPrefix}/${id}`, {
          method: "DELETE",
        }),
      );
    },
  };

  const settings: OrgSettingsClient = {
    async snapshot() {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgSettingsSnapshot>>(
          `${settingsPrefix}/settings`,
        ),
      );
    },
    async savePrefs(body) {
      return unwrap(
        await fetchJson<OrgEnvelope<OrgPrefs>>(`${settingsPrefix}/prefs`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
    async saveModules(updates) {
      const raw = await fetchJson<{
        updates?: Record<string, boolean>;
        success?: boolean;
        data?: { updates?: Record<string, boolean> };
      }>(`${settingsPrefix}/modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (raw.updates) return raw.updates;
      if (raw.data?.updates) return raw.data.updates;
      throw new Error("request failed");
    },
  };

  return {
    announcements,
    org,
    employees,
    governance,
    skills,
    knowledge,
    tasks,
    reflections,
    settings,
  };
}

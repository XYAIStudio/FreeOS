import { request } from "../request";

export interface ProjectLink {
  id: string;
  title: string;
  agent_id?: string;
}

export interface Project {
  id: string;
  name: string;
  work_dir: string;
  owner_user_id: number;
  conversation_ids: string[];
  task_ids: string[];
  conversations?: ProjectLink[];
  tasks?: ProjectLink[];
  created_at: number;
  updated_at: number;
}

export const projectsApi = {
  list: () => request<{ projects: Project[] }>("/projects"),
  create: (body: { name: string; work_dir?: string }) =>
    request<Project>("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  get: (id: string) => request<Project>(`/projects/${id}`),
  update: (
    id: string,
    body: {
      name?: string;
      work_dir?: string;
      conversation_ids?: string[];
      task_ids?: string[];
    },
  ) =>
    request<Project>(`/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/projects/${id}`, { method: "DELETE" }),
  link: (id: string, kind: "conversation" | "task", ref_id: string) =>
    request<Project>(`/projects/${id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ref_id }),
    }),
};

import { request } from "../request";

export interface OrgCapability {
  key: string;
  label: string;
  label_zh: string;
  description: string;
  description_zh: string;
  locked: boolean;
}

export interface OrgModuleStatus {
  enabled: boolean;
  plugin_id: string;
  sidecar: {
    reachable: boolean;
    url: string;
    status_code: number | null;
    detail: string;
    payload: Record<string, unknown>;
  };
  home: string;
  catalog_keys: string[];
  catalog: OrgCapability[];
  embed_url: string;
  proxy_prefix: string;
  start_command: string;
  notes: string[];
}

export interface OrgPlaneCounts {
  employees: number;
  employee_states: Record<string, number>;
  agents: number;
  spawned_colleagues: number;
  org_skills: number;
  skill_packages: number;
  mcp: number;
  tasks: number;
}

export interface OrgControlPlane {
  reachable: boolean;
  url: string;
  detail: string;
  modules: number;
  governance: boolean;
  tenant_id: string;
  approvals: number;
}

export interface OrgOverview {
  enabled: boolean;
  sidecar_reachable: boolean;
  sidecar_url: string;
  start_available: boolean;
  start_command: string;
  home: string;
  last_sync: string | null;
  freeos: OrgPlaneCounts;
  openxyos: OrgControlPlane;
  last_loop: Record<string, unknown> | null;
  notes: string[];
  catalog: OrgCapability[];
  module_toggles?: Record<string, boolean>;
}

export interface OrgSidecarStart {
  started: boolean;
  already: boolean;
  reachable: boolean;
  url: string;
  command: string;
  detail: string;
  launcher: string;
}

export interface OrgAssembleResult {
  sidecar_reachable: boolean;
  employees: string[];
  spawned: Array<{ agent_id: string; slug: string; name: string }>;
  imported: Record<string, unknown> | null;
  notes: string[];
}

export interface OrgPackResult {
  pack: {
    directory: string;
    skill_count: number;
    plugin_count: number;
    mcp_count: number;
    agent_count: number;
    notes: string[];
  };
  applied: {
    pack_dir: string;
    mirror_dir: string;
    remote_applied: boolean;
    mirrored: boolean;
    notes: string[];
  };
}

export interface OrgLoopProof {
  ok: boolean;
  tenant_id: string;
  home: string;
  skills: string[];
  employees: string[];
  agents: Array<Record<string, unknown>>;
  lifecycle: Record<string, string>;
  pack_dir: string;
  mirror_dir: string;
  remote_applied: boolean;
  imported_roundtrip: Record<string, unknown>;
  governance_blocked: boolean;
  governance: Record<string, unknown>;
  notes: string[];
  updated_at?: string;
}

export const orgModuleApi = {
  status: () => request<OrgModuleStatus>("/org-module/status"),
  overview: () => request<OrgOverview>("/org-module/overview"),
  catalog: () => request<{ modules: OrgCapability[] }>("/org-module/catalog"),
  setEnabled: (enabled: boolean, sidecar_url?: string) =>
    request<OrgModuleStatus>("/org-module", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, sidecar_url }),
    }),
  startSidecar: () =>
    request<OrgSidecarStart>("/org-module/sidecar/start", { method: "POST" }),
  assemble: () =>
    request<OrgAssembleResult>("/org-module/assemble", { method: "POST" }),
  pack: () => request<OrgPackResult>("/org-module/pack", { method: "POST" }),
  runLoop: () =>
    request<OrgLoopProof>("/org-module/loop/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  setModules: (updates: Record<string, boolean>) =>
    request<{ updates: Record<string, boolean> }>("/org-module/modules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    }),
  downloadSource: (dest: string) =>
    request<{ ok: boolean; path: string; source: string }>(
      "/org-module/source/download",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dest }),
      },
    ),
};

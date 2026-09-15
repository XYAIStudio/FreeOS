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

export const orgModuleApi = {
  status: () => request<OrgModuleStatus>("/org-module/status"),
  catalog: () => request<{ modules: OrgCapability[] }>("/org-module/catalog"),
  setEnabled: (enabled: boolean, sidecar_url?: string) =>
    request<OrgModuleStatus>("/org-module", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, sidecar_url }),
    }),
};

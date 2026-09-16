import { request } from "../request";

export interface HostAppItem {
  id: string;
  name: string;
  path?: string;
  kind: string;
  format?: string;
  transport?: string;
  command?: string;
  args?: string[];
  url?: string;
  source_path?: string;
  enabled?: boolean;
}

export interface HostAppReport {
  id: string;
  label: string;
  installed: boolean;
  paths_checked: string[];
  paths_found: string[];
  skills: HostAppItem[];
  plugins: HostAppItem[];
  mcp: HostAppItem[];
  notes: string;
}

export const hostAppsApi = {
  list: () =>
    request<{ hosts: HostAppReport[]; readonly: boolean }>("/host-apps"),
  importItem: (body: {
    host_id: string;
    item_id: string;
    kind: "skill" | "plugin" | "mcp";
  }) =>
    request<Record<string, unknown>>("/host-apps/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};

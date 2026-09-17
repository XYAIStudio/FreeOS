import { request } from "../request";

export interface LocalHardware {
  os: string;
  arch: string;
  cpu_count: number;
  ram_gb: number;
  gpu: string;
  ollama_binary: boolean;
  ollama_installed?: boolean;
  ollama_reachable: boolean;
  ollama_path?: string;
}

export interface LocalDep {
  id: string;
  kind: string;
  automatable: boolean;
  method?: string | null;
  docs_url?: string;
  next_step?: string;
}

export interface LocalInstalledModel {
  name: string;
  path: string;
  size: number;
  source: string;
  registerable?: boolean;
  registered?: boolean;
  provider_name?: string;
  is_default?: boolean;
}

export interface LocalRecommendedModel {
  id: string;
  reason: string;
  install: string;
}

export interface LocalProbe {
  hardware: LocalHardware;
  deps?: LocalDep[];
  installed: LocalInstalledModel[];
  recommended: LocalRecommendedModel[];
  default_ref?: string;
  default_provider_name?: string;
  default_model?: string;
}

export interface LocalSpeedTestResult {
  ok: boolean;
  name?: string;
  provider_name?: string;
  latency_ms?: number;
  ttft_ms?: number | null;
  tokens?: number | null;
  tokens_per_sec?: number | null;
  error?: string | null;
  next_step?: string;
  action?: string;
}

export interface LocalDefaultResult {
  ok: boolean;
  action?: string;
  name?: string | null;
  provider_name?: string;
  ref?: string;
  preferred_model?: string;
  error?: string | null;
  next_step?: string;
}

export interface LocalRuntimeResult {
  ok: boolean;
  installed: boolean;
  running?: boolean;
  action?: string;
  automatable?: boolean;
  method?: string | null;
  command?: string;
  docs_url?: string;
  next_step?: string;
  error?: string | null;
  name?: string;
  size?: number;
  source?: string;
  provider_name?: string;
  registered?: boolean;
}

export interface LocalScanJob {
  job_id: string | null;
  status: string;
  roots?: string[];
  full_disk?: boolean;
  dirs_scanned?: number;
  files_found?: number;
  current?: string;
  found?: LocalInstalledModel[];
  error?: string | null;
}

export const localModelsApi = {
  probe: () => request<LocalProbe>("/local-models/probe"),
  install: (name: string) =>
    request<LocalRuntimeResult>("/local-models/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  startOllama: () =>
    request<LocalRuntimeResult>("/local-models/start-ollama", {
      method: "POST",
    }),
  ensureDeps: (install: boolean) =>
    request<LocalRuntimeResult>("/local-models/ensure-deps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ install }),
    }),
  startScan: (body: { root?: string; full_disk?: boolean }) =>
    request<LocalScanJob>("/local-models/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getScan: (jobId: string) =>
    request<LocalScanJob>(`/local-models/scan/${encodeURIComponent(jobId)}`),
  getLatestScan: () => request<LocalScanJob>("/local-models/scan"),
  cancelScan: (jobId: string) =>
    request<LocalScanJob>(`/local-models/scan/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    }),
  register: (body: {
    path: string;
    name?: string;
    source: string;
    size?: number;
  }) =>
    request<LocalRuntimeResult>("/local-models/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  speedTest: (name: string, init?: RequestInit) =>
    request<LocalSpeedTestResult>("/local-models/speed-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
      ...init,
    }),
  setDefault: (name: string) =>
    request<LocalDefaultResult>("/local-models/default", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  clearDefault: (name?: string) =>
    request<LocalDefaultResult>(
      name
        ? `/local-models/default?name=${encodeURIComponent(name)}`
        : "/local-models/default",
      { method: "DELETE" },
    ),
};

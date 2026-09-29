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
  llamacpp_binary?: boolean;
  llamacpp_reachable?: boolean;
  llamacpp_path?: string;
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
  runtime?: string;
  managed_by_freeos?: boolean;
  base_url?: string;
  model_path?: string;
  alias?: string;
  provider_name?: string;
  is_default?: boolean;
}

export interface LocalRecommendedModel {
  id: string;
  name?: string;
  display_name?: string;
  size?: number;
  reason: string;
  install: string;
}

export interface LocalDownloadJob {
  job_id: string;
  catalog_id: string;
  name?: string;
  status: string;
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
  path: string;
  error?: string | null;
  resumable?: boolean;
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
  startDownload: (catalogId: string) =>
    request<LocalDownloadJob>("/local-models/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog_id: catalogId }),
    }),
  listDownloads: () => request<LocalDownloadJob[]>("/local-models/downloads"),
  getDownload: (jobId: string) =>
    request<LocalDownloadJob>(
      `/local-models/downloads/${encodeURIComponent(jobId)}`,
    ),
  cancelDownload: (jobId: string) =>
    request<LocalDownloadJob>(
      `/local-models/downloads/${encodeURIComponent(jobId)}`,
      { method: "DELETE" },
    ),
  startOllama: () =>
    request<LocalRuntimeResult>("/local-models/start-ollama", {
      method: "POST",
    }),
  llamaCppStatus: () =>
    request<LocalRuntimeResult>("/local-models/llamacpp/status"),
  startLlamaCpp: (body: {
    model_path: string;
    alias?: string;
    context_size?: number;
    gpu_layers?: number;
  }) =>
    request<LocalRuntimeResult>("/local-models/llamacpp/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  stopLlamaCpp: () =>
    request<LocalRuntimeResult>("/local-models/llamacpp", {
      method: "DELETE",
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
  speedTest: (name: string, providerName?: string, init?: RequestInit) =>
    request<LocalSpeedTestResult>("/local-models/speed-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, provider_name: providerName }),
      ...init,
    }),
  setDefault: (name: string, providerName?: string) =>
    request<LocalDefaultResult>("/local-models/default", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, provider_name: providerName }),
    }),
  clearDefault: (name?: string) =>
    request<LocalDefaultResult>(
      name
        ? `/local-models/default?name=${encodeURIComponent(name)}`
        : "/local-models/default",
      { method: "DELETE" },
    ),
};

import { request } from "../request";

export interface LocalHardware {
  os: string;
  arch: string;
  cpu_count: number;
  ram_gb: number;
  gpu: string;
  ollama_binary: boolean;
  ollama_reachable: boolean;
}

export interface LocalInstalledModel {
  name: string;
  path: string;
  size: number;
  source: string;
}

export interface LocalRecommendedModel {
  id: string;
  reason: string;
  install: string;
}

export interface LocalProbe {
  hardware: LocalHardware;
  installed: LocalInstalledModel[];
  recommended: LocalRecommendedModel[];
}

export const localModelsApi = {
  probe: () => request<LocalProbe>("/local-models/probe"),
  install: (name: string) =>
    request<{ ok: boolean; name: string; size: number; source: string }>(
      "/local-models/install",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
    ),
};

import type { LocalSpeedTestResult } from "../api/modules/localModels";

const STORAGE_KEY = "octop:local-model-speed";

export interface StoredLocalSpeedResult {
  name: string;
  ok: boolean;
  action?: string;
  latency_ms?: number;
  ttft_ms?: number | null;
  tokens_per_sec?: number | null;
  error?: string | null;
  at: number;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function speedResultKey(source: string, name: string): string {
  return `${source}:${name}`;
}

export function loadSpeedResults(): Record<string, StoredLocalSpeedResult> {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, StoredLocalSpeedResult>;
  } catch {
    return {};
  }
}

export function saveSpeedResult(
  source: string,
  name: string,
  result: LocalSpeedTestResult,
): StoredLocalSpeedResult {
  const stored: StoredLocalSpeedResult = {
    name,
    ok: result.ok,
    action: result.action,
    latency_ms: result.latency_ms,
    ttft_ms: result.ttft_ms,
    tokens_per_sec: result.tokens_per_sec,
    error: result.error || result.next_step || null,
    at: Date.now(),
  };
  const all = loadSpeedResults();
  all[speedResultKey(source, name)] = stored;
  storage()?.setItem(STORAGE_KEY, JSON.stringify(all));
  return stored;
}

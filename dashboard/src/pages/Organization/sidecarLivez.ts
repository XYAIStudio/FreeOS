import { isSidecarOriginUrl } from "./orgBrowser";

export function sidecarLivezUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/health/livez`;
}

export function isLivezHttpOk(status: number): boolean {
  return status > 0 && status < 500;
}

export async function probeSidecarLivez(
  origin: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2500,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(sidecarLivezUrl(origin), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return isLivezHttpOk(response.status);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function confirmSidecarLivez(input: {
  origin: string;
  fetchImpl?: typeof fetch;
  apiProbe?: () => Promise<{ reachable: boolean }>;
}): Promise<boolean> {
  const direct = await probeSidecarLivez(input.origin, input.fetchImpl);
  if (direct) return true;
  if (!input.apiProbe) return false;
  try {
    const result = await input.apiProbe();
    return Boolean(result.reachable);
  } catch {
    return false;
  }
}

export function shouldLoadSidecarFrame(input: {
  url: string;
  sidecarOrigin: string;
  livezOk: boolean;
}): boolean {
  if (!isSidecarOriginUrl(input.url, input.sidecarOrigin)) return true;
  return input.livezOk;
}

export function sidecarPreviewGate(input: {
  livezOk: boolean;
  restarting: boolean;
}): "open" | "restarting" | "needsRestart" {
  if (input.restarting) return "restarting";
  if (!input.livezOk) return "needsRestart";
  return "open";
}

export type SidecarRecoverPhase = "hidden" | "opening" | "needsRestart";

/** When livez is down, surface a restart CTA instead of a silent Failed to fetch. */
export function sidecarRecoverPhase(input: {
  sidecarUp: boolean;
  installReady: boolean;
  startAvailable: boolean;
  autoStarting: boolean;
  autoStartFailed: boolean;
}): SidecarRecoverPhase {
  if (input.sidecarUp) return "hidden";
  if (input.autoStarting && !input.autoStartFailed) return "opening";
  return "needsRestart";
}

/** livez can be green while iframe assets 500 on the sidecar's own Origin. */
export function shouldShowPreviewBlank(input: {
  sidecarUp: boolean;
  embedOk: boolean | null | undefined;
}): boolean {
  return Boolean(input.sidecarUp) && input.embedOk === false;
}

export type SidecarRecoverPhase = "hidden" | "opening";

/** Organization always embeds the local URL; there is no start-CTA recover path. */
export function sidecarRecoverPhase(input: {
  sidecarUp: boolean;
  installReady: boolean;
  startAvailable: boolean;
  autoStarting: boolean;
  autoStartFailed: boolean;
}): SidecarRecoverPhase {
  if (input.sidecarUp) return "hidden";
  return "opening";
}

/** livez can be green while iframe assets 500 on the sidecar's own Origin. */
export function shouldShowPreviewBlank(input: {
  sidecarUp: boolean;
  embedOk: boolean | null | undefined;
}): boolean {
  return Boolean(input.sidecarUp) && input.embedOk === false;
}

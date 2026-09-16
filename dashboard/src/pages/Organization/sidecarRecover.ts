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

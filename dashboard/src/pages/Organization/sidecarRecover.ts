export type SidecarRecoverPhase = "hidden" | "starting" | "recover";

export function sidecarRecoverPhase(input: {
  sidecarUp: boolean;
  installReady: boolean;
  startAvailable: boolean;
  autoStarting: boolean;
  autoStartFailed: boolean;
}): SidecarRecoverPhase {
  if (input.sidecarUp) return "hidden";
  if (input.autoStarting) return "starting";
  if (input.autoStartFailed) return "recover";
  if (input.installReady || input.startAvailable) return "starting";
  return "recover";
}

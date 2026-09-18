export const SIDECAR_RESTART_STEPS = [
  "stop",
  "preferLayout",
  "startApi",
  "waitPort",
  "loadLogin",
] as const;

export type SidecarRestartStepId = (typeof SIDECAR_RESTART_STEPS)[number];

/** Elapsed-ms marks at which each step becomes current while restart is in flight. */
export const SIDECAR_RESTART_STEP_AT_MS = [0, 1600, 3400, 5600, 8200] as const;

export function sidecarRestartStepIndex(
  elapsedMs: number,
  opts: { finished?: boolean; failed?: boolean } = {},
): number {
  const last = SIDECAR_RESTART_STEPS.length - 1;
  if (opts.finished) return last;
  let index = 0;
  for (let i = 0; i < SIDECAR_RESTART_STEP_AT_MS.length; i += 1) {
    if (elapsedMs >= SIDECAR_RESTART_STEP_AT_MS[i]) index = i;
  }
  if (!opts.finished && index >= last) {
    return last - 1;
  }
  if (opts.failed) return index;
  return index;
}

export function sidecarRestartStepId(
  elapsedMs: number,
  opts: { finished?: boolean; failed?: boolean } = {},
): SidecarRestartStepId {
  return SIDECAR_RESTART_STEPS[sidecarRestartStepIndex(elapsedMs, opts)];
}

export function sidecarRestartSpeechKeys(stepId: SidecarRestartStepId): {
  title: string;
  body: string;
} {
  return {
    title: `organization.restartSpeech.${stepId}Title`,
    body: `organization.restartSpeech.${stepId}Body`,
  };
}

export function sidecarRestartStepLabelKey(stepId: SidecarRestartStepId): string {
  return `organization.restartStep.${stepId}`;
}

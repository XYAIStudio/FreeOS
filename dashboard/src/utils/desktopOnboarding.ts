const ONBOARDING_KEY = "freeos:model-onboarding-done";

/** Pinned default agent created for the desktop / loopback guest session. */
export const DESKTOP_FIRST_AGENT_ID = "main";

/** Canvas for the first-run assistant — not the shared conversation list. */
export const DESKTOP_FIRST_CHAT_PATH = `/chat/${DESKTOP_FIRST_AGENT_ID}`;

/** Returning desktop users land on the shared workspace conversation list. */
export const DESKTOP_RETURNING_HOME_PATH = "/projects";

export const DESKTOP_MODEL_SETUP_PATH = "/setup";

/** True after the desktop first-run model step was saved or skipped. */
export function isDesktopModelOnboardingDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remember that the desktop first-run model step should not show again. */
export function markDesktopModelOnboardingDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    /* quota / private-mode — next launch may show the step again */
  }
}

/** First launch with no providers and no skip/save yet. */
export function needsDesktopModelOnboarding(hasProviders = false): boolean {
  return !hasProviders && !isDesktopModelOnboardingDone();
}

/**
 * Path after a desktop local session is adopted.
 * First launch → model setup; later launches → conversation list (not a loop).
 */
export function desktopPostSessionPath(hasProviders = false): string {
  if (needsDesktopModelOnboarding(hasProviders)) {
    return DESKTOP_MODEL_SETUP_PATH;
  }
  if (hasProviders) markDesktopModelOnboardingDone();
  return DESKTOP_RETURNING_HOME_PATH;
}

/** After skip or a successful model save: chat with the default first agent. */
export function desktopAfterModelSetupPath(): string {
  markDesktopModelOnboardingDone();
  return DESKTOP_FIRST_CHAT_PATH;
}

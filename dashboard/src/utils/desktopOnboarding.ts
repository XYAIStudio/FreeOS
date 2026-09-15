const ONBOARDING_KEY = "freeos:model-onboarding-done";

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

/** Path after a desktop local session: model setup once, then the workspace. */
export function desktopPostSessionPath(hasProviders = false): string {
  if (hasProviders || isDesktopModelOnboardingDone()) {
    if (hasProviders) markDesktopModelOnboardingDone();
    return "/chat";
  }
  return "/setup";
}

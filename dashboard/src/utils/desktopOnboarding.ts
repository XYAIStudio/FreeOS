const ONBOARDING_KEY = "freeos:model-onboarding-done";

/** Pinned default agent created for the desktop / loopback guest session. */
export const DESKTOP_FIRST_AGENT_ID = "main";

/** Canvas for the first-run assistant — not the shared conversation list. */
export const DESKTOP_FIRST_CHAT_PATH = `/chat/${DESKTOP_FIRST_AGENT_ID}`;

/** After the door is open, land on the first agent — not the workspace list. */
export const DESKTOP_RETURNING_HOME_PATH = DESKTOP_FIRST_CHAT_PATH;

export const DESKTOP_MODEL_SETUP_PATH = "/setup";

/**
 * Launch landings that are not studio chat: Octop `/projects` dump, bare
 * `/chat`, SPA `/`, or the organization room when `?desktop=1` is still on
 * the URL (host first paint). Sidebar can still open those rooms later.
 */
export function isDesktopLaunchDumpPath(
  pathname: string,
  search = "",
): boolean {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const launchQuery = params.get("desktop") === "1";
  if (pathname === "/" || pathname === "") return true;
  if (pathname === "/chat") return true;
  if (pathname === "/projects" || pathname === "/projects/") {
    const view = params.get("view");
    return view !== "projects" && view !== "tasks";
  }
  if (
    launchQuery &&
    (pathname === "/organization" || pathname.startsWith("/organization/"))
  ) {
    return true;
  }
  return false;
}

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
 * Path after a this-device local session is adopted.
 * First launch → optional model setup; later launches → first agent chat.
 */
export function desktopPostSessionPath(hasProviders = false): string {
  if (needsDesktopModelOnboarding(hasProviders)) {
    return DESKTOP_MODEL_SETUP_PATH;
  }
  if (hasProviders) markDesktopModelOnboardingDone();
  return DESKTOP_FIRST_CHAT_PATH;
}

/** After skip or a successful model save: chat with the default first agent. */
export function desktopAfterModelSetupPath(): string {
  markDesktopModelOnboardingDone();
  return DESKTOP_FIRST_CHAT_PATH;
}

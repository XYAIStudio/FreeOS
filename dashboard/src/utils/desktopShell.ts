const DESKTOP_FLAG = "freeos:desktop-shell";

/** True when the SPA is inside the Wails shell (`?desktop=1` or remembered). */
export function isDesktopShell(search?: string): boolean {
  const query =
    search ?? (typeof window === "undefined" ? "" : window.location.search);
  if (new URLSearchParams(query).get("desktop") === "1") {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(DESKTOP_FLAG, "1");
      } catch {
        // Ignore quota / private-mode failures; the query string still counts.
      }
    }
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.sessionStorage.getItem(DESKTOP_FLAG) === "1";
  } catch {
    return false;
  }
}

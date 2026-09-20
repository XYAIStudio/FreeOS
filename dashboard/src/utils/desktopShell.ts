const DESKTOP_FLAG = "freeos:desktop-shell";

function rememberDesktopFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DESKTOP_FLAG, "1");
    window.localStorage.setItem(DESKTOP_FLAG, "1");
  } catch {
    // Ignore quota / private-mode failures; the query string still counts.
  }
}

function rememberedDesktopFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.sessionStorage.getItem(DESKTOP_FLAG) === "1" ||
      window.localStorage.getItem(DESKTOP_FLAG) === "1"
    );
  } catch {
    return false;
  }
}

/** True when the SPA is inside the Wails shell (`?desktop=1` or remembered). */
export function isDesktopShell(search?: string): boolean {
  const query =
    search ?? (typeof window === "undefined" ? "" : window.location.search);
  if (new URLSearchParams(query).get("desktop") === "1") {
    rememberDesktopFlag();
    return true;
  }
  return rememberedDesktopFlag();
}

/** Capture `?desktop=1` before React Router navigates `/` → `/projects`. */
if (typeof window !== "undefined") {
  isDesktopShell();
}

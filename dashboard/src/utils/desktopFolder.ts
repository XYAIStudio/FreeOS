import { isDesktopShell } from "./desktopChrome";
import { repairUtf8Mojibake } from "./utf8Mojibake";

type DesktopWindow = Window & {
  _wails?: { invoke?: (message: string) => void };
};

const FOLDER_EVENT = "freeos-folder-selected";

/**
 * Native OS folder picker via the Wails desktop bridge.
 * Returns null when cancelled, not in the desktop shell, or on timeout.
 */
export function pickDesktopFolder(
  win: DesktopWindow = window as DesktopWindow,
  timeoutMs = 120_000,
): Promise<string | null> {
  const invoke = win._wails?.invoke;
  if (typeof invoke !== "function") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (path: string | null) => {
      if (settled) return;
      settled = true;
      win.removeEventListener(FOLDER_EVENT, onSelected as EventListener);
      window.clearTimeout(timer);
      resolve(path);
    };
    const onSelected = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      finish(
        typeof detail === "string" && detail.trim()
          ? repairUtf8Mojibake(detail.trim())
          : null,
      );
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    win.addEventListener(FOLDER_EVENT, onSelected as EventListener);
    invoke("wails:event:emit:desktop:select-folder");
  });
}

export function canPickDesktopFolder(
  win: Pick<DesktopWindow, "_wails"> = window as DesktopWindow,
): boolean {
  return isDesktopShell(win);
}

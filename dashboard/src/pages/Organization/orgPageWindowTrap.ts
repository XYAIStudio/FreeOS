import { tryOpenInOrgBrowser } from "../../utils/orgBrowserHost";
import { isHttpUrl, normalizeOrgUrl } from "./orgBrowser";

function blankLinkFromEvent(event: Event): HTMLAnchorElement | null {
  const raw = event.target;
  const node =
    raw instanceof Element
      ? raw
      : raw instanceof Node
        ? raw.parentElement
        : null;
  if (!node) return null;
  const link = node.closest("a[href][target]");
  if (!(link instanceof HTMLAnchorElement)) return null;
  if (link.target.toLowerCase() !== "_blank") return null;
  if (link.hasAttribute("download")) return null;
  return link;
}

function trapUrl(raw: string, title?: string): boolean {
  const url = normalizeOrgUrl(raw, "");
  if (!url || !isHttpUrl(url)) return false;
  return tryOpenInOrgBrowser(url, title);
}

function onActivate(event: Event): void {
  if (event instanceof MouseEvent && event.button !== 0) return;
  const link = blankLinkFromEvent(event);
  if (!link) return;
  if (!trapUrl(link.href, link.textContent?.trim() || undefined)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

/** Capture Organization-chrome _blank / window.open into in-app tabs. */
export function installOrgPageWindowTrap(): () => void {
  const original = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const href = url == null ? "" : String(url);
    const name = target == null ? "_blank" : String(target);
    if (href && name.toLowerCase() === "_blank" && trapUrl(href)) {
      return null;
    }
    return original(url, target, features);
  }) as typeof window.open;
  document.addEventListener("click", onActivate, true);
  document.addEventListener("auxclick", onActivate, true);
  return () => {
    document.removeEventListener("click", onActivate, true);
    document.removeEventListener("auxclick", onActivate, true);
    window.open = original;
  };
}

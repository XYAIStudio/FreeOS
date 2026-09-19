export const OPENXYOS_OPEN_TAB = "openxyos:open-tab";
export const OPENXYOS_NAVIGATED = "openxyos:navigated";
export const OPENXYOS_READY = "openxyos:ready";

export function isEmbeddedFrame(win: Window = window): boolean {
  try {
    return win.self !== win.top;
  } catch {
    return true;
  }
}

export function shouldTrapWindowTarget(target?: string | null): boolean {
  if (target == null || target === "") return true;
  const name = String(target).toLowerCase();
  return name === "_blank" || name === "_new";
}

export function resolveOpenUrl(
  url: string | URL | undefined | null,
  base: string,
): string | null {
  if (url == null || url === "") return null;
  try {
    const parsed = new URL(String(url), base);
    const scheme = parsed.protocol.replace(":", "").toLowerCase();
    if (scheme !== "http" && scheme !== "https") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function blankLinkFromEvent(event: Event): HTMLAnchorElement | null {
  const raw = event.target;
  const node =
    raw instanceof Element
      ? raw
      : raw instanceof Node
        ? raw.parentElement
        : null;
  if (!node || !node.closest) return null;
  const link = node.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return null;
  if (link.hasAttribute("download")) return null;
  const target = (link.getAttribute("target") || "").toLowerCase();
  if (target !== "_blank" && target !== "_new") return null;
  return link;
}

function fakeWindow(): WindowProxy {
  const result = {
    closed: false,
    close: () => {
      result.closed = true;
    },
    focus() {},
    blur() {},
    opener: window,
  };
  return result as unknown as WindowProxy;
}

function postToParent(win: Window, data: Record<string, unknown>): void {
  if (!win.parent || win.parent === win) return;
  try {
    win.parent.postMessage(data, "*");
  } catch {
    /* host may ignore */
  }
}

/**
 * When openXYOS is framed by FreeOS Organization, send new windows to the
 * parent as in-app tabs instead of OS / system windows.
 */
export function installOpenxyosEmbedTrap(win: Window = window): () => void {
  if (!isEmbeddedFrame(win)) return () => {};

  const originalOpen = win.open.bind(win);
  win.open = ((url?: string | URL, target?: string, features?: string) => {
    const href = resolveOpenUrl(url, win.location.href);
    if (href && shouldTrapWindowTarget(target)) {
      postToParent(win, { type: OPENXYOS_OPEN_TAB, url: href });
      return fakeWindow();
    }
    return originalOpen(url, target, features);
  }) as typeof win.open;

  const onActivate = (event: Event) => {
    if (event instanceof MouseEvent && event.button !== 0) return;
    const link = blankLinkFromEvent(event);
    if (!link) return;
    const href = resolveOpenUrl(link.href, win.location.href);
    if (!href) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    postToParent(win, {
      type: OPENXYOS_OPEN_TAB,
      url: href,
      title: (link.textContent || "").trim() || undefined,
    });
  };

  win.document.addEventListener("click", onActivate, true);
  win.document.addEventListener("auxclick", onActivate, true);

  const notifyNav = () => {
    postToParent(win, {
      type: OPENXYOS_NAVIGATED,
      url: win.location.href,
      title: win.document.title,
    });
  };

  const historyProto = win.history;
  const originalPush = historyProto.pushState.bind(historyProto);
  const originalReplace = historyProto.replaceState.bind(historyProto);
  historyProto.pushState = ((
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ) => {
    originalPush(data, unused, url);
    notifyNav();
  }) as typeof historyProto.pushState;
  historyProto.replaceState = ((
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ) => {
    originalReplace(data, unused, url);
    notifyNav();
  }) as typeof historyProto.replaceState;
  win.addEventListener("popstate", notifyNav);
  win.addEventListener("hashchange", notifyNav);

  notifyNav();

  return () => {
    win.document.removeEventListener("click", onActivate, true);
    win.document.removeEventListener("auxclick", onActivate, true);
    win.removeEventListener("popstate", notifyNav);
    win.removeEventListener("hashchange", notifyNav);
    historyProto.pushState = originalPush;
    historyProto.replaceState = originalReplace;
    win.open = originalOpen;
  };
}

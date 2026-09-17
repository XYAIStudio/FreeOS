const HOOK = "__FREEOS_ORG_OPEN_TAB__";

type OrgOpenTab = (url: string, title?: string) => boolean;

type HostWindow = Window & {
  __FREEOS_ORG_OPEN_TAB__?: OrgOpenTab;
};

/** Register Organization as the in-app tab host for new web windows. */
export function registerOrgBrowserHost(openTab: OrgOpenTab): () => void {
  const w = window as HostWindow;
  w[HOOK] = openTab;
  return () => {
    if (w[HOOK] === openTab) {
      delete w[HOOK];
    }
  };
}

/** True when Organization swallowed the URL as an in-app tab. */
export function tryOpenInOrgBrowser(url: string, title?: string): boolean {
  const hook = (window as HostWindow)[HOOK];
  if (typeof hook !== "function") return false;
  try {
    return hook(url, title) === true;
  } catch {
    return false;
  }
}

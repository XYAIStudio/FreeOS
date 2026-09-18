import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORG_URL,
  buildEmbedSrc,
  canGoBack,
  canGoForward,
  closeOrgTab,
  createHomeTab,
  goBackOrgTab,
  goForwardOrgTab,
  iframeSandboxFor,
  navigateOrgTab,
  normalizeOrgUrl,
  openOrgTab,
  parseOrgNavigatedMessage,
  parseOrgOpenTabMessage,
  reloadOrgTab,
  sidecarOriginOf,
  stripEmbedParams,
  tabTitleFromUrl,
} from "./orgBrowser";

describe("normalizeOrgUrl", () => {
  it("defaults empty input to the local openXYOS console", () => {
    expect(normalizeOrgUrl("")).toBe(DEFAULT_ORG_URL);
  });

  it("adds https for bare hosts and rejects non-http schemes", () => {
    expect(normalizeOrgUrl("example.com/x")).toBe("https://example.com/x");
    expect(normalizeOrgUrl("javascript:alert(1)")).toBe(DEFAULT_ORG_URL);
  });
});

describe("buildEmbedSrc", () => {
  it("marks sidecar URLs as FreeOS embed mode", () => {
    expect(
      buildEmbedSrc("http://127.0.0.1:3780/employees", {
        sidecarOrigin: "http://127.0.0.1:3780",
        disabledKeys: ["chat"],
        nonce: "9",
      }),
    ).toBe(
      "http://127.0.0.1:3780/employees?freeos_embed=1&freeos_disabled=chat&freeos_sync=9",
    );
  });

  it("leaves third-party URLs untouched", () => {
    expect(
      buildEmbedSrc("https://github.com/XYAIStudio/openXYOS", {
        sidecarOrigin: "http://127.0.0.1:3780",
        disabledKeys: ["chat"],
        nonce: "9",
      }),
    ).toBe("https://github.com/XYAIStudio/openXYOS");
  });
});

describe("iframeSandboxFor", () => {
  it("does not sandbox the local sidecar so login cookies work", () => {
    expect(
      iframeSandboxFor(
        "http://127.0.0.1:3780/?freeos_embed=1",
        "http://127.0.0.1:3780",
      ),
    ).toBeUndefined();
  });

  it("blocks popups on third-party tabs", () => {
    const sandbox = iframeSandboxFor(
      "https://example.com/",
      "http://127.0.0.1:3780",
    );
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-popups");
  });
});

describe("org tab helpers", () => {
  it("reuses an open URL and can force a new tab", () => {
    const home = createHomeTab(DEFAULT_ORG_URL, "openXYOS");
    const reused = openOrgTab([home], DEFAULT_ORG_URL, "openXYOS");
    expect(reused.tabs).toHaveLength(1);
    expect(reused.activeId).toBe("org-home");
    const extra = openOrgTab([home], DEFAULT_ORG_URL, "openXYOS", false);
    expect(extra.tabs).toHaveLength(2);
    expect(extra.activeId).not.toBe("org-home");
  });

  it("keeps iframe src stable when the SPA reports navigation", () => {
    const home = createHomeTab(DEFAULT_ORG_URL, "openXYOS");
    const next = navigateOrgTab(
      [home],
      "org-home",
      "http://127.0.0.1:3780/employees",
      "Employees",
      false,
    );
    expect(next[0]?.url).toBe("http://127.0.0.1:3780/employees");
    expect(next[0]?.srcUrl).toBe(DEFAULT_ORG_URL);
    expect(next[0]?.title).toBe("Employees");
  });

  it("tracks back / forward / reload on the active tab", () => {
    const home = createHomeTab(DEFAULT_ORG_URL, "openXYOS");
    const employees = "http://127.0.0.1:3780/employees";
    const next = navigateOrgTab([home], "org-home", employees, "Employees");
    expect(canGoBack(next[0])).toBe(true);
    expect(canGoForward(next[0])).toBe(false);
    const back = goBackOrgTab(next, "org-home", "openXYOS");
    expect(back[0]?.url).toBe(DEFAULT_ORG_URL);
    expect(back[0]?.srcUrl).toBe(DEFAULT_ORG_URL);
    expect(canGoForward(back[0])).toBe(true);
    const forward = goForwardOrgTab(back, "org-home", "openXYOS");
    expect(forward[0]?.url).toBe(employees);
    const reloaded = reloadOrgTab(forward, "org-home");
    expect(reloaded[0]?.reloadSeq).toBe(1);
    expect(reloaded[0]?.srcUrl).toBe(employees);
  });

  it("closes a tab and activates a neighbor", () => {
    const home = createHomeTab(DEFAULT_ORG_URL, "openXYOS");
    const opened = openOrgTab([home], "https://example.com/", "example", false);
    const closed = closeOrgTab(opened.tabs, opened.activeId, opened.activeId);
    expect(closed.tabs).toHaveLength(1);
    expect(closed.activeId).toBe("org-home");
  });
});

describe("embed messages", () => {
  it("accepts open-tab and navigated payloads", () => {
    expect(
      parseOrgOpenTabMessage({
        type: "openxyos:open-tab",
        url: "https://github.com/x",
        title: "GitHub",
      }),
    ).toEqual({ url: "https://github.com/x", title: "GitHub" });
    expect(
      parseOrgNavigatedMessage({
        type: "openxyos:navigated",
        url: "http://127.0.0.1:3780/org?freeos_embed=1&freeos_sync=1",
        title: "Org",
      }),
    ).toEqual({ url: "http://127.0.0.1:3780/org", title: "Org" });
    expect(parseOrgOpenTabMessage({ type: "openxyos:open-tab" })).toBeNull();
  });

  it("strips embed query keys from the address bar", () => {
    expect(
      stripEmbedParams(
        "http://127.0.0.1:3780/?freeos_embed=1&freeos_disabled=chat",
      ),
    ).toBe("http://127.0.0.1:3780/");
  });

  it("labels loopback hosts as the home tab", () => {
    expect(tabTitleFromUrl("http://127.0.0.1:3780/x", "openXYOS")).toBe(
      "openXYOS",
    );
    expect(tabTitleFromUrl("https://github.com/x", "openXYOS")).toBe(
      "github.com",
    );
    expect(sidecarOriginOf("http://127.0.0.1:3780/")).toBe(
      "http://127.0.0.1:3780",
    );
  });
});

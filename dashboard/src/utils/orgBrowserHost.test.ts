import { afterEach, describe, expect, it } from "vitest";
import { registerOrgBrowserHost, tryOpenInOrgBrowser } from "./orgBrowserHost";

describe("orgBrowserHost", () => {
  afterEach(() => {
    delete (window as Window & { __FREEOS_ORG_OPEN_TAB__?: unknown })
      .__FREEOS_ORG_OPEN_TAB__;
  });

  it("routes a URL to the registered Organization host", () => {
    const opened: string[] = [];
    const stop = registerOrgBrowserHost((url) => {
      opened.push(url);
      return true;
    });
    expect(tryOpenInOrgBrowser("https://example.com/")).toBe(true);
    expect(opened).toEqual(["https://example.com/"]);
    stop();
    expect(tryOpenInOrgBrowser("https://example.com/other")).toBe(false);
  });
});

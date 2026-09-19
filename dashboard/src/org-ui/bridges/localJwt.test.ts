import { describe, expect, it, vi } from "vitest";
import {
  STANDALONE_SESSION_KEY,
  STANDALONE_TOKEN_KEY,
  StandaloneUnauthorizedError,
  createBridgeFetcher,
  createLocalJwtBridge,
  sessionFromLoginUser,
} from "./localJwt";

function memoryStorage(seed?: Record<string, string>) {
  const data = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    data,
  };
}

describe("createLocalJwtBridge", () => {
  it("uses a token key distinct from the Dashboard session", () => {
    expect(STANDALONE_TOKEN_KEY).toBe("openxyos.standalone.jwt");
    expect(STANDALONE_TOKEN_KEY).not.toBe("auth_token");
  });

  it("stores local JWT headers and session without host actions", () => {
    const storage = memoryStorage();
    const navigate = vi.fn();
    const bridge = createLocalJwtBridge({
      apiBase: "/api",
      locale: "zh",
      storage,
      navigate,
    });
    expect(bridge.showHostActions).toBe(false);
    expect(bridge.apiBase()).toBe("/api");
    expect(bridge.hasToken()).toBe(false);
    expect(bridge.authHeaders()).toEqual({});

    bridge.setSession("tok-1", {
      userId: 7,
      displayName: "Ada",
      role: "admin",
      isAdmin: true,
    });
    expect(bridge.hasToken()).toBe(true);
    expect(bridge.authHeaders()).toEqual({ Authorization: "Bearer tok-1" });
    expect(bridge.getSession()).toEqual({
      userId: 7,
      displayName: "Ada",
      role: "admin",
      isAdmin: true,
    });
    expect(storage.getItem(STANDALONE_TOKEN_KEY)).toBe("tok-1");
    expect(storage.getItem(STANDALONE_SESSION_KEY)).toContain("Ada");

    bridge.navigate("/org");
    expect(navigate).toHaveBeenCalledWith("/org");
    bridge.clearSession();
    expect(bridge.hasToken()).toBe(false);
    expect(bridge.getSession().displayName).toBe("");
  });

  it("maps a FreeOS login user onto OrgSession", () => {
    expect(
      sessionFromLoginUser({
        id: 3,
        username: "ada",
        display_name: "Ada Lovelace",
        role: "admin",
      }),
    ).toEqual({
      userId: 3,
      displayName: "Ada Lovelace",
      role: "admin",
      isAdmin: true,
    });
  });
});

describe("createBridgeFetcher", () => {
  it("prefixes apiBase and attaches the standalone Bearer token", async () => {
    const storage = memoryStorage();
    const bridge = createLocalJwtBridge({ apiBase: "/api", storage });
    bridge.setSession("abc", {
      userId: 1,
      displayName: "Ada",
      role: "admin",
      isAdmin: true,
    });
    const fetchMock = vi.fn(async () => ({
      status: 200,
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: { count: 1 } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const fetchJson = createBridgeFetcher(bridge);
    const payload = await fetchJson<{ success: boolean }>(
      "/org-module/overview",
    );
    expect(payload).toEqual({ success: true, data: { count: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/org-module/overview");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer abc");
    vi.unstubAllGlobals();
  });

  it("throws StandaloneUnauthorizedError on 401", async () => {
    const bridge = createLocalJwtBridge({
      apiBase: "/api",
      storage: memoryStorage(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 401,
        ok: false,
        headers: new Headers(),
        text: async () => "nope",
      })),
    );
    await expect(
      createBridgeFetcher(bridge)("/org-module/settings"),
    ).rejects.toBeInstanceOf(StandaloneUnauthorizedError);
    vi.unstubAllGlobals();
  });
});

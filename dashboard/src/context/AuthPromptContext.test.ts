import { describe, expect, it } from "vitest";
import { userNeedsAccount } from "./AuthPromptContext";
import type { OctopUser } from "../api/modules/auth";

function user(overrides: Partial<OctopUser> = {}): OctopUser {
  return {
    id: 1,
    username: "local",
    role: "admin",
    display_name: "FreeOS",
    locale: "zh",
    is_local: true,
    ...overrides,
  };
}

describe("userNeedsAccount", () => {
  it("is true for the unclaimed local guest", () => {
    expect(userNeedsAccount(user())).toBe(true);
  });

  it("is false after the guest registers", () => {
    expect(userNeedsAccount(user({ is_local: false, username: "owner" }))).toBe(
      false,
    );
  });

  it("is false when no user is loaded", () => {
    expect(userNeedsAccount(null)).toBe(false);
  });
});

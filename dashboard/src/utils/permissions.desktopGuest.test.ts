import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  isLocalDesktopGuest,
  navAllowed,
  userCan,
} from "./permissions";

const desktopGuest = {
  role: "user",
  username: "local",
  is_local: true,
  permissions: [] as string[],
};

const restricted = {
  role: "user",
  username: "guest",
  permissions: [] as string[],
};

describe("desktop local guest permissions", () => {
  it("recognizes the unclaimed local session", () => {
    expect(isLocalDesktopGuest(desktopGuest)).toBe(true);
    expect(isLocalDesktopGuest(restricted)).toBe(false);
    expect(isLocalDesktopGuest({ role: "user", username: "local" })).toBe(true);
  });

  it("can open models and knowledge bases on first-run desktop", () => {
    expect(navAllowed(desktopGuest, "models")).toBe(true);
    expect(navAllowed(desktopGuest, "knowledge-bases")).toBe(true);
    expect(canAccessPath(desktopGuest, "/models")).toBe(true);
    expect(canAccessPath(desktopGuest, "/knowledge-bases")).toBe(true);
    expect(userCan(desktopGuest, "ollama_models")).toBe(true);
    expect(userCan(desktopGuest, "knowledge_bases")).toBe(true);
  });

  it("does not unlock admin pages for the desktop guest", () => {
    expect(navAllowed(desktopGuest, "admin-users")).toBe(false);
    expect(canAccessPath(desktopGuest, "/personalization/users")).toBe(false);
    expect(userCan(desktopGuest, "users")).toBe(false);
  });

  it("still hides models for a regular user without permissions", () => {
    expect(navAllowed(restricted, "models")).toBe(false);
    expect(canAccessPath(restricted, "/models")).toBe(false);
    expect(navAllowed(restricted, "knowledge-bases")).toBe(false);
  });
});

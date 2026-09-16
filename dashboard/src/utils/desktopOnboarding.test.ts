import { afterEach, describe, expect, it } from "vitest";
import {
  desktopPostSessionPath,
  isDesktopModelOnboardingDone,
  markDesktopModelOnboardingDone,
} from "./desktopOnboarding";

describe("desktopOnboarding", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("starts unfinished and remembers skip or save", () => {
    expect(isDesktopModelOnboardingDone()).toBe(false);
    expect(desktopPostSessionPath()).toBe("/setup");
    markDesktopModelOnboardingDone();
    expect(isDesktopModelOnboardingDone()).toBe(true);
    expect(desktopPostSessionPath()).toBe("/projects");
  });

  it("treats an existing provider as already finished", () => {
    expect(desktopPostSessionPath(true)).toBe("/projects");
    expect(isDesktopModelOnboardingDone()).toBe(true);
  });
});

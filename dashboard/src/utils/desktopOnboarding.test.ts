import { afterEach, describe, expect, it } from "vitest";
import {
  DESKTOP_FIRST_CHAT_PATH,
  DESKTOP_MODEL_SETUP_PATH,
  DESKTOP_RETURNING_HOME_PATH,
  desktopAfterModelSetupPath,
  desktopPostSessionPath,
  isDesktopModelOnboardingDone,
  markDesktopModelOnboardingDone,
  needsDesktopModelOnboarding,
} from "./desktopOnboarding";

describe("desktopOnboarding", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("starts unfinished and remembers skip or save", () => {
    expect(isDesktopModelOnboardingDone()).toBe(false);
    expect(needsDesktopModelOnboarding()).toBe(true);
    expect(desktopPostSessionPath()).toBe(DESKTOP_MODEL_SETUP_PATH);
    markDesktopModelOnboardingDone();
    expect(isDesktopModelOnboardingDone()).toBe(true);
    expect(needsDesktopModelOnboarding()).toBe(false);
    expect(desktopPostSessionPath()).toBe(DESKTOP_RETURNING_HOME_PATH);
  });

  it("treats an existing provider as already finished", () => {
    expect(needsDesktopModelOnboarding(true)).toBe(false);
    expect(desktopPostSessionPath(true)).toBe(DESKTOP_RETURNING_HOME_PATH);
    expect(isDesktopModelOnboardingDone()).toBe(true);
  });

  it("opens the default first-agent chat after skip or save", () => {
    expect(desktopAfterModelSetupPath()).toBe(DESKTOP_FIRST_CHAT_PATH);
    expect(isDesktopModelOnboardingDone()).toBe(true);
    expect(desktopPostSessionPath()).toBe(DESKTOP_RETURNING_HOME_PATH);
  });
});

import { describe, expect, it } from "vitest";
import type { OctopUser } from "../../../api/modules/auth";
import {
  allowedPersonalizationTabs,
  SYSTEM_SETTINGS_TO_PERSONALIZATION,
} from "./tabs";

const adminUser = {
  id: 1,
  username: "admin",
  role: "admin",
  permissions: ["*"],
} as OctopUser;

describe("personalization tabs", () => {
  it("includes connectors, skill packages, and former system-settings host tabs", () => {
    const tabs = allowedPersonalizationTabs(adminUser, { mobileEnabled: true });
    expect(tabs).toContain("skills");
    expect(tabs).toContain("channels");
    expect(tabs).toContain("connectors");
    expect(tabs).toContain("skill-packages");
    expect(tabs).toContain("workbench");
    expect(tabs).toContain("users");
    expect(tabs).not.toContain("models");
  });

  it("maps the models system-settings tab to the top-level models page", () => {
    expect(SYSTEM_SETTINGS_TO_PERSONALIZATION.models).toBe("/models");
  });
});

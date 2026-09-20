import { describe, expect, it } from "vitest";
import {
  hostUserFromOrganization,
  type OrganizationIdentityUser,
} from "./auth";

describe("hostUserFromOrganization", () => {
  it("never maps an organization-room admin onto the studio admin role", () => {
    const user: OrganizationIdentityUser = {
      id: 11,
      email: "root@example.local",
      nickname: "Root",
      role: "super_admin",
      tenant_id: 4,
    };
    const host = hostUserFromOrganization(user);
    expect(host.role).toBe("user");
    expect(host.organization_role).toBe("super_admin");
    expect(host.username).toBe("root@example.local");
  });
});

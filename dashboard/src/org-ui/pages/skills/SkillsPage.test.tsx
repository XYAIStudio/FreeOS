import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillsPage } from "./SkillsPage";
import type { OrgSkillsClient } from "../../api/createClient";

function mockClient(): OrgSkillsClient {
  return {
    list: vi.fn(async () => ({
      out_dir: "/tmp/org-skills",
      skills: [
        {
          slug: "org-employees",
          module_key: "employees",
          name: "org-employees",
          description: "Call the employees module",
          label_en: "People & agents",
          label_zh: "人机资源",
          directory: "/tmp/org-skills/org-employees",
          skill_md: "/tmp/org-skills/org-employees/SKILL.md",
          published: false,
          plugin_dir: null,
        },
      ],
      catalog: [
        {
          key: "employees",
          slug: "org-employees",
          label: "People & agents",
          label_zh: "人机资源",
          description: "Department employees",
          description_zh: "已入部门的员工",
          generated: true,
          published: false,
        },
        {
          key: "skills",
          slug: "org-skills",
          label: "Skill plugins",
          label_zh: "技能插件",
          description: "Agent skill catalog",
          description_zh: "技能目录",
          generated: false,
          published: false,
        },
      ],
      host_packages: [
        {
          id: "pkg-1",
          name: "Ops pack",
          description: "Host runtime package",
          skill_count: 3,
        },
      ],
    })),
    get: vi.fn(async () => ({
      slug: "org-employees",
      module_key: "employees",
      name: "org-employees",
      description: "Call the employees module",
      label_en: "People & agents",
      label_zh: "人机资源",
      directory: "/tmp/org-skills/org-employees",
      skill_md: "/tmp/org-skills/org-employees/SKILL.md",
      published: false,
      plugin_dir: null,
      content: "---\nname: org-employees\n---\n# Employees",
    })),
    generate: vi.fn(async () => ({
      out_dir: "/tmp/org-skills",
      skills: [
        {
          slug: "org-employees",
          module_key: "employees",
          directory: "/tmp/org-skills/org-employees",
        },
      ],
    })),
    publish: vi.fn(async () => ({
      plugin_id: "org-employees",
      module_key: "employees",
      source_skill: "/tmp/org-skills/org-employees",
      output_dir: "/tmp/org-skills/org-employees.plugin",
      notes: ["Draft only"],
    })),
  };
}

const adminSession = {
  userId: 1,
  displayName: "Ada",
  role: "admin",
  isAdmin: true,
};

const memberSession = {
  userId: 2,
  displayName: "Mo",
  role: "user",
  isAdmin: false,
};

describe("SkillsPage", () => {
  it("renders the shared page without an iframe", async () => {
    const client = mockClient();
    render(<SkillsPage client={client} session={adminSession} locale="en" />);
    expect(await screen.findByTestId("org-ui-skills")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("People & agents")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.list).toHaveBeenCalled();
  });

  it("lets an admin generate through the injected client", async () => {
    const client = mockClient();
    render(<SkillsPage client={client} session={adminSession} locale="en" />);
    fireEvent.click(await screen.findByTestId("org-skills-generate"));
    fireEvent.click(await screen.findByTestId("org-skills-confirm-generate"));
    await waitFor(() => {
      expect(client.generate).toHaveBeenCalled();
    });
  });

  it("hides generate for non-admins and still lists catalog skills", async () => {
    const client = mockClient();
    render(<SkillsPage client={client} session={memberSession} locale="en" />);
    expect(await screen.findByTestId("org-ui-skills")).toBeInTheDocument();
    expect(screen.queryByTestId("org-skills-generate")).toBeNull();
    expect(
      screen.getByText("Generate and publish are limited to administrators."),
    ).toBeInTheDocument();
    expect(screen.getByText("People & agents")).toBeInTheDocument();
  });

  it("opens skill content and publishes a draft", async () => {
    const client = mockClient();
    render(<SkillsPage client={client} session={adminSession} locale="en" />);
    fireEvent.click(await screen.findByTestId("org-skill-card-org-employees"));
    expect(await screen.findByTestId("org-skills-content")).toHaveTextContent(
      "org-employees",
    );
    fireEvent.click(screen.getByTestId("org-skills-publish-org-employees"));
    fireEvent.click(
      await screen.findByTestId("org-skills-confirm-publish-org-employees"),
    );
    await waitFor(() => {
      expect(client.publish).toHaveBeenCalledWith({ slug: "org-employees" });
    });
  });
});

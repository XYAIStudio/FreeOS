import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrganizationPage from "./index";
import { orgModuleApi, type OrgOverview } from "../../api/modules/orgModule";

const overview: OrgOverview = {
  enabled: true,
  sidecar_reachable: true,
  sidecar_embed_ok: true,
  sidecar_url: "http://127.0.0.1:3780",
  start_available: false,
  install_ready: true,
  start_command: "",
  home: "/tmp",
  last_sync: null,
  freeos: {
    employees: 1,
    employee_states: {},
    agents: 0,
    spawned_colleagues: 1,
    org_skills: 0,
    skill_packages: 0,
    mcp: 0,
    tasks: 0,
  },
  openxyos: {
    reachable: true,
    url: "http://127.0.0.1:3780",
    detail: "ok",
    modules: 4,
    governance: true,
    tenant_id: "1",
    approvals: 0,
  },
  last_loop: null,
  notes: [],
  catalog: [
    {
      key: "org",
      label: "Org",
      label_zh: "组织",
      description: "Org tree",
      description_zh: "组织树",
      locked: true,
    },
  ],
  module_toggles: { org: true },
};

vi.mock("../../api/modules/orgModule", () => ({
  orgModuleApi: {
    overview: vi.fn(async () => overview),
    setEnabled: vi.fn(),
    startSidecar: vi.fn(),
    assemble: vi.fn(),
    produce: vi.fn(),
    pack: vi.fn(),
    runLoop: vi.fn(),
    setModules: vi.fn(),
    downloadSource: vi.fn(),
  },
}));

vi.mock("../../hooks/useServerTimezone", () => ({
  useServerTimezone: () => "UTC",
}));

describe("OrganizationPage", () => {
  it("defaults to the local embed and keeps extras behind the two status buttons", async () => {
    render(<OrganizationPage />);

    await waitFor(() => {
      expect(
        screen.getByTitle("organization.previewTitle"),
      ).toBeInTheDocument();
    });
    const frame = screen.getByTitle("organization.previewTitle");
    expect(frame).toHaveAttribute("src", "http://127.0.0.1:3780/");

    expect(screen.queryByText("organization.assembleAction")).toBeNull();
    expect(screen.queryByText("organization.startSidecarAction")).toBeNull();

    fireEvent.click(screen.getByTestId("org-enable-module"));
    expect(
      await screen.findByText("organization.catalogTitle"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("org-manage-os"));
    expect(
      await screen.findByText("organization.assembleTitle"),
    ).toBeInTheDocument();
    expect(screen.getByText("organization.loopTitle")).toBeInTheDocument();
    expect(
      screen.getAllByText("organization.downloadSource").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByTestId("org-preview-blank")).toBeNull();
  });

  it("surfaces a blank-preview error when livez is up but embed origin fails", async () => {
    vi.mocked(orgModuleApi.overview).mockResolvedValue({
      ...overview,
      sidecar_embed_ok: false,
    });
    render(<OrganizationPage />);
    expect(await screen.findByTestId("org-preview-blank")).toHaveTextContent(
      "organization.previewBlank",
    );
    expect(
      screen.getByText("organization.sidecarEmbedFailed"),
    ).toBeInTheDocument();
  });

  it("shows pack landed counts and opens the employees preview", async () => {
    vi.mocked(orgModuleApi.overview).mockResolvedValue(overview);
    vi.mocked(orgModuleApi.pack).mockResolvedValue({
      pack: {
        directory: "/tmp/pack",
        skill_count: 12,
        plugin_count: 11,
        mcp_count: 1,
        agent_count: 2,
        notes: [],
      },
      applied: {
        pack_dir: "/tmp/pack",
        mirror_dir: "/tmp/mirror",
        remote_applied: true,
        mirrored: true,
        notes: ["control plane accepted the FreeOS ingest"],
        tenant_id: 2,
        preview_path: "/employees",
        landed: {
          tenant_id: 2,
          preview: "/employees",
          landed: {
            employees: { created: 2, updated: 0 },
            talent: { created: 2, updated: 0 },
            plugins: { created: 11, updated: 0 },
            skills: { created: 12, updated: 0 },
            mcp: { created: 1, updated: 0 },
          },
        },
      },
    });

    render(<OrganizationPage />);
    fireEvent.click(await screen.findByTestId("org-manage-os"));
    fireEvent.click(screen.getByText("organization.packAction"));

    expect(await screen.findByTestId("org-last-receipt")).toHaveTextContent(
      "organization.packReceipt",
    );
    expect(screen.getByTestId("org-last-receipt")).toHaveTextContent(
      "organization.packLanded",
    );
    expect(screen.getByTestId("org-last-receipt")).toHaveTextContent(
      "organization.packPreviewEmployees",
    );
    await waitFor(() => {
      expect(screen.getByTitle("organization.previewTitle")).toHaveAttribute(
        "src",
        expect.stringContaining("/employees"),
      );
    });
  });
});

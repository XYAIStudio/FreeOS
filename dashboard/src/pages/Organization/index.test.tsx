import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationPage from "./index";
import { orgModuleApi, type OrgOverview } from "../../api/modules/orgModule";
import { message } from "../../utils/antdMessage";

function renderOrg() {
  return render(
    <MemoryRouter initialEntries={["/organization"]}>
      <Routes>
        <Route path="/organization" element={<OrganizationPage />} />
        <Route
          path="/organization/announcements"
          element={
            <div data-testid="org-announcements-page">announcements</div>
          }
        />
        <Route
          path="/experts"
          element={<div data-testid="experts-page">experts</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const overview: OrgOverview = {
  enabled: true,
  runtime: "in_host",
  sidecar_optional: true,
  sidecar_reachable: false,
  sidecar_embed_ok: false,
  sidecar_url: "http://127.0.0.1:3780",
  start_available: false,
  install_ready: false,
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
    reachable: false,
    url: "http://127.0.0.1:3780",
    detail: "sidecar optional; not configured",
    modules: 4,
    governance: true,
    tenant_id: "1",
    approvals: 0,
  },
  colleagues: [
    {
      slug: "ops-coordinator",
      name: "Ops",
      lifecycle: "active",
      agent_id: "org-ops-coordinator",
      spawned: true,
    },
  ],
  experts: [
    { agent_id: "org-ops-coordinator", slug: "ops-coordinator", name: "Ops" },
  ],
  org_surfaces: { employees: 1, talent: 0, skills: 2, plugins: 1 },
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
    restartSidecar: vi.fn(),
    probeLivez: vi.fn(),
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

const pickDesktopFolder = vi.fn();
const canPickDesktopFolder = vi.fn();

vi.mock("../../utils/desktopFolder", () => ({
  pickDesktopFolder: (...args: unknown[]) => pickDesktopFolder(...args),
  canPickDesktopFolder: (...args: unknown[]) => canPickDesktopFolder(...args),
}));

vi.mock("../../utils/antdMessage", () => ({
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("OrganizationPage", () => {
  beforeEach(() => {
    canPickDesktopFolder.mockReturnValue(true);
    pickDesktopFolder.mockReset();
    vi.mocked(orgModuleApi.overview).mockResolvedValue(overview);
    vi.mocked(orgModuleApi.downloadSource).mockReset();
    vi.mocked(orgModuleApi.startSidecar).mockReset();
    vi.mocked(orgModuleApi.restartSidecar).mockReset();
    vi.mocked(orgModuleApi.probeLivez).mockReset();
    vi.mocked(orgModuleApi.assemble).mockReset();
    vi.mocked(orgModuleApi.pack).mockReset();
    vi.mocked(orgModuleApi.runLoop).mockReset();
    vi.mocked(message.success).mockReset();
    vi.mocked(message.error).mockReset();
  });

  it("paints the in-host workbench without a 3780 iframe or livez gate", async () => {
    renderOrg();

    expect(
      await screen.findByTestId("org-native-workbench"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("org-runtime-chip")).toHaveTextContent(
      "organization.inHostReady",
    );
    expect(screen.getByText("organization.assembleAction")).toBeInTheDocument();
    expect(screen.getByText("organization.packAction")).toBeInTheDocument();
    expect(screen.getByText("organization.loopAction")).toBeInTheDocument();
    expect(screen.getByTestId("org-colleagues")).toHaveTextContent("Ops");
    expect(screen.getByTestId("org-surfaces")).toBeInTheDocument();
    expect(screen.getByTestId("org-open-announcements")).toBeInTheDocument();
    expect(screen.queryByTestId("org-mini-browser")).toBeNull();
    expect(screen.queryByTestId("org-browser-frame")).toBeNull();
    expect(screen.queryByTestId("org-sidecar-gate")).toBeNull();
    expect(screen.queryByTestId("org-restart-sidecar")).toBeNull();
    expect(screen.queryByTestId("org-restart-overlay")).toBeNull();
    expect(orgModuleApi.startSidecar).not.toHaveBeenCalled();
    expect(orgModuleApi.probeLivez).not.toHaveBeenCalled();
  });

  it("does not auto-start or gate login when the optional sidecar is down", async () => {
    vi.mocked(orgModuleApi.overview).mockResolvedValue({
      ...overview,
      sidecar_reachable: false,
      start_available: true,
      install_ready: true,
    });
    renderOrg();
    await screen.findByTestId("org-native-workbench");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(orgModuleApi.startSidecar).not.toHaveBeenCalled();
    expect(screen.queryByTestId("org-sidecar-gate")).toBeNull();
    expect(screen.getByText("organization.assembleAction")).toBeInTheDocument();
  });

  it("keeps sidecar start and source download behind Advanced", async () => {
    pickDesktopFolder.mockResolvedValue("D:\\源码\\openXYOS");
    vi.mocked(orgModuleApi.downloadSource).mockResolvedValue({
      path: "D:\\源码\\openXYOS\\openXYOS-main.zip",
    });
    renderOrg();
    await screen.findByTestId("org-native-workbench");
    expect(screen.queryByTestId("org-download-source")).toBeNull();
    expect(screen.queryByTestId("org-start-sidecar")).toBeNull();

    fireEvent.click(screen.getByTestId("org-advanced-console"));
    fireEvent.click(await screen.findByTestId("org-download-source"));
    await waitFor(() => {
      expect(orgModuleApi.downloadSource).toHaveBeenCalledWith(
        "D:\\源码\\openXYOS",
      );
    });
    expect(message.success).toHaveBeenCalledWith(
      "organization.downloadSourceDone",
    );
  });

  it("opens in-host announcements without a sidecar iframe", async () => {
    renderOrg();
    fireEvent.click(await screen.findByTestId("org-open-announcements"));
    expect(
      await screen.findByTestId("org-announcements-page"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("org-browser-frame")).toBeNull();
  });

  it("imports into FreeOS and opens Experts so colleagues are selectable", async () => {
    vi.mocked(orgModuleApi.assemble).mockResolvedValue({
      sidecar_reachable: false,
      employees: ["ops-coordinator"],
      spawned: [
        {
          agent_id: "org-ops-coordinator",
          slug: "ops-coordinator",
          name: "Ops",
        },
      ],
      imported: { skills: ["org-governance"], plugins: ["bridge"] },
      skills: ["org-governance"],
      plugins: ["bridge"],
      preview_path: "/experts",
      notes: [
        "using in-host org storage and bundled openXYOS blueprint fixtures",
      ],
    });

    renderOrg();
    fireEvent.click(await screen.findByTestId("org-assemble"));

    expect(await screen.findByTestId("experts-page")).toBeInTheDocument();
    expect(orgModuleApi.assemble).toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith("organization.assembleDone");
  });

  it("packs to the in-host mirror without opening a 3780 preview", async () => {
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
        remote_applied: false,
        mirrored: true,
        notes: ["OPENXYOS_BASE_URL unset; applied to local mirror only"],
      },
    });

    renderOrg();
    fireEvent.click(await screen.findByTestId("org-pack"));

    expect(await screen.findByTestId("org-last-receipt")).toHaveTextContent(
      "organization.packLocalDone",
    );
    expect(screen.queryByTestId("org-browser-frame")).toBeNull();
    expect(message.success).toHaveBeenCalledWith("organization.packDone");
  });

  it("runs the growth loop without requiring sidecar health", async () => {
    vi.mocked(orgModuleApi.runLoop).mockResolvedValue({
      ok: true,
      tenant_id: "1",
      home: "/tmp",
      skills: ["org-employees"],
      employees: ["policy-analyst"],
      agents: [{ slug: "policy-analyst" }],
      lifecycle: { active: "active" },
      pack_dir: "/tmp/pack",
      mirror_dir: "/tmp/mirror",
      remote_applied: false,
      imported_roundtrip: {},
      governance_blocked: true,
      governance: {},
      notes: ["Loop produced colleagues"],
    });

    renderOrg();
    fireEvent.click(await screen.findByTestId("org-loop"));

    await waitFor(() => {
      expect(orgModuleApi.runLoop).toHaveBeenCalled();
    });
    expect(message.success).toHaveBeenCalledWith("organization.loopOk");
    expect(screen.queryByTestId("org-sidecar-gate")).toBeNull();
  });
});

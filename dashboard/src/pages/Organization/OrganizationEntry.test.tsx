import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationEntry from "./OrganizationEntry";
import { orgModuleApi, type OrgOverview } from "../../api/modules/orgModule";

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
    employees: 0,
    employee_states: {},
    agents: 0,
    spawned_colleagues: 0,
    org_skills: 0,
    skill_packages: 0,
    mcp: 0,
    tasks: 0,
  },
  openxyos: {
    reachable: false,
    url: "http://127.0.0.1:3780",
    detail: "",
    modules: 12,
    governance: true,
    tenant_id: "default",
    approvals: 0,
  },
  last_loop: null,
  notes: [],
  catalog: [],
};

vi.mock("../../api/modules/orgModule", () => ({
  orgModuleApi: {
    identityStatus: vi.fn(async () => ({
      integrated: true,
      authority: "organization",
    })),
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

vi.mock("../../utils/desktopFolder", () => ({
  pickDesktopFolder: vi.fn(),
  canPickDesktopFolder: () => false,
}));

vi.mock("../../utils/antdMessage", () => ({
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("OrganizationEntry", () => {
  beforeEach(() => {
    vi.mocked(orgModuleApi.overview).mockResolvedValue(overview);
    vi.mocked(orgModuleApi.identityStatus).mockResolvedValue({
      integrated: true,
      authority: "organization",
    });
  });

  it("keeps the native workbench as Organization home when desktop is integrated", async () => {
    render(
      <MemoryRouter initialEntries={["/organization"]}>
        <Routes>
          <Route path="/organization" element={<OrganizationEntry />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByTestId("org-native-workbench"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("org-original-app-hint"),
    ).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

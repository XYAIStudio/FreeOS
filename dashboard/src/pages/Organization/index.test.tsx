import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationPage from "./index";
import { orgModuleApi, type OrgOverview } from "../../api/modules/orgModule";
import { message } from "../../utils/antdMessage";
import { tryOpenInOrgBrowser } from "../../utils/orgBrowserHost";

function renderOrg() {
  return render(
    <MemoryRouter initialEntries={["/organization"]}>
      <Routes>
        <Route path="/organization" element={<OrganizationPage />} />
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
    restartSidecar: vi.fn(),
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
    vi.mocked(orgModuleApi.assemble).mockReset();
    vi.mocked(orgModuleApi.pack).mockReset();
    vi.mocked(message.success).mockReset();
    vi.mocked(message.error).mockReset();
  });

  it("embeds a multi-tab browser for local openXYOS and keeps extras behind drawers", async () => {
    renderOrg();

    await waitFor(() => {
      expect(screen.getByTestId("org-mini-browser")).toBeInTheDocument();
    });
    const frame = screen.getByTestId("org-browser-frame");
    expect(frame).toHaveAttribute(
      "src",
      expect.stringMatching(/^http:\/\/127\.0\.0\.1:3780\/\?freeos_embed=1/),
    );
    expect(screen.getByTestId("org-address-bar")).toHaveValue(
      "http://127.0.0.1:3780/",
    );
    expect(screen.getByTestId("org-browser-back")).toBeDisabled();
    expect(screen.getByTestId("org-browser-forward")).toBeDisabled();
    expect(screen.getByTestId("org-browser-reload")).toBeEnabled();
    const restart = screen.getByTestId("org-restart-sidecar");
    const lastSync = screen.getByTestId("org-last-sync");
    expect(
      restart.compareDocumentPosition(lastSync) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("organization.openSidecar")).toBeNull();
    expect(screen.getByTestId("org-download-source")).toHaveTextContent(
      "organization.downloadSourceBar",
    );

    expect(screen.queryByText("organization.assembleAction")).toBeNull();
    expect(screen.queryByText("organization.startSidecarAction")).toBeNull();
    expect(screen.queryByTestId("org-download-source-drawer")).toBeNull();

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
      screen.getByTestId("org-download-source-drawer"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("org-preview-blank")).toBeNull();
  });

  it("downloads latest source from the status bar after picking a folder", async () => {
    pickDesktopFolder.mockResolvedValue("D:\\源码\\openXYOS");
    vi.mocked(orgModuleApi.downloadSource).mockResolvedValue({
      path: "D:\\源码\\openXYOS\\openXYOS-main.zip",
    });

    renderOrg();
    fireEvent.click(await screen.findByTestId("org-download-source"));

    await waitFor(() => {
      expect(pickDesktopFolder).toHaveBeenCalled();
      expect(orgModuleApi.downloadSource).toHaveBeenCalledWith(
        "D:\\源码\\openXYOS",
      );
    });
    expect(message.success).toHaveBeenCalledWith(
      "organization.downloadSourceDone",
    );
    expect(screen.queryByText("organization.assembleTitle")).toBeNull();
  });

  it("does not download when the folder picker is cancelled", async () => {
    pickDesktopFolder.mockResolvedValue(null);

    renderOrg();
    fireEvent.click(await screen.findByTestId("org-download-source"));

    await waitFor(() => {
      expect(pickDesktopFolder).toHaveBeenCalled();
    });
    expect(orgModuleApi.downloadSource).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
  });

  it("opens trapped window.open / host URLs as extra tabs", async () => {
    renderOrg();
    await screen.findByTestId("org-mini-browser");

    expect(
      tryOpenInOrgBrowser("https://github.com/XYAIStudio/openXYOS", "GitHub"),
    ).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("org-address-bar")).toHaveValue(
        "https://github.com/XYAIStudio/openXYOS",
      );
    });
    expect(
      screen
        .getAllByTestId("org-browser-frame")
        .some(
          (node) =>
            node.getAttribute("src") ===
            "https://github.com/XYAIStudio/openXYOS",
        ),
    ).toBe(true);

    expect(window.open("https://example.com/docs", "_blank")).toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId("org-address-bar")).toHaveValue(
        "https://example.com/docs",
      );
    });
  });

  it("navigates the active tab from the address bar", async () => {
    renderOrg();
    const address = await screen.findByTestId("org-address-bar");
    fireEvent.change(address, {
      target: { value: "https://example.com/path" },
    });
    fireEvent.submit(address.closest("form") as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByTestId("org-browser-frame")).toHaveAttribute(
        "src",
        "https://example.com/path",
      );
    });
    expect(screen.getByTestId("org-browser-back")).toBeEnabled();
    fireEvent.click(screen.getByTestId("org-browser-back"));
    await waitFor(() => {
      expect(screen.getByTestId("org-address-bar")).toHaveValue(
        "http://127.0.0.1:3780/",
      );
    });
    fireEvent.click(screen.getByTestId("org-browser-reload"));
    await waitFor(() => {
      expect(screen.getByTestId("org-browser-frame")).toHaveAttribute(
        "data-tab-id",
        "org-home",
      );
    });
  });

  it("restarts openXYOS and returns the embed to the local home page", async () => {
    vi.mocked(orgModuleApi.restartSidecar).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        started: true,
        already: false,
        reachable: true,
        url: "http://127.0.0.1:3780",
        command: "start-sidecar",
        detail: "restarted openXYOS frontend and backend",
        launcher: "",
      };
    });
    renderOrg();
    const address = await screen.findByTestId("org-address-bar");
    fireEvent.change(address, {
      target: { value: "https://example.com/docs" },
    });
    fireEvent.submit(address.closest("form") as HTMLFormElement);
    fireEvent.click(screen.getByTestId("org-restart-sidecar"));
    expect(
      await screen.findByTestId("org-restart-overlay"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(orgModuleApi.restartSidecar).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId("org-address-bar")).toHaveValue(
        "http://127.0.0.1:3780/",
      );
    });
    expect(screen.queryByTestId("org-restart-overlay")).toBeNull();
    expect(message.success).toHaveBeenCalledWith(
      "organization.restartSidecarDone",
    );
  });

  it("auto-starts the sidecar when Organization is opened offline", async () => {
    vi.mocked(orgModuleApi.overview).mockResolvedValue({
      ...overview,
      sidecar_reachable: false,
      sidecar_embed_ok: false,
      start_available: true,
    });
    vi.mocked(orgModuleApi.startSidecar).mockResolvedValue({
      started: true,
      already: false,
      reachable: true,
      url: "http://127.0.0.1:3780",
      command: "",
      detail: "ok",
      launcher: "",
    });
    renderOrg();
    await waitFor(() => {
      expect(orgModuleApi.startSidecar).toHaveBeenCalled();
    });
  });

  it("surfaces a blank-preview error when livez is up but embed origin fails", async () => {
    vi.mocked(orgModuleApi.overview).mockResolvedValue({
      ...overview,
      sidecar_embed_ok: false,
    });
    renderOrg();
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

    renderOrg();
    fireEvent.click(await screen.findByTestId("org-manage-os"));
    fireEvent.click(screen.getByTestId("org-pack"));

    await waitFor(() => {
      expect(screen.getByTestId("org-address-bar")).toHaveValue(
        "http://127.0.0.1:3780/employees",
      );
    });
    expect(screen.queryByText("organization.assembleTitle")).toBeNull();
    expect(message.success).toHaveBeenCalledWith("organization.packDone");
  });

  it("imports into FreeOS and opens Experts so colleagues are selectable", async () => {
    vi.mocked(orgModuleApi.assemble).mockResolvedValue({
      sidecar_reachable: true,
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
      notes: ["imported live control-plane export"],
    });

    renderOrg();
    fireEvent.click(await screen.findByTestId("org-manage-os"));
    fireEvent.click(screen.getByTestId("org-assemble"));

    expect(await screen.findByTestId("experts-page")).toBeInTheDocument();
    expect(orgModuleApi.assemble).toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith("organization.assembleDone");
  });
});

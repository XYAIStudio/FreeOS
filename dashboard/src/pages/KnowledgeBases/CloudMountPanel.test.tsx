import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const imaStatus = vi.fn();
const imaConnect = vi.fn();
const imaListBases = vi.fn();
const imaListDocuments = vi.fn();
const setMount = vi.fn();
const getMount = vi.fn();

vi.mock("../../api/modules/knowledgeBases", () => ({
  knowledgeBasesApi: {
    imaStatus: (...args: unknown[]) => imaStatus(...args),
    imaConnect: (...args: unknown[]) => imaConnect(...args),
    imaListBases: (...args: unknown[]) => imaListBases(...args),
    imaListDocuments: (...args: unknown[]) => imaListDocuments(...args),
    getMount: (...args: unknown[]) => getMount(...args),
    setMount: (...args: unknown[]) => setMount(...args),
    distillMount: vi.fn(),
  },
}));

vi.mock("./pickKnowledgeFolder", () => ({
  pickKnowledgeFolder: vi.fn(),
  canPickKnowledgeFolder: () => false,
}));

import { CloudMountPanel } from "./CloudMountPanel";

describe("<CloudMountPanel />", () => {
  beforeEach(() => {
    imaStatus.mockReset();
    imaConnect.mockReset();
    imaListBases.mockReset();
    imaListDocuments.mockReset();
    setMount.mockReset();
    getMount.mockReset();
    imaStatus.mockResolvedValue({
      connected: false,
      instance_id: "",
      client_id_preview: "",
      auth_url: "https://ima.qq.com/agent-interface",
      instances: [],
    });
    getMount.mockResolvedValue({ mounted: false, entries: [] });
    imaListBases.mockResolvedValue({
      items: [{ id: "kb-ima", name: "工作库" }],
      next_cursor: "",
      is_end: true,
    });
    imaListDocuments.mockResolvedValue({
      items: [{ media_id: "doc-1", title: "周报" }],
      folders: [],
      current_path: [],
      next_cursor: "",
      is_end: true,
      knowledge_base_id: "kb-ima",
      folder_id: "",
    });
    imaConnect.mockResolvedValue({
      connected: true,
      instance_id: "inst-1",
      client_id_preview: "clid…1234",
      auth_url: "https://ima.qq.com/agent-interface",
      instances: [
        {
          instance_id: "inst-1",
          display_name: "腾讯 IMA",
          client_id_preview: "clid…1234",
        },
      ],
    });
    setMount.mockResolvedValue({ mounted: true, entries: [] });
  });

  it("connects through the official Agent Interface then saves selected KB and doc", async () => {
    const user = userEvent.setup();
    const ensureKb = vi.fn().mockResolvedValue("kb-local");

    render(<CloudMountPanel prominent ensureKb={ensureKb} />);

    expect(
      screen.getByRole("link", { name: /knowledgeBases.imaAuthLink/ }),
    ).toHaveAttribute("href", "https://ima.qq.com/agent-interface");

    await user.type(
      screen.getByPlaceholderText("knowledgeBases.imaClientId"),
      "client-id",
    );
    await user.type(
      screen.getByPlaceholderText("knowledgeBases.imaApiKey"),
      "api-key",
    );
    await user.click(
      screen.getByRole("button", { name: "knowledgeBases.imaConnectAction" }),
    );

    expect(imaConnect).toHaveBeenCalledWith({
      client_id: "client-id",
      api_key: "api-key",
      instance_id: undefined,
    });

    const kbBox = await screen.findByRole("checkbox", { name: "工作库" });
    await user.click(kbBox);
    const docBox = await screen.findByRole("checkbox", { name: "周报" });
    await user.click(docBox);
    await user.click(
      screen.getByRole("button", { name: "knowledgeBases.cloudMountAction" }),
    );

    expect(ensureKb).toHaveBeenCalled();
    expect(setMount).toHaveBeenCalledWith("kb-local", "", "", {
      kind: "cloud",
      cloud_provider: "ima",
      cloud_url: "https://ima.qq.com/agent-interface",
      connector_instance_id: "inst-1",
      selected_bases: [{ id: "kb-ima", name: "工作库" }],
      selected_docs: [
        {
          knowledge_base_id: "kb-ima",
          knowledge_base_name: "工作库",
          media_id: "doc-1",
          title: "周报",
        },
      ],
    });
  });

  it("browses official folder_ entries and searches documents", async () => {
    const user = userEvent.setup();
    imaStatus.mockResolvedValue({
      connected: true,
      instance_id: "inst-1",
      client_id_preview: "clid…1234",
      auth_url: "https://ima.qq.com/agent-interface",
      instances: [
        {
          instance_id: "inst-1",
          display_name: "腾讯 IMA",
          client_id_preview: "clid…1234",
        },
      ],
    });
    imaListDocuments.mockImplementation(
      async (_kb: string, opts?: { folder_id?: string; query?: string }) => {
        if (opts?.query === "排期") {
          return {
            items: [{ media_id: "doc-3", title: "排期" }],
            folders: [],
            current_path: [],
            next_cursor: "",
            is_end: true,
            knowledge_base_id: "kb-ima",
            folder_id: "",
            query: "排期",
          };
        }
        if (opts?.folder_id === "folder_abc") {
          return {
            items: [{ media_id: "doc-2", title: "需求" }],
            folders: [],
            current_path: [
              { folder_id: "folder_abc", name: "设计文档", is_folder: true },
            ],
            next_cursor: "",
            is_end: true,
            knowledge_base_id: "kb-ima",
            folder_id: "folder_abc",
          };
        }
        return {
          items: [],
          folders: [
            { folder_id: "folder_abc", name: "设计文档", is_folder: true },
          ],
          current_path: [],
          next_cursor: "",
          is_end: true,
          knowledge_base_id: "kb-ima",
          folder_id: "",
        };
      },
    );

    render(<CloudMountPanel prominent kbId="kb-local" />);

    expect(await screen.findByText("设计文档")).toBeInTheDocument();
    await user.click(screen.getByText("设计文档"));
    expect(
      await screen.findByRole("checkbox", { name: "需求" }),
    ).toBeInTheDocument();
    expect(imaListDocuments).toHaveBeenCalledWith("kb-ima", {
      folder_id: "folder_abc",
      query: "",
      cursor: "",
      instance_id: "inst-1",
    });

    await user.type(
      screen.getByPlaceholderText("knowledgeBases.imaSearchDocs"),
      "排期",
    );
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("checkbox", { name: "排期" }),
    ).toBeInTheDocument();
    expect(imaListDocuments).toHaveBeenLastCalledWith("kb-ima", {
      folder_id: "",
      query: "排期",
      cursor: "",
      instance_id: "inst-1",
    });
  });
});

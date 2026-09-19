import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KnowledgePage } from "./KnowledgePage";
import type { OrgKnowledgeClient } from "../../api/createClient";

function mockClient(): OrgKnowledgeClient {
  return {
    list: vi.fn(async () => ({
      host_route: "/knowledge-bases",
      store: "host_knowledge_bases",
      capability: {
        feature_enabled: true,
        usable: true,
        prerequisites_ok: true,
        selected_model: "bge",
        backend: "onnx",
      },
      bases: [
        {
          id: "kb-1",
          knowledge_base_id: "kb-1",
          name: "Policies",
          description: "Host knowledge base",
          shared: true,
          default_open: false,
          icon_name: "",
          document_count: 1,
          owner_user_id: 1,
          owned: true,
        },
      ],
      stats: { bases: 1, documents: 1, shared: 1, owned: 1 },
    })),
    get: vi.fn(async () => ({
      id: "kb-1",
      knowledge_base_id: "kb-1",
      name: "Policies",
      description: "Host knowledge base",
      shared: true,
      default_open: false,
      icon_name: "",
      document_count: 1,
      owner_user_id: 1,
      owned: true,
      documents: [
        {
          id: "doc-1",
          document_id: "doc-1",
          kb_id: "kb-1",
          filename: "handbook.md",
          path: "handbook.md",
          content_type: "text/markdown",
          byte_size: 12,
          is_dir: false,
          status: "ready",
          chunk_count: 1,
          created_at: 1,
          kind: "note",
        },
      ],
    })),
    preview: vi.fn(async () => ({
      id: "doc-1",
      document_id: "doc-1",
      kb_id: "kb-1",
      filename: "handbook.md",
      content_type: "text/markdown",
      text: "# Handbook",
      kind: "note",
    })),
    createBase: vi.fn(async () => ({
      id: "kb-2",
      knowledge_base_id: "kb-2",
      name: "New base",
      description: "",
      shared: false,
      default_open: false,
      icon_name: "",
      document_count: 0,
      owner_user_id: 1,
      owned: true,
    })),
    createNote: vi.fn(async () => ({
      id: "doc-2",
      document_id: "doc-2",
      kb_id: "kb-1",
      filename: "note.md",
      path: "note.md",
      content_type: "text/markdown",
      byte_size: 4,
      is_dir: false,
      status: "pending",
      chunk_count: 0,
      created_at: 2,
      kind: "note",
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

describe("KnowledgePage", () => {
  it("renders the shared page without an iframe", async () => {
    const client = mockClient();
    render(
      <KnowledgePage client={client} session={adminSession} locale="en" />,
    );
    expect(await screen.findByTestId("org-ui-knowledge")).toBeInTheDocument();
    expect(screen.getByText("Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Policies")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(client.list).toHaveBeenCalled();
  });

  it("lets a writer create a host knowledge base through the injected client", async () => {
    const client = mockClient();
    render(
      <KnowledgePage
        client={client}
        session={adminSession}
        locale="en"
        canWrite
      />,
    );
    fireEvent.click(await screen.findByTestId("org-knowledge-create-base"));
    fireEvent.change(screen.getByTestId("org-knowledge-base-name"), {
      target: { value: "New base" },
    });
    fireEvent.click(screen.getByTestId("org-knowledge-save-base"));
    fireEvent.click(await screen.findByTestId("org-knowledge-confirm-base"));
    await waitFor(() => {
      expect(client.createBase).toHaveBeenCalledWith({
        name: "New base",
        description: "",
        shared: false,
      });
    });
  });

  it("hides create actions without write access and still lists host bases", async () => {
    const client = mockClient();
    render(
      <KnowledgePage
        client={client}
        session={memberSession}
        locale="en"
        canWrite={false}
      />,
    );
    expect(await screen.findByTestId("org-ui-knowledge")).toBeInTheDocument();
    expect(screen.queryByTestId("org-knowledge-create-base")).toBeNull();
    expect(
      screen.getByText(
        "Creating bases and notes requires the knowledge-bases permission.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Policies")).toBeInTheDocument();
  });

  it("opens a document from the selected host knowledge base", async () => {
    const client = mockClient();
    render(
      <KnowledgePage client={client} session={adminSession} locale="en" />,
    );
    fireEvent.click(await screen.findByTestId("org-knowledge-card-kb-1"));
    fireEvent.click(await screen.findByTestId("org-knowledge-doc-doc-1"));
    expect(
      await screen.findByTestId("org-knowledge-preview"),
    ).toHaveTextContent("Handbook");
    expect(client.get).toHaveBeenCalledWith("kb-1");
    expect(client.preview).toHaveBeenCalledWith("kb-1", "doc-1");
  });
});

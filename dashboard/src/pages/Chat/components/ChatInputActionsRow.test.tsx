import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ResolvedModel } from "../../../api/types";
import ChatInputActionsRow from "./ChatInputActionsRow";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("./ContextWindowRing", () => ({
  default: () => null,
}));

const models: ResolvedModel[] = [
  {
    provider_id: 1,
    provider_name: "Provider",
    provider_kind: "openai",
    model: "compact-model",
    name: "Compact Model",
    context_window: 128_000,
  },
];

describe("ChatInputActionsRow compact pickers", () => {
  it("uses a popover instead of a full-width drawer on narrow desktop", async () => {
    const { container } = render(
      <MemoryRouter>
        <ChatInputActionsRow
          isMobile={false}
          isStreaming={false}
          canSend={false}
          text=""
          polishing={false}
          uploading={false}
          recording={false}
          transcribing={false}
          availableModels={models}
          onModelChange={vi.fn()}
          slashPickerGroups={null}
          slashMenuItems={[]}
          onSlashShortcutSelect={vi.fn()}
          onFileSelect={vi.fn()}
          onNewChat={vi.fn()}
          onPolish={vi.fn()}
          onToggleVoice={vi.fn()}
          onCancel={vi.fn()}
          onSubmit={vi.fn()}
        />
      </MemoryRouter>,
    );

    const modelButton = container
      .querySelector("svg.lucide-cpu")
      ?.closest("button");
    expect(modelButton).not.toBeNull();

    fireEvent.click(modelButton!);

    await waitFor(() => {
      expect(document.querySelector(".ant-popover")).toBeInTheDocument();
    });
    expect(document.querySelector(".ant-drawer-content")).toBeNull();
  });

  it("opens 模型管理 on the sidebar Models route", async () => {
    navigate.mockClear();
    const { container } = render(
      <MemoryRouter>
        <ChatInputActionsRow
          isMobile={false}
          isStreaming={false}
          canSend={false}
          text=""
          polishing={false}
          uploading={false}
          recording={false}
          transcribing={false}
          availableModels={models}
          onModelChange={vi.fn()}
          slashPickerGroups={null}
          slashMenuItems={[]}
          onSlashShortcutSelect={vi.fn()}
          onFileSelect={vi.fn()}
          onNewChat={vi.fn()}
          onPolish={vi.fn()}
          onToggleVoice={vi.fn()}
          onCancel={vi.fn()}
          onSubmit={vi.fn()}
        />
      </MemoryRouter>,
    );

    const modelButton = container
      .querySelector("svg.lucide-cpu")
      ?.closest("button");
    fireEvent.click(modelButton!);
    const manage = await screen.findByText("模型管理");
    fireEvent.click(manage);
    expect(navigate).toHaveBeenCalledWith("/models");
  });

  it("still shows 模型管理 when no models are configured", async () => {
    const { container } = render(
      <MemoryRouter>
        <ChatInputActionsRow
          isMobile={false}
          isStreaming={false}
          canSend={false}
          text=""
          polishing={false}
          uploading={false}
          recording={false}
          transcribing={false}
          availableModels={[]}
          onModelChange={vi.fn()}
          slashPickerGroups={null}
          slashMenuItems={[]}
          onSlashShortcutSelect={vi.fn()}
          onFileSelect={vi.fn()}
          onNewChat={vi.fn()}
          onPolish={vi.fn()}
          onToggleVoice={vi.fn()}
          onCancel={vi.fn()}
          onSubmit={vi.fn()}
        />
      </MemoryRouter>,
    );

    const modelButton = container
      .querySelector("svg.lucide-cpu")
      ?.closest("button");
    expect(modelButton).not.toBeNull();
    fireEvent.click(modelButton!);
    expect(await screen.findByText("模型管理")).toBeInTheDocument();
  });

  it("opens the workspace panel picker from the composer + button", async () => {
    const onOpenWorkspacePanel = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <ChatInputActionsRow
          isMobile={false}
          isStreaming={false}
          canSend={false}
          text=""
          polishing={false}
          uploading={false}
          recording={false}
          transcribing={false}
          slashPickerGroups={null}
          slashMenuItems={[]}
          onSlashShortcutSelect={vi.fn()}
          onFileSelect={vi.fn()}
          onOpenWorkspacePanel={onOpenWorkspacePanel}
          permissionMode="default"
          onPermissionModeChange={vi.fn()}
          onNewChat={vi.fn()}
          onPolish={vi.fn()}
          onToggleVoice={vi.fn()}
          onCancel={vi.fn()}
          onSubmit={vi.fn()}
        />
      </MemoryRouter>,
    );

    const plus = container.querySelector("svg.lucide-plus")?.closest("button");
    expect(plus).not.toBeNull();
    fireEvent.click(plus!);
    const openFiles = await screen.findByText("打开文件");
    fireEvent.click(openFiles.closest("button") ?? openFiles);
    expect(onOpenWorkspacePanel).toHaveBeenCalledWith("files");
  });

  it("shows the current permission mode on the trigger", () => {
    render(
      <MemoryRouter>
        <ChatInputActionsRow
          isMobile={false}
          isStreaming={false}
          canSend={false}
          text=""
          polishing={false}
          uploading={false}
          recording={false}
          transcribing={false}
          slashPickerGroups={null}
          slashMenuItems={[]}
          onSlashShortcutSelect={vi.fn()}
          onFileSelect={vi.fn()}
          permissionMode="full"
          onPermissionModeChange={vi.fn()}
          onNewChat={vi.fn()}
          onPolish={vi.fn()}
          onToggleVoice={vi.fn()}
          onCancel={vi.fn()}
          onSubmit={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("完全访问")).toBeInTheDocument();
  });
});

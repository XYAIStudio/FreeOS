import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ExpertPickerPopover, {
  resolveGroupMembers,
} from "./ExpertPickerPopover";
import type { ChatAgentOption } from "./ExpertAgentAvatar";

const agents: ChatAgentOption[] = [
  { agent_id: "a2", name: "研究员" },
  { agent_id: "a3", name: "设计师" },
];

const host: ChatAgentOption = { agent_id: "a1", name: "分析师" };

function renderPicker(
  props: Partial<ComponentProps<typeof ExpertPickerPopover>> = {},
) {
  return render(
    <MemoryRouter>
      <ExpertPickerPopover
        agents={agents}
        selectedAgentIds={[]}
        onSelect={vi.fn()}
        hostAgent={host}
        onEnterGroupChat={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("resolveGroupMembers", () => {
  it("includes the host plus checked experts", () => {
    const members = resolveGroupMembers(["a2"], agents, host);
    expect(members.map((item) => item.agent_id)).toEqual(["a1", "a2"]);
  });
});

describe("ExpertPickerPopover", () => {
  it("keeps row click as single-select and checkboxes for group chat", () => {
    const onSelect = vi.fn();
    const onEnterGroupChat = vi.fn();
    renderPicker({ onSelect, onEnterGroupChat });

    fireEvent.click(screen.getByRole("button", { name: "研究员" }));
    expect(onSelect).toHaveBeenCalledWith(agents[0]);
    expect(onEnterGroupChat).not.toHaveBeenCalled();

    const enter = screen.getByRole("button", {
      name: /expertPickerEnterGroupCount|进入群聊|Enter group chat/,
    });
    expect(enter).toBeDisabled();

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(enter).not.toBeDisabled();
    fireEvent.click(enter);
    expect(onEnterGroupChat).toHaveBeenCalledWith([
      expect.objectContaining({ agent_id: "a1" }),
      expect.objectContaining({ agent_id: "a2" }),
    ]);
  });
});

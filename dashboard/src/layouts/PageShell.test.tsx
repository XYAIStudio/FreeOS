import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PageShell from "./PageShell";

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

describe("PageShell path tabs", () => {
  it("renders wrapping tabs and keeps title copy horizontal", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PageShell
        title="个性化 / 子智能体"
        subtitle="技能、通道、连接器、技能包"
        pathTabs={{
          value: "subagents",
          onChange,
          options: [
            { value: "skills", label: "技能", icon: null },
            { value: "channels", label: "通道", icon: null },
            { value: "subagents", label: "子智能体", icon: null },
          ],
        }}
      >
        <div>body</div>
      </PageShell>,
    );

    expect(container.querySelector("div[class*='titleRow']")).toBeTruthy();
    expect(container.querySelector("div[class*='pathTabs']")).toBeTruthy();
    expect(screen.getByText("个性化 / 子智能体")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "技能" }));
    expect(onChange).toHaveBeenCalledWith("skills");
    expect(screen.getByRole("tab", { name: "子智能体" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

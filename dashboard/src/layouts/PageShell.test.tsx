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

  it("places a two-row flush strip below the title without a subtitle", () => {
    const labels = [
      "技能",
      "通道",
      "连接器/MCP",
      "技能包",
      "工具",
      "插件",
      "子智能体",
      "MBTI",
      "记忆",
      "工作台",
      "远程桌面",
      "ACP",
      "用户",
      "存储",
      "主机插件",
      "安全",
      "高级",
      "智能体配置",
    ];
    const { container } = render(
      <PageShell
        title="个性化 / 技能"
        pathTabsPlacement="below-title"
        pathTabs={{
          value: "skills",
          onChange: vi.fn(),
          options: labels.map((label) => ({
            value: label,
            label,
            icon: null,
          })),
        }}
      >
        <div>body</div>
      </PageShell>,
    );

    expect(screen.queryByText("技能、通道、连接器、技能包")).toBeNull();
    expect(container.querySelector("div[class*='titleActions']")).toBeNull();
    const rows = container.querySelectorAll("[data-testid='path-tabs-row']");
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll("[role='tab']")).toHaveLength(9);
    expect(rows[1].querySelectorAll("[role='tab']")).toHaveLength(9);
    expect(container.querySelector("div[class*='pathTabsFlush']")).toBeTruthy();
    expect(
      container.querySelector("div[class*='pathTabsBelowTitle']"),
    ).toBeTruthy();
  });

  it("scrolls the body when fill pins the title chrome", () => {
    render(
      <PageShell title="组织 / 公告" fill>
        <div data-testid="tall-body">body</div>
      </PageShell>,
    );
    const body = screen.getByTestId("page-shell-scroll-body");
    expect(body).toContainElement(screen.getByTestId("tall-body"));
    expect(body.className).toMatch(/fillBody/);
  });
});

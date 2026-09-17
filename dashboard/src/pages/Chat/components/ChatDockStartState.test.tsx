import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatDockStartState from "./ChatDockStartState";

describe("ChatDockStartState", () => {
  it("lists the five starter panels", () => {
    const onOpen = vi.fn();
    render(<ChatDockStartState onOpen={onOpen} />);
    expect(screen.getByText("开始一个面板")).toBeInTheDocument();
    fireEvent.click(screen.getByText("打开审查"));
    expect(onOpen).toHaveBeenCalledWith("review");
    fireEvent.click(screen.getByText("打开后台任务"));
    expect(onOpen).toHaveBeenCalledWith("tasks");
    fireEvent.click(screen.getByText("打开终端"));
    expect(onOpen).toHaveBeenCalledWith("terminal");
  });
});

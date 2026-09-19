import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { authApi } from "../../../api/modules/auth";
import ChatPermissionModeMenu from "./ChatPermissionModeMenu";

vi.mock("../../../api/modules/auth", () => ({
  authApi: { getAuthStatus: vi.fn() },
}));

describe("runtime permission capabilities", () => {
  it("resets a saved full mode and prevents unsupported selections", async () => {
    vi.mocked(authApi.getAuthStatus).mockResolvedValue({
      permission_mode_overrides: false,
    } as Awaited<ReturnType<typeof authApi.getAuthStatus>>);
    const onChange = vi.fn();
    const { container } = render(
      <ChatPermissionModeMenu mode="full" onChange={onChange} />,
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("default"));
    fireEvent.click(container.querySelector("button")!);
    const options = await screen.findAllByRole("menuitemradio");
    expect(options[0]).toBeEnabled();
    expect(options[1]).toBeDisabled();
    expect(options[2]).toBeDisabled();
    onChange.mockClear();
    fireEvent.click(options[2]);
    expect(onChange).not.toHaveBeenCalled();
  });
});

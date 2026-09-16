import { describe, expect, it } from "vitest";
import { repairUtf8Mojibake } from "./utf8Mojibake";

describe("repairUtf8Mojibake", () => {
  it("restores UTF-8 Chinese that was decoded as Windows-1252", () => {
    const bytes = new TextEncoder().encode("项目结构.png");
    const garbled = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
      "",
    );
    expect(garbled).not.toBe("项目结构.png");
    expect(repairUtf8Mojibake(garbled)).toBe("项目结构.png");
  });

  it("leaves already-valid Unicode and ASCII alone", () => {
    expect(repairUtf8Mojibake("项目结构.png")).toBe("项目结构.png");
    expect(repairUtf8Mojibake("D:\\docs\\notes")).toBe("D:\\docs\\notes");
  });
});

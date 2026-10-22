import { describe, expect, it } from "vitest";
import { normalizeXHandle } from "./GenesisWhitelist";

describe("normalizeXHandle", () => {
  it("accepts @handle, URL, and bare handle", () => {
    expect(normalizeXHandle("@Alice_gno")).toBe("Alice_gno");
    expect(normalizeXHandle("Alice_gno")).toBe("Alice_gno");
    expect(normalizeXHandle("https://x.com/Alice_gno")).toBe("Alice_gno");
    expect(normalizeXHandle("https://twitter.com/Alice_gno?s=20")).toBe("Alice_gno");
  });

  it("rejects empty, spaces, and overlong", () => {
    expect(normalizeXHandle("")).toBe("");
    expect(normalizeXHandle("   ")).toBe("");
    expect(normalizeXHandle("bad handle")).toBe("");
    expect(normalizeXHandle("a".repeat(33))).toBe("");
  });
});

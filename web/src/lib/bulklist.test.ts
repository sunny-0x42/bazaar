import { describe, expect, it } from "vitest";
import {
  LIST_PER_TX,
  applyPrice,
  bulkMessages,
  dropMissing,
  listButtonLabel,
  listGasWanted,
  packListTxs,
  selectAll,
  togglePick,
} from "./bulklist";

describe("bulk list", () => {
  it("toggles a pick and keeps the offered price", () => {
    const once = togglePick({}, "bazaargens:7", "1.5");
    expect(once).toEqual({ "bazaargens:7": "1.5" });
    expect(togglePick(once, "bazaargens:7", "9")).toEqual({});
  });

  it("selects only the keys that are not already priced", () => {
    const next = selectAll(["a", "b"], "2", { a: "1" });
    expect(next).toEqual({ a: "1", b: "2" });
  });

  it("applies one price to every selected key", () => {
    expect(applyPrice({ a: "1", b: "3" }, "4")).toEqual({ a: "4", b: "4" });
  });

  it("drops picks that left the wallet", () => {
    const prev = { a: "1", b: "2" };
    expect(dropMissing(prev, ["a"])).toEqual({ a: "1" });
    expect(dropMissing(prev, ["a", "b"])).toBe(prev);
  });

  it("builds List and UpdatePrice and skips a zero price", () => {
    const msgs = bulkMessages([
      { id: "7", listed: false, pkgPath: "gno.land/r/demo/bazaar/c/gens", priceUgnot: 1_500_000 },
      { id: "8", listed: true, pkgPath: "gno.land/r/demo/bazaar/c/gens", priceUgnot: 2_000_000 },
      { id: "9", listed: false, pkgPath: "gno.land/r/demo/bazaar/c/gens", priceUgnot: 0 },
    ]);
    expect(msgs).toEqual([
      { pkgPath: "gno.land/r/demo/bazaar/c/gens", func: "List", args: ["7", "1500000"] },
      { pkgPath: "gno.land/r/demo/bazaar/c/gens", func: "UpdatePrice", args: ["8", "2000000"] },
    ]);
  });

  it("packs 21 listings into two signatures", () => {
    const msgs = bulkMessages(
      Array.from({ length: LIST_PER_TX + 1 }, (_, i) => ({
        id: String(i + 1),
        listed: false,
        pkgPath: "gno.land/r/demo/bazaar/c/gens",
        priceUgnot: 1_000_000,
      })),
    );
    const groups = packListTxs(msgs);
    expect(groups.map((group) => group.length)).toEqual([LIST_PER_TX, 1]);
    expect(listGasWanted(groups[0].length)).toBe(Math.ceil(50_000_000 * LIST_PER_TX * 1.15));
    expect(listButtonLabel(msgs.map(() => ({ listed: false })))).toBe("List 21 · 2 signatures");
  });

  it("names a price update when every row is already listed", () => {
    expect(listButtonLabel([{ listed: true }])).toBe("Update 1 price");
    expect(listButtonLabel([{ listed: false }, { listed: true }])).toBe("List 1 · update 1");
  });
});

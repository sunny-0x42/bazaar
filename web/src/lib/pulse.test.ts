import { describe, expect, it } from "vitest";
import { foldMonth, monthCut, parseMonthTxs, parseSendUgnot, pulsePacks } from "./pulse";

describe("pulsePacks", () => {
  it("keeps public realms and drops hidden or empty packages", () => {
    const packed = pulsePacks([
      { slug: "bazaargens", pkg: "gno.land/r/demo/bazaar/c/bazaargens" },
      { slug: "seafish", pkg: "gno.land/r/demo/bazaar/c/seafish" },
      { slug: "planes", pkg: "" },
      { slug: "stones", pkg: "not-a-realm" },
    ]);
    expect(packed.packs).toEqual(["gno.land/r/demo/bazaar/c/bazaargens"]);
    expect(packed.key).toBe("bazaargens\tgno.land/r/demo/bazaar/c/bazaargens");
  });
});

describe("parseMonthTxs", () => {
  it("counts one row per hash and ignores a call on another realm", () => {
    const rows = parseMonthTxs(
      [
        {
          hash: "aa",
          messages: [
            { value: { func: "List", pkg_path: "gno.land/r/demo/col", send: "" } },
            { value: { func: "Buy", pkg_path: "gno.land/r/demo/col", send: "2000000ugnot" } },
          ],
        },
        {
          hash: "aa",
          messages: [{ value: { func: "Buy", pkg_path: "gno.land/r/demo/col", send: "9000000ugnot" } }],
        },
        {
          hash: "bb",
          messages: [{ value: { func: "Buy", pkg_path: "gno.land/r/other", send: "1000000ugnot" } }],
        },
        {
          hash: "cc",
          messages: [{ value: { func: "PublicMint", pkg_path: "gno.land/r/demo/col", send: "5000000ugnot" } }],
        },
      ],
      "gno.land/r/demo/col",
    );
    expect(rows).toEqual([
      { kind: "buy", price: 2_000_000 },
      { kind: "publicmint", price: 5_000_000 },
    ]);
  });

  it("reads only a ugnot coin string", () => {
    expect(parseSendUgnot("1000000ugnot")).toBe(1_000_000);
    expect(parseSendUgnot("1000000ugnot,1foo")).toBe(0);
  });
});

describe("foldMonth", () => {
  it("adds mints to volume and keeps trade volume to sales", () => {
    expect(
      foldMonth([
        { kind: "buy", price: 2_000_000 },
        { kind: "accept", price: 3_000_000 },
        { kind: "publicmint", price: 5_000_000 },
        { kind: "mint", price: 0 },
        { kind: "list", price: 9_000_000 },
      ]),
    ).toEqual({ vol: 10_000_000, sales: 2, minted: 2, traded: 5_000_000 });
  });
});

describe("monthCut", () => {
  it("returns 0 when genesis is inside the last 30 days", async () => {
    const now = 1_800_000_000;
    const cut = await monthCut({ height: 100, time: now }, async (height) => now - height);
    expect(cut).toBe(0);
  });

  it("returns the latest height at or before the cutoff", async () => {
    const now = 1_800_000_000;
    const day = 86400;
    const cut = await monthCut({ height: 40, time: now }, async (height) => now - (40 - height) * day);
    expect(cut).toBe(10);
  });
});

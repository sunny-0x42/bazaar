import { describe, expect, it } from "vitest";
import { ITEM_BOOK_CAP, mergeBookItems, missingItemIds, nextItemIds, nextPageSize } from "./itembook";
import type { Item } from "./chain";

function row(id: string, name = "Unrevealed"): Item {
  return {
    id,
    name,
    owner: "g1abc",
    seller: "",
    price: 0,
    listed: false,
    image: "ipfs://bafy",
    collection: "bazaargens",
    rarity: "",
    traits: "",
    revealed: false,
    slot: 0,
  };
}

describe("item book", () => {
  it("keeps the grid cap at 50 and skips ids already shown", () => {
    const ids = missingItemIds(["1", "2"], 132);
    expect(ids[0]).toBe(3);
    expect(ids[ids.length - 1]).toBe(ITEM_BOOK_CAP);
    expect(ids).toHaveLength(ITEM_BOOK_CAP - 2);
    expect(missingItemIds([], 0)).toEqual([]);
    expect(missingItemIds([], -4)).toEqual([]);
  });

  it("merges later rows over the same id and keeps numeric order", () => {
    const listed = { ...row("6"), listed: true, price: 5_000_000, seller: "g1sell" };
    const merged = mergeBookItems([row("6"), row("2")], [row("1"), listed]);
    expect(merged.map((it) => it.id)).toEqual(["1", "2", "6"]);
    expect(merged[2]?.listed).toBe(true);
    expect(merged[2]?.price).toBe(5_000_000);
  });

  it("does not drop ids that arrived in an earlier wave", () => {
    const merged = mergeBookItems([row("1"), row("2"), row("3")], [row("4")]);
    expect(merged.map((it) => it.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("pages the next 50 minted ids and stops at the minted count", () => {
    const second = nextItemIds([], 132, ITEM_BOOK_CAP);
    expect(second[0]).toBe(51);
    expect(second[second.length - 1]).toBe(100);
    expect(second).toHaveLength(50);
    const last = nextItemIds(["101"], 132, 100);
    expect(last[0]).toBe(102);
    expect(last[last.length - 1]).toBe(132);
    expect(nextItemIds([], 40, 50)).toEqual([]);
  });

  it("hides Load more until the first page is done and after the last id", () => {
    expect(nextPageSize(0, 132)).toBe(0);
    expect(nextPageSize(50, 132)).toBe(50);
    expect(nextPageSize(100, 132)).toBe(32);
    expect(nextPageSize(132, 132)).toBe(0);
  });
});

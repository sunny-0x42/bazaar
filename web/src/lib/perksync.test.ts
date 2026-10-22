import { describe, expect, it } from "vitest";
import {
  SETTLE_GAS_WANTED,
  backlogUnassigned,
  holderNeedsSync,
  nextSyncSpan,
  nftCanSync,
  planSyncSpan,
  syncCalls,
  syncableIds,
} from "./perksync";

describe("perk sync plan", () => {
  it("asks Settle for enough gas to walk the wallet book without crossing Adena's simulate cap", () => {
    expect(SETTLE_GAS_WANTED).toBeGreaterThanOrEqual(100_000_000);
    expect(SETTLE_GAS_WANTED).toBeLessThan(2_000_000_000);
  });
  it("records each revealed unlisted id once, lowest first, and stops at 20", () => {
    expect(syncCalls([4, 0, 4, 2, 1.9])).toEqual([
      { func: "Sync", args: ["1"] },
      { func: "Sync", args: ["2"] },
      { func: "Sync", args: ["4"] },
    ]);
    const many = syncCalls(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(many).toHaveLength(20);
    expect(many[0].args).toEqual(["1"]);
    expect(many[19].args).toEqual(["20"]);
  });

  it("skips sealed and listed rows", () => {
    expect(
      syncableIds([
        { id: "3", rarity: "Common", revealed: true, listed: false },
        { id: "4", rarity: "Mythic", revealed: true, listed: true },
        { id: "5", rarity: "Rare", revealed: false, listed: false },
        { id: "6", rarity: "", revealed: true, listed: false },
      ]),
    ).toEqual([3]);
  });

  it("offers Sync on a revealed unlisted Bazaar Gens only", () => {
    const row = { id: "119", collection: "bazaargens", rarity: "Rare", revealed: true, listed: false };
    expect(nftCanSync(row)).toBe(true);
    expect(nftCanSync({ ...row, listed: true })).toBe(false);
    expect(nftCanSync({ ...row, revealed: false })).toBe(false);
    expect(nftCanSync({ ...row, collection: "other" })).toBe(false);
    expect(nftCanSync({ ...row, rarity: "" })).toBe(false);
  });

  it("asks for Sync only when the counted NFTs differ from the perk record", () => {
    const base = { weight: 25, countedWeight: 25, perkDiscountBps: 25, countedBps: 25, syncIds: [3] };
    expect(holderNeedsSync(base)).toBe(false);
    expect(holderNeedsSync({ ...base, weight: 0, perkDiscountBps: 0 })).toBe(true);
    expect(holderNeedsSync({ ...base, syncIds: [] })).toBe(false);
  });

  it("treats a positive pool with zero weight as unassigned", () => {
    expect(backlogUnassigned(0, 2_398_000, 0)).toBe(true);
    expect(backlogUnassigned(25, 2_398_000, 0)).toBe(false);
    expect(backlogUnassigned(0, 0, 0)).toBe(false);
  });

  it("rejects a span past the minted supply or longer than 20", () => {
    expect(planSyncSpan(1, 20, 218)).toEqual({ start: 1, end: 20 });
    expect(planSyncSpan(201, 218, 218)).toEqual({ start: 201, end: 218 });
    expect(() => planSyncSpan(1, 21, 218)).toThrow(/20 tokens/);
    expect(() => planSyncSpan(1, 20, 0)).toThrow(/Nothing minted/);
    expect(() => planSyncSpan(0, 5, 10)).toThrow(/starts at 1/);
    expect(() => planSyncSpan(10, 30, 20)).toThrow(/minted supply/);
  });

  it("walks the minted supply in spans of 20", () => {
    expect(nextSyncSpan(0, 218)).toEqual({ start: 1, end: 20 });
    expect(nextSyncSpan(20, 218)).toEqual({ start: 21, end: 40 });
    expect(nextSyncSpan(200, 218)).toEqual({ start: 201, end: 218 });
    expect(nextSyncSpan(218, 218)).toBeNull();
    expect(nextSyncSpan(0, 0)).toBeNull();
  });
});

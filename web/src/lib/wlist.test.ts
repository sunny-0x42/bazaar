import { describe, expect, it } from "vitest";
import {
  applyWlistSubmit,
  GENESIS_RARITIES,
  GENESIS_SUPPLY,
  isG1,
  wlistCsv,
  WLIST_CAP,
  WLIST_OPENS_AT,
} from "./wlist";

const alice = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt";
const bob = "g1jg8qg5h63n8m8z86l07yw2h6pt3vw3r7m2k0abc";
const openMs = WLIST_OPENS_AT * 1000 + 1000;

describe("applyWlistSubmit", () => {
  it("adds a row after open", () => {
    const got = applyWlistSubmit({ rows: [] }, { address: alice, handle: "Alice_gno", nowMs: openMs });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.row.place).toBe(1);
    expect(got.row.handle).toBe("Alice_gno");
    expect(got.state.rows).toHaveLength(1);
  });

  it("rejects before open, bad handle, duplicate, and full", () => {
    expect(applyWlistSubmit({ rows: [] }, { address: alice, handle: "Alice_gno", nowMs: 0 }).ok).toBe(false);
    expect(applyWlistSubmit({ rows: [] }, { address: alice, handle: "bad handle", nowMs: openMs }).ok).toBe(false);
    const once = applyWlistSubmit({ rows: [] }, { address: alice, handle: "Alice_gno", nowMs: openMs });
    if (!once.ok) throw new Error("setup");
    expect(applyWlistSubmit(once.state, { address: alice, handle: "other", nowMs: openMs }).ok).toBe(false);
    const full = { rows: Array.from({ length: WLIST_CAP }, (_, i) => ({ place: i + 1, address: `g1${"a".repeat(39)}${i}`, handle: `h${i}`, at: "x" })) };
    expect(applyWlistSubmit(full, { address: bob, handle: "bobx", nowMs: openMs }).ok).toBe(false);
  });

  it("lets a seeded wallet bind a handle before public open", () => {
    const seeded = { rows: [{ place: 7, address: alice, handle: "", at: "x", seeded: true }] };
    const got = applyWlistSubmit(seeded, { address: alice, handle: "Alice_gno", nowMs: 0 });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.row.handle).toBe("Alice_gno");
    expect(got.row.place).toBe(7);
    expect(got.state.rows).toHaveLength(1);
    expect(applyWlistSubmit({ rows: [] }, { address: bob, handle: "bobx", nowMs: 0 }).ok).toBe(false);
  });
});


describe("wlistCsv", () => {
  it("writes a header row", () => {
    expect(wlistCsv([])).toBe("place,address,handle,submitted_at_utc\n");
    expect(wlistCsv([{ place: 1, address: alice, handle: "Alice_gno", at: "2026-09-28T00:00:01.000Z" }])).toContain(
      `@Alice_gno`,
    );
  });
});

describe("GENESIS_RARITIES", () => {
  it("sums to 1111", () => {
    expect(GENESIS_RARITIES.reduce((n, row) => n + row.supply, 0)).toBe(GENESIS_SUPPLY);
    expect(GENESIS_SUPPLY).toBe(1111);
    expect(WLIST_CAP).toBe(333);
  });
});

describe("isG1", () => {
  it("accepts a g1 address", () => {
    expect(isG1(alice)).toBe(true);
    expect(isG1("0xabc")).toBe(false);
  });
});

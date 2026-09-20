import { afterEach, describe, expect, it, vi } from "vitest";
import type { Activity } from "./chain";
import {
  activityToPoints,
  fetchChart,
  listedPricesToPoints,
  mapChartJson,
  pointsForItem,
} from "./chart";

function act(partial: Partial<Activity> & Pick<Activity, "kind" | "price">): Activity {
  return {
    id: "",
    slug: "stones",
    actor: "",
    name: "",
    ...partial,
  };
}

describe("activityToPoints", () => {
  it("keeps buy/list with price>0, oldest first (newest-first input)", () => {
    const points = activityToPoints([
      act({ kind: "buy", id: "3", name: "Night Core", price: 3_500_000 }),
      act({ kind: "list", id: "2", name: "Tide Core", price: 2_000_000 }),
      act({ kind: "buy", id: "1", name: "Ember Core", price: 1_000_000 }),
    ]);
    expect(points.map((p) => p.name)).toEqual(["Ember Core", "Tide Core", "Night Core"]);
    expect(points.map((p) => p.price)).toEqual([1_000_000, 2_000_000, 3_500_000]);
    expect(points[0]).toMatchObject({ x: "Ember Core", kind: "buy", id: "1" });
  });

  it("skips price<=0", () => {
    const points = activityToPoints([
      act({ kind: "list", name: "Zero", price: 0 }),
      act({ kind: "buy", name: "Neg", price: -1 }),
      act({ kind: "list", name: "Ok", price: 500_000 }),
    ]);
    expect(points).toEqual([{ x: "Ok", price: 500_000, name: "Ok", kind: "list" }]);
  });

  it("skips mint/cancel even when they carry a price", () => {
    const points = activityToPoints([
      act({ kind: "cancel", name: "X", price: 9, id: "4" }),
      act({ kind: "list", name: "Listed", price: 80, id: "1" }),
      act({ kind: "mint", name: "Minted", price: 500_000, id: "0" }),
      act({ kind: "mint", name: "Free", price: 0, id: "2" }),
    ]);
    expect(points.map((p) => p.name)).toEqual(["Listed"]);
  });

  it("skips publicmint and drop", () => {
    const points = activityToPoints([
      act({ kind: "publicmint", name: "Copper Wick", price: 800_000 }),
      act({ kind: "drop", name: "Harbor Lamps", price: 800_000 }),
      act({ kind: "BUY", name: "Blue Wick", price: 2_500_000 }),
    ]);
    expect(points).toEqual([{ x: "Blue Wick", price: 2_500_000, name: "Blue Wick", kind: "buy" }]);
  });

  it("is a stable reverse of newest-first input", () => {
    const points = activityToPoints([
      act({ kind: "list", name: "Same", price: 3, id: "c" }),
      act({ kind: "list", name: "Same", price: 2, id: "b" }),
      act({ kind: "list", name: "Same", price: 1, id: "a" }),
    ]);
    expect(points.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(points.map((p) => p.price)).toEqual([1, 2, 3]);
  });

  it("returns empty when nothing is a priced trade", () => {
    expect(activityToPoints([])).toEqual([]);
    expect(
      activityToPoints([
        act({ kind: "mint", name: "Ember Core", price: 0 }),
        act({ kind: "cancel", name: "Ember Core", price: 0 }),
      ]),
    ).toEqual([]);
  });
});

describe("listedPricesToPoints", () => {
  it("uses catalog listPrices in order and skips blanks", () => {
    expect(
      listedPricesToPoints([
        { name: "Ember Core", listPrice: 1_000_000 },
        { name: "Skip", listPrice: 0 },
        { name: "Tide Core", price: 2_000_000 },
        { id: "9", price: 3_500_000 },
      ]),
    ).toEqual([
      { x: "Ember Core", price: 1_000_000, name: "Ember Core", kind: "list" },
      { x: "Tide Core", price: 2_000_000, name: "Tide Core", kind: "list" },
      { x: "#9", price: 3_500_000, id: "9", kind: "list" },
    ]);
  });
});

describe("pointsForItem", () => {
  const series = [
    { x: "Ember Core", price: 1_000_000, id: "1", name: "Ember Core", kind: "list" as const },
    { x: "Ember Core", price: 1_200_000, id: "1", name: "Ember Core", kind: "buy" as const },
    { x: "Tide Core", price: 2_000_000, id: "2", name: "Tide Core", kind: "list" as const },
  ];

  it("matches by id, then name", () => {
    expect(pointsForItem(series, { id: "1", name: "Nope" }).map((p) => p.price)).toEqual([
      1_000_000, 1_200_000,
    ]);
    expect(pointsForItem(series, { id: "", name: "Tide Core" }).map((p) => p.id)).toEqual(["2"]);
    expect(pointsForItem(series, { name: "ember core" })).toHaveLength(2);
  });

  it("returns empty when the item has no series", () => {
    expect(pointsForItem(series, { id: "9", name: "Missing" })).toEqual([]);
    expect(pointsForItem(series, { id: "", name: "" })).toEqual([]);
  });
});

describe("mapChartJson", () => {
  it("maps { points } from the indexer, oldest first", () => {
    expect(
      mapChartJson({
        points: [
          { height: 10, price: 200, kind: "buy", id: "2", name: "Early" },
          { height: 30, price: 50, kind: "list", id: "1", name: "Late" },
        ],
      }),
    ).toEqual([
      { x: 10, price: 200, kind: "buy", id: "2", name: "Early" },
      { x: 30, price: 50, kind: "list", id: "1", name: "Late" },
    ]);
  });

  it("skips mint/cancel and price<=0", () => {
    const parsed = mapChartJson([
      { x: "a", price: 0, kind: "list", name: "Zero" },
      { height: 12, price: 9, kind: "cancel", id: "4", name: "X" },
      { x: "ok", price: "1500000", kind: "list", id: "3", name: "Copper Wick" },
    ]);
    expect(parsed).toEqual([
      { x: "ok", price: 1_500_000, kind: "list", id: "3", name: "Copper Wick" },
    ]);
  });

  it("returns empty for blank payloads", () => {
    expect(mapChartJson(null)).toEqual([]);
    expect(mapChartJson({})).toEqual([]);
    expect(mapChartJson({ points: [] })).toEqual([]);
  });
});

describe("fetchChart", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs /api/chart?slug=&limit= and maps JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        points: [{ height: 10, price: 200, kind: "buy", id: "2", name: "Early" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchChart({ slug: "stones", limit: 20 })).resolves.toEqual([
      { x: 10, price: 200, kind: "buy", id: "2", name: "Early" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/api/chart?slug=stones&limit=20");
  });

  it("defaults limit to 50", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ points: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchChart({ slug: "lamps" })).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith("/api/chart?slug=lamps&limit=50");
  });

  it("returns null on 404 / not ok so UI can use activity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => [] }));
    await expect(fetchChart({ slug: "stones" })).resolves.toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchChart({ slug: "stones" })).resolves.toBeNull();
  });
});

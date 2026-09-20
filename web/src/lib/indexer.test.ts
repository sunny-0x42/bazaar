import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchActivity, mapActivityJson } from "./indexer";

describe("mapActivityJson", () => {
  it("maps kind|id|slug|actor|price|name from a JSON array", () => {
    expect(
      mapActivityJson([
        {
          kind: "buy",
          id: 2,
          slug: "stones",
          actor: "g1abcdefghijklmnopqrstuvwxyz",
          price: "1000000",
          name: "Ember Core",
          height: 42,
          hash: "abc",
        },
        {
          kind: "list",
          id: "1",
          slug: "stones",
          actor: "g1abcdefghijklmnopqrstuvwxyz",
          price: 500000,
          name: "Ember Core",
        },
      ]),
    ).toEqual([
      {
        kind: "buy",
        id: "2",
        slug: "stones",
        actor: "g1abcdefghijklmnopqrstuvwxyz",
        price: 1_000_000,
        name: "Ember Core",
        preview: false,
        source: "indexed",
      },
      {
        kind: "list",
        id: "1",
        slug: "stones",
        actor: "g1abcdefghijklmnopqrstuvwxyz",
        price: 500_000,
        name: "Ember Core",
        preview: false,
        source: "indexed",
      },
    ]);
  });

  it("maps { events } wrapper and skips blank kind", () => {
    const parsed = mapActivityJson({
      events: [
        { kind: "", id: "9", slug: "stones", actor: "g1a", price: 1, name: "X" },
        { kind: "mint", id: "1", slug: "stones", actor: "g1a", price: 0, name: "Ember Core" },
        { kind: "publicmint", id: 4, slug: "lamps", actor: "g1mint", price: 800000, name: "Copper Wick" },
      ],
    });
    expect(parsed.map((r) => r.kind)).toEqual(["mint", "publicmint"]);
    expect(parsed[0]).toMatchObject({
      id: "1",
      slug: "stones",
      actor: "g1a",
      price: 0,
      name: "Ember Core",
      preview: false,
      source: "indexed",
    });
    expect(parsed[1].id).toBe("4");
  });

  it("maps { activity } wrapper and drop with empty id", () => {
    const parsed = mapActivityJson({
      activity: [{ kind: "drop", id: "", slug: "lamps", actor: "g1creator", price: 800000, name: "Harbor Lamps" }],
    });
    expect(parsed).toEqual([
      {
        kind: "drop",
        id: "",
        slug: "lamps",
        actor: "g1creator",
        price: 800_000,
        name: "Harbor Lamps",
        preview: false,
        source: "indexed",
      },
    ]);
  });

  it("returns empty for blank payloads", () => {
    expect(mapActivityJson(null)).toEqual([]);
    expect(mapActivityJson([])).toEqual([]);
    expect(mapActivityJson({ events: [] })).toEqual([]);
    expect(mapActivityJson({})).toEqual([]);
  });
});

describe("fetchActivity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs /api/activity?slug=&limit= and maps JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { kind: "cancel", id: "3", slug: "lamps", actor: "g1sell", price: 0, name: "Blue Wick" },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchActivity({ slug: "lamps", limit: 20 })).resolves.toEqual([
      {
        kind: "cancel",
        id: "3",
        slug: "lamps",
        actor: "g1sell",
        price: 0,
        name: "Blue Wick",
        preview: false,
        source: "indexed",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/api/activity?slug=lamps&limit=20");
  });

  it("defaults limit to 50", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchActivity({ slug: "stones" })).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith("/api/activity?slug=stones&limit=50");
  });

  it("returns null when response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => [] }));
    await expect(fetchActivity({ slug: "stones", limit: 10 })).resolves.toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchActivity({ slug: "stones" })).resolves.toBeNull();
  });
});

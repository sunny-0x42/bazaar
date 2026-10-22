import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adenaIndexerOrigin,
  callerPublicMintHeights,
  collectionPublicMintHeights,
  fetchActivity,
  fetchPkgActivity,
  indexerUrl,
  mapActivityJson,
  mapIndexerTransactions,
} from "./indexer";

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

describe("mapIndexerTransactions", () => {
  const pkg = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/c/test";

  it("maps List and PublicMint events and skips session txs", () => {
    const parsed = mapIndexerTransactions(
      {
        data: {
          getTransactions: [
            {
              block_height: 10,
              messages: [{ typeUrl: "create_session", value: {} }],
              response: { events: [] },
            },
            {
              block_height: 20,
              messages: [
                {
                  typeUrl: "exec",
                  value: { caller: "g1seller", func: "List", pkg_path: pkg, args: ["1", "1000000"], send: "" },
                },
              ],
              response: {
                events: [
                  { type: "List", pkg_path: pkg, attrs: [{ key: "id", value: "1" }, { key: "seller", value: "g1seller" }, { key: "price", value: "1000000" }] },
                ],
              },
            },
            {
              block_height: 15,
              messages: [
                {
                  typeUrl: "exec",
                  value: { caller: "g1minter", func: "PublicMint", pkg_path: pkg, args: null, send: "" },
                },
              ],
              response: {
                events: [{ type: "PublicMint", pkg_path: pkg, attrs: [{ key: "id", value: "1" }] }],
              },
            },
          ],
        },
      },
      pkg,
      "test",
    );
    expect(parsed.map((r) => r.kind)).toEqual(["list", "publicmint"]);
    expect(parsed[0]).toMatchObject({ id: "1", actor: "g1seller", price: 1_000_000, slug: "test", source: "indexed" });
    expect(parsed[1]).toMatchObject({ id: "1", actor: "g1minter", kind: "publicmint" });
  });

  it("maps an Offer by bidder and amount", () => {
    const parsed = mapIndexerTransactions(
      {
        data: {
          getTransactions: [
            {
              messages: [
                { value: { caller: "g1bid", func: "Offer", pkg_path: pkg, send: "500000ugnot" } },
              ],
              response: {
                events: [
                  {
                    type: "Offer",
                    pkg_path: pkg,
                    attrs: [
                      { key: "id", value: "2" },
                      { key: "bidder", value: "g1bid" },
                      { key: "amount", value: "500000" },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      pkg,
      "test",
    );
    expect(parsed).toMatchObject([{ kind: "offer", id: "2", actor: "g1bid", price: 500_000 }]);
  });
});

describe("fetchPkgActivity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function listTx(pkg: string) {
    return {
      messages: [
        { value: { caller: "g1seller", func: "List", pkg_path: pkg, args: ["1", "1000000"], send: "" } },
      ],
      response: {
        events: [
          {
            type: "List",
            pkg_path: pkg,
            attrs: [
              { key: "id", value: "1" },
              { key: "seller", value: "g1seller" },
              { key: "price", value: "1000000" },
            ],
          },
        ],
      },
    };
  }

  it("asks for the latest height, then only the recent block window", async () => {
    const pkg = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/c/window";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as { query?: string; variables?: { after?: number } };
      if (String(body.query || "").includes("latestBlockHeight")) {
        return { ok: true, json: async () => ({ data: { latestBlockHeight: 100_000 } }) };
      }
      expect(body.variables?.after).toBe(80_000);
      return { ok: true, json: async () => ({ data: { getTransactions: [listTx(pkg)] } }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const rows = await fetchPkgActivity({ pkg, slug: "window", network: "mainnet" });
    expect(rows).toMatchObject([{ kind: "list", id: "1", price: 1_000_000 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const again = await fetchPkgActivity({ pkg, slug: "window", network: "mainnet" });
    expect(again).toEqual(rows);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when the height read fails and does not scan all history", async () => {
    const pkg = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/c/failheight";
    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPkgActivity({ pkg, slug: "fail", network: "mainnet" })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("callerPublicMintHeights", () => {
  const pkg = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/c/test";

  it("counts each PublicMint message in a batch and skips other wallets", () => {
    const heights = callerPublicMintHeights(
      {
        data: {
          getTransactions: [
            {
              block_height: 40,
              messages: [
                { value: { caller: "g1mine", func: "PublicMint", pkg_path: pkg } },
                { value: { caller: "g1mine", func: "PublicMint", pkg_path: pkg } },
                { value: { caller: "g1other", func: "PublicMint", pkg_path: pkg } },
              ],
            },
            {
              block_height: 30,
              messages: [{ value: { caller: "g1mine", func: "List", pkg_path: pkg } }],
            },
          ],
        },
      },
      pkg,
      "g1mine",
    );
    expect(heights).toEqual([40, 40]);
  });

  it("counts every wallet when splitting the collection rounds", () => {
    const raw = {
      data: {
        getTransactions: [
          {
            block_height: 40,
            messages: [
              { value: { caller: "g1mine", func: "PublicMint", pkg_path: pkg } },
              { value: { caller: "g1other", func: "PublicMint", pkg_path: pkg } },
              { value: { caller: "g1mine", func: "List", pkg_path: pkg } },
            ],
          },
        ],
      },
    };
    expect(collectionPublicMintHeights(raw, pkg)).toEqual([40, 40]);
  });
});

describe("adenaIndexerOrigin", () => {
  it("is the host Adena stores, without the graphql path", () => {
    expect(adenaIndexerOrigin("onyx")).toBe("https://indexer.onyx.testnets.gno.land");
    expect(indexerUrl("onyx")).toBe(`${adenaIndexerOrigin("onyx")}/graphql/query`);
    expect(adenaIndexerOrigin("local")).toBe("");
  });
});

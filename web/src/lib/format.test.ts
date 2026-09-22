import { describe, expect, it } from "vitest";
import {
  activityKindLabel,
  filterItems,
  filterListedItems,
  itemMatchesTraits,
  traitGroups,
  filterListings,
  gnotFromCoins,
  mintHash,
  parseHash,
  tabHash,
  profileHash,
  parseCoinsUgnot,
  artSrc,
  ipfsToHttp,
  isArtSrc,
  isHttpUrl,
  isIpfsUri,
  isDropCover,
  isDropMaxSupply,
  isDropMintPrice,
  isDropSlug,
  isMintImage,
  isMintName,
  isNameNotDeclared,
  isOwnListing,
  isPreviewItem,
  isRealmUnavailable,
  isSamplePath,
  parseActivityLines,
  parseCollectionLines,
  parseFactoryCollectionLines,
  parseFeaturedLines,
  collectionBookPath,
  collectionRealmPath,
  DEFAULT_FACTORY,
  DEFAULT_NFT,
  FACTORY_PKG,
  parseIds,
  parseItems,
  parseListings,
  parseDropSlotLines,
  parseOfferLines,
  parsePoolNftLines,
  parseTraits,
  parsePoolOf,
  parseSocials,
  parseDropSale,
  parseTokenURI,
  sameAddr,
  socialHref,
  sweepQuote,
  topOfferFor,
  protocolFeeLabel,
  protocolFeeUgnot,
  shortAddr,
  sortItems,
  sortListings,
  symbolHue,
  tickerLetters,
  ugnotFromGnot,
  uniqueListingSymbols,
  type Item,
  type Listing,
} from "./chain";
import {
  buildDrops,
  buildExploreCollections,
  collectionMarketRow,
  formatFloorPct,
  itemsForExploreCollection,
  listedShare,
  parseCatalog,
  pickFeatured,
  previewActivityFor,
  previewItemsFor,
} from "./catalog";

const rows: Listing[] = [
  { id: "a", symbol: "DEMO", seller: "g1abc", amount: 100, price: 1_000_000, status: "open" },
  { id: "b", symbol: "PEARL", seller: "g1zzz", amount: 50, price: 2_500_000, status: "open" },
  { id: "c", symbol: "ALPHA", seller: "g1abc", amount: 200, price: 500_000, status: "open" },
];

const items: Item[] = [
  {
    id: "1",
    name: "Sunset",
    owner: "g1own",
    seller: "g1abc",
    price: 1_000_000,
    listed: true,
    image: "https://example.com/a.png",
    collection: "stones",
    rarity: "Rare",
    traits: "Background:Dusk;Fur:Ember",
    revealed: true,
    slot: -1,
  },
  {
    id: "2",
    name: "Pearl Shell",
    owner: "g1zzz",
    seller: "g1zzz",
    price: 2_500_000,
    listed: true,
    image: "",
    collection: "lamps",
    rarity: "Common",
    traits: "",
    revealed: true,
    slot: -1,
  },
  {
    id: "10",
    name: "Alpha",
    owner: "g1own",
    seller: "",
    price: 0,
    listed: false,
    image: "http://example.com/b.png",
    collection: "",
    rarity: "Uncommon",
    traits: "",
    revealed: true,
    slot: -1,
  },
];

describe("formatUgnot / parseGnoswapGnotUsd", () => {
  it("keeps GNOT and converts USD only with a live fx", async () => {
    const { formatUgnot, parseGnoswapGnotUsd, parseCoinGeckoGnotUsd } = await import("./fx");
    expect(formatUgnot(1_000_000, "gnot", 0)).toMatch(/1\.00/);
    expect(formatUgnot(1_000_000, "gnot", 0)).toMatch(/GNOT/);
    expect(formatUgnot(1_000_000, "usd", 0)).toBe("—");
    expect(formatUgnot(2_000_000, "usd", 0.5)).toBe("$1.00");
    expect(formatUgnot(0, "usd", 1)).toBe("—");
    expect(
      parseGnoswapGnotUsd({
        data: [
          { path: "ugnot", usd: 0.12, priceGradeType: "POOL" },
          { path: "ugnot", usd: 0.15, priceGradeType: "ORACLE" },
        ],
      }),
    ).toBe(0.15);
    expect(parseCoinGeckoGnotUsd({ "gno-land": { usd: 0.2 } })).toBe(0.2);
    expect(parseCoinGeckoGnotUsd({})).toBe(0);
  });
});

describe("drop slots / traits", () => {
  it("parses slot lines and trait pairs", () => {
    expect(parseDropSlotLines(`("0|Dusk Fox|/samples/foxes-01.png|Rare|Background:Dusk;Fur:Ember" string)`)).toEqual([
      {
        index: 0,
        name: "Dusk Fox",
        image: "/samples/foxes-01.png",
        rarity: "Rare",
        traits: "Background:Dusk;Fur:Ember",
      },
    ]);
    expect(parseTraits("Background:Dusk;Fur:Ember")).toEqual([
      { type: "Background", value: "Dusk" },
      { type: "Fur", value: "Ember" },
    ]);
    expect(parseItems(`("1|Dusk Fox|g1a||0|false|/samples/foxes-01.png|gems|Rare|Background:Dusk" string)`)[0].traits).toBe(
      "Background:Dusk",
    );
    expect(
      parseItems(`("1|Unrevealed|g1a||0|false|/samples/stones-01.png|gems|||false|0" string)`)[0],
    ).toMatchObject({ name: "Unrevealed", revealed: false, slot: 0, traits: "" });
  });
});

describe("jsonToSlotBlob", () => {
  it("maps OpenSea attributes to pipe slots", async () => {
    const { jsonToSlotBlob } = await import("./dropjson");
    const blob = jsonToSlotBlob(
      JSON.stringify([
        {
          name: "Dusk Fox",
          image: "/samples/foxes-01.png",
          attributes: [
            { trait_type: "Rarity", value: "Rare" },
            { trait_type: "Background", value: "Dusk" },
            { trait_type: "Fur", value: "Ember" },
          ],
        },
      ]),
    );
    expect(blob).toBe("Dusk Fox|/samples/foxes-01.png|Rare|Background:Dusk;Fur:Ember");
  });

  it("prefers ipfs:// over https image_url and maps to the gateway", async () => {
    const { jsonToSlotBlob } = await import("./dropjson");
    const blob = jsonToSlotBlob(
      JSON.stringify([
        {
          name: "Dusk Fox",
          image: "ipfs://bafybeiabc",
          image_url: "https://example.com/skip.png",
          attributes: [{ trait_type: "Rarity", value: "Rare" }],
        },
      ]),
    );
    expect(blob).toBe("Dusk Fox|https://ipfs.io/ipfs/bafybeiabc|Rare|");
  });

  it("reads launch pack collection fields", async () => {
    const { applyLaunchPack } = await import("./dropjson");
    const meta = applyLaunchPack(
      JSON.stringify({
        name: "Harbor Foxes",
        slug: "hfoxes",
        cover: "/samples/foxes-01.png",
        maxSupply: 20,
        mintPrice: "1",
        royaltyPct: 5,
        hideUntilReveal: true,
        items: [{ name: "Fox #1", image: "/samples/foxes-01.png" }],
      }),
    );
    expect(meta.slug).toBe("hfoxes");
    expect(meta.maxSupply).toBe("20");
    expect(meta.hideUntilReveal).toBe(true);
  });

  it("counts JSON items and rejects over 10000", async () => {
    const { countSlotLines, JSON_SLOT_CAP } = await import("./dropjson");
    expect(JSON_SLOT_CAP).toBe(10000);
    expect(countSlotLines(JSON.stringify([{ name: "A" }, { name: "B" }])).n).toBe(2);
    expect(countSlotLines("").n).toBe(0);
  });
});

describe("liveTradeRows", () => {
  it("keeps list/buy/offer and drops mint/drop", async () => {
    const { liveTradeRows } = await import("./chain");
    const rows = liveTradeRows([
      { kind: "list", id: "1", slug: "stones", actor: "g1a", price: 1, name: "A" },
      { kind: "mint", id: "2", slug: "stones", actor: "g1a", price: 0, name: "B" },
      { kind: "buy", id: "1", slug: "stones", actor: "g1b", price: 1, name: "A" },
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["list", "buy"]);
  });
});

describe("parseDropSale", () => {
  it("reads royalty|wlPrice|wlSupply|phase|mintPrice", () => {
    expect(parseDropSale(`("500|1000000|20|whitelist|2000000" string)`)).toEqual({
      royaltyBps: 500,
      wlPrice: 1_000_000,
      wlSupply: 20,
      phase: "whitelist",
      mintPrice: 2_000_000,
    });
  });
});

describe("protocolFeeUgnot", () => {
  it("takes 50 bps of 1 GNOT", () => {
    expect(protocolFeeUgnot(1_000_000, 50)).toBe(5000);
  });
});

describe("protocolFeeLabel", () => {
  it("renders 50 bps as 0.50%", () => {
    expect(protocolFeeLabel(50)).toBe("0.50%");
  });
});

describe("ugnotFromGnot", () => {
  it("converts 1.5 GNOT", () => {
    expect(ugnotFromGnot("1.5")).toBe(1_500_000);
  });
});

describe("parseListings", () => {
  it("reads qeval string rows", () => {
    const parsed = parseListings(`("a|DEMO|g1abc|100|1000000|open" string)`);
    expect(parsed).toEqual([
      { id: "a", symbol: "DEMO", seller: "g1abc", amount: 100, price: 1_000_000, status: "open" },
    ]);
  });
});

describe("parseItems", () => {
  it("reads ItemLine rows from qeval", () => {
    const parsed = parseItems(
      `("1|Sunset|g1own|g1sell|1000000|true|https://example.com/a.png" string)`,
    );
    expect(parsed).toEqual([
      {
        id: "1",
        name: "Sunset",
        owner: "g1own",
        seller: "g1sell",
        price: 1_000_000,
        listed: true,
        image: "https://example.com/a.png",
        collection: "",
        rarity: "",
        traits: "",
    revealed: true,
    slot: -1,
      },
    ]);
  });

  it("reads image as parts[6] and collection as parts[7]", () => {
    const parsed = parseItems(
      `("1|Ember Core|g1own|g1sell|1000000|true|/samples/stones-01.png|stones|Legendary" string)`,
    );
    expect(parsed).toEqual([
      {
        id: "1",
        name: "Ember Core",
        owner: "g1own",
        seller: "g1sell",
        price: 1_000_000,
        listed: true,
        image: "/samples/stones-01.png",
        collection: "stones",
        rarity: "Legendary",
        traits: "",
    revealed: true,
    slot: -1,
      },
    ]);
  });

  it("reads multiple newline rows and false listed", () => {
    const parsed = parseItems(`("1|A|g1a|g1s|1|true|\\n2|B|g1b||0|false|" string)`);
    expect(parsed).toEqual([
      {
        id: "1",
        name: "A",
        owner: "g1a",
        seller: "g1s",
        price: 1,
        listed: true,
        image: "",
        collection: "",
        rarity: "",
        traits: "",
    revealed: true,
    slot: -1,
      },
      {
        id: "2",
        name: "B",
        owner: "g1b",
        seller: "",
        price: 0,
        listed: false,
        image: "",
        collection: "",
        rarity: "",
        traits: "",
    revealed: true,
    slot: -1,
      },
    ]);
  });

  it("returns empty for blank payload", () => {
    expect(parseItems(`("" string)`)).toEqual([]);
    expect(parseItems("")).toEqual([]);
  });
});

describe("parseCollectionLines", () => {
  it("reads slug|name|cover rows from qeval", () => {
    const parsed = parseCollectionLines(
      `("stones|Signal Stones|/samples/stones-01.png\\nlamps|Harbor Lamps|/samples/lamps-01.png" string)`,
    );
    expect(parsed).toEqual([
      {
        slug: "stones",
        name: "Signal Stones",
        cover: "/samples/stones-01.png",
        count: 0,
        mintPrice: 0,
        maxSupply: 0,
        minted: 0,
        creator: "",
        paused: false,
        drop: false,
        bio: "",
      },
      {
        slug: "lamps",
        name: "Harbor Lamps",
        cover: "/samples/lamps-01.png",
        count: 0,
        mintPrice: 0,
        maxSupply: 0,
        minted: 0,
        creator: "",
        paused: false,
        drop: false,
        bio: "",
      },
    ]);
  });

  it("reads DropLine slug|name|cover|count|mintPrice|maxSupply|minted|creator", () => {
    const parsed = parseCollectionLines(
      `("stones|Signal Stones|/samples/stones-01.png|3|500000|6|3|g1abc" string)`,
    );
    expect(parsed).toEqual([
      {
        slug: "stones",
        name: "Signal Stones",
        cover: "/samples/stones-01.png",
        count: 3,
        mintPrice: 500000,
        maxSupply: 6,
        minted: 3,
        creator: "g1abc",
        paused: false,
        drop: true,
        bio: "",
      },
    ]);
  });

  it("treats creator as optional", () => {
    const parsed = parseCollectionLines(
      `("lamps|Harbor Lamps|/samples/lamps-01.png|3|800000|6|3" string)`,
    );
    expect(parsed).toEqual([
      {
        slug: "lamps",
        name: "Harbor Lamps",
        cover: "/samples/lamps-01.png",
        count: 3,
        mintPrice: 800000,
        maxSupply: 6,
        minted: 3,
        creator: "",
        paused: false,
        drop: true,
        bio: "",
      },
    ]);
  });

  it("uses slug as name when name is missing", () => {
    expect(parseCollectionLines(`("relics" string)`)).toEqual([
      {
        slug: "relics",
        name: "relics",
        cover: "",
        count: 0,
        mintPrice: 0,
        maxSupply: 0,
        minted: 0,
        creator: "",
        paused: false,
        drop: false,
        bio: "",
      },
    ]);
  });

  it("reads drop flag and open edition (maxSupply 0)", () => {
    const parsed = parseCollectionLines(
      `("open|Open Gems|/samples/stones-01.png|0|0|0|0|g1abc|false|true|" string)`,
    );
    expect(parsed[0].drop).toBe(true);
    expect(parsed[0].maxSupply).toBe(0);
    expect(parsed[0].bio).toBe("");
  });

  it("returns empty for blank payload", () => {
    expect(parseCollectionLines(`("" string)`)).toEqual([]);
    expect(parseCollectionLines("")).toEqual([]);
  });
});

describe("parseFactoryCollectionLines", () => {
  it("reads slug|name|cover|pkg|mintPrice|maxSupply|minted|creator", () => {
    const parsed = parseFactoryCollectionLines(
      `("demo|Demo|/samples/clay-01.png|gno.land/r/bazaar/c/demo|1000000|100|3|g1abc" string)`,
    );
    expect(parsed).toEqual([
      {
        slug: "demo",
        name: "Demo",
        cover: "/samples/clay-01.png",
        count: 3,
        mintPrice: 1_000_000,
        maxSupply: 100,
        minted: 3,
        creator: "g1abc",
        paused: false,
        drop: true,
        bio: "",
        pkg: "gno.land/r/bazaar/c/demo",
      },
    ]);
    expect(parsed[0].addr).toBeUndefined();
    expect(parsed[0].royaltyBps).toBeUndefined();
  });

  it("reads optional addr and royaltyBps when 10 fields are present", () => {
    const parsed = parseFactoryCollectionLines(
      `("demo|Demo|/samples/clay-01.png|gno.land/r/bazaar/c/demo|1000000|100|3|g1abc|g1coladdr00000000000000000000000000|500" string)`,
    );
    expect(parsed).toEqual([
      {
        slug: "demo",
        name: "Demo",
        cover: "/samples/clay-01.png",
        count: 3,
        mintPrice: 1_000_000,
        maxSupply: 100,
        minted: 3,
        creator: "g1abc",
        paused: false,
        drop: true,
        bio: "",
        pkg: "gno.land/r/bazaar/c/demo",
        addr: "g1coladdr00000000000000000000000000",
        royaltyBps: 500,
      },
    ]);
  });

  it("keeps 8-field rows next to 10-field rows", () => {
    const parsed = parseFactoryCollectionLines(
      `("demo|Demo|/samples/clay-01.png|gno.land/r/bazaar/c/demo|1000000|100|3|g1abc\\nfoxes|Harbor Foxes|/samples/foxes-01.png|gno.land/r/bazaar/c/foxes|2000000|10|1|g1def|g1foxaddr00000000000000000000000000|250" string)`,
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      slug: "demo",
      pkg: "gno.land/r/bazaar/c/demo",
    });
    expect(parsed[0].addr).toBeUndefined();
    expect(parsed[0].royaltyBps).toBeUndefined();
    expect(parsed[1]).toMatchObject({
      slug: "foxes",
      pkg: "gno.land/r/bazaar/c/foxes",
      addr: "g1foxaddr00000000000000000000000000",
      royaltyBps: 250,
    });
  });

  it("skips nftv6 DropLine rows (count is not a pkg path)", () => {
    expect(
      parseFactoryCollectionLines(
        `("stones|Signal Stones|/samples/stones-01.png|3|500000|6|3|g1abc" string)`,
      ),
    ).toEqual([]);
  });

  it("defaults factory to the local bazaar factory pkg", () => {
    expect(DEFAULT_FACTORY).toBe("gno.land/r/bazaar/factory");
    expect(DEFAULT_FACTORY).toBe(FACTORY_PKG);
    expect(DEFAULT_FACTORY).not.toBe(DEFAULT_NFT);
    expect(collectionRealmPath("hfoxes", "local")).toBe("gno.land/r/bazaar/c/hfoxes");
    expect(collectionRealmPath("hfoxes", "pearl")).toBe(
      "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/c/hfoxes",
    );
    expect(
      collectionBookPath(
        "demo",
        [{ slug: "demo", pkg: "gno.land/r/bazaar/c/demo" }],
        DEFAULT_NFT,
      ),
    ).toBe("gno.land/r/bazaar/c/demo");
    expect(collectionBookPath("missing", [{ slug: "demo", pkg: "gno.land/r/bazaar/c/demo" }], DEFAULT_NFT)).toBe(
      DEFAULT_NFT,
    );
  });
});

describe("parseActivityLines", () => {
  it("reads kind|id|slug|actor|price|name rows from qeval", () => {
    const parsed = parseActivityLines(
      `("list|1|stones|g1abcdefghijklmnopqrstuvwxyz|1000000|Ember Core\\nmint|1|stones|g1abcdefghijklmnopqrstuvwxyz|0|Ember Core" string)`,
    );
    expect(parsed).toEqual([
      {
        kind: "list",
        id: "1",
        slug: "stones",
        actor: "g1abcdefghijklmnopqrstuvwxyz",
        price: 1_000_000,
        name: "Ember Core",
      },
      {
        kind: "mint",
        id: "1",
        slug: "stones",
        actor: "g1abcdefghijklmnopqrstuvwxyz",
        price: 0,
        name: "Ember Core",
      },
    ]);
  });

  it("reads buy, cancel, drop, and publicmint", () => {
    const parsed = parseActivityLines(
      `("buy|2|lamps|g1buyer|2500000|Blue Wick\\ncancel|2|lamps|g1sell|0|Blue Wick\\ndrop||lamps|g1creator|800000|Harbor Lamps\\npublicmint|4|lamps|g1mint|800000|Copper Wick" string)`,
    );
    expect(parsed.map((r) => r.kind)).toEqual(["buy", "cancel", "drop", "publicmint"]);
    expect(parsed[0].price).toBe(2_500_000);
    expect(parsed[2].id).toBe("");
    expect(parsed[2].name).toBe("Harbor Lamps");
    expect(parsed[3].kind).toBe("publicmint");
  });

  it("skips blank lines and empty kind", () => {
    expect(parseActivityLines(`("\\n|1|stones|g1a|0|X\\nlist|3|stones|g1a|1|Y" string)`)).toEqual([
      { kind: "list", id: "3", slug: "stones", actor: "g1a", price: 1, name: "Y" },
    ]);
  });

  it("returns empty for blank payload", () => {
    expect(parseActivityLines(`("" string)`)).toEqual([]);
    expect(parseActivityLines("")).toEqual([]);
  });
});

describe("activityKindLabel", () => {
  it("maps realm kinds to English labels", () => {
    expect(activityKindLabel("mint")).toBe("Mint");
    expect(activityKindLabel("list")).toBe("Listed");
    expect(activityKindLabel("buy")).toBe("Sold");
    expect(activityKindLabel("cancel")).toBe("Cancelled");
    expect(activityKindLabel("drop")).toBe("Drop");
    expect(activityKindLabel("publicmint")).toBe("Public mint");
    expect(activityKindLabel("LIST")).toBe("Listed");
    expect(activityKindLabel("offer")).toBe("Offer");
    expect(activityKindLabel("accept")).toBe("Offer taken");
    expect(activityKindLabel("depositpool")).toBe("Pool in");
    expect(activityKindLabel("depositnft")).toBe("NFT in pool");
  });
});

describe("offers / pool / socials parsers", () => {
  it("parses offer lines, pool, pool nfts, and socials", () => {
    expect(parseOfferLines(`("1|g1abc|2000000|Ember Core" string)`)).toEqual([
      { id: "1", bidder: "g1abc", amount: 2_000_000, name: "Ember Core" },
    ]);
    expect(parsePoolOf(`("4000000|4000000|2" string)`)).toEqual({ gnot: 4_000_000, shares: 4_000_000, nfts: 2 });
    expect(parsePoolNftLines(`("1|Sword|g1alice" string)`)).toEqual([
      { id: "1", name: "Sword", depositor: "g1alice" },
    ]);
    expect(parseSocials(`("https://gno.land|@_gnoland|https://discord.gg/gnoland" string)`)).toEqual({
      website: "https://gno.land",
      twitter: "@_gnoland",
      discord: "https://discord.gg/gnoland",
    });
  });

  it("builds social hrefs and compares addresses", () => {
    expect(socialHref("@_gnoland")).toBe("https://x.com/_gnoland");
    expect(socialHref("https://gno.land")).toBe("https://gno.land");
    expect(socialHref("discord.gg/gnoland")).toBe("https://discord.gg/gnoland");
    expect(sameAddr("G1ABC", "g1abc")).toBe(true);
    expect(sameAddr("g1abc", "g1zzz")).toBe(false);
  });
});

describe("sweepQuote / topOfferFor", () => {
  it("picks cheapest listed items skipping own listings", () => {
    const q = sweepQuote(items, 2, "g1abc");
    expect(q.ids).toEqual(["2"]);
    expect(q.total).toBe(2_500_000);
    expect(q.count).toBe(1);
  });

  it("picks top offer per item id", () => {
    const offers = [
      { id: "1", bidder: "g1a", amount: 1_000_000, name: "A" },
      { id: "1", bidder: "g1b", amount: 3_000_000, name: "A" },
      { id: "2", bidder: "g1c", amount: 500_000, name: "B" },
    ];
    expect(topOfferFor(offers, "1")?.bidder).toBe("g1b");
    expect(topOfferFor(offers, "9")).toBeNull();
  });
});

describe("shortAddr", () => {
  it("shortens long g1 addresses", () => {
    expect(shortAddr("g1abcdefghijklmnopqrstuvwxyz")).toBe("g1abcd…wxyz");
    expect(shortAddr("g1short")).toBe("g1short");
  });
});

describe("parseIds", () => {
  it("splits comma ids from qeval", () => {
    expect(parseIds(`("1,2,3" string)`)).toEqual(["1", "2", "3"]);
    expect(parseIds(`("1, 2, 10" string)`)).toEqual(["1", "2", "10"]);
    expect(parseIds(`("" string)`)).toEqual([]);
  });
});

describe("isHttpUrl", () => {
  it("accepts http(s) without whitespace", () => {
    expect(isHttpUrl("https://example.com/a.png")).toBe(true);
    expect(isHttpUrl("http://example.com/a.png")).toBe(true);
    expect(isHttpUrl("ipfs://cid")).toBe(false);
    expect(isHttpUrl("https://example.com/a png")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl("/samples/stones-01.png")).toBe(false);
  });
});

describe("isSamplePath / isArtSrc", () => {
  it("accepts /samples/ file names and rejects traversal", () => {
    expect(isSamplePath("/samples/stones-01.png")).toBe(true);
    expect(isSamplePath("/samples/lamps-02.png")).toBe(true);
    expect(isSamplePath("/samples/../secret.png")).toBe(false);
    expect(isSamplePath("/samples/foo/bar.png")).toBe(false);
    expect(isSamplePath("https://example.com/a.png")).toBe(false);
    expect(isSamplePath("")).toBe(false);
  });

  it("isArtSrc is http(s) or /samples/", () => {
    expect(isArtSrc("https://example.com/a.png")).toBe(true);
    expect(isArtSrc("/samples/relics-01.png")).toBe(true);
    expect(isArtSrc("ipfs://bafybeiabc")).toBe(true);
  });
});

describe("ipfs", () => {
  it("maps ipfs:// CID to the ipfs.io gateway", () => {
    expect(isIpfsUri("ipfs://bafybeiabc")).toBe(true);
    expect(isIpfsUri("ipfs://bafybeiabc/fox.png")).toBe(true);
    expect(isIpfsUri("https://ipfs.io/ipfs/bafybeiabc")).toBe(false);
    expect(ipfsToHttp("ipfs://bafybeiabc/fox.png")).toBe("https://ipfs.io/ipfs/bafybeiabc/fox.png");
    expect(artSrc("ipfs://bafybeiabc")).toBe("https://ipfs.io/ipfs/bafybeiabc");
  });
});

describe("isMintName / isMintImage", () => {
  it("enforces name length and no newlines", () => {
    expect(isMintName("Sunset")).toBe(true);
    expect(isMintName("")).toBe(false);
    expect(isMintName("a\nb")).toBe(false);
    expect(isMintName("x".repeat(64))).toBe(true);
    expect(isMintName("x".repeat(65))).toBe(false);
  });

  it("allows empty image, http(s), or /samples/ path", () => {
    expect(isMintImage("")).toBe(true);
    expect(isMintImage("https://example.com/a.png")).toBe(true);
    expect(isMintImage("/samples/stones-01.png")).toBe(true);
    expect(isMintImage("ipfs://bafybeiabc")).toBe(true);
    expect(isMintImage("https://example.com/a png")).toBe(false);
    expect(isMintImage(`https://example.com/${"a".repeat(200)}`)).toBe(false);
  });
});

describe("drop field validators", () => {
  it("accepts Gno package names 2–11 [a-z][a-z0-9]* and rejects hyphen / 12-char", () => {
    expect(isDropSlug("stones")).toBe(true);
    expect(isDropSlug("a1")).toBe(true);
    expect(isDropSlug("hfoxes")).toBe(true);
    expect(isDropSlug("x".repeat(11))).toBe(true);
    expect(isDropSlug("paper-relics")).toBe(false);
    expect(isDropSlug("a-b")).toBe(false);
    expect(isDropSlug("a")).toBe(false);
    expect(isDropSlug("A1")).toBe(false);
    expect(isDropSlug("1abc")).toBe(false);
    expect(isDropSlug("x".repeat(12))).toBe(false);
    expect(isDropSlug("x".repeat(17))).toBe(false);
  });

  it("allows empty, http(s), or /samples/ cover", () => {
    expect(isDropCover("")).toBe(true);
    expect(isDropCover("https://example.com/a.png")).toBe(true);
    expect(isDropCover("/samples/stones-01.png")).toBe(true);
    expect(isDropCover("ipfs://bafybeiabc")).toBe(true);
  });

  it("allows custom supply 1–1_000_000; 0 is open edition in the wizard", () => {
    expect(isDropMaxSupply("1")).toBe(true);
    expect(isDropMaxSupply("3000")).toBe(true);
    expect(isDropMaxSupply("3001")).toBe(true);
    expect(isDropMaxSupply("1000000")).toBe(true);
    expect(isDropMaxSupply("0")).toBe(false);
    expect(isDropMaxSupply("1000001")).toBe(false);
    expect(isDropMaxSupply("6.5")).toBe(false);
  });

  it("allows mint price 0 GNOT", () => {
    expect(isDropMintPrice("0")).toBe(true);
    expect(isDropMintPrice("0.5")).toBe(true);
    expect(isDropMintPrice("")).toBe(false);
    expect(isDropMintPrice("-1")).toBe(false);
  });
});

describe("filterItems", () => {
  it("returns a copy when the query is empty", () => {
    const out = filterItems(items, "  ");
    expect(out).toEqual(items);
    expect(out).not.toBe(items);
  });

  it("matches name, #id, seller, or collection", () => {
    expect(filterItems(items, "pearl").map((r) => r.id)).toEqual(["2"]);
    expect(filterItems(items, "#10").map((r) => r.id)).toEqual(["10"]);
    expect(filterItems(items, "g1abc").map((r) => r.id)).toEqual(["1"]);
    expect(filterItems(items, "stones").map((r) => r.id)).toEqual(["1"]);
  });
});

describe("parseCatalog / buildExploreCollections", () => {
  const catalog = parseCatalog({
    collections: [
      {
        slug: "stones",
        name: "Signal Stones",
        cover: "/samples/stones-01.png",
        website: "https://gno.land",
        twitter: "@_gnoland",
        discord: "https://discord.gg/gnoland",
        mintPrice: 500000,
        maxSupply: 6,
        minted: 3,
        items: [
          { name: "Ember Core", image: "/samples/stones-01.png", listPrice: 1000000 },
          { name: "Tide Core", image: "/samples/stones-02.png", listPrice: 2000000 },
          { name: "Night Core", image: "/samples/stones-03.png", listPrice: 3500000 },
        ],
      },
      {
        slug: "lamps",
        name: "Harbor Lamps",
        cover: "/samples/lamps-01.png",
        mintPrice: 800000,
        maxSupply: 6,
        minted: 3,
        items: [{ name: "Copper Wick", image: "/samples/lamps-01.png", listPrice: 1500000 }],
      },
    ],
  });

  it("parses catalog collections", () => {
    expect(catalog.map((c) => c.slug)).toEqual(["stones", "lamps"]);
    expect(catalog[0].items).toHaveLength(3);
    expect(catalog[0].mintPrice).toBe(500000);
    expect(catalog[0].maxSupply).toBe(6);
    expect(catalog[0].items[0].listPrice).toBe(1_000_000);
    expect(catalog[0].website).toBe("https://gno.land");
    expect(catalog[0].twitter).toBe("@_gnoland");
  });

  it("builds preview collections when ListOpen is empty", () => {
    const cards = buildExploreCollections(catalog, [], []);
    expect(cards.map((c) => c.slug)).toEqual(["stones", "lamps"]);
    expect(cards.every((c) => c.preview)).toBe(true);
    expect(cards[0].itemCount).toBe(3);
    expect(cards[0].floor).toBe(1_000_000);
    expect(cards[0].mintPrice).toBe(500000);
    expect(cards[0].minted).toBe(3);
    expect(cards[0].website).toBe("https://gno.land");
    expect(cards[0].twitter).toBe("@_gnoland");
    expect(previewItemsFor(catalog[0]).every(isPreviewItem)).toBe(true);
  });

  it("builds market rows and featured order", () => {
    const cards = buildExploreCollections(catalog, [], []);
    const listed = previewItemsFor(catalog[0]);
    const tape = [
      { kind: "buy", id: "1", slug: "stones", actor: "g1x", price: 1_000_000, name: "Ember Core" },
    ];
    const row = collectionMarketRow(cards[0], listed, tape);
    expect(row.floor).toBe(1_000_000);
    expect(row.listed).toBe(3);
    expect(row.vol).toBe(1_000_000);
    expect(row.sales).toBe(1);
    const markets = new Map(cards.map((c) => [c.slug, collectionMarketRow(c, listed, tape)]));
    expect(pickFeatured(cards, markets, 1)[0].slug).toBe("stones");
    expect(pickFeatured(cards, markets, 4, { requireVolume: true }).map((c) => c.slug)).toEqual(["stones"]);
    expect(pickFeatured(cards, markets, 4, { requireVolume: true, exclude: new Set(["stones"]) })).toEqual([]);
  });

  it("uses catalog listedCount and volume for preview ME-style rows", () => {
    const me = parseCatalog({
      collections: [
        {
          slug: "madlads",
          name: "Mad Lads",
          cover: "https://example.com/c.png",
          maxSupply: 10000,
          minted: 10000,
          listedCount: 232,
          volumeUgnot: 534000000,
          salesCount: 71,
          topOfferUgnot: 6244000,
          floorPct7d: -1.72,
          items: [{ name: "Mad Lads #1", image: "https://example.com/a.png", listPrice: 6997000 }],
        },
      ],
    });
    const cards = buildExploreCollections(me, [], []);
    const m = collectionMarketRow(cards[0], previewItemsFor(me[0]), []);
    expect(m.listed).toBe(232);
    expect(m.vol).toBe(534000000);
    expect(m.sales).toBe(71);
    expect(m.floor).toBe(6997000);
    expect(m.supply).toBe(10000);
    expect(m.topOffer).toBe(6244000);
    expect(m.floorPct7d).toBe(-1.72);
  });

  it("formats listed share and 7d floor pct", () => {
    const share = listedShare(232, 10000);
    expect(share.pct).toBe("2.3%");
    expect(share.ratio).toMatch(/232/);
    expect(share.ratio).toMatch(/10/);
    expect(formatFloorPct(10.51)).toBe("+10.5%");
    expect(formatFloorPct(-1.72)).toBe("−1.72%");
  });

  it("synthesizes preview mint, list, and buy rows", () => {
    const rows = previewActivityFor(catalog[0]);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.length).toBeLessThanOrEqual(8);
    expect(rows[0]).toMatchObject({ kind: "mint", name: "Ember Core", price: 0, preview: true });
    expect(rows[1]).toMatchObject({
      kind: "list",
      name: "Ember Core",
      price: 1_000_000,
      preview: true,
    });
    expect(rows.some((r) => r.kind === "buy" && r.price > 0)).toBe(true);
    expect(rows.every((r) => r.preview && r.slug === "stones")).toBe(true);
  });

  it("sets preview items listed with listPrice so cards show GNOT", () => {
    const rows = previewItemsFor(catalog[0]);
    expect(rows.every((row) => row.listed && row.price > 0)).toBe(true);
    expect(rows.map((row) => row.price)).toEqual([1_000_000, 2_000_000, 3_500_000]);
    expect(rows.every(isPreviewItem)).toBe(true);
  });

  it("marks seeded collections as live Buy rows", () => {
    const cards = buildExploreCollections(catalog, [], items);
    const stones = cards.find((c) => c.slug === "stones");
    const lamps = cards.find((c) => c.slug === "lamps");
    expect(stones?.preview).toBe(false);
    expect(stones?.itemCount).toBe(1);
    expect(stones?.floor).toBe(1_000_000);
    expect(lamps?.preview).toBe(false);
  });

  it("uses catalog preview items when the collection has no chain rows", () => {
    const rows = itemsForExploreCollection("stones", catalog, [], null);
    expect(rows).toHaveLength(3);
    expect(rows.every(isPreviewItem)).toBe(true);
    expect(rows[0].name).toBe("Ember Core");
    expect(rows[0].listed).toBe(true);
    expect(rows[0].price).toBe(1_000_000);
  });

  it("uses ListOpen / ListByCollection rows as real items", () => {
    const fromOpen = itemsForExploreCollection("stones", catalog, items, null);
    expect(fromOpen.map((r) => r.id)).toEqual(["1"]);
    expect(fromOpen.every((r) => !isPreviewItem(r))).toBe(true);
    const fromBy = itemsForExploreCollection("stones", catalog, [], [items[0]]);
    expect(fromBy.map((r) => r.id)).toEqual(["1"]);
  });

  it("builds catalog drops when chain has no maxSupply", () => {
    const drops = buildDrops(catalog, []);
    expect(drops.map((d) => d.slug)).toEqual(["stones", "lamps"]);
    expect(drops.every((d) => d.preview)).toBe(true);
    expect(drops[0].mintPrice).toBe(500000);
    expect(drops[0].maxSupply).toBe(6);
    expect(drops[0].minted).toBe(3);
  });

  it("uses chain drops when maxSupply is set", () => {
    const drops = buildDrops(catalog, [
      {
        slug: "stones",
        name: "Signal Stones",
        cover: "/samples/stones-01.png",
        count: 3,
        mintPrice: 500000,
        maxSupply: 6,
        minted: 3,
        creator: "g1abc",
        paused: false,
        drop: true,
        bio: "",
      },
    ]);
    expect(drops).toHaveLength(1);
    expect(drops[0].preview).toBe(false);
    expect(drops[0].creator).toBe("g1abc");
    expect(drops[0].paused).toBe(false);
  });

  it("ignores chain collections without maxSupply and previews catalog", () => {
    const drops = buildDrops(catalog, [
      {
        slug: "bazaar",
        name: "Bazaar",
        cover: "",
        count: 0,
        mintPrice: 0,
        maxSupply: 0,
        minted: 0,
        creator: "",
        paused: false,
        drop: false,
        bio: "",
      },
    ]);
    expect(drops.map((d) => d.slug)).toEqual(["stones", "lamps"]);
    expect(drops.every((d) => d.preview)).toBe(true);
  });

  it("shows factory collections with pkg and skips catalog preview", () => {
    const cards = buildExploreCollections(
      catalog,
      [
        {
          slug: "demo",
          name: "Demo",
          cover: "/samples/clay-01.png",
          count: 0,
          mintPrice: 1_000_000,
          maxSupply: 100,
          minted: 0,
          creator: "g1abc",
          paused: false,
          drop: true,
          bio: "",
          pkg: "gno.land/r/bazaar/c/demo",
          addr: "g1coladdr00000000000000000000000000",
          royaltyBps: 500,
        },
      ],
      [],
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].slug).toBe("demo");
    expect(cards[0].pkg).toBe("gno.land/r/bazaar/c/demo");
    expect(cards[0].preview).toBe(false);
    expect(cards[0].maxSupply).toBe(100);
    expect(cards[0].royaltyBps).toBe(500);
  });

  it("keeps mintPrice when preview items have no listPrice", () => {
    const empty = parseCatalog({
      collections: [
        {
          slug: "x",
          name: "X",
          cover: "",
          mintPrice: 500000,
          maxSupply: 6,
          minted: 0,
          items: [{ name: "A", image: "" }],
        },
      ],
    });
    const cards = buildExploreCollections(empty, [], []);
    expect(cards[0].floor).toBe(0);
    expect(cards[0].mintPrice).toBe(500000);
    expect(cards[0].maxSupply).toBe(6);
  });
});

describe("sortItems", () => {
  it("sorts by price ascending with id tie-break", () => {
    expect(sortItems(items, "price", "asc").map((r) => r.id)).toEqual(["10", "1", "2"]);
  });

  it("sorts by name A–Z", () => {
    expect(sortItems(items, "name", "asc").map((r) => r.name)).toEqual(["Alpha", "Pearl Shell", "Sunset"]);
  });

  it("sorts by numeric id", () => {
    expect(sortItems(items, "id", "asc").map((r) => r.id)).toEqual(["1", "2", "10"]);
  });
});

describe("filterListings", () => {
  it("returns a copy when the query is empty", () => {
    const out = filterListings(rows, "  ");
    expect(out).toEqual(rows);
    expect(out).not.toBe(rows);
  });

  it("matches symbol case-insensitively", () => {
    expect(filterListings(rows, "pearl").map((r) => r.id)).toEqual(["b"]);
  });

  it("matches seller or id", () => {
    expect(filterListings(rows, "g1abc").map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterListings(rows, "g1zzz").map((r) => r.id)).toEqual(["b"]);
  });
});

describe("sortListings", () => {
  it("sorts by price ascending with id tie-break", () => {
    expect(sortListings(rows, "price", "asc").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by amount descending", () => {
    expect(sortListings(rows, "amount", "desc").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by symbol A–Z", () => {
    expect(sortListings(rows, "symbol", "asc").map((r) => r.symbol)).toEqual(["ALPHA", "DEMO", "PEARL"]);
  });
});

describe("uniqueListingSymbols", () => {
  it("keeps first-seen order", () => {
    expect(uniqueListingSymbols(rows)).toEqual(["DEMO", "PEARL", "ALPHA"]);
    expect(uniqueListingSymbols([...rows, { ...rows[0], id: "d" }])).toEqual(["DEMO", "PEARL", "ALPHA"]);
  });
});

describe("tickerLetters", () => {
  it("uses 2–4 alphanumeric letters", () => {
    expect(tickerLetters("DEMO")).toBe("DEMO");
    expect(tickerLetters("TOOLONG")).toBe("TOOL");
    expect(tickerLetters("ab-cd")).toBe("ABCD");
    expect(tickerLetters("")).toBe("?");
  });
});

describe("symbolHue", () => {
  it("is deterministic in 0–359", () => {
    const hue = symbolHue("DEMO");
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
    expect(symbolHue("DEMO")).toBe(hue);
    expect(symbolHue("demo")).toBe(hue);
  });
});

describe("isOwnListing", () => {
  it("matches seller case-insensitively", () => {
    expect(isOwnListing(items[0], "G1ABC")).toBe(true);
    expect(isOwnListing(items[0], "g1zzz")).toBe(false);
    expect(isOwnListing(items[0], "")).toBe(false);
  });
});

describe("parseCollectionLine paused|bio", () => {
  it("reads paused true/false and bio after creator", () => {
    const parsed = parseCollectionLines(
      `("stones|Signal Stones|/samples/stones-01.png|3|500000|6|3|g1abc|true|Harbor watchers." string)`,
    );
    expect(parsed).toEqual([
      {
        slug: "stones",
        name: "Signal Stones",
        cover: "/samples/stones-01.png",
        count: 3,
        mintPrice: 500000,
        maxSupply: 6,
        minted: 3,
        creator: "g1abc",
        paused: true,
        drop: true,
        bio: "Harbor watchers.",
      },
    ]);
  });

  it("keeps bio pipes after the paused field", () => {
    const parsed = parseCollectionLines(`("lamps|Lamps||0|0|0|0|g1abc|false|A|B" string)`);
    expect(parsed[0].paused).toBe(false);
    expect(parsed[0].bio).toBe("A|B");
  });
});

describe("filterListedItems", () => {
  it("filters listed items by rarity and GNOT range", () => {
    expect(filterListedItems(items, { rarity: "Rare" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterListedItems(items, { minGnot: "2" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterListedItems(items, { maxGnot: "1" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterListedItems(items, { rarity: "all", minGnot: "1", maxGnot: "3" }).map((r) => r.id)).toEqual([
      "1",
      "2",
    ]);
  });

  it("drops unlisted rows when a price bound is set", () => {
    expect(filterListedItems(items, { minGnot: "0" }).map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("filters by trait AND rarity groups", () => {
    expect(itemMatchesTraits(items[0], { Fur: ["Ember"] })).toBe(true);
    expect(filterListedItems(items, { traits: { Fur: ["Ember"] } }).map((r) => r.id)).toEqual(["1"]);
    expect(traitGroups(items).some((g) => g.type === "Rarity")).toBe(true);
    expect(filterListedItems(items, { listedOnly: true }).every((r) => r.listed)).toBe(true);
  });
});

describe("gnotFromCoins", () => {
  it("parses leading digits and divides by 1e6", () => {
    expect(parseCoinsUgnot("12345678ugnot")).toBe(12345678);
    expect(gnotFromCoins("1500000ugnot")).toBe("1.5");
    expect(gnotFromCoins("")).toBe("");
    expect(gnotFromCoins("0ugnot")).toBe("0");
  });
});

describe("parseFeaturedLines", () => {
  it("parses qeval featured slugs and ignores junk", () => {
    expect(parseFeaturedLines(`("tide\\nkelp" string)`)).toEqual(["tide", "kelp"]);
    expect(parseFeaturedLines(`("tide,kelp,nope!" string)`)).toEqual(["tide", "kelp"]);
    expect(parseFeaturedLines(`("tide\\n\\ntide\\nkelp\\n" string)`)).toEqual(["tide", "kelp"]);
    expect(parseFeaturedLines(`("" string)`)).toEqual([]);
    expect(parseFeaturedLines("")).toEqual([]);
  });
});

describe("parseHash", () => {
  it("reads collection, item, and page URLs", () => {
    expect(parseHash("#/c/stones")).toEqual({ tab: "explore", slug: "stones", itemId: "", profile: "", mintSlug: "" });
    expect(parseHash("#/i/12")).toEqual({ tab: "explore", slug: "", itemId: "12", profile: "", mintSlug: "" });
    expect(parseHash("#/m/stones")).toEqual({ tab: "explore", slug: "", itemId: "", profile: "", mintSlug: "stones" });
    expect(parseHash("#/launch")).toEqual({ tab: "create", slug: "", itemId: "", profile: "", mintSlug: "" });
    expect(parseHash("#/sell")).toEqual({ tab: "sell", slug: "", itemId: "", profile: "", mintSlug: "" });
    expect(parseHash("#/portfolio")).toEqual({ tab: "portfolio", slug: "", itemId: "", profile: "", mintSlug: "" });
    expect(parseHash("#/profile")).toEqual({ tab: "portfolio", slug: "", itemId: "", profile: "", mintSlug: "" });
    expect(parseHash("#/u/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt")).toEqual({
      tab: "portfolio",
      slug: "",
      itemId: "",
      profile: "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
      mintSlug: "",
    });
    expect(parseHash("#/settings")).toEqual({ tab: "settings", slug: "", itemId: "", profile: "", mintSlug: "" });
    expect(parseHash("#/admin")).toEqual({ tab: "admin", slug: "", itemId: "", profile: "", mintSlug: "" });
    expect(parseHash("#/guide")).toEqual({ tab: "guide", slug: "", itemId: "", profile: "", mintSlug: "" });
    expect(tabHash("guide")).toBe("#/guide");
    expect(parseHash("#/explore")).toEqual({ tab: "explore", slug: "", itemId: "", profile: "", mintSlug: "" });
    expect(parseHash("")).toEqual({ tab: "explore", slug: "", itemId: "", profile: "", mintSlug: "" });
    expect(tabHash("admin")).toBe("#/admin");
    expect(profileHash("g1abc")).toBe("#/u/g1abc");
    expect(mintHash("stones")).toBe("#/m/stones");
  });
});

describe("isRealmUnavailable", () => {
  it("detects missing-package copy", () => {
    expect(isRealmUnavailable("Could not read listings: Realm not on this chain yet: gno.land/r/bazaar/market")).toBe(
      true,
    );
    expect(isRealmUnavailable("package not found: gno.land/r/bazaar")).toBe(true);
    expect(
      isRealmUnavailable(
        "ERROR: /std.InternalError: recovered: unexpected node with location gno.land/r/bazaar/nft:0:0",
      ),
    ).toBe(true);
    expect(isRealmUnavailable("timeout talking to RPC")).toBe(false);
  });
});

describe("isNameNotDeclared", () => {
  it("detects missing realm funcs", () => {
    expect(isNameNotDeclared("ERROR: /std.InternalError: recovered: name Offer not declared")).toBe(true);
    expect(isNameNotDeclared("name ListOffers not declared:")).toBe(true);
    expect(isNameNotDeclared("nft: self buy")).toBe(false);
  });
});

describe("parseTokenURI", () => {
  it("parses a json data URI with charset and percent-encoding", () => {
    const json = {
      name: "Sword",
      description: "Sword #1",
      image: "https://example.com/sword.png",
      attributes: [{ trait_type: "Rarity", value: "Rare" }],
    };
    const uri = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(json))}`;
    expect(parseTokenURI(uri)).toMatchObject({
      kind: "json",
      name: "Sword",
      description: "Sword #1",
      image: "https://example.com/sword.png",
      attributes: [{ trait_type: "Rarity", value: "Rare" }],
    });
    expect(parseTokenURI(uri).json).toContain('"name": "Sword"');
  });

  it("parses an unencoded json data URI", () => {
    const uri =
      'data:application/json,{"name":"Foam","description":"Foam #1","image":"/samples/foam-01.png","attributes":[]}';
    expect(parseTokenURI(uri)).toMatchObject({
      kind: "json",
      name: "Foam",
      description: "Foam #1",
      image: "/samples/foam-01.png",
      attributes: [],
    });
  });

  it("treats a bare image URL as image (Foam)", () => {
    expect(parseTokenURI("https://example.com/sword.png")).toEqual({
      name: "",
      description: "",
      image: "https://example.com/sword.png",
      attributes: [],
      kind: "image",
      json: "",
    });
    expect(parseTokenURI("/samples/foam-01.png")).toMatchObject({
      kind: "image",
      image: "/samples/foam-01.png",
    });
    expect(parseTokenURI(`("https://example.com/sword.png" string)`).image).toBe("https://example.com/sword.png");
  });
});

import {
  isPublicDrop,
  itemCollectionSlug,
  type Activity,
  type ChainCollection,
  type Item,
} from "./chain";

export type CatalogItem = {
  name: string;
  image: string;
  listPrice: number;
  rarity: string;
  traits: string;
};

export type CatalogCollection = {
  slug: string;
  name: string;
  cover: string;
  mintPrice: number;
  maxSupply: number;
  minted: number;
  website: string;
  twitter: string;
  discord: string;
  listedCount?: number;
  volumeUgnot?: number;
  salesCount?: number;
  topOfferUgnot?: number;
  floorPct7d?: number;
  items: CatalogItem[];
};

export type ExploreCollection = {
  slug: string;
  name: string;
  cover: string;
  itemCount: number;
  preview: boolean;
  floor: number;
  mintPrice: number;
  maxSupply: number;
  minted: number;
  paused: boolean;
  drop: boolean;
  bio: string;
  website: string;
  twitter: string;
  discord: string;
  listedCount?: number;
  previewVol?: number;
  previewSales?: number;
  topOfferUgnot?: number;
  floorPct7d?: number;
};

export type Drop = {
  slug: string;
  name: string;
  cover: string;
  mintPrice: number;
  maxSupply: number;
  minted: number;
  creator: string;
  preview: boolean;
  paused: boolean;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function minPositive(prices: number[]): number {
  let min = 0;
  for (const p of prices) {
    if (p <= 0) continue;
    if (min === 0 || p < min) min = p;
  }
  return min;
}

export function parseCatalog(data: unknown): CatalogCollection[] {
  if (!data || typeof data !== "object") return [];
  const cols = (data as { collections?: unknown }).collections;
  if (!Array.isArray(cols)) return [];
  return cols
    .map((c) => {
      if (!c || typeof c !== "object") return null;
      const row = c as Record<string, unknown>;
      const slug = asString(row.slug).trim();
      if (!slug) return null;
      const items = Array.isArray(row.items)
        ? row.items
            .map((it) => {
              if (!it || typeof it !== "object") return null;
              const rec = it as Record<string, unknown>;
              const name = asString(rec.name).trim();
              if (!name) return null;
              return {
                name,
                image: asString(rec.image).trim(),
                listPrice: asNum(rec.listPrice),
                rarity: asString(rec.rarity).trim(),
                traits: asString(rec.traits).trim(),
              };
            })
            .filter((x): x is CatalogItem => !!x)
        : [];
      return {
        slug,
        name: asString(row.name).trim() || slug,
        cover: asString(row.cover).trim(),
        mintPrice: asNum(row.mintPrice),
        maxSupply: asNum(row.maxSupply),
        minted: asNum(row.minted),
        website: asString(row.website).trim(),
        twitter: asString(row.twitter).trim(),
        discord: asString(row.discord).trim(),
        items,
        ...(asNum(row.listedCount) ? { listedCount: asNum(row.listedCount) } : {}),
        ...(asNum(row.volumeUgnot) ? { volumeUgnot: asNum(row.volumeUgnot) } : {}),
        ...(asNum(row.salesCount) ? { salesCount: asNum(row.salesCount) } : {}),
        ...(asNum(row.topOfferUgnot) ? { topOfferUgnot: asNum(row.topOfferUgnot) } : {}),
        ...(row.floorPct7d != null && row.floorPct7d !== "" && Number.isFinite(Number(row.floorPct7d))
          ? { floorPct7d: Number(row.floorPct7d) }
          : {}),
      };
    })
    .filter((x): x is CatalogCollection => !!x);
}

export function previewItemsFor(col: CatalogCollection): Item[] {
  return col.items.map((it, i) => ({
    id: "",
    name: it.name,
    owner: "",
    seller: `g1prev${col.slug}${i + 1}`,
    price: it.listPrice,
    listed: true,
    image: it.image,
    collection: col.slug,
    rarity: it.rarity || "Common",
    traits: it.traits || "",
    revealed: true,
    slot: -1,
  }));
}

export function previewActivityFor(col: CatalogCollection): Activity[] {
  const out: Activity[] = [];
  for (const it of col.items) {
    out.push({
      kind: "mint",
      id: "",
      slug: col.slug,
      actor: "",
      price: 0,
      name: it.name,
      preview: true,
    });
    if (it.listPrice > 0) {
      out.push({
        kind: "list",
        id: "",
        slug: col.slug,
        actor: "",
        price: it.listPrice,
        name: it.name,
        preview: true,
      });
    }
  }
  const sold = col.items.filter((it) => it.listPrice > 0).slice(-2);
  for (const it of sold) {
    out.push({
      kind: "buy",
      id: "",
      slug: col.slug,
      actor: "",
      price: it.listPrice,
      name: it.name,
      preview: true,
    });
  }
  return out.slice(0, 8);
}

const HIDE_FROM_EXPLORE = new Set(["stones", "lamps", "relics", "foxes", "docks", "clay", "bazaar"]);

export function buildExploreCollections(
  catalog: CatalogCollection[],
  chainCols: ChainCollection[],
  openItems: Item[],
): ExploreCollection[] {
  const bySlug = new Map<string, ExploreCollection>();
  const order: string[] = [];

  function ensure(slug: string): ExploreCollection {
    const existing = bySlug.get(slug);
    if (existing) return existing;
    const row: ExploreCollection = {
      slug,
      name: slug,
      cover: "",
      itemCount: 0,
      preview: true,
      floor: 0,
      mintPrice: 0,
      maxSupply: 0,
      minted: 0,
      paused: false,
      drop: false,
      bio: "",
      website: "",
      twitter: "",
      discord: "",
    };
    bySlug.set(slug, row);
    order.push(slug);
    return row;
  }

  for (const col of catalog) {
    const row = ensure(col.slug);
    row.name = col.name || row.name;
    row.cover = col.cover || row.cover;
    row.itemCount = col.items.length;
    row.preview = true;
    row.mintPrice = col.mintPrice;
    row.maxSupply = col.maxSupply;
    row.minted = col.minted;
    row.floor = minPositive(col.items.map((it) => it.listPrice));
    if (col.website) row.website = col.website;
    if (col.twitter) row.twitter = col.twitter;
    if (col.discord) row.discord = col.discord;
    if (col.listedCount) row.listedCount = col.listedCount;
    if (col.volumeUgnot) row.previewVol = col.volumeUgnot;
    if (col.salesCount) row.previewSales = col.salesCount;
    if (col.topOfferUgnot) row.topOfferUgnot = col.topOfferUgnot;
    if (col.floorPct7d != null) row.floorPct7d = col.floorPct7d;
  }

  for (const col of chainCols) {
    if (HIDE_FROM_EXPLORE.has(col.slug) && !bySlug.has(col.slug)) continue;
    const row = ensure(col.slug);
    if (col.name) row.name = col.name;
    if (col.cover) row.cover = col.cover;
    if (col.mintPrice) row.mintPrice = col.mintPrice;
    if (col.maxSupply) row.maxSupply = col.maxSupply;
    row.minted = col.minted || col.count;
    row.paused = col.paused;
    row.drop = col.drop || col.maxSupply > 0;
    if (col.bio) row.bio = col.bio;
    if (col.website) row.website = col.website;
    if (col.twitter) row.twitter = col.twitter;
    if (col.discord) row.discord = col.discord;
  }

  const counts = new Map<string, number>();
  for (const it of openItems) {
    const slug = itemCollectionSlug(it);
    if (HIDE_FROM_EXPLORE.has(slug) && !bySlug.has(slug)) continue;
    const row = ensure(slug);
    counts.set(slug, (counts.get(slug) || 0) + 1);
    if (!row.cover && it.image) row.cover = it.image;
    if (row.name === slug && it.collection) row.name = it.collection;
    row.preview = false;
  }

  for (const [slug, n] of counts) {
    const row = bySlug.get(slug);
    if (row) row.itemCount = n;
  }

  for (const slug of order) {
    const row = bySlug.get(slug);
    if (!row) continue;
    const listed = openItems.filter((it) => itemCollectionSlug(it) === slug && it.listed && it.price > 0);
    if (listed.length > 0) {
      row.floor = minPositive(listed.map((it) => it.price));
    } else if (!row.preview) {
      row.floor = 0;
    }
  }

  return order
    .map((slug) => bySlug.get(slug)!)
    .filter((row) => row.itemCount > 0 || row.maxSupply > 0 || row.floor > 0);
}

export type CollectionMarket = {
  slug: string;
  floor: number;
  listed: number;
  supply: number;
  vol: number;
  sales: number;
  owners: number;
  topOffer: number;
  floorPct7d: number | null;
};

export function collectionMarketRow(
  col: ExploreCollection,
  listedItems: Item[],
  activity: Activity[],
): CollectionMarket {
  const listed = listedItems.filter(
    (it) => itemCollectionSlug(it) === col.slug && it.listed && it.price > 0,
  );
  const floor = listed.length > 0 ? minPositive(listed.map((it) => it.price)) : col.floor;
  const salesRows = activity.filter(
    (row) => row.slug === col.slug && (row.kind === "buy" || row.kind === "accept") && row.price > 0,
  );
  const owners = new Set(
    listed.map((it) => (it.seller || it.owner).toLowerCase()).filter(Boolean),
  );
  const listedCount = listed.length > 0 ? listed.length : col.preview ? col.itemCount : 0;
  const tapeVol = salesRows.reduce((n, row) => n + row.price, 0);
  const tapeSales = salesRows.length;
  return {
    slug: col.slug,
    floor,
    listed: col.preview && col.listedCount ? col.listedCount : listedCount,
    supply: col.maxSupply || col.itemCount,
    vol: col.preview && col.previewVol ? col.previewVol : tapeVol,
    sales: col.preview && col.previewSales ? col.previewSales : tapeSales,
    owners: owners.size,
    topOffer: col.topOfferUgnot || 0,
    floorPct7d: col.floorPct7d != null && Number.isFinite(col.floorPct7d) ? col.floorPct7d : null,
  };
}

export function listedShare(listed: number, supply: number): { ratio: string; pct: string } {
  if (supply <= 0) return { ratio: listed > 0 ? String(listed) : "—", pct: "" };
  const pct = (listed / supply) * 100;
  const pctLabel = pct >= 10 ? pct.toFixed(0) : pct >= 1 ? pct.toFixed(1) : pct.toFixed(2);
  return {
    ratio: `${listed.toLocaleString()} / ${supply.toLocaleString()}`,
    pct: `${pctLabel}%`,
  };
}

export function formatFloorPct(n: number): string {
  const abs = Math.abs(n);
  const body = abs >= 10 ? abs.toFixed(1) : abs.toFixed(2);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${body}%`;
}

export function pickFeatured(rows: ExploreCollection[], markets: Map<string, CollectionMarket>, n = 3): ExploreCollection[] {
  return rows
    .slice()
    .sort((a, b) => {
      const ma = markets.get(a.slug);
      const mb = markets.get(b.slug);
      const vol = (mb?.vol || 0) - (ma?.vol || 0);
      if (vol) return vol;
      const listed = (mb?.listed || 0) - (ma?.listed || 0);
      if (listed) return listed;
      return (b.floor || 0) - (a.floor || 0);
    })
    .slice(0, n);
}

export function itemsForExploreCollection(
  slug: string,
  catalog: CatalogCollection[],
  openItems: Item[],
  byCollection: Item[] | null,
): Item[] {
  const fromBy = byCollection && byCollection.length > 0 ? byCollection : null;
  const fromOpen = openItems.filter((it) => itemCollectionSlug(it) === slug);
  const chain = fromBy ?? (fromOpen.length > 0 ? fromOpen : null);
  if (chain && chain.length > 0) return chain;
  const col = catalog.find((c) => c.slug === slug);
  return col ? previewItemsFor(col) : [];
}

export function buildDrops(catalog: CatalogCollection[], chainCols: ChainCollection[]): Drop[] {
  const live = chainCols.filter((c) => isPublicDrop(c));
  if (live.length > 0) {
    return live.map((c) => {
      const cat = catalog.find((x) => x.slug === c.slug);
      return {
        slug: c.slug,
        name: c.name || cat?.name || c.slug,
        cover: c.cover || cat?.cover || "",
        mintPrice: c.mintPrice,
        maxSupply: c.maxSupply,
        minted: c.minted,
        creator: c.creator,
        preview: false,
        paused: c.paused,
      };
    });
  }
  return catalog
    .filter((c) => c.maxSupply > 0)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      cover: c.cover,
      mintPrice: c.mintPrice,
      maxSupply: c.maxSupply,
      minted: c.minted,
      creator: "",
      preview: true,
      paused: false,
    }));
}

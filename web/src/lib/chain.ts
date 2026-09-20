export type NetworkId = "pearl" | "local";

export type Network = {
  id: NetworkId;
  chainId: string;
  chainName: string;
  rpcUrl: string;
  gnoweb: string;
  faucet: string;
};

export const PEARL: Network = {
  id: "pearl",
  chainId: "pearl-1",
  chainName: "Gno Pearl",
  rpcUrl: "https://rpc.pearl.testnets.gno.land:443",
  gnoweb: "https://pearl.testnets.gno.land",
  faucet: "https://pearl.testnets.gno.land/faucet",
};

export const LOCAL: Network = {
  id: "local",
  chainId: "dev",
  chainName: "gnodev",
  rpcUrl: "http://127.0.0.1:26657",
  gnoweb: "http://127.0.0.1:8888",
  faucet: "",
};

export const NETWORKS: Network[] = [PEARL, LOCAL];
export const NET_KEY = "bazaar.network";

export function networkById(id: string): Network {
  return NETWORKS.find((n) => n.id === id) || PEARL;
}

export function loadNetwork(): Network {
  try {
    return networkById(localStorage.getItem(NET_KEY) || "pearl");
  } catch {
    return PEARL;
  }
}

export function saveNetwork(id: NetworkId) {
  try {
    localStorage.setItem(NET_KEY, id);
  } catch {
    /* ignore */
  }
}

export const UGNOT = 1_000_000;
export const PROTOCOL_BPS = 50;
export const HUB_KEY = "bazaar.hub";
export const MARKET_KEY = "bazaar.market";
export const NFT_KEY = "bazaar.nft";
export const DEFAULT_HUB = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar";
export const DEFAULT_NFT = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv5";
export const DEFAULT_MARKET = "gno.land/r/bazaar/market";

export function normalizePkgPath(p: string): string {
  return p.trim().replace(/\/+$/, "");
}

export function isPkgPath(p: string): boolean {
  return /^gno\.land\/r\/[a-z0-9][a-z0-9._\-\/]*$/i.test(normalizePkgPath(p));
}

export function loadHub(): string {
  try {
    const stored = normalizePkgPath(localStorage.getItem(HUB_KEY) || "");
    if (!stored || stored === "gno.land/r/bazaar") return DEFAULT_HUB;
    return stored;
  } catch {
    return DEFAULT_HUB;
  }
}

export function loadMarket(): string {
  try {
    return normalizePkgPath(localStorage.getItem(MARKET_KEY) || DEFAULT_MARKET);
  } catch {
    return DEFAULT_MARKET;
  }
}

export function loadNft(): string {
  try {
    const stored = normalizePkgPath(localStorage.getItem(NFT_KEY) || "");
    if (
      !stored ||
      stored === "gno.land/r/bazaar/nft" ||
      stored === "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nft" ||
      stored === "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv2" ||
      stored === "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv3" ||
      stored === "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv4"
    ) {
      return DEFAULT_NFT;
    }
    return stored;
  } catch {
    return DEFAULT_NFT;
  }
}

export function saveHub(p: string) {
  try {
    localStorage.setItem(HUB_KEY, normalizePkgPath(p));
  } catch {
    /* ignore */
  }
}

export function saveMarket(p: string) {
  try {
    localStorage.setItem(MARKET_KEY, normalizePkgPath(p));
  } catch {
    /* ignore */
  }
}

export function saveNft(p: string) {
  try {
    localStorage.setItem(NFT_KEY, normalizePkgPath(p));
  } catch {
    /* ignore */
  }
}

export function parseEvalInt(s: string): number {
  const first = String(s).split("\n")[0] ?? "";
  const m = first.match(/-?\d+/);
  return m ? Number(m[0]) : 0;
}

export function parseEvalString(s: string): string {
  const first = String(s).split("\n")[0] ?? "";
  const quoted = first.match(/"([\s\S]*)"/);
  if (quoted) return quoted[1].replace(/\\n/g, "\n");
  return first.replace(/^\(|\)$/g, "").replace(/\s*string\s*$/, "").trim();
}

export type Listing = {
  id: string;
  symbol: string;
  seller: string;
  amount: number;
  price: number;
  status: string;
};

export function parseListings(raw: string): Listing[] {
  const text = parseEvalString(raw);
  if (!text.trim()) return [];
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, symbol, seller, amount, price, status] = line.split("|");
      return {
        id: id || "",
        symbol: symbol || "",
        seller: seller || "",
        amount: Number(amount || 0),
        price: Number(price || 0),
        status: status || "",
      };
    })
    .filter((row) => row.id);
}

export type Item = {
  id: string;
  name: string;
  owner: string;
  seller: string;
  price: number;
  listed: boolean;
  image: string;
  collection: string;
  rarity: string;
  traits: string;
  revealed: boolean;
  slot: number;
};

function parseListedFlag(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "listed";
}

export function parseItemLine(line: string): Item | null {
  const parts = line.split("|");
  const id = (parts[0] || "").trim();
  if (!id) return null;
  return {
    id,
    name: parts[1] || "",
    owner: parts[2] || "",
    seller: parts[3] || "",
    price: Number(parts[4] || 0),
    listed: parseListedFlag(parts[5] || ""),
    image: (parts[6] || "").trim(),
    collection: (parts[7] || "").trim(),
    rarity: (parts[8] || "").trim(),
    traits: (parts[9] || "").trim(),
    revealed: parts.length < 11 || (parts[10] || "").trim() !== "false",
    slot: parts.length > 11 && Number.isFinite(Number(parts[11])) ? Number(parts[11]) : -1,
  };
}

export type DropSlot = {
  index: number;
  name: string;
  image: string;
  rarity: string;
  traits: string;
};

export type Trait = { type: string; value: string };

export function parseTraits(raw: string): Trait[] {
  const out: Trait[] = [];
  for (const part of String(raw || "").split(";")) {
    const s = part.trim();
    if (!s) continue;
    const i = s.indexOf(":");
    if (i <= 0) continue;
    const type = s.slice(0, i).trim();
    const value = s.slice(i + 1).trim();
    if (type && value) out.push({ type, value });
  }
  return out;
}

export function parseDropSlotLine(line: string): DropSlot | null {
  const parts = line.split("|");
  const index = Number((parts[0] || "").trim());
  const name = (parts[1] || "").trim();
  if (!name) return null;
  return {
    index: Number.isFinite(index) ? index : 0,
    name,
    image: (parts[2] || "").trim(),
    rarity: (parts[3] || "").trim(),
    traits: (parts[4] || "").trim(),
  };
}

export function parseDropSlotLines(raw: string): DropSlot[] {
  const text = parseEvalString(raw);
  if (!text.trim()) return [];
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseDropSlotLine)
    .filter((row): row is DropSlot => !!row);
}

export function parseItems(raw: string): Item[] {
  const text = parseEvalString(raw);
  if (!text.trim()) return [];
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseItemLine)
    .filter((row): row is Item => !!row);
}

export type ChainCollection = {
  slug: string;
  name: string;
  cover: string;
  count: number;
  mintPrice: number;
  maxSupply: number;
  minted: number;
  creator: string;
  paused: boolean;
  drop: boolean;
  bio: string;
  website?: string;
  twitter?: string;
  discord?: string;
};

export type OfferRow = {
  id: string;
  bidder: string;
  amount: number;
  name: string;
};

export type PoolInfo = {
  gnot: number;
  shares: number;
  nfts: number;
};

export type PoolNft = {
  id: string;
  name: string;
  depositor: string;
};

export type Socials = {
  website: string;
  twitter: string;
  discord: string;
};

export function parseOfferLine(line: string): OfferRow | null {
  const parts = line.split("|");
  const id = (parts[0] || "").trim();
  if (!id) return null;
  return {
    id,
    bidder: (parts[1] || "").trim(),
    amount: parseNumPart(parts[2]),
    name: (parts[3] || "").trim(),
  };
}

export function parseOfferLines(raw: string): OfferRow[] {
  const text = parseEvalString(raw);
  if (!text.trim()) return [];
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseOfferLine)
    .filter((row): row is OfferRow => !!row);
}

export const SWEEP_CAP = 10;

export function topOfferFor(offers: OfferRow[], id: string): OfferRow | null {
  let best: OfferRow | null = null;
  for (const row of offers) {
    if (row.id !== id || row.amount <= 0) continue;
    if (!best || row.amount > best.amount) best = row;
  }
  return best;
}

export function sweepQuote(
  items: Item[],
  n: number,
  wallet?: string,
): { ids: string[]; total: number; count: number } {
  const want = Math.max(0, Math.min(SWEEP_CAP, Math.floor(n)));
  const listed = items
    .filter((it) => it.id && it.listed && it.price > 0 && !isOwnListing(it, wallet))
    .sort((a, b) => a.price - b.price || Number(a.id) - Number(b.id));
  const pick = listed.slice(0, want);
  return {
    ids: pick.map((it) => it.id),
    total: pick.reduce((s, it) => s + it.price, 0),
    count: pick.length,
  };
}

export function parsePoolOf(raw: string): PoolInfo {
  const text = parseEvalString(raw);
  const parts = text.split("|");
  return {
    gnot: parseNumPart(parts[0]),
    shares: parseNumPart(parts[1]),
    nfts: parseNumPart(parts[2]),
  };
}

export function parseSocials(raw: string): Socials {
  const text = parseEvalString(raw);
  const parts = text.split("|");
  return {
    website: (parts[0] || "").trim(),
    twitter: (parts[1] || "").trim(),
    discord: (parts[2] || "").trim(),
  };
}

export function parsePoolNftLine(line: string): PoolNft | null {
  const parts = line.split("|");
  const id = (parts[0] || "").trim();
  if (!id) return null;
  return {
    id,
    name: (parts[1] || "").trim(),
    depositor: (parts[2] || "").trim(),
  };
}

export function parsePoolNftLines(raw: string): PoolNft[] {
  const text = parseEvalString(raw);
  if (!text.trim()) return [];
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parsePoolNftLine)
    .filter((row): row is PoolNft => !!row);
}

export function socialHref(s: string): string {
  const v = s.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("@")) return `https://x.com/${v.slice(1)}`;
  if (/x\.com|twitter|discord/i.test(v)) return v.startsWith("http") ? v : `https://${v}`;
  return `https://${v}`;
}

export function sameAddr(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

function parseNumPart(v: string | undefined): number {
  const n = Number((v || "").trim() || 0);
  return Number.isFinite(n) ? n : 0;
}

function parsePausedFlag(v: string | undefined): boolean {
  const s = (v || "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

export function parseCollectionLine(line: string): ChainCollection | null {
  const parts = line.split("|");
  const slug = (parts[0] || "").trim();
  if (!slug) return null;
  const maxSupply = parseNumPart(parts[5]);
  const flag = (parts[9] || "").trim().toLowerCase();
  const hasDropFlag = flag === "true" || flag === "false";
  return {
    slug,
    name: (parts[1] || slug).trim() || slug,
    cover: (parts[2] || "").trim(),
    count: parseNumPart(parts[3]),
    mintPrice: parseNumPart(parts[4]),
    maxSupply,
    minted: parseNumPart(parts[6]),
    creator: (parts[7] || "").trim(),
    paused: parsePausedFlag(parts[8]),
    drop: hasDropFlag ? flag === "true" : maxSupply > 0,
    bio: (hasDropFlag ? parts.slice(10) : parts.slice(9)).join("|").trim(),
  };
}

export type DropSale = {
  royaltyBps: number;
  wlPrice: number;
  wlSupply: number;
  phase: "whitelist" | "public";
  mintPrice: number;
};

export function parseDropSale(raw: string): DropSale {
  const text = parseEvalString(raw);
  const parts = text.split("|");
  const phase = (parts[3] || "public").trim() === "whitelist" ? "whitelist" : "public";
  return {
    royaltyBps: parseNumPart(parts[0]),
    wlPrice: parseNumPart(parts[1]),
    wlSupply: parseNumPart(parts[2]),
    phase,
    mintPrice: parseNumPart(parts[4]),
  };
}

export function isPublicDrop(col: { drop?: boolean; maxSupply: number }): boolean {
  return col.drop === true || (!!col.maxSupply && col.maxSupply > 0);
}

export function isOpenEdition(col: { drop?: boolean; maxSupply: number }): boolean {
  return isPublicDrop(col) && !(col.maxSupply > 0);
}

export function parseCollectionLines(raw: string): ChainCollection[] {
  const text = parseEvalString(raw);
  if (!text.trim()) return [];
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCollectionLine)
    .filter((row): row is ChainCollection => !!row);
}

export type ActivitySource = "indexed" | "on-chain";

export type Activity = {
  kind: string;
  id: string;
  slug: string;
  actor: string;
  price: number;
  name: string;
  preview?: boolean;
  source?: ActivitySource;
};

const ACTIVITY_KIND_LABELS: Record<string, string> = {
  mint: "Mint",
  list: "Listed",
  buy: "Sold",
  cancel: "Cancelled",
  drop: "Drop",
  publicmint: "Public mint",
  offer: "Offer",
  canceloffer: "Offer cancelled",
  accept: "Offer taken",
  depositpool: "Pool in",
  withdrawpool: "Pool out",
  depositnft: "NFT in pool",
  withdrawnft: "NFT out",
};

export function activityKindLabel(kind: string): string {
  const key = kind.trim().toLowerCase();
  return ACTIVITY_KIND_LABELS[key] || kind.trim() || "Activity";
}

const LIVE_TRADE_KINDS = new Set(["list", "buy", "accept", "offer"]);

export function isLiveTrade(row: Activity): boolean {
  return LIVE_TRADE_KINDS.has((row.kind || "").trim().toLowerCase());
}

export function liveTradeRows(rows: Activity[], cap = 24): Activity[] {
  return rows.filter(isLiveTrade).slice(0, cap);
}

export function canAddToCart(item: Item, wallet?: string): boolean {
  return item.listed && item.price > 0 && !isOwnListing(item, wallet);
}

export function parseActivityLine(line: string): Activity | null {
  const parts = line.split("|");
  const kind = (parts[0] || "").trim().toLowerCase();
  if (!kind) return null;
  return {
    kind,
    id: (parts[1] || "").trim(),
    slug: (parts[2] || "").trim(),
    actor: (parts[3] || "").trim(),
    price: parseNumPart(parts[4]),
    name: (parts[5] || "").trim(),
  };
}

export function parseActivityLines(raw: string): Activity[] {
  const text = parseEvalString(raw);
  if (!text.trim()) return [];
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseActivityLine)
    .filter((row): row is Activity => !!row);
}

export function itemCollectionSlug(item: Item): string {
  const s = item.collection.trim();
  return s || "bazaar";
}

export function isPreviewItem(item: Item): boolean {
  return !item.id;
}

export function isOwnListing(item: Item, wallet?: string): boolean {
  if (!wallet) return false;
  const w = wallet.toLowerCase();
  return !!(item.seller && item.seller.toLowerCase() === w);
}

export function itemRowKey(item: Item): string {
  if (item.id) return item.id;
  return `preview:${item.collection}:${item.name}`;
}

export function parseIds(raw: string): string[] {
  const text = parseEvalString(raw);
  if (!text.trim()) return [];
  return text
    .split(/[, \n]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
}

export function isHttpUrl(u: string): boolean {
  const s = u.trim();
  return /^https?:\/\/\S+$/i.test(s);
}

export function isSamplePath(u: string): boolean {
  const s = u.trim();
  return /^\/samples\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s);
}

/** ipfs://CID or ipfs://CID/path — preferred art pointer in drop JSON. */
export function isIpfsUri(u: string): boolean {
  return /^ipfs:\/\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/\S*)?$/.test(u.trim());
}

export const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

/** nftv4 validImage is http(s) or /samples/ — map ipfs:// to a public gateway. */
export function ipfsToHttp(u: string): string {
  const s = u.trim();
  const m = s.match(/^ipfs:\/\/(?:ipfs\/)?(.+)$/i);
  if (!m) return s;
  return IPFS_GATEWAY + m[1];
}

export function artSrc(u: string): string {
  return ipfsToHttp(u.trim());
}

export function isArtSrc(u: string): boolean {
  const s = u.trim();
  if (isIpfsUri(s)) return true;
  return isHttpUrl(s) || isSamplePath(s);
}

export function isMintName(name: string): boolean {
  const n = name.trim();
  return n.length >= 1 && n.length <= 64 && !/[\r\n]/.test(name);
}

export function isMintImage(url: string): boolean {
  const s = url.trim();
  if (!s) return true;
  if (!isArtSrc(s)) return false;
  const chain = ipfsToHttp(s);
  return chain.length <= 200 && !/[\s|<>"'`]/.test(chain);
}

export function isDropSlug(slug: string): boolean {
  return /^[a-z0-9-]{2,16}$/.test(slug.trim());
}

export function isDropCover(url: string): boolean {
  return isMintImage(url);
}

export function isDropMaxSupply(raw: string): boolean {
  const s = raw.trim();
  if (!/^[0-9]+$/.test(s)) return false;
  const n = Number(s);
  return n >= 1 && n <= 1_000_000;
}

export function isDropMintPrice(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0;
}

export function gnotFromUgnot(u: number): string {
  return (u / UGNOT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ugnotFromGnot(g: string): number {
  const n = Number(g);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * UGNOT);
}

export function parseCoinsUgnot(coins: string): number | null {
  const m = String(coins).match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function gnotFromCoins(coins: string): string {
  const n = parseCoinsUgnot(coins);
  if (n == null) return "";
  return (n / UGNOT).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function shortAddr(a: string): string {
  if (a.length < 16) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function protocolFeeUgnot(price: number, bps = PROTOCOL_BPS): number {
  if (price < 0 || bps < 0 || bps > 10000) return 0;
  const q = Math.floor(price / 10000);
  const r = price % 10000;
  return q * bps + Math.floor((r * bps) / 10000);
}

export function protocolFeeLabel(bps = PROTOCOL_BPS): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export const LISTING_SORTS = ["price", "amount", "symbol"] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];
export type SortDir = "asc" | "desc";

export function filterListings(listings: Listing[], query: string): Listing[] {
  const q = query.trim().toLowerCase();
  if (!q) return listings.slice();
  return listings.filter((row) => {
    return (
      row.symbol.toLowerCase().includes(q) ||
      row.seller.toLowerCase().includes(q) ||
      row.id.toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q)
    );
  });
}

export function sortListings(listings: Listing[], sort: ListingSort, dir: SortDir = "asc"): Listing[] {
  const mul = dir === "desc" ? -1 : 1;
  return listings.slice().sort((a, b) => {
    let cmp = 0;
    if (sort === "symbol") cmp = a.symbol.localeCompare(b.symbol, undefined, { sensitivity: "base" });
    else if (sort === "amount") cmp = a.amount - b.amount;
    else cmp = a.price - b.price;
    if (cmp === 0) cmp = a.id.localeCompare(b.id);
    return cmp * mul;
  });
}

export function uniqueListingSymbols(listings: Listing[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of listings) {
    if (!row.symbol || seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    out.push(row.symbol);
  }
  return out;
}

export const ITEM_SORTS = ["price", "name", "id"] as const;
export type ItemSort = (typeof ITEM_SORTS)[number];

export const ITEM_RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

export type ItemFilters = {
  query?: string;
  rarity?: string;
  minGnot?: string;
  maxGnot?: string;
  listedOnly?: boolean;
  traits?: Record<string, string[]>;
};

function gnotFilterToUgnot(raw: string | undefined): number | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * UGNOT);
}

export function filterItems(items: Item[], query: string): Item[] {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return items.slice();
  return items.filter((row) => {
    return (
      row.name.toLowerCase().includes(q) ||
      row.id.toLowerCase().includes(q) ||
      row.seller.toLowerCase().includes(q) ||
      row.owner.toLowerCase().includes(q) ||
      row.collection.toLowerCase().includes(q) ||
      row.rarity.toLowerCase().includes(q)
    );
  });
}

export function filterListedItems(items: Item[], filters: ItemFilters): Item[] {
  let out = filterItems(items, filters.query || "");
  if (filters.listedOnly) {
    out = out.filter((row) => row.listed && row.price > 0);
  }
  const rarity = (filters.rarity || "").trim().toLowerCase();
  if (rarity && rarity !== "all") {
    out = out.filter((row) => row.rarity.trim().toLowerCase() === rarity);
  }
  const minU = gnotFilterToUgnot(filters.minGnot);
  const maxU = gnotFilterToUgnot(filters.maxGnot);
  if (minU != null || maxU != null) {
    out = out.filter((row) => {
      if (!row.listed || row.price <= 0) return false;
      if (minU != null && row.price < minU) return false;
      if (maxU != null && row.price > maxU) return false;
      return true;
    });
  }
  if (filters.traits) {
    out = out.filter((row) => itemMatchesTraits(row, filters.traits || {}));
  }
  return out;
}

export function itemTraitMap(item: Item): Record<string, string> {
  const map: Record<string, string> = {};
  if (item.rarity) map.Rarity = item.rarity;
  for (const t of parseTraits(item.traits || "")) map[t.type] = t.value;
  return map;
}

export function itemMatchesTraits(item: Item, selected: Record<string, string[]>): boolean {
  const map = itemTraitMap(item);
  for (const [type, values] of Object.entries(selected)) {
    if (!values.length) continue;
    const have = map[type];
    if (!have || !values.includes(have)) return false;
  }
  return true;
}

export type TraitGroup = { type: string; values: { value: string; count: number }[] };

export function traitGroups(items: Item[]): TraitGroup[] {
  const byType = new Map<string, Map<string, number>>();
  for (const it of items) {
    const map = itemTraitMap(it);
    for (const [type, value] of Object.entries(map)) {
      let inner = byType.get(type);
      if (!inner) {
        inner = new Map();
        byType.set(type, inner);
      }
      inner.set(value, (inner.get(value) || 0) + 1);
    }
  }
  const types = [...byType.keys()].sort((a, b) => {
    if (a === "Rarity") return -1;
    if (b === "Rarity") return 1;
    return a.localeCompare(b);
  });
  return types.map((type) => ({
    type,
    values: [...(byType.get(type) || new Map()).entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
  }));
}

export type HashView = {
  tab: "explore" | "sell" | "create" | "portfolio" | "settings";
  slug: string;
  itemId: string;
  profile: string;
  mintSlug: string;
};

export function parseHash(hash: string): HashView {
  const empty = { tab: "explore" as const, slug: "", itemId: "", profile: "", mintSlug: "" };
  const h = String(hash || "")
    .replace(/^#/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  const mint = h.match(/^m\/([a-z0-9-]{1,32})$/i);
  if (mint) return { ...empty, mintSlug: mint[1].toLowerCase() };
  const col = h.match(/^c\/([a-z0-9-]{1,32})$/i);
  if (col) return { ...empty, slug: col[1].toLowerCase() };
  const item = h.match(/^i\/(\d+)$/);
  if (item) return { ...empty, itemId: item[1] };
  const user = h.match(/^u\/(g1[a-z0-9]+)$/i);
  if (user) return { ...empty, tab: "portfolio", profile: user[1] };
  if (h === "launch" || h === "create") return { ...empty, tab: "create" };
  if (h === "sell") return { ...empty, tab: "sell" };
  if (h === "portfolio" || h === "profile") return { ...empty, tab: "portfolio" };
  if (h === "settings") return { ...empty, tab: "settings" };
  return empty;
}

export function mintHash(slug: string): string {
  return `#/m/${slug}`;
}

export function collectionHash(slug: string): string {
  return `#/c/${slug}`;
}

export function itemHash(id: string): string {
  return `#/i/${id}`;
}

export function tabHash(tab: HashView["tab"]): string {
  if (tab === "create") return "#/launch";
  if (tab === "explore") return "#/explore";
  if (tab === "portfolio") return "#/profile";
  return `#/${tab}`;
}

export function profileHash(addr: string): string {
  return `#/u/${addr}`;
}

export function isG1(addr: string): boolean {
  return /^g1[a-z0-9]{20,}$/i.test(addr.trim());
}

export function accountExplorer(addr: string, net: Network): string {
  if (!isG1(addr)) return "";
  if (net.id === "pearl") return `https://gnoscan.io/account/${addr}`;
  return "";
}

export function sortItems(items: Item[], sort: ItemSort, dir: SortDir = "asc"): Item[] {
  const mul = dir === "desc" ? -1 : 1;
  return items.slice().sort((a, b) => {
    let cmp = 0;
    if (sort === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    else if (sort === "id") {
      const an = Number(a.id);
      const bn = Number(b.id);
      cmp = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : a.id.localeCompare(b.id);
    } else cmp = a.price - b.price;
    if (cmp === 0) cmp = a.id.localeCompare(b.id);
    return cmp * mul;
  });
}

export function tickerLetters(symbol: string): string {
  const s = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (s.length >= 4) return s.slice(0, 4);
  return s || "?";
}

export function symbolHue(symbol: string): number {
  const s = symbol.toUpperCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

export function isRealmUnavailable(message: string): boolean {
  return /not on this chain|package not found|unknown package|invalid package|unexpected node with location|InternalError/i.test(
    message,
  );
}

export function isNameNotDeclared(message: string): boolean {
  return /name\s+\w+\s+not declared/i.test(message);
}

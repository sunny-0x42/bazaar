import type { Item } from "./chain";

/** One browser wave. rpc.gno.land allows about six connections per host. */
export const ITEM_LINE_WAVE = 6;

/** Ids read per page. The next page waits for Load more. */
export const ITEM_BOOK_CAP = 50;

const ITEM_CACHE_MAX = 2000;
const ITEM_CACHE_PREFIX = "bazaar.items.v1:";

export function itemBookCacheKey(pkg: string): string {
  return `${ITEM_CACHE_PREFIX}${pkg}`;
}

function isCachedItem(row: unknown): row is Item {
  if (!row || typeof row !== "object") return false;
  const id = (row as Item).id;
  return typeof id === "string" && id.length > 0;
}

export function readItemBookCache(pkg: string): { through: number; rows: Item[] } | null {
  try {
    const raw = localStorage.getItem(itemBookCacheKey(pkg));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const rows = parsed.filter(isCachedItem).slice(0, ITEM_CACHE_MAX);
      return rows.length > 0 ? { through: 0, rows } : null;
    }
    if (!parsed || typeof parsed !== "object") return null;
    const body = parsed as { through?: unknown; rows?: unknown };
    if (!Array.isArray(body.rows)) return null;
    const rows = body.rows.filter(isCachedItem).slice(0, ITEM_CACHE_MAX);
    const through = Number(body.through);
    if (rows.length < 1) return null;
    return { through: Number.isFinite(through) && through > 0 ? Math.floor(through) : 0, rows };
  } catch {
    return null;
  }
}

export function writeItemBookCache(pkg: string, rows: Item[], through = 0): void {
  try {
    const keep = rows.filter((row) => row.id).slice(0, ITEM_CACHE_MAX);
    if (keep.length < 1) return;
    const done = Number.isFinite(through) && through > 0 ? Math.floor(through) : 0;
    localStorage.setItem(itemBookCacheKey(pkg), JSON.stringify({ through: done, rows: keep }));
  } catch {
    /* private mode or quota */
  }
}

export function mergeBookItems(prev: Item[] | null | undefined, next: Item[]): Item[] {
  const byId = new Map<string, Item>();
  for (const row of prev || []) {
    if (row?.id) byId.set(row.id, row);
  }
  for (const row of next) {
    if (!row?.id) continue;
    byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
}

/** Ids in the next page after `after`, capped at minted, skipping ids already loaded. */
export function nextItemIds(have: Iterable<string>, minted: number, after: number, page = ITEM_BOOK_CAP): number[] {
  const known = new Set(have);
  const total = Math.max(0, Math.floor(minted));
  const start = Math.max(0, Math.floor(after)) + 1;
  const size = Math.max(1, Math.floor(page));
  const end = Math.min(total, Math.max(0, Math.floor(after)) + size);
  const missing: number[] = [];
  for (let n = start; n <= end; n++) {
    if (!known.has(String(n))) missing.push(n);
  }
  return missing;
}

/** First page: ids 1..min(50, minted) that are not already on screen. */
export function missingItemIds(have: Iterable<string>, minted: number): number[] {
  return nextItemIds(have, minted, 0, ITEM_BOOK_CAP);
}

/** How many ids the next Load more click will request. 0 hides the button. */
export function nextPageSize(through: number, minted: number, page = ITEM_BOOK_CAP): number {
  const done = Math.max(0, Math.floor(through));
  const total = Math.max(0, Math.floor(minted));
  if (done <= 0 || done >= total) return 0;
  return Math.min(page, total - done);
}

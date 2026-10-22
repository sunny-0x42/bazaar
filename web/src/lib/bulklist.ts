/** One collection List or UpdatePrice inside a bulk signature. */
export type ListMsg = {
  pkgPath: string;
  func: "List" | "UpdatePrice";
  args: [string, string];
};

/**
 * A single List on this book uses the same 50M gas budget as the one-item
 * Sell call. Twenty of those stay at 1B, under Adena's 2B simulate ceiling.
 */
export const LIST_GAS_EACH = 50_000_000;
export const LIST_PER_TX = 20;
export const LIST_GAS_CAP = 1_200_000_000;

export function togglePick(selected: Record<string, string>, key: string, priceGnot: string): Record<string, string> {
  if (Object.prototype.hasOwnProperty.call(selected, key)) {
    const next = { ...selected };
    delete next[key];
    return next;
  }
  return { ...selected, [key]: priceGnot };
}

export function selectAll(keys: string[], priceGnot: string, prev: Record<string, string>): Record<string, string> {
  const next = { ...prev };
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) next[key] = priceGnot;
  }
  return next;
}

export function applyPrice(selected: Record<string, string>, priceGnot: string): Record<string, string> {
  const next: Record<string, string> = {};
  for (const key of Object.keys(selected)) next[key] = priceGnot;
  return next;
}

export function dropMissing(selected: Record<string, string>, liveKeys: string[]): Record<string, string> {
  const live = new Set(liveKeys);
  let changed = false;
  const next: Record<string, string> = {};
  for (const [key, price] of Object.entries(selected)) {
    if (live.has(key)) next[key] = price;
    else changed = true;
  }
  return changed ? next : selected;
}

export type BulkRow = {
  id: string;
  listed: boolean;
  pkgPath: string;
  priceUgnot: number;
};

export function bulkMessages(rows: BulkRow[]): ListMsg[] {
  const out: ListMsg[] = [];
  for (const row of rows) {
    const id = row.id.trim();
    const pkg = row.pkgPath.trim();
    const price = Math.floor(row.priceUgnot);
    if (!id || !pkg || price <= 0) continue;
    out.push({
      pkgPath: pkg,
      func: row.listed ? "UpdatePrice" : "List",
      args: [id, String(price)],
    });
  }
  return out;
}

/** Split an ordered list into signatures of at most LIST_PER_TX. */
export function packListTxs(msgs: ListMsg[]): ListMsg[][] {
  const out: ListMsg[][] = [];
  let cur: ListMsg[] = [];
  let gas = 0;
  const flush = () => {
    if (cur.length === 0) return;
    out.push(cur);
    cur = [];
    gas = 0;
  };
  for (const msg of msgs) {
    if (cur.length > 0 && (cur.length >= LIST_PER_TX || gas + LIST_GAS_EACH > LIST_GAS_CAP)) flush();
    cur.push(msg);
    gas += LIST_GAS_EACH;
  }
  flush();
  return out;
}

export function listGasWanted(count: number): number {
  const n = Math.max(0, Math.floor(count));
  const scaled = Math.ceil(LIST_GAS_EACH * n * 1.15);
  return Math.min(LIST_GAS_CAP, scaled);
}

export function listButtonLabel(rows: { listed: boolean }[]): string {
  const n = rows.length;
  if (n < 1) return "List";
  const updates = rows.filter((row) => row.listed).length;
  const fresh = n - updates;
  const sigs = Math.ceil(n / LIST_PER_TX);
  const sig = sigs > 1 ? ` · ${sigs} signatures` : "";
  if (fresh === 0) return `Update ${n} price${n === 1 ? "" : "s"}${sig}`;
  if (updates === 0) return `List ${n}${sig}`;
  return `List ${fresh} · update ${updates}${sig}`;
}

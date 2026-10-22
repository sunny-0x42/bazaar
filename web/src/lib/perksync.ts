import { rarityShareBps } from "./rewards";

/** perk.SyncSpan panics when end-start is 20 or more, so one call records 20 ids. */
export const SYNC_SPAN_MAX = 20;

/** One Settle walks every recorded wallet. Stays under Adena's 2e9 simulate cap. */
export const SETTLE_GAS_WANTED = 400_000_000;

export type SyncCall = { func: "Sync"; args: [string] };

/** One Sync per revealed, unlisted id. At most one span's worth, lowest ids first. */
export function syncCalls(ids: number[]): SyncCall[] {
  const seen = new Set<number>();
  const out: SyncCall[] = [];
  const ordered = [...ids].map((id) => Math.floor(id)).sort((a, b) => a - b);
  for (const id of ordered) {
    if (id < 1 || seen.has(id)) continue;
    seen.add(id);
    out.push({ func: "Sync", args: [String(id)] });
    if (out.length >= SYNC_SPAN_MAX) break;
  }
  return out;
}

export function syncableIds(rows: { id: string; rarity: string; revealed: boolean; listed: boolean }[]): number[] {
  const ids: number[] = [];
  for (const row of rows) {
    if (!row.revealed || row.listed) continue;
    if (rarityShareBps(row.rarity) <= 0) continue;
    const id = Math.floor(Number(row.id));
    if (id >= 1) ids.push(id);
  }
  return ids;
}

/** One revealed, unlisted Bazaar Gens the holder can record. */
export function nftCanSync(item: {
  id: string;
  collection?: string;
  rarity: string;
  revealed: boolean;
  listed: boolean;
}): boolean {
  if ((item.collection || "").trim().toLowerCase() !== "bazaargens") return false;
  return syncableIds([item]).length === 1;
}

/** True when this wallet's revealed NFTs are not the perk record yet. */
export function holderNeedsSync(desk: {
  weight: number;
  countedWeight: number;
  perkDiscountBps: number;
  countedBps: number;
  syncIds: number[];
}): boolean {
  if (desk.syncIds.length === 0) return false;
  return desk.weight !== desk.countedWeight || desk.perkDiscountBps !== desk.countedBps;
}

/** GNOT already in the realm is still unassigned because no NFT has weight. */
export function backlogUnassigned(totalWeight: number, poolUgnot: number, accountedUgnot: number): boolean {
  return totalWeight <= 0 && poolUgnot > accountedUgnot;
}

export function planSyncSpan(startRaw: number, endRaw: number, minted: number): { start: number; end: number } {
  const start = Math.floor(startRaw);
  const end = Math.floor(endRaw);
  const cap = Math.floor(minted);
  if (start < 1 || end < start) throw new Error("Enter a token range that starts at 1 or later.");
  if (cap < 1 || start > cap) throw new Error("Nothing minted is left in that range.");
  if (end > cap) throw new Error("That range goes past the minted supply.");
  if (end - start + 1 > SYNC_SPAN_MAX) throw new Error("One signature records at most 20 tokens.");
  return { start, end };
}

/** The next unrecorded span after `after`. `after` 0 starts at token 1. */
export function nextSyncSpan(after: number, minted: number): { start: number; end: number } | null {
  const cap = Math.floor(minted);
  const start = Math.floor(after) + 1;
  if (cap < 1 || start > cap) return null;
  return { start, end: Math.min(cap, start + SYNC_SPAN_MAX - 1) };
}

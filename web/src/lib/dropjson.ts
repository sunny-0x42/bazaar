/** OpenSea-style metadata → AddDropItems blob (name|image|rarity|Trait:Value;...). */

import { ipfsToHttp, isIpfsUri } from "./chain";

function asUrl(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Prefer ipfs:// (then IPFS gateway), then OpenSea image / image_url. */
export function pickNftImage(rec: Record<string, unknown>): string {
  const cands = [rec.image_ipfs, rec.ipfs, rec.cid, rec.image, rec.image_url].map(asUrl).filter(Boolean);
  const ipfs = cands.find(isIpfsUri) || cands.find((u) => /\/ipfs\/[A-Za-z0-9]/i.test(u));
  return ipfsToHttp(ipfs || cands[0] || "");
}

export function jsonToSlotBlob(raw: string): string {
  const text = raw.trim();
  if (!text) throw new Error("Empty JSON");
  const data = JSON.parse(text) as unknown;
  const arr: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? (((data as { nfts?: unknown; items?: unknown }).nfts ||
          (data as { items?: unknown }).items) as unknown[])
      : [];
  if (!Array.isArray(arr) || arr.length < 1) throw new Error("JSON must be a non-empty array of NFTs");
  const lines: string[] = [];
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const name = String(rec.name || "").trim();
    const image = pickNftImage(rec);
    if (!name) continue;
    if (image.length > 200) throw new Error(`image URL too long (max 200): ${name}`);
    let rarity = String(rec.rarity || "").trim();
    const traits: string[] = [];
    const attrs = Array.isArray(rec.attributes) ? rec.attributes : [];
    for (const a of attrs) {
      if (!a || typeof a !== "object") continue;
      const ar = a as Record<string, unknown>;
      const t = String(ar.trait_type || ar.type || "").trim();
      const v = String(ar.value ?? "").trim();
      if (!t || !v) continue;
      if (t.toLowerCase() === "rarity" && !rarity) rarity = v;
      else traits.push(`${t}:${v}`);
    }
    lines.push([name, image, rarity, traits.join(";")].join("|"));
  }
  if (lines.length < 1) throw new Error("No valid NFT objects (need name, optional image/attributes)");
  return lines.join("\n");
}

export function looksLikeJson(raw: string): boolean {
  const t = raw.trim();
  return t.startsWith("[") || t.startsWith("{");
}

/** Unique JSON / pipe slots per collection (matches realm dropSlotHardCap). */
export const JSON_SLOT_CAP = 10000;
export const DROP_ADD_CAP = 20;

export function parseSlotBlob(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];
  let blob = text;
  if (looksLikeJson(blob)) blob = jsonToSlotBlob(blob);
  return blob
    .split(/\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return "";
      if (t.includes("|")) return t;
      const parts = t.split(",").map((p) => p.trim());
      return [parts[0] || "", parts[1] || "", parts[2] || "", parts[3] || ""].join("|");
    })
    .filter(Boolean);
}

export type LaunchPackMeta = {
  name?: string;
  slug?: string;
  cover?: string;
  bio?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  maxSupply?: string;
  mintPrice?: string;
  royaltyPct?: string;
  hideUntilReveal?: boolean;
};

export function applyLaunchPack(raw: string): LaunchPackMeta {
  try {
    const data = JSON.parse(raw.trim()) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const rec = data as Record<string, unknown>;
    const str = (k: string) => (typeof rec[k] === "string" ? rec[k].trim() : rec[k] != null ? String(rec[k]).trim() : "");
    const hide = rec.hideUntilReveal;
    return {
      name: str("name") || undefined,
      slug: str("slug") || undefined,
      cover: str("cover") || undefined,
      bio: str("bio") ? str("bio").replace(/[\r\n|]/g, " ").slice(0, 200) : undefined,
      website: str("website") || undefined,
      twitter: str("twitter") || undefined,
      discord: str("discord") || undefined,
      maxSupply: str("maxSupply") || undefined,
      mintPrice: str("mintPrice") || undefined,
      royaltyPct: str("royaltyPct") || undefined,
      hideUntilReveal: typeof hide === "boolean" ? hide : undefined,
    };
  } catch {
    return {};
  }
}

export function countSlotLines(raw: string): { n: number; err: string } {
  try {
    const lines = parseSlotBlob(raw);
    if (lines.length > JSON_SLOT_CAP) {
      return { n: lines.length, err: `Max ${JSON_SLOT_CAP} unique NFTs in one JSON (this file has ${lines.length}).` };
    }
    return { n: lines.length, err: "" };
  } catch (e) {
    return { n: 0, err: e instanceof Error ? e.message : String(e) };
  }
}

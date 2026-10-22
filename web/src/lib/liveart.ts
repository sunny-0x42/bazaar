export type LiveArtRow = {
  slug?: string;
  id?: string;
  name?: string;
};

export type LiveArtItem = LiveArtRow & {
  collection?: string;
  image?: string;
};

export type LiveArtHit = {
  image: string;
  name: string;
};

/** One tape row. An id wins over the name so two sales of the same NFT share one image. */
export function liveArtKey(row: LiveArtRow): string {
  const slug = (row.slug || "").trim().toLowerCase();
  const id = (row.id || "").trim();
  if (id) return `${slug}#${id}`;
  return `${slug}#${(row.name || "").trim().toLowerCase()}`;
}

/** Images already on screen or in the item cache. Preview rows have no id, so they match by name. */
export function indexLiveArt(items: LiveArtItem[]): Map<string, LiveArtHit> {
  const map = new Map<string, LiveArtHit>();
  for (const it of items) {
    const image = (it.image || "").trim();
    const slug = (it.collection || it.slug || "").trim().toLowerCase();
    if (!image || !slug) continue;
    const name = (it.name || "").trim();
    const id = (it.id || "").trim();
    if (id) {
      map.set(`${slug}#${id}`, { image, name });
      continue;
    }
    if (name) map.set(`${slug}#${name.toLowerCase()}`, { image, name });
  }
  return map;
}

export function liveArtFor(row: LiveArtRow, index: ReadonlyMap<string, LiveArtHit>): LiveArtHit | undefined {
  return index.get(liveArtKey(row));
}

/** Numeric token ids that still need ItemLine. Repeated sales of one NFT are one fetch. */
export function missingLiveArt(rows: LiveArtRow[], index: ReadonlyMap<string, LiveArtHit>): { key: string; slug: string; id: string }[] {
  const out: { key: string; slug: string; id: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (liveArtFor(row, index)?.image) continue;
    const id = (row.id || "").trim();
    if (!/^[1-9]\d*$/.test(id)) continue;
    const slug = (row.slug || "").trim().toLowerCase();
    if (!slug) continue;
    const key = liveArtKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, slug, id });
  }
  return out;
}

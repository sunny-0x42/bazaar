import type { Activity } from "./chain";

export type FetchActivityOpts = {
  slug: string;
  limit?: number;
};

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function asPrice(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim() || 0);
  return Number.isFinite(n) ? n : 0;
}

function activityRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.events)) return o.events;
    if (Array.isArray(o.activity)) return o.activity;
  }
  return [];
}

export function mapActivityJson(raw: unknown): Activity[] {
  const out: Activity[] = [];
  for (const row of activityRows(raw)) {
    if (!row || typeof row !== "object") continue;
    const mapped = mapActivityRow(row as Record<string, unknown>);
    if (mapped) out.push(mapped);
  }
  return out;
}

export function mapActivityRow(row: Record<string, unknown>): Activity | null {
  const kind = asString(row.kind).toLowerCase();
  if (!kind) return null;
  return {
    kind,
    id: asString(row.id),
    slug: asString(row.slug),
    actor: asString(row.actor),
    price: asPrice(row.price),
    name: asString(row.name),
    preview: false,
    source: "indexed",
  };
}

export async function fetchActivity({ slug, limit = 50 }: FetchActivityOpts): Promise<Activity[] | null> {
  try {
    const q = new URLSearchParams();
    q.set("slug", slug);
    q.set("limit", String(limit));
    const r = await fetch(`/api/activity?${q.toString()}`);
    if (!r.ok) return null;
    return mapActivityJson(await r.json());
  } catch {
    return null;
  }
}

import type { Activity } from "./chain";

export type ChartPoint = {
  x: string | number;
  price: number;
  id?: string;
  name?: string;
  kind?: string;
};

export type FetchChartOpts = {
  slug: string;
  limit?: number;
};

const TRADE_KINDS = new Set(["buy", "list"]);
const SKIP_KINDS = new Set(["mint", "cancel"]);

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function asPrice(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim() || 0);
  return Number.isFinite(n) ? n : 0;
}

function kindOf(row: { kind?: string }): string {
  return (row.kind || "").trim().toLowerCase();
}

function pointX(row: { name?: string; id?: string }, i: number): string | number {
  const name = (row.name || "").trim();
  if (name) return name;
  const id = (row.id || "").trim();
  if (id) return `#${id}`;
  return i;
}

function toPoint(x: string | number, price: number, kind: string, id: string, name: string): ChartPoint {
  const point: ChartPoint = { x, price };
  if (kind) point.kind = kind;
  if (id.trim()) point.id = id.trim();
  if (name.trim()) point.name = name.trim();
  return point;
}

/** Newest-first activity → oldest-first buy/list points. Skips price<=0 and mint/cancel. */
export function activityToPoints(activity: Activity[]): ChartPoint[] {
  const kept: { row: Activity; index: number }[] = [];
  for (let i = 0; i < activity.length; i++) {
    const row = activity[i];
    const kind = kindOf(row);
    if (!kind || row.price <= 0) continue;
    if (SKIP_KINDS.has(kind)) continue;
    if (!TRADE_KINDS.has(kind)) continue;
    kept.push({ row, index: i });
  }
  kept.sort((a, b) => b.index - a.index);
  return kept.map(({ row }, i) => toPoint(pointX(row, i), row.price, kindOf(row), row.id, row.name));
}

export function listedPricesToPoints(
  items: Array<{ name?: string; id?: string; price?: number; listPrice?: number }>,
): ChartPoint[] {
  const out: ChartPoint[] = [];
  for (const it of items) {
    const price = Number(it.listPrice ?? it.price ?? 0);
    if (!Number.isFinite(price) || price <= 0) continue;
    const name = (it.name || "").trim();
    const id = (it.id || "").trim();
    out.push(toPoint(name || (id ? `#${id}` : out.length), price, "list", id, name));
  }
  return out;
}

export function pointsForItem(
  points: ChartPoint[],
  item: { id?: string; name?: string },
): ChartPoint[] {
  const id = (item.id || "").trim();
  const name = (item.name || "").trim().toLowerCase();
  if (!id && !name) return [];
  return points.filter((p) => {
    const pid = (p.id || "").trim();
    if (id && pid && pid === id) return true;
    const pname = (p.name || "").trim().toLowerCase();
    if (name && pname && pname === name) return true;
    if (name && String(p.x).trim().toLowerCase() === name) return true;
    return false;
  });
}

function chartRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.points)) return o.points;
    if (Array.isArray(o.chart)) return o.chart;
  }
  return [];
}

function mapChartX(row: Record<string, unknown>, fallback: ChartPoint, i: number): string | number {
  const rawX = row.x;
  if (typeof rawX === "number" && Number.isFinite(rawX)) return rawX;
  if (typeof rawX === "string" && rawX.trim()) return rawX.trim();
  const height = asPrice(row.height);
  if (height > 0) return height;
  return pointX(fallback, i);
}

export function mapChartJson(raw: unknown): ChartPoint[] {
  const out: ChartPoint[] = [];
  for (const row of chartRows(raw)) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const price = asPrice(rec.price);
    if (price <= 0) continue;
    const kind = asString(rec.kind).toLowerCase();
    if (kind && (SKIP_KINDS.has(kind) || !TRADE_KINDS.has(kind))) continue;
    const id = asString(rec.id);
    const name = asString(rec.name);
    const point = toPoint(0, price, kind, id, name);
    point.x = mapChartX(rec, point, out.length);
    out.push(point);
  }
  return out;
}

/** Optional indexer series. 404 / network → null; caller keeps activity points. */
export async function fetchChart({ slug, limit = 50 }: FetchChartOpts): Promise<ChartPoint[] | null> {
  try {
    const q = new URLSearchParams();
    q.set("slug", slug);
    q.set("limit", String(limit));
    const r = await fetch(`/api/chart?${q.toString()}`);
    if (!r.ok) return null;
    return mapChartJson(await r.json());
  } catch {
    return null;
  }
}

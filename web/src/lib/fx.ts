import { UGNOT, gnotFromUgnot } from "./chain";

export type Quote = "gnot" | "usd";

export const QUOTE_KEY = "bazaar.quote";
export const GNOSWAP_PRICES_URL = "https://api.gnoswap.io/v1/tokens/prices";
export const COINGECKO_GNOT_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=gno-land&vs_currencies=usd";

export function loadQuote(): Quote {
  try {
    return localStorage.getItem(QUOTE_KEY) === "usd" ? "usd" : "gnot";
  } catch {
    return "gnot";
  }
}

export function saveQuote(q: Quote) {
  try {
    localStorage.setItem(QUOTE_KEY, q);
  } catch {
    /* ignore */
  }
}

export function parseGnoswapGnotUsd(body: unknown): number {
  const rows = Array.isArray((body as { data?: unknown })?.data)
    ? (body as { data: unknown[] }).data
    : Array.isArray(body)
      ? body
      : [];
  let gnotUsd = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { path?: unknown; usd?: unknown; priceGradeType?: unknown };
    const path = String(rec.path || "").trim();
    const usd = Number(rec.usd);
    const grade = String(rec.priceGradeType || "").toUpperCase();
    if (
      !(
        path === "ugnot" ||
        path === "gno.land/r/gnoland/wugnot.wugnot" ||
        path.endsWith("/wugnot.wugnot") ||
        path.endsWith(".wugnot")
      )
    ) {
      continue;
    }
    if (!(Number.isFinite(usd) && usd > 0)) continue;
    if (!gnotUsd || grade === "ORACLE") gnotUsd = usd;
  }
  return gnotUsd > 0 ? gnotUsd : 0;
}

export function parseCoinGeckoGnotUsd(body: unknown): number {
  const usd = Number((body as { "gno-land"?: { usd?: unknown } })?.["gno-land"]?.usd);
  return Number.isFinite(usd) && usd > 0 ? usd : 0;
}

async function fetchJson(url: string, ms = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchGnotUsd(): Promise<{ gnotUsd: number; source: string }> {
  const urls = [
    { url: GNOSWAP_PRICES_URL, kind: "gnoswap" as const },
    { url: "/gnoswap-prices", kind: "gnoswap" as const },
  ];
  for (const { url, kind } of urls) {
    try {
      const usd = parseGnoswapGnotUsd(await fetchJson(url));
      if (usd > 0) return { gnotUsd: usd, source: kind };
    } catch {
      /* next */
    }
  }
  for (const url of [COINGECKO_GNOT_URL, "/coingecko-gnot"]) {
    try {
      const usd = parseCoinGeckoGnotUsd(await fetchJson(url, 6000));
      if (usd > 0) return { gnotUsd: usd, source: "coingecko" };
    } catch {
      /* next */
    }
  }
  return { gnotUsd: 0, source: "none" };
}

export function formatUsd(usd: number): string {
  if (!(usd > 0) || !Number.isFinite(usd)) return "—";
  const digits = usd >= 1000 ? 0 : usd >= 1 ? 2 : 4;
  return `$${usd.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits > 0 ? Math.min(2, digits) : 0 })}`;
}

export function formatUgnot(ugnot: number, quote: Quote, gnotUsd: number): string {
  if (!(ugnot > 0) || !Number.isFinite(ugnot)) return "—";
  if (quote === "usd") {
    if (!(gnotUsd > 0)) return "—";
    return formatUsd((ugnot / UGNOT) * gnotUsd);
  }
  return `${gnotFromUgnot(ugnot)} GNOT`;
}

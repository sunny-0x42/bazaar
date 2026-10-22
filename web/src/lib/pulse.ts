import { isPkgPath, isPublicFactorySlug, networkById, normalizePkgPath, type NetworkId } from "./chain";
import { indexerUrl } from "./indexer";

export type PulseSnapshot = {
  state: "load" | "ok" | "fail";
  vol?: number;
  sales?: number;
  traded?: number;
  collections?: number;
};

export type MonthRow = { kind: string; price: number };

type PulseCache = {
  key: string;
  vol: number;
  sales: number;
  traded: number;
  collections: number;
  packs: string[];
  net: string;
  at: number;
};

type RawTx = {
  hash?: unknown;
  block_height?: unknown;
  messages?: unknown;
};

const PULSE_STORE = "bazaar.pulse.v1";
const MONTH_FUNCS = new Set(["Buy", "AcceptOffer", "PublicMint", "Mint"]);
const KIND: Record<string, string> = {
  Buy: "buy",
  AcceptOffer: "accept",
  PublicMint: "publicmint",
  Mint: "mint",
};
const MONTH_QUERY = `query BzMonth($pkg:String!,$after:Int!,$before:Int!){getTransactions(where:{success:{eq:true},block_height:{gt:$after,lt:$before},_or:[{messages:{value:{MsgCall:{pkg_path:{eq:$pkg},func:{eq:"Buy"}}}}},{messages:{value:{MsgCall:{pkg_path:{eq:$pkg},func:{eq:"PublicMint"}}}}},{messages:{value:{MsgCall:{pkg_path:{eq:$pkg},func:{eq:"AcceptOffer"}}}}},{messages:{value:{MsgCall:{pkg_path:{eq:$pkg},func:{eq:"Mint"}}}}}]},order:{heightAndIndex:DESC}){hash block_height messages{value{... on MsgCall{caller func pkg_path send}}}}}`;

const cutCache = new Map<string, Promise<{ after: number; tip: number } | null>>();
const monthCache = new Map<string, Promise<RawTx[] | null>>();

export function pulsePacks(collections: { slug: string; pkg?: string }[]): { key: string; packs: string[] } {
  const lines = (collections || [])
    .filter((row) => row && isPublicFactorySlug(row.slug) && isPkgPath(normalizePkgPath(row.pkg || "")))
    .map((row) => `${row.slug}\t${normalizePkgPath(row.pkg || "")}`)
    .sort();
  return { key: lines.join("\n"), packs: lines.map((line) => line.split("\t")[1] || "") };
}

export function readPulse(key: string, net?: string): PulseCache | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PULSE_STORE) || "");
    if (!raw || typeof raw !== "object") return null;
    const row = raw as PulseCache;
    if (!Number.isFinite(row.vol) || !Number.isFinite(row.sales) || !Number.isFinite(row.traded)) return null;
    if (net && row.net && row.net !== net) return null;
    if (key && row.key !== key) return null;
    return row;
  } catch {
    return null;
  }
}

export function writePulse(key: string, fold: { vol: number; sales: number; traded: number }, collections: number, packs: string[], net: string) {
  try {
    const row: PulseCache = {
      key,
      vol: fold.vol,
      sales: fold.sales,
      traded: fold.traded,
      collections,
      packs,
      net,
      at: Date.now(),
    };
    localStorage.setItem(PULSE_STORE, JSON.stringify(row));
  } catch {
    /* private mode */
  }
}

export function parseSendUgnot(send: unknown): number {
  const match = String(send || "").trim().match(/^(\d+)\s*ugnot$/i);
  return match ? Number(match[1]) : 0;
}

export function parseMonthTxs(rows: unknown, pkg: string): MonthRow[] {
  const want = String(pkg || "").toLowerCase();
  const seen = new Set<string>();
  const out: MonthRow[] = [];
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const hash = String((row as RawTx).hash || "");
    if (!hash || seen.has(hash)) continue;
    const messages = (row as RawTx).messages;
    const calls = Array.isArray(messages)
      ? messages.map((message) => (message && typeof message === "object" ? (message as { value?: unknown }).value : undefined))
      : [];
    const call = calls.find((value) => {
      if (!value || typeof value !== "object") return false;
      const func = String((value as { func?: unknown }).func || "").trim();
      const path = String((value as { pkg_path?: unknown }).pkg_path || "").trim().toLowerCase();
      return MONTH_FUNCS.has(func) && (!want || path === want);
    }) as { func?: unknown; send?: unknown } | undefined;
    if (!call) continue;
    seen.add(hash);
    const func = String(call.func || "").trim();
    out.push({ kind: KIND[func] || "", price: parseSendUgnot(call.send) });
  }
  return out;
}

export function foldMonth(rows: MonthRow[]): { vol: number; sales: number; minted: number; traded: number } {
  let vol = 0;
  let sales = 0;
  let minted = 0;
  let traded = 0;
  for (const row of rows) {
    if (row.kind === "buy" || row.kind === "accept") {
      sales += 1;
      vol += row.price || 0;
      traded += row.price || 0;
    } else if (row.kind === "mint" || row.kind === "publicmint") {
      minted += 1;
      vol += row.price || 0;
    }
  }
  return { vol, sales, minted, traded };
}

/** Height at or before 30 days ago. 0 means the chain itself is younger than the window. */
export async function monthCut(
  tip: { height: number; time: number },
  blockTime: (height: number) => Promise<number | null>,
): Promise<number> {
  const cutoff = tip.time - 30 * 86400;
  const genesis = await blockTime(1);
  if (genesis != null && genesis >= cutoff) return 0;
  let lo = 1;
  let hi = tip.height;
  let found = 0;
  for (let step = 0; lo <= hi && step < 24; step += 1) {
    const mid = Math.floor((lo + hi) / 2);
    const time = await blockTime(mid);
    if (time == null) {
      hi = mid - 1;
      continue;
    }
    if (time <= cutoff) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

async function chainHead(rpc: string): Promise<{ height: number; time: number } | null> {
  try {
    const res = await fetch(rpc.replace(/\/$/, ""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "status", params: {} }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { sync_info?: { latest_block_height?: unknown; latest_block_time?: unknown } } };
    const info = json?.result?.sync_info;
    const height = Math.floor(Number(info?.latest_block_height));
    const time = Date.parse(String(info?.latest_block_time || ""));
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(time)) return null;
    return { height, time: Math.floor(time / 1000) };
  } catch {
    return null;
  }
}

async function blockUnix(rpc: string, height: number): Promise<number | null> {
  const n = Math.floor(height);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    const res = await fetch(rpc.replace(/\/$/, ""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "block", params: { height: String(n) } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { block?: { header?: { time?: unknown } } } };
    const time = json?.result?.block?.header?.time;
    if (typeof time !== "string" || !time) return null;
    const ms = Date.parse(time);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  } catch {
    return null;
  }
}

function windowFor(rpc: string): Promise<{ after: number; tip: number } | null> {
  const hit = cutCache.get(rpc);
  if (hit) return hit;
  const job = (async () => {
    const head = await chainHead(rpc);
    if (!head) return null;
    const after = await monthCut(head, (height) => blockUnix(rpc, height));
    return { after, tip: head.height };
  })();
  cutCache.set(rpc, job);
  job.catch(() => {
    cutCache.delete(rpc);
  });
  return job;
}

async function fetchMonthPkg(url: string, pkg: string, after: number, before: number): Promise<RawTx[] | null> {
  const key = `${pkg.toLowerCase()}|${after}|${before}`;
  const hit = monthCache.get(key);
  if (hit) return hit;
  const job = (async () => {
    const rows: RawTx[] = [];
    let cursor = before;
    let any = false;
    for (let page = 0; page < 4; page += 1) {
      if (!(cursor - after > 1)) break;
      let json: { data?: { getTransactions?: unknown } } | null = null;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: MONTH_QUERY, variables: { pkg, after, before: cursor } }),
          signal: AbortSignal.timeout(12000),
        });
        json = res.ok ? ((await res.json()) as { data?: { getTransactions?: unknown } }) : null;
      } catch {
        json = null;
      }
      const batch = json?.data && Array.isArray(json.data.getTransactions) ? (json.data.getTransactions as RawTx[]) : null;
      if (!batch) break;
      any = true;
      rows.push(...batch);
      if (batch.length < 10000) break;
      let next = cursor;
      for (const row of batch) {
        const height = Math.floor(Number(row?.block_height));
        if (Number.isFinite(height) && height < next) next = height;
      }
      if (!(next < cursor)) break;
      cursor = next;
    }
    return any ? rows : null;
  })().catch(() => null);
  monthCache.set(key, job);
  void job.then((rows) => {
    if (!rows) monthCache.delete(key);
  });
  return job;
}

export function warmPulsePacks(network: NetworkId, packs: string[]) {
  const url = indexerUrl(network);
  if (!url || !packs.length) return;
  for (const pkg of packs) void fetchMonthPkg(url, pkg, 0, 2147483647);
}

export async function loadMonthPulse(
  network: NetworkId,
  collections: { slug: string; pkg?: string }[],
  alive: () => boolean,
  cached: boolean,
): Promise<PulseSnapshot | null> {
  const { key, packs } = pulsePacks(collections);
  if (!packs.length) return null;
  const url = indexerUrl(network);
  const rpc = networkById(network).rpcUrl;
  if (!url || !rpc) return { state: "fail", collections: packs.length };
  const windowPromise = windowFor(rpc);
  let lists = await Promise.all(packs.map((pkg) => fetchMonthPkg(url, pkg, 0, 2147483647)));
  const span = await windowPromise;
  if (!alive()) return null;
  if (!span) return cached ? null : { state: "fail", collections: packs.length };
  if (span.after > 0) {
    if (lists.some((rows) => !rows || rows.length >= 10000)) {
      lists = await Promise.all(packs.map((pkg) => fetchMonthPkg(url, pkg, span.after, span.tip + 1)));
    } else {
      lists = lists.map((rows) => (rows || []).filter((row) => Math.floor(Number(row?.block_height)) > span.after));
    }
  }
  if (!alive()) return null;
  if (lists.every((rows) => !rows)) return cached ? null : { state: "fail", collections: packs.length };
  const parsed: MonthRow[] = [];
  packs.forEach((pkg, index) => {
    if (lists[index]) parsed.push(...parseMonthTxs(lists[index], pkg));
  });
  const fold = foldMonth(parsed);
  writePulse(key, fold, packs.length, packs, network);
  return { state: "ok", vol: fold.vol, sales: fold.sales, traded: fold.traded, collections: packs.length };
}

import type { Activity, NetworkId } from "./chain";

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

export function indexerUrl(network: NetworkId): string | null {
  if (network === "mainnet") return "https://indexer.gno.land/graphql/query";
  if (network === "onyx") return "https://indexer.onyx.testnets.gno.land/graphql/query";
  if (network === "pearl") return "https://indexer.pearl.testnets.gno.land/graphql/query";
  return null;
}

/** Host Adena stores as indexerUrl. Adena appends `/graphql/query`. */
export function adenaIndexerOrigin(network: NetworkId): string {
  const url = indexerUrl(network);
  return url ? url.replace(/\/graphql\/query\/?$/, "") : "";
}

/** Recent blocks only. A wider scan reaches the launch txs and the indexer stops answering. */
const ACTIVITY_LOOKBACK = 20_000;
const ACTIVITY_TIMEOUT_MS = 12_000;
const ACTIVITY_CACHE_MS = 60_000;

const LATEST_HEIGHT_QUERY = `query { latestBlockHeight }`;

const PKG_ACTIVITY_QUERY = `
query PkgTxs($pkg: String!, $after: Int!) {
  getTransactions(
    where: {
      success: { eq: true }
      block_height: { gt: $after }
      messages: { value: { MsgCall: { pkg_path: { eq: $pkg } } } }
    }
    order: { heightAndIndex: DESC }
  ) {
    hash
    block_height
    success
    messages {
      typeUrl
      value {
        ... on MsgCall {
          caller
          func
          pkg_path
          args
          send
        }
      }
    }
    response {
      events {
        ... on GnoEvent {
          type
          pkg_path
          attrs { key value }
        }
      }
    }
  }
}
`;

const EVENT_KIND: Record<string, string> = {
  List: "list",
  Buy: "buy",
  Cancel: "cancel",
  Mint: "mint",
  PublicMint: "publicmint",
  Transfer: "transfer",
  Init: "init",
  Offer: "offer",
  CancelOffer: "canceloffer",
  AcceptOffer: "accept",
};

function ugnotFromSend(send: string): number {
  const m = String(send || "").trim().match(/^(\d+)\s*ugnot$/i);
  return m ? Number(m[1]) : 0;
}

function attrMap(attrs: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(attrs)) return out;
  for (const row of attrs) {
    if (!row || typeof row !== "object") continue;
    const k = asString((row as { key?: unknown }).key);
    if (k) out[k] = asString((row as { value?: unknown }).value);
  }
  return out;
}

type IndexerMsg = {
  typeUrl?: string;
  value?: { caller?: string; func?: string; pkg_path?: string; args?: string[] | null; send?: string };
};

type IndexerEvent = { type?: string; pkg_path?: string; attrs?: { key?: string; value?: string }[] };

export function mapIndexerTransactions(raw: unknown, pkg: string, slug: string): Activity[] {
  const data = raw && typeof raw === "object" ? (raw as { data?: { getTransactions?: unknown[] } }).data : null;
  const txs = Array.isArray(data?.getTransactions) ? data.getTransactions : [];
  const want = pkg.trim().toLowerCase();
  const out: Activity[] = [];
  for (const tx of txs) {
    if (!tx || typeof tx !== "object") continue;
    const rec = tx as {
      block_height?: unknown;
      messages?: IndexerMsg[];
      response?: { events?: IndexerEvent[] };
    };
    const msgs = Array.isArray(rec.messages) ? rec.messages : [];
    const call = msgs
      .map((m) => m?.value)
      .find((v) => v && asString(v.pkg_path).toLowerCase() === want && asString(v.func));
    if (!call) continue;
    const events = Array.isArray(rec.response?.events) ? rec.response.events : [];
    const biz = events.find((ev) => {
      const t = asString(ev?.type);
      if (!EVENT_KIND[t]) return false;
      const p = asString(ev?.pkg_path).toLowerCase();
      return !p || p === want;
    });
    const kind = (biz ? EVENT_KIND[asString(biz.type)] : "") || EVENT_KIND[asString(call.func)] || "";
    if (!kind) continue;
    const attrs = attrMap(biz?.attrs);
    const args = Array.isArray(call.args) ? call.args : [];
    const id = attrs.id || (kind === "init" ? "" : args[0] || "");
    const actor = attrs.seller || attrs.buyer || attrs.bidder || attrs.owner || attrs.to || asString(call.caller);
    let price = asPrice(attrs.price);
    if (!(price > 0)) price = asPrice(attrs.amount);
    if (!(price > 0)) price = ugnotFromSend(asString(call.send));
    if (!(price > 0) && kind === "list" && args[1]) price = asPrice(args[1]);
    out.push({
      kind,
      id,
      slug,
      actor,
      price,
      name: attrs.name || "",
      preview: false,
      source: "indexed",
    });
  }
  return out;
}

const WALLET_MINT_QUERY = `
query WalletMints($pkg: String!, $after: Int!) {
  getTransactions(
    where: {
      success: { eq: true }
      block_height: { gt: $after }
      messages: {
        value: {
          MsgCall: {
            pkg_path: { eq: $pkg }
            func: { eq: "PublicMint" }
          }
        }
      }
    }
    order: { heightAndIndex: DESC }
  ) {
    block_height
    messages {
      value {
        ... on MsgCall {
          caller
          func
          pkg_path
        }
      }
    }
  }
}
`;

/** One block height per successful PublicMint message on this collection. A batch repeats the height. */
export function collectionPublicMintHeights(raw: unknown, pkg: string): number[] {
  return publicMintHeights(raw, pkg, "");
}

/** One block height per successful PublicMint message from this wallet. A batch repeats the height. */
export function callerPublicMintHeights(raw: unknown, pkg: string, caller: string): number[] {
  return publicMintHeights(raw, pkg, caller);
}

function publicMintHeights(raw: unknown, pkg: string, caller: string): number[] {
  const data = raw && typeof raw === "object" ? (raw as { data?: { getTransactions?: unknown[] } }).data : null;
  const txs = Array.isArray(data?.getTransactions) ? data.getTransactions : [];
  const wantPkg = pkg.trim().toLowerCase();
  const wantCaller = caller.trim().toLowerCase();
  const out: number[] = [];
  for (const tx of txs) {
    if (!tx || typeof tx !== "object") continue;
    const rec = tx as { block_height?: unknown; messages?: IndexerMsg[] };
    const height = Math.floor(Number(rec.block_height));
    if (!Number.isFinite(height) || height <= 0) continue;
    const msgs = Array.isArray(rec.messages) ? rec.messages : [];
    for (const msg of msgs) {
      const value = msg?.value;
      if (!value) continue;
      if (asString(value.func) !== "PublicMint") continue;
      if (asString(value.pkg_path).toLowerCase() !== wantPkg) continue;
      if (wantCaller && asString(value.caller).toLowerCase() !== wantCaller) continue;
      out.push(height);
    }
  }
  return out;
}

/**
 * null when the indexer cannot answer. An empty list means this wallet has no
 * successful PublicMint after `afterHeight`. Caller is filtered here: the
 * indexer's caller filter does not return in time.
 */
export async function fetchCallerPublicMintHeights(opts: {
  pkg: string;
  caller: string;
  network: NetworkId;
  afterHeight: number;
}): Promise<number[] | null> {
  const url = indexerUrl(opts.network);
  const pkg = opts.pkg.trim();
  const caller = opts.caller.trim();
  const after = Math.floor(opts.afterHeight);
  if (!url || !pkg || !caller || !Number.isFinite(after) || after < 1) return null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: WALLET_MINT_QUERY, variables: { pkg, after } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const json: unknown = await r.json();
    if (json && typeof json === "object" && Array.isArray((json as { errors?: unknown }).errors)) {
      const errors = (json as { errors: unknown[] }).errors;
      if (errors.length > 0) return null;
    }
    return callerPublicMintHeights(json, pkg, caller);
  } catch {
    return null;
  }
}

/** null when the indexer cannot answer. Heights are every successful PublicMint after `afterHeight`. */
export async function fetchCollectionPublicMintHeights(opts: {
  pkg: string;
  network: NetworkId;
  afterHeight: number;
}): Promise<number[] | null> {
  const url = indexerUrl(opts.network);
  const pkg = opts.pkg.trim();
  const after = Math.floor(opts.afterHeight);
  if (!url || !pkg || !Number.isFinite(after) || after < 1) return null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: WALLET_MINT_QUERY, variables: { pkg, after } }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) return null;
    const json: unknown = await r.json();
    if (json && typeof json === "object" && Array.isArray((json as { errors?: unknown }).errors)) {
      const errors = (json as { errors: unknown[] }).errors;
      if (errors.length > 0) return null;
    }
    return collectionPublicMintHeights(json, pkg);
  } catch {
    return null;
  }
}

const activityCache = new Map<string, { at: number; rows: Activity[] }>();
const activityInflight = new Map<string, Promise<Activity[] | null>>();

function indexerFailed(json: unknown): boolean {
  if (!json || typeof json !== "object" || !Array.isArray((json as { errors?: unknown }).errors)) return false;
  return (json as { errors: unknown[] }).errors.length > 0;
}

async function postIndexer(url: string, query: string, variables: Record<string, unknown> | undefined, ms: number): Promise<unknown | null> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(variables ? { query, variables } : { query }),
    signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) return null;
  const json: unknown = await r.json();
  if (indexerFailed(json)) return null;
  return json;
}

function latestHeight(raw: unknown): number {
  const n = raw && typeof raw === "object" ? Number((raw as { data?: { latestBlockHeight?: unknown } }).data?.latestBlockHeight) : NaN;
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.floor(n);
}

async function loadPkgActivity(url: string, pkg: string, slug: string): Promise<Activity[] | null> {
  try {
    const head = await postIndexer(url, LATEST_HEIGHT_QUERY, undefined, ACTIVITY_TIMEOUT_MS);
    const height = latestHeight(head);
    if (!height) return null;
    const after = Math.max(0, height - ACTIVITY_LOOKBACK);
    const json = await postIndexer(url, PKG_ACTIVITY_QUERY, { pkg, after }, ACTIVITY_TIMEOUT_MS);
    if (!json) return null;
    return mapIndexerTransactions(json, pkg, slug);
  } catch {
    return null;
  }
}

export async function fetchPkgActivity(opts: {
  pkg: string;
  slug: string;
  network: NetworkId;
}): Promise<Activity[] | null> {
  const url = indexerUrl(opts.network);
  const pkg = opts.pkg.trim();
  if (!url || !pkg) return null;
  const key = `${opts.network}:${pkg}`;
  const hit = activityCache.get(key);
  if (hit && Date.now() - hit.at < ACTIVITY_CACHE_MS) return hit.rows;
  const pending = activityInflight.get(key);
  if (pending) return pending;
  const job = loadPkgActivity(url, pkg, opts.slug)
    .then((rows) => {
      if (rows) activityCache.set(key, { at: Date.now(), rows });
      return rows;
    })
    .finally(() => {
      activityInflight.delete(key);
    });
  activityInflight.set(key, job);
  return job;
}

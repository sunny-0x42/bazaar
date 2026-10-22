/** Same integer split Claim runs: sync the pot, then settle this wallet. */

const SCALE = 1_000_000n;
const TIER_BPS = [25n, 50n, 75n, 100n, 125n, 150n];

export function gnoInt(value: unknown): bigint {
  if (!value || typeof value !== "object") return 0n;
  const rec = value as { N?: unknown; V?: { value?: unknown; ["@type"]?: string } };
  if (typeof rec.N === "string" && rec.N) return leInt(rec.N);
  const inner = rec.V;
  if (inner && typeof inner.value === "string" && /^-?\d+$/.test(inner.value)) return BigInt(inner.value);
  return 0n;
}

function leInt(b64: string): bigint {
  const bin = atob(b64);
  let n = 0n;
  for (let i = 0; i < bin.length; i++) n += BigInt(bin.charCodeAt(i)) << (8n * BigInt(i));
  return n;
}

/** New accumulator after the coins sitting in the realm are split by weight. */
export function accruePot(balance: bigint, accounted: bigint, totalWeight: bigint, acc: bigint, scale = SCALE): bigint {
  if (totalWeight <= 0n || scale <= 0n) return acc;
  const delta = balance - accounted;
  if (delta <= 0n) return acc;
  const bump = (delta * scale) / totalWeight;
  if (bump <= 0n) return acc;
  const allocated = (bump * totalWeight) / scale;
  if (allocated <= 0n) return acc;
  return acc + bump;
}

export function claimableOf(weight: bigint, accrued: bigint, debt: bigint, acc: bigint, scale = SCALE): bigint {
  if (scale <= 0n || weight < 0n) return 0n;
  const got = (weight * acc) / scale;
  if (got < debt) return 0n;
  return accrued + (got - debt);
}

type Obj = Record<string, unknown>;

function asObj(value: unknown): Obj | null {
  return value && typeof value === "object" ? (value as Obj) : null;
}

function refOid(value: unknown): string {
  const rec = asObj(value);
  if (!rec) return "";
  if (typeof rec.ObjectID === "string" && rec.ObjectID.includes(":")) return rec.ObjectID;
  if (rec.Base) return refOid(rec.Base);
  if (rec.V) return refOid(rec.V);
  return "";
}

function stringField(field: unknown): string {
  const rec = asObj(field);
  const inner = asObj(rec?.V);
  if (inner && inner["@type"] === "/gno.StringValue") return String(inner.value || "");
  return "";
}

async function structFields(oid: string, getObject: (oid: string) => Promise<unknown>): Promise<unknown[] | null> {
  let cur = oid;
  for (let hop = 0; hop < 4; hop++) {
    const raw = asObj(await getObject(cur));
    const value = asObj(raw?.value) || raw;
    if (!value) return null;
    if (value["@type"] === "/gno.HeapItemValue") {
      const next = refOid(asObj(value.Value)?.V);
      if (!next || next === cur) return null;
      cur = next;
      continue;
    }
    if (value["@type"] === "/gno.StructValue" && Array.isArray(value.Fields)) return value.Fields;
    return null;
  }
  return null;
}

function walletOf(fields: unknown[]): { weight: bigint; accrued: bigint; debt: bigint } | null {
  if (fields.length < 8) return null;
  let weight = 0n;
  for (let i = 0; i < TIER_BPS.length; i++) weight += gnoInt(fields[i]) * TIER_BPS[i];
  return { weight, debt: gnoInt(fields[6]), accrued: gnoInt(fields[7]) };
}

async function findWallet(
  rootOid: string,
  owner: string,
  getObject: (oid: string) => Promise<unknown>,
): Promise<{ weight: bigint; accrued: bigint; debt: bigint } | null> {
  const want = owner.trim().toLowerCase();
  if (!want) return null;
  const tree = await structFields(rootOid, getObject);
  let oid = tree ? refOid(asObj(tree[0])?.V) : "";
  for (let hop = 0; oid && hop < 64; hop++) {
    const fields = await structFields(oid, getObject);
    if (!fields || fields.length < 6) return null;
    const key = stringField(fields[0]);
    if (key === want) {
      const valueOid = refOid(asObj(fields[1])?.V);
      if (!valueOid) return null;
      const walletFields = await structFields(valueOid, getObject);
      return walletFields ? walletOf(walletFields) : null;
    }
    const side = want < key ? fields[4] : fields[5];
    const next = refOid(asObj(side)?.V);
    if (!next || next === oid) return null;
    oid = next;
  }
  return null;
}

export async function claimFromPkg(
  pkgJson: string,
  owner: string,
  balance: bigint,
  getObject: (oid: string) => Promise<unknown>,
): Promise<bigint> {
  const parsed = JSON.parse(pkgJson) as { names?: string[]; values?: unknown[] };
  const names = parsed.names || [];
  const values = parsed.values || [];
  const at = (name: string) => values[names.indexOf(name)];
  const scale = gnoInt(at("scale")) || SCALE;
  const accounted = gnoInt(at("accounted"));
  const totalWeight = gnoInt(at("totalWeight"));
  const acc = accruePot(balance, accounted, totalWeight, gnoInt(at("acc")), scale);
  const root = refOid(asObj(at("wallets"))?.V);
  if (!root) return 0n;
  const wallet = await findWallet(root, owner, getObject);
  if (!wallet) return 0n;
  return claimableOf(wallet.weight, wallet.accrued, wallet.debt, acc, scale);
}

export function ugnotNumber(amount: bigint): number {
  if (amount <= 0n) return 0;
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  return Number(amount);
}

/** First integer in a qeval line such as `(95920000000 int64)`. */
export function parseLedgerInt(text: string): bigint {
  const m = String(text).match(/-?\d+/);
  return m ? BigInt(m[0]) : 0n;
}

const WALLET_GET =
  /struct\{\((-?\d+) int\),\((-?\d+) int\),\((-?\d+) int\),\((-?\d+) int\),\((-?\d+) int\),\((-?\d+) int\),\((-?\d+) int64\),\((-?\d+) int64\)\}/;

/**
 * `wallets.Get` prints the tier counts, debt, then accrued.
 * qobject_json omits the AVL `any` body, so this string is the read that still sees the struct.
 */
export function parseWalletGet(text: string): { weight: bigint; accrued: bigint; debt: bigint } | null {
  const m = String(text).match(WALLET_GET);
  if (!m) return null;
  let weight = 0n;
  for (let i = 0; i < TIER_BPS.length; i++) weight += BigInt(m[i + 1] || "0") * TIER_BPS[i];
  return { weight, debt: BigInt(m[7] || "0"), accrued: BigInt(m[8] || "0") };
}

/** True when Get answered and this address has no wallet row. */
export function walletGetAbsent(text: string): boolean {
  const s = String(text).trim().toLowerCase();
  if (s.includes("struct{")) return false;
  if (!s) return true;
  return s.includes("undefined") || s.includes("nil") || /\bfalse\b/.test(s);
}

/** Same integer Claim pays: settle the pot, then this wallet's accrued plus unsettled share. */
export function claimFromLedger(input: {
  balance: bigint;
  accounted: bigint;
  totalWeight: bigint;
  acc: bigint;
  wallet: { weight: bigint; accrued: bigint; debt: bigint } | null;
  scale?: bigint;
}): bigint {
  if (!input.wallet) return 0n;
  const scale = input.scale && input.scale > 0n ? input.scale : SCALE;
  const acc = accruePot(input.balance, input.accounted, input.totalWeight, input.acc, scale);
  return claimableOf(input.wallet.weight, input.wallet.accrued, input.wallet.debt, acc, scale);
}

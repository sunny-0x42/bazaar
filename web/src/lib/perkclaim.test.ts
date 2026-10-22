import { describe, expect, it } from "vitest";
import { accruePot, claimableOf, claimFromLedger, claimFromPkg, gnoInt, parseLedgerInt, parseWalletGet, walletGetAbsent } from "./perkclaim";

const SCALE = 1_000_000n;

function leB64(n: bigint): string {
  const bytes: number[] = [];
  let x = n;
  while (x > 0n) {
    bytes.push(Number(x & 0xffn));
    x >>= 8n;
  }
  while (bytes.length < 8) bytes.push(0);
  return Buffer.from(bytes).toString("base64");
}

function ref(oid: string) {
  return { "@type": "/gno.RefValue", ObjectID: oid };
}

function ptr(oid: string) {
  return { V: { "@type": "/gno.PointerValue", Base: ref(oid) } };
}

function str(value: string) {
  return { V: { "@type": "/gno.StringValue", value } };
}

function num(amount: bigint) {
  return amount === 0n ? { T: { "@type": "/gno.PrimitiveType", value: "1024" } } : { N: leB64(amount) };
}

function struct(fields: unknown[]) {
  return { value: { "@type": "/gno.StructValue", Fields: fields } };
}

function heap(inner: string) {
  return { value: { "@type": "/gno.HeapItemValue", Value: { V: ref(inner) } } };
}

function walletFields(counts: bigint[], debt = 0n, accrued = 0n) {
  const fields = counts.map((n) => num(n));
  while (fields.length < 6) fields.push(num(0n));
  fields.push(num(debt), num(accrued));
  return fields;
}

function pkg(extra: { balance?: bigint; accounted?: bigint; totalWeight?: bigint; acc?: bigint; root?: string }) {
  return JSON.stringify({
    names: ["scale", "accounted", "totalWeight", "acc", "wallets"],
    values: [
      { N: "QEIPAAAAAAA=" },
      num(extra.accounted ?? 0n),
      num(extra.totalWeight ?? 0n),
      num(extra.acc ?? 0n),
      extra.root ? { V: ref(extra.root) } : { T: { "@type": "/gno.RefType" } },
    ],
  });
}

describe("perk claim read", () => {
  it("reads the live scale encoding", () => {
    expect(gnoInt({ N: "QEIPAAAAAAA=" })).toBe(SCALE);
    expect(gnoInt({ T: { "@type": "/gno.PrimitiveType", value: "1024" } })).toBe(0n);
  });

  it("splits new coins by weight and leaves a short pot untouched", () => {
    expect(accruePot(1_000_000n, 0n, 25n, 0n)).toBe(40_000_000_000n);
    expect(accruePot(1_000_000n, 0n, 0n, 7n)).toBe(7n);
    expect(accruePot(1n, 0n, 2_000_000n, 3n)).toBe(3n);
    expect(accruePot(4n, 9n, 25n, 3n)).toBe(3n);
  });

  it("pays accrued plus the unsettled share, and reports 0 when debt would revert", () => {
    expect(claimableOf(25n, 0n, 0n, 40_000_000_000n)).toBe(1_000_000n);
    expect(claimableOf(25n, 250_000n, 0n, 0n)).toBe(250_000n);
    expect(claimableOf(25n, 0n, 1n, 0n)).toBe(0n);
  });

  it("returns 0 when the wallet tree is empty", async () => {
    const objects = new Map<string, unknown>([["tree:1", struct([{ T: { "@type": "/gno.PointerType" } }])]]);
    const claim = await claimFromPkg(pkg({ root: "tree:1", totalWeight: 25n }), "g1abc", 1_000_000n, async (oid) => objects.get(oid));
    expect(claim).toBe(0n);
  });

  it("returns 0 when this wallet has never synced", async () => {
    const objects = new Map<string, unknown>([
      ["tree:1", struct([ptr("heap:node")])],
      ["heap:node", heap("node:1")],
      [
        "node:1",
        struct([str("g1other"), ptr("heap:wal"), num(1n), num(1n), { T: { "@type": "/gno.PointerType" } }, { T: { "@type": "/gno.PointerType" } }]),
      ],
      ["heap:wal", heap("wal:1")],
      ["wal:1", struct(walletFields([1n, 0n, 0n, 0n, 0n, 0n], 0n, 500_000n))],
    ]);
    const claim = await claimFromPkg(pkg({ root: "tree:1", totalWeight: 25n }), "g1abc", 1_000_000n, async (oid) => objects.get(oid));
    expect(claim).toBe(0n);
  });

  it("reads a synced wallet through the heap pointer and adds coins not yet settled", async () => {
    const owner = "g1abc";
    const objects = new Map<string, unknown>([
      ["tree:1", struct([ptr("heap:root")])],
      ["heap:root", heap("node:root")],
      [
        "node:root",
        struct([
          str("g1zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"),
          ptr("unused"),
          num(1n),
          num(2n),
          ptr("heap:left"),
          { T: { "@type": "/gno.PointerType" } },
        ]),
      ],
      ["heap:left", heap("node:left")],
      ["node:left", struct([str(owner), ptr("heap:wal"), num(1n), num(1n), { T: { "@type": "/gno.PointerType" } }, { T: { "@type": "/gno.PointerType" } }])],
      ["heap:wal", heap("wal:1")],
      ["wal:1", struct(walletFields([1n, 0n, 0n, 0n, 0n, 1n], 0n, 0n))],
    ]);
    const claim = await claimFromPkg(
      pkg({ root: "tree:1", totalWeight: 175n, accounted: 0n, acc: 0n }),
      "G1ABC",
      1_750_000n,
      async (oid) => objects.get(oid),
    );
    expect(claim).toBe(1_750_000n);
  });

  it("reads the qeval wallet string and pays the unsettled share", () => {
    const early =
      "(&(struct{(1 int),(0 int),(0 int),(0 int),(0 int),(0 int),(0 int64),(0 int64)} gno.land/r/demo/perk.wallet) *gno.land/r/demo/perk.wallet)";
    const late = "(&(struct{(1 int),(1 int),(1 int),(0 int),(0 int),(0 int),(14388000 int64),(0 int64)} pkg.wallet) *pkg.wallet)";
    const ledger = {
      balance: 2_398_000n,
      accounted: 2_398_000n,
      totalWeight: 400n,
      acc: 95_920_000_000n,
    };
    expect(parseLedgerInt("(95920000000 int64)")).toBe(95_920_000_000n);
    expect(parseWalletGet(early)).toEqual({ weight: 25n, debt: 0n, accrued: 0n });
    expect(claimFromLedger({ ...ledger, wallet: parseWalletGet(early) })).toBe(2_398_000n);
    expect(parseWalletGet(late)?.weight).toBe(150n);
    expect(claimFromLedger({ ...ledger, wallet: parseWalletGet(late) })).toBe(0n);
    expect(parseWalletGet("(undefined)")).toBeNull();
    expect(walletGetAbsent("(undefined)")).toBe(true);
    expect(walletGetAbsent(early)).toBe(false);
    expect(claimFromLedger({ ...ledger, wallet: null })).toBe(0n);
  });
});

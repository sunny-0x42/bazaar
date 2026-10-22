import { useEffect, useState } from "react";
import { parseEvalAddress, parseEvalInt, parseEvalString } from "../lib/chain";
import { formatRewardGnot, formatRewardGnotExact, formatUgnot, parsePerkRender } from "../lib/rewards";
import { backlogUnassigned, nextSyncSpan, planSyncSpan } from "../lib/perksync";
import { evalExpr, readBankUgnot } from "../lib/wallets";

export type ShareDeskView = {
  perkPkg: string;
  minted: number;
  totalWeight: number;
  accountedUgnot: number;
  poolUgnot: number;
  /** True when the perk render has an unsettled line. Sync records weight and does not pay. */
  epoch?: boolean;
  unsettledUgnot?: number;
};

type Props = {
  rpc: string;
  factory: string;
  collection: string;
  blocked: boolean;
  busy: boolean;
  onSyncSpan: (pkg: string, start: number, end: number) => Promise<boolean>;
  onSettle?: (pkg: string) => Promise<boolean>;
  preview?: ShareDeskView;
};

const emptyView = (): ShareDeskView => ({
  perkPkg: "",
  minted: 0,
  totalWeight: 0,
  accountedUgnot: 0,
  poolUgnot: 0,
  epoch: false,
  unsettledUgnot: 0,
});

function spanStorageKey(pkg: string): string {
  return `bazaar.syncspan.v1:${pkg}`;
}

function readSpanThrough(pkg: string): number {
  if (!pkg || typeof sessionStorage === "undefined") return 0;
  try {
    const n = Math.floor(Number(sessionStorage.getItem(spanStorageKey(pkg))));
    return n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeSpanThrough(pkg: string, through: number) {
  if (!pkg || typeof sessionStorage === "undefined") return;
  try {
    if (through > 0) sessionStorage.setItem(spanStorageKey(pkg), String(through));
    else sessionStorage.removeItem(spanStorageKey(pkg));
  } catch {
    /* private mode */
  }
}

export function ShareDesk({ rpc, factory, collection, blocked, busy, onSyncSpan, onSettle, preview }: Props) {
  const [view, setView] = useState<ShareDeskView>(preview ?? emptyView());
  const [through, setThrough] = useState(0);
  const [start, setStart] = useState("1");
  const [end, setEnd] = useState("20");
  const [acceptBacklog, setAcceptBacklog] = useState(false);
  const [acceptSettle, setAcceptSettle] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (preview) {
      setView(preview);
      return;
    }
    let live = true;
    const load = async () => {
      try {
        const [pkgRaw, mintedRaw] = await Promise.all([
          evalExpr(rpc, factory, "GenesisPkg()"),
          collection ? evalExpr(rpc, collection, "Minted()").catch(() => "0") : Promise.resolve("0"),
        ]);
        const perkPkg = parseEvalString(pkgRaw);
        const next = emptyView();
        next.perkPkg = perkPkg;
        next.minted = parseEvalInt(mintedRaw);
        if (perkPkg) {
          const [weightRaw, renderRaw, sinkRaw] = await Promise.all([
            evalExpr(rpc, perkPkg, "TotalWeight()"),
            evalExpr(rpc, perkPkg, 'Render("")'),
            evalExpr(rpc, factory, "GenesisSink()"),
          ]);
          const rendered = parsePerkRender(renderRaw);
          next.totalWeight = parseEvalInt(weightRaw) || rendered.totalWeight;
          next.accountedUgnot = rendered.accountedUgnot;
          next.epoch = rendered.unsettledUgnot != null;
          next.unsettledUgnot = rendered.unsettledUgnot ?? 0;
          const sink = parseEvalAddress(sinkRaw);
          const balance = sink ? await readBankUgnot(rpc, sink) : 0;
          next.poolUgnot = balance == null ? rendered.accountedUgnot : Math.max(balance, rendered.accountedUgnot);
        }
        if (live) {
          setView(next);
          setError("");
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Could not read the perk realm.");
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [preview, rpc, factory, collection, reload]);

  useEffect(() => {
    if (preview || !view.perkPkg) return;
    const n = readSpanThrough(view.perkPkg);
    if (n > 0) setThrough(n);
  }, [preview, view.perkPkg]);

  const next = nextSyncSpan(through, view.minted);
  const epoch = view.epoch === true;
  const backlog = !epoch && backlogUnassigned(view.totalWeight, view.poolUgnot, view.accountedUgnot);
  const needsAccept = backlog && !acceptBacklog;
  const unsettled = Math.max(0, Math.trunc(view.unsettledUgnot ?? 0));
  const settleReady = epoch && unsettled > 0 && view.totalWeight > 0 && !!view.perkPkg;

  async function record(span: { start: number; end: number }) {
    setError("");
    if (!view.perkPkg) {
      setError("The factory has no perk realm yet.");
      return;
    }
    const ok = await onSyncSpan(view.perkPkg, span.start, span.end);
    if (!ok) return;
    setThrough(span.end);
    if (!preview) writeSpanThrough(view.perkPkg, span.end);
    setReload((n) => n + 1);
  }

  async function settle() {
    setError("");
    if (!settleReady || !onSettle) return;
    const ok = await onSettle(view.perkPkg);
    if (!ok) return;
    setAcceptSettle(false);
    setReload((n) => n + 1);
  }

  return (
    <section className="panel admin-fee-card share-desk" aria-label="Sync NFT">
      <h2>Sync NFT</h2>
      <p className="hint">
        {epoch
          ? "The deploy wallet syncs minted Bazaar Gens from this desk. Sync records weight only and does not pay GNOT. After Settle, holders Claim. One signature covers at most 20 tokens."
          : "The deploy wallet syncs minted Bazaar Gens from this desk, including an NFT this wallet does not hold. One signature covers at most 20 tokens. An unminted slot is skipped by the realm."}
      </p>
      <div className="admin-kpi-grid">
        <div className="admin-kpi"><dt>Pool</dt><dd>{formatRewardGnot(view.poolUgnot)} GNOT</dd></div>
        <div className="admin-kpi"><dt>Pool weight</dt><dd>{view.totalWeight.toLocaleString("en-US")}</dd></div>
        <div className="admin-kpi"><dt>Accounted</dt><dd>{formatRewardGnot(view.accountedUgnot)} GNOT</dd></div>
        {epoch ? (
          <div className="admin-kpi"><dt>Unsettled</dt><dd>{formatRewardGnotExact(view.unsettledUgnot ?? 0)} GNOT</dd></div>
        ) : null}
        <div className="admin-kpi"><dt>Minted</dt><dd>{view.minted.toLocaleString("en-US")}</dd></div>
      </div>
      {epoch ? (
        <p className="hint">Sync records weight only. Settle splits the unsettled pool across the weight recorded then. This desk does not pay GNOT.</p>
      ) : null}
      {backlog ? (
        <label className="trait-check">
          <input
            type="checkbox"
            checked={acceptBacklog}
            onChange={(e) => setAcceptBacklog(e.target.checked)}
          />
          The GNOT already in the pool goes to the owner of the first NFT this records. Later NFTs share only fees that
          arrive after that.
        </label>
      ) : null}
      <p className="hint" data-next={next ? `${next.start}-${next.end}` : "done"}>
        {next
          ? `Next span ${next.start.toLocaleString("en-US")}–${next.end.toLocaleString("en-US")} of ${view.minted.toLocaleString("en-US")} minted.`
          : "Every minted id is in a span you already sent from this desk."}
      </p>
      <button
        className="btn primary"
        type="button"
        data-sync="nft"
        disabled={blocked || busy || !next || needsAccept || !view.perkPkg}
        onClick={() => {
          if (next) void record(next);
        }}
      >
        {busy ? "Syncing…" : next ? "Sync NFT" : "Synced"}
      </button>
      {through > 0 ? (
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={() => {
            setThrough(0);
            if (!preview) writeSpanThrough(view.perkPkg, 0);
          }}
        >
          Start from 1
        </button>
      ) : null}
      <form
        className="share-span"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            void record(planSyncSpan(Number(start), Number(end), view.minted));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Check the token range.");
          }
        }}
      >
        <label>
          Start
          <input value={start} onChange={(e) => setStart(e.target.value)} inputMode="numeric" />
        </label>
        <label>
          End
          <input value={end} onChange={(e) => setEnd(e.target.value)} inputMode="numeric" />
        </label>
        <button className="btn" type="submit" disabled={blocked || busy || needsAccept || !view.perkPkg}>
          Sync span
        </button>
      </form>
      {epoch ? (
        <div className="share-settle">
          <p className="hint">
            Settle writes each recorded wallet's share of the unsettled pool. Holders Claim that share afterwards.
            Weight synced later joins the next Settle.
          </p>
          {settleReady ? (
            <label className="trait-check">
              <input
                type="checkbox"
                checked={acceptSettle}
                onChange={(e) => setAcceptSettle(e.target.checked)}
              />
              Split {formatRewardGnotExact(unsettled)} GNOT ({formatUgnot(unsettled)} ugnot) across weight{" "}
              {view.totalWeight.toLocaleString("en-US")} now.
            </label>
          ) : (
            <p className="hint">
              {view.totalWeight <= 0
                ? "Settle needs recorded weight. Sync NFT first."
                : "Nothing unsettled to split."}
            </p>
          )}
          <button
            className="btn primary"
            type="button"
            disabled={blocked || busy || !settleReady || !onSettle || !acceptSettle}
            onClick={() => void settle()}
          >
            {busy ? "Settling…" : "Settle"}
          </button>
        </div>
      ) : null}
      {error ? <p className="notice err">{error}</p> : null}
    </section>
  );
}

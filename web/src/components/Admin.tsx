import { useEffect, useMemo, useState } from "react";
import type { ChainCollection, Item } from "../lib/chain";
import { UGNOT, itemCollectionSlug, shortAddr, shortPkgPath } from "../lib/chain";
import { downloadText, wlistCsv, type WlistRow } from "../lib/wlist";
import { ShareDesk } from "./ShareDesk";
import { CopyLine } from "./CopyLine";
import { EmptyState } from "./EmptyState";
import { ItemArt } from "./ItemArt";
import { PriceMark } from "./PriceMark";

type Pane = "overview" | "fees" | "share" | "whitelist";

type Props = {
  allowed: boolean;
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  drops: ChainCollection[];
  featured: string[];
  listed: Item[];
  launchFeeUgnot: number;
  adminReserveFree?: boolean;
  protocolBps?: number;
  factoryPkg?: string;
  adminAddr?: string;
  onSave: (slugs: string[]) => void;
  onConnect: () => void;
  onSetLaunchFee: (ugnot: number) => void;
  onSetProtocolBps: (pkg: string, bps: number) => void;
  protocolSink?: string;
  onSetProtocolSink?: (addr: string) => void;
  genesisPkg?: string;
  onSetGenesis?: (pkg: string) => void;
  onOpenCollection?: (slug: string) => void;
  onLaunch?: () => void;
  factoryTreasuryUgnot?: number;
  onWithdraw?: () => void;
  wlistRows?: WlistRow[];
  wlistCount?: number;
  wlistCap?: number;
  wlistError?: string;
  onSeedWlist?: (blob: string) => void;
  onPatchWlist?: (patch: { address: string; handle?: string; newAddress?: string }) => void;
  onRemoveWlist?: (address: string) => void;
  rpc?: string;
  collection?: string;
  onSyncSpan?: (pkg: string, start: number, end: number) => Promise<boolean>;
  onSettle?: (pkg: string) => Promise<boolean>;
};

export function Admin({
  blocked,
  busy,
  drops,
  listed,
  launchFeeUgnot,
  adminReserveFree = false,
  protocolBps = 200,
  factoryPkg = "",
  adminAddr = "",
  onSetLaunchFee,
  onSetProtocolBps,
  protocolSink = "",
  onSetProtocolSink,
  genesisPkg: liveGenesisPkg = "",
  onSetGenesis,
  onOpenCollection,
  onLaunch,
  factoryTreasuryUgnot = 0,
  onWithdraw,
  wlistRows = [],
  wlistCount = 0,
  wlistCap = 333,
  wlistError = "",
  onSeedWlist,
  onPatchWlist,
  onRemoveWlist,
  rpc = "",
  collection = "",
  onSyncSpan,
  onSettle,
}: Props) {
  const [pane, setPane] = useState<Pane>("overview");

  const listedRows = listed.filter((row) => row.listed && row.price > 0);
  const minted = drops.reduce((n, col) => n + (col.minted || col.count || 0), 0);
  const listedN = listedRows.length;
  const asks = listedRows.reduce((n, row) => n + (row.price || 0), 0);
  const paused = drops.filter((col) => col.paused).length;
  const soldOut = drops.filter((col) => (col.maxSupply || 0) > 0 && (col.minted || col.count || 0) >= (col.maxSupply || 0)).length;

  const bySlug = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const row of listedRows) {
      const slug = itemCollectionSlug(row);
      if (!slug) continue;
      const cur = map.get(slug) || [];
      cur.push(row);
      map.set(slug, cur);
    }
    return map;
  }, [listedRows]);

  return (
    <section className="page admin-page">
      <header className="admin-studio">
        <div>
          <p className="explore-kicker">Factory desk</p>
          <h1>Nomaq Studio</h1>
          <p className="muted">Live fees and inventory on bazaarv2. Open asks are listed inventory, not sales volume.</p>
        </div>
        <div className="admin-studio-meta">
          <span className="status-pill is-live">
            <span className="status-dot" aria-hidden />
            Mainnet
          </span>
          {factoryPkg ? <CopyLine display={shortPkgPath(factoryPkg)} value={factoryPkg} /> : null}
          {adminAddr ? <CopyLine display={shortAddr(adminAddr)} value={adminAddr} /> : null}
        </div>
      </header>
      <div className="col-tabs" role="tablist">
        <button type="button" className={pane === "overview" ? "active" : ""} onClick={() => setPane("overview")}>
          Overview
        </button>
        <button type="button" className={pane === "fees" ? "active" : ""} onClick={() => setPane("fees")}>
          Fees
        </button>
        <button type="button" className={pane === "share" ? "active" : ""} onClick={() => setPane("share")}>
          Sync NFT
        </button>
        <button type="button" className={pane === "whitelist" ? "active" : ""} onClick={() => setPane("whitelist")}>
          Whitelist
        </button>
      </div>
      {pane === "overview" ? (
        <div className="admin-overview">
          <div className="admin-kpi-grid">
            <Kpi label="Collections" value={String(drops.length)} />
            <Kpi label="Minted" value={String(minted)} />
            <Kpi label="Open listings" value={String(listedN)} />
            <Kpi label="Open asks" value={asks > 0 ? undefined : "0"} ugnot={asks > 0 ? asks : undefined} />
          </div>
          <p className="admin-flags muted">
            {paused} paused · {soldOut} sold out · create {launchFeeUgnot / UGNOT} GNOT · protocol {protocolBps} bps
            {asks > 0 ? ` · if all asks fill, protocol ~${((asks * protocolBps) / 10000 / UGNOT).toLocaleString()} GNOT` : ""}
          </p>
          {drops.length > 0 ? <InventoryChart drops={drops} listedBySlug={bySlug} /> : null}
          {drops.length === 0 ? (
            <EmptyState title="No collections yet" body="Launch a bazaarv2 collection to fill this desk.">
              {onLaunch ? (
                <button className="btn primary" type="button" onClick={onLaunch}>
                  Launch a collection
                </button>
              ) : null}
            </EmptyState>
          ) : (
            <div className="market-table-wrap">
              <table className="market-table">
                <thead>
                  <tr>
                    <th>Collection</th>
                    <th>Floor</th>
                    <th>Listed</th>
                    <th>Minted</th>
                    <th>Royalty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drops.map((col) => {
                    const m = col.minted || col.count || 0;
                    const max = col.maxSupply || 0;
                    const rows = bySlug.get(col.slug) || [];
                    const nListed = rows.length;
                    const floor = rows.reduce((min, row) => (min <= 0 || row.price < min ? row.price : min), 0);
                    const out = max > 0 && m >= max;
                    const status = col.paused ? "Paused" : out ? "Sold out" : nListed > 0 ? "Live" : "Unlisted";
                    return (
                      <tr
                        key={col.slug}
                        className={onOpenCollection ? "is-link" : ""}
                        onClick={() => onOpenCollection?.(col.slug)}
                      >
                        <td>
                          <div className="admin-col-cell">
                            <ItemArt image={col.cover} name={col.name} size={40} />
                            <span>
                              <strong>{col.name}</strong>
                              <span className="mono muted"> {col.slug}</span>
                            </span>
                          </div>
                        </td>
                        <td>{floor > 0 ? <PriceMark ugnot={floor} size={13} /> : "—"}</td>
                        <td className="num">
                          {nListed}/{m || "—"}
                        </td>
                        <td className="num">
                          {m}/{max || "∞"}
                        </td>
                        <td className="num">{col.royaltyBps != null ? `${col.royaltyBps / 100}%` : "—"}</td>
                        <td>
                          <span className={`admin-status is-${status.toLowerCase().replace(" ", "-")}`}>{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
      {pane === "whitelist" ? (
        <WhitelistPanel
          rows={wlistRows}
          count={wlistCount}
          cap={wlistCap}
          error={wlistError}
          busy={busy}
          onSeed={onSeedWlist}
          onPatch={onPatchWlist}
          onRemove={onRemoveWlist}
        />
      ) : null}
      {pane === "share" && onSyncSpan ? (
        <ShareDesk
          rpc={rpc}
          factory={factoryPkg}
          collection={collection}
          blocked={blocked}
          busy={busy}
          onSyncSpan={onSyncSpan}
          onSettle={onSettle}
        />
      ) : null}
      {pane === "fees" ? (
        <FeesPanel
          blocked={blocked}
          busy={busy}
          factoryPkg={factoryPkg}
          launchFeeUgnot={launchFeeUgnot}
          adminReserveFree={adminReserveFree}
          protocolBps={protocolBps}
          onSetLaunchFee={onSetLaunchFee}
          onSetProtocolBps={onSetProtocolBps}
          protocolSink={protocolSink}
          onSetProtocolSink={onSetProtocolSink}
          liveGenesis={liveGenesisPkg}
          onSetGenesis={onSetGenesis}
          factoryTreasuryUgnot={factoryTreasuryUgnot}
          onWithdraw={onWithdraw}
        />
      ) : null}
    </section>
  );
}

function InventoryChart({
  drops,
  listedBySlug,
}: {
  drops: ChainCollection[];
  listedBySlug: Map<string, Item[]>;
}) {
  const rows = drops.slice(0, 12).map((col) => {
    const minted = Math.max(0, col.minted || col.count || 0);
    const listedN = listedBySlug.get(col.slug)?.length || 0;
    return { slug: col.slug, name: col.name, minted, listedN };
  });
  const max = Math.max(1, ...rows.map((r) => Math.max(r.minted, r.listedN)));
  return (
    <section className="panel admin-chart">
      <h2>Inventory mix</h2>
      <p className="hint">Minted vs open listings per collection. Not sales volume.</p>
      <ul className="admin-bars">
        {rows.map((row) => (
          <li key={row.slug}>
            <span className="admin-bar-label" title={row.name}>
              {row.slug}
            </span>
            <div className="admin-bar-track" aria-hidden>
              <span className="admin-bar is-minted" style={{ width: `${(row.minted / max) * 100}%` }} />
              <span className="admin-bar is-listed" style={{ width: `${(row.listedN / max) * 100}%` }} />
            </div>
            <span className="muted num">
              {row.listedN}/{row.minted || 0}
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">Blue = minted · brighter = listed</p>
    </section>
  );
}

function Kpi({ label, value, ugnot }: { label: string; value?: string; ugnot?: number }) {
  return (
    <div className="admin-kpi">
      <dt>{label}</dt>
      <dd>{ugnot != null && ugnot > 0 ? <PriceMark ugnot={ugnot} /> : value}</dd>
    </div>
  );
}

function WhitelistPanel({
  rows,
  count,
  cap,
  error,
  busy,
  onSeed,
  onPatch,
  onRemove,
}: {
  rows: WlistRow[];
  count: number;
  cap: number;
  error: string;
  busy: boolean;
  onSeed?: (blob: string) => void;
  onPatch?: (patch: { address: string; handle?: string; newAddress?: string }) => void;
  onRemove?: (address: string) => void;
}) {
  const stamp = new Date().toISOString().slice(0, 10);
  const [seedBlob, setSeedBlob] = useState("");
  const [editAddr, setEditAddr] = useState("");
  const [editG1, setEditG1] = useState("");
  const [editHandle, setEditHandle] = useState("");
  return (
    <div className="admin-overview">
      <div className="admin-kpi-grid">
        <Kpi label="Slots" value={`${count}/${cap}`} />
        <Kpi label="Remaining" value={String(Math.max(0, cap - count))} />
      </div>
      <div className="admin-fee-grid">
        <section className="panel admin-fee-card">
          <h2>Add wallets</h2>
          <p className="hint">
            One g1 per line. Seeded wallets bind an X handle from 5 hours before 00:00 UTC 28 Sep. Remaining slots fill
            FCFS after open.
          </p>
          <label>
            g1 addresses
            <textarea value={seedBlob} onChange={(e) => setSeedBlob(e.target.value)} rows={6} spellCheck={false} />
          </label>
          <button
            className="btn primary"
            type="button"
            disabled={busy || !onSeed || !seedBlob.trim()}
            onClick={() => onSeed?.(seedBlob)}
          >
            Add to whitelist
          </button>
        </section>
        <section className="panel admin-fee-card">
          <h2>Export</h2>
          <p className="hint">CSV and JSON of the current list, including empty handles.</p>
          <div className="admin-wlist-actions">
            <button
              className="btn primary"
              type="button"
              disabled={rows.length < 1}
              onClick={() => downloadText(`bazaar-whitelist-${stamp}.csv`, wlistCsv(rows), "text/csv")}
            >
              Download CSV
            </button>
            <button
              className="btn"
              type="button"
              disabled={rows.length < 1}
              onClick={() =>
                downloadText(`bazaar-whitelist-${stamp}.json`, JSON.stringify(rows, null, 2) + "\n", "application/json")
              }
            >
              Download JSON
            </button>
          </div>
        </section>
      </div>
      {error ? <p className="hint">{error}</p> : null}
      <section className="panel admin-fee-card">
        <h2>Entries</h2>
        {rows.length < 1 ? (
          <EmptyState title="No wallets yet" body="Add g1 addresses here, or wait for public submit after open." />
        ) : (
          <div className="market-table-wrap">
            <table className="market-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Wallet</th>
                  <th>X handle</th>
                  <th>UTC</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.address}>
                    <td className="num">{row.place}</td>
                    <td>
                      {editAddr === row.address ? (
                        <input
                          value={editG1}
                          onChange={(e) => setEditG1(e.target.value)}
                          spellCheck={false}
                          aria-label="Wallet"
                        />
                      ) : (
                        <CopyLine variant="row" label="g1" display={shortAddr(row.address)} value={row.address} />
                      )}
                    </td>
                    <td>
                      {editAddr === row.address ? (
                        <input
                          value={editHandle}
                          onChange={(e) => setEditHandle(e.target.value)}
                          spellCheck={false}
                          placeholder="@handle"
                          aria-label="X handle"
                        />
                      ) : (
                        <span className="mono">{row.handle ? `@${row.handle}` : "—"}</span>
                      )}
                    </td>
                    <td className="mono muted">{row.at.slice(0, 16).replace("T", " ")}</td>
                    <td>
                      <div className="admin-wlist-actions">
                        {editAddr === row.address ? (
                          <>
                            <button
                              className="btn primary"
                              type="button"
                              disabled={busy || !onPatch}
                              onClick={() => {
                                onPatch?.({ address: row.address, handle: editHandle, newAddress: editG1 });
                                setEditAddr("");
                              }}
                            >
                              Save
                            </button>
                            <button className="btn" type="button" onClick={() => setEditAddr("")}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn"
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setEditAddr(row.address);
                                setEditG1(row.address);
                                setEditHandle(row.handle || "");
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn"
                              type="button"
                              disabled={busy || !onRemove}
                              onClick={() => onRemove?.(row.address)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FeesPanel({
  blocked,
  busy,
  factoryPkg,
  launchFeeUgnot,
  adminReserveFree = false,
  protocolBps,
  onSetLaunchFee,
  onSetProtocolBps,
  protocolSink,
  onSetProtocolSink,
  liveGenesis = "",
  onSetGenesis,
  factoryTreasuryUgnot,
  onWithdraw,
}: {
  blocked: boolean;
  busy: boolean;
  factoryPkg: string;
  launchFeeUgnot: number;
  adminReserveFree?: boolean;
  protocolBps: number;
  onSetLaunchFee: (ugnot: number) => void;
  onSetProtocolBps: (pkg: string, bps: number) => void;
  protocolSink: string;
  onSetProtocolSink?: (addr: string) => void;
  liveGenesis?: string;
  onSetGenesis?: (pkg: string) => void;
  factoryTreasuryUgnot: number;
  onWithdraw?: () => void;
}) {
  const [feeGnot, setFeeGnot] = useState(String(launchFeeUgnot / UGNOT));
  const [sink, setSink] = useState(protocolSink);
  const [genesisPkg, setGenesisPkg] = useState(liveGenesis);
  const [bps, setBps] = useState(String(protocolBps));
  useEffect(() => {
    setFeeGnot(String(launchFeeUgnot / UGNOT));
  }, [launchFeeUgnot]);
  useEffect(() => {
    setBps(String(protocolBps));
  }, [protocolBps]);
  useEffect(() => {
    setSink(protocolSink);
  }, [protocolSink]);
  useEffect(() => {
    setGenesisPkg(liveGenesis);
  }, [liveGenesis]);
  const feeNum = Number(feeGnot);
  const bpsNum = Math.round(Number(bps) || 0);
  const feeDirty = Number.isFinite(feeNum) && Math.round(feeNum * UGNOT) !== launchFeeUgnot;
  const bpsDirty = bpsNum !== protocolBps;
  return (
    <div className="admin-fee-grid">
      <section className="panel admin-fee-card">
        <h2>Treasury</h2>
        <p className="hint">
          New collections send protocol Buy fees to the protocol sink (deploy wallet by default). Withdraw still
          sends leftover LaunchFees on the factory (minus open Reserve locks) to admin.
        </p>
        <p className="admin-treasury">
          {factoryTreasuryUgnot > 0 ? <PriceMark ugnot={factoryTreasuryUgnot} /> : "0 GNOT"}
        </p>
        <p className="hint">Bank balance of the factory realm. Withdrawable is this amount minus locked reserves.</p>
        <button
          className="btn primary"
          type="button"
          disabled={blocked || busy || !onWithdraw || factoryTreasuryUgnot <= 0}
          onClick={() => onWithdraw?.()}
        >
          Withdraw to deploy wallet
        </button>
      </section>
      <section className="panel admin-fee-card">
        <h2>Create fee</h2>
        <p className="hint">
          {adminReserveFree
            ? `Live ${launchFeeUgnot / UGNOT} GNOT for other wallets. This wallet reserves with an empty send.`
            : `Live ${launchFeeUgnot / UGNOT} GNOT. Every wallet, including this one, pays this fee on the current factory.`}{" "}
          CancelReserve refunds the locked amount.
        </p>
        <label>
          Fee (GNOT)
          <input value={feeGnot} onChange={(e) => setFeeGnot(e.target.value)} inputMode="decimal" />
        </label>
        <button
          className="btn primary"
          type="button"
          disabled={blocked || busy || !feeDirty || !Number.isFinite(feeNum) || feeNum < 0}
          onClick={() => onSetLaunchFee(Math.round(feeNum * UGNOT))}
        >
          Update create fee
        </button>
      </section>
      <section className="panel admin-fee-card">
        <h2>Protocol take</h2>
        <p className="hint">
          Live {protocolBps} bps ({protocolBps / 100}%). Magic Eden 2%. Cap 500 bps. Collections read this on Buy.
        </p>
        <label>
          Protocol bps ({bpsNum / 100}%)
          <input value={bps} onChange={(e) => setBps(e.target.value)} inputMode="numeric" />
        </label>
        <button
          className="btn primary"
          type="button"
          disabled={blocked || busy || !bpsDirty || !factoryPkg || bpsNum < 0 || bpsNum > 500}
          onClick={() => onSetProtocolBps(factoryPkg, bpsNum)}
        >
          Update protocol bps
        </button>
      </section>
      <section className="panel admin-fee-card">
        <h2>Protocol sink</h2>
        <p className="hint">
          89% of protocol take on new-col Buys goes here. 11% goes to the Bazaar Gens realm. Init sets this to the
          deploy wallet. Admin can change it.
        </p>
        <label>
          g1 address
          <input value={sink} onChange={(e) => setSink(e.target.value)} spellCheck={false} placeholder="g1…" />
        </label>
        <button
          className="btn primary"
          type="button"
          disabled={blocked || busy || !onSetProtocolSink || !factoryPkg || sink.trim() === protocolSink}
          onClick={() => onSetProtocolSink?.(sink.trim())}
        >
          Update sink
        </button>
      </section>
      <section className="panel admin-fee-card">
        <h2>Bazaar Gens</h2>
        <p className="hint">
          Optional. Leave empty until Bazaar Gens is addpkg’d. Init of Bazaar Gens with the deploy wallet auto-attaches.
          Or paste the realm path here to enable 11% share + holder discounts on new collections.
        </p>
        <label>
          Package path
          <input
            value={genesisPkg}
            onChange={(e) => setGenesisPkg(e.target.value)}
            spellCheck={false}
            placeholder="gno.land/r/…/bazaar/genesis"
          />
        </label>
        <button
          className="btn primary"
          type="button"
          disabled={blocked || busy || !onSetGenesis || !factoryPkg || genesisPkg.trim() === liveGenesis}
          onClick={() => onSetGenesis?.(genesisPkg.trim())}
        >
          Attach Bazaar Gens
        </button>
      </section>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { parseEvalAddress, parseEvalBool, parseEvalInt, parseEvalString, parseIds, parseItems } from "../lib/chain";
import { ITEM_LINE_WAVE } from "../lib/itembook";
import { claimFromLedger, claimFromPkg, parseLedgerInt, parseWalletGet, ugnotNumber, walletGetAbsent } from "../lib/perkclaim";
import { backlogUnassigned, holderNeedsSync, syncableIds } from "../lib/perksync";
import {
  LEGACY_PERK_PKG,
  LEGACY_PERK_SINK,
  REWARD_EXAMPLE_UGNOT,
  bpsPercent,
  countRevealedHold,
  discountTier,
  feeSaved,
  claimShareLine,
  formatRewardGnot,
  formatRewardGnotExact,
  formatUgnot,
  holderEligible,
  holderNotice,
  parsePerkRender,
  rewardDiscountBps,
  rewardWeight,
  samePkg,
  showLegacyClaim,
  type HoldRow,
  type RewardDesk,
} from "../lib/rewards";
import { evalExpr, queryAbci, readBankUgnot } from "../lib/wallets";

type Props = {
  rpc: string;
  factory: string;
  address: string;
  collection: string;
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  onConnect: () => void;
  onClaim: (pkg: string) => Promise<boolean>;
  onSync: (pkg: string, ids: number[]) => Promise<boolean>;
  preview?: RewardDesk;
};

const emptyDesk = (): RewardDesk => ({
  protocolBps: 0,
  shareBps: 0,
  perkPkg: "",
  discountBps: 0,
  perkDiscountBps: 0,
  weight: 0,
  totalWeight: 0,
  accountedUgnot: 0,
  held: 0,
  sealed: false,
  countedBps: 0,
  countedWeight: 0,
  countedNfts: 0,
  poolUgnot: 0,
  claimUgnot: 0,
  epoch: false,
  unsettledUgnot: 0,
  epochs: 0,
  legacyPkg: "",
  legacyClaimUgnot: 0,
  syncIds: [],
});

async function readLegacyClaimUgnot(rpc: string, owner: string): Promise<number> {
  const quoted = JSON.stringify(owner);
  const [weightRaw, renderRaw, accRaw, walletRaw] = await Promise.all([
    evalExpr(rpc, LEGACY_PERK_PKG, "TotalWeight()"),
    evalExpr(rpc, LEGACY_PERK_PKG, 'Render("")'),
    evalExpr(rpc, LEGACY_PERK_PKG, "acc"),
    evalExpr(rpc, LEGACY_PERK_PKG, `wallets.Get(${quoted})`),
  ]);
  const rendered = parsePerkRender(renderRaw);
  const totalWeight = parseEvalInt(weightRaw) || rendered.totalWeight;
  const balance = await readBankUgnot(rpc, LEGACY_PERK_SINK);
  if (balance == null) throw new Error("legacy pool unread");
  const pool = Math.max(balance, rendered.accountedUgnot);
  const coins = BigInt(Math.max(0, Math.trunc(pool)));
  const wallet = parseWalletGet(walletRaw);
  if (wallet || walletGetAbsent(walletRaw)) {
    return ugnotNumber(
      claimFromLedger({
        balance: coins,
        accounted: BigInt(Math.max(0, Math.trunc(rendered.accountedUgnot))),
        totalWeight: BigInt(Math.max(0, Math.trunc(totalWeight))),
        acc: parseLedgerInt(accRaw),
        wallet,
      }),
    );
  }
  const pkgJson = await queryAbci(rpc, "vm/qpkg_json", LEGACY_PERK_PKG);
  const claim = await claimFromPkg(pkgJson, owner, coins, (oid) =>
    queryAbci(rpc, "vm/qobject_json", oid).then((raw) => JSON.parse(raw) as unknown),
  );
  return ugnotNumber(claim);
}

export function RewardsPage({
  rpc,
  factory,
  address,
  collection,
  connected,
  blocked,
  busy,
  onConnect,
  onClaim,
  onSync,
  preview,
}: Props) {
  const [desk, setDesk] = useState<RewardDesk>(preview ?? emptyDesk());
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const holdAt = useRef(0);

  useEffect(() => {
    if (preview) {
      setDesk(preview);
      setLoading(false);
      return;
    }
    let live = true;
    let inflight = false;
    const load = async (quiet: boolean) => {
      if (!live || inflight) return;
      if (quiet && document.visibilityState === "hidden") return;
      inflight = true;
      if (!quiet) {
        setLoading(true);
        setError("");
      }
      try {
        const [bpsRaw, shareRaw, pkgRaw, hiddenRaw, balRaw] = await Promise.all([
          evalExpr(rpc, factory, "ProtocolBps()"),
          evalExpr(rpc, factory, "GenesisShareBps()"),
          evalExpr(rpc, factory, "GenesisPkg()"),
          collection ? evalExpr(rpc, collection, "Hidden()").catch(() => "") : Promise.resolve(""),
          address && collection
            ? evalExpr(rpc, collection, `GrcBalanceOf(${JSON.stringify(address)})`).catch(() => "0")
            : Promise.resolve("0"),
        ]);
        const perkPkg = parseEvalString(pkgRaw);
        const next = emptyDesk();
        next.protocolBps = parseEvalInt(bpsRaw);
        next.shareBps = parseEvalInt(shareRaw);
        next.perkPkg = perkPkg;
        next.sealed = parseEvalBool(hiddenRaw);
        next.held = parseEvalInt(balRaw);
        if (perkPkg) {
          const [weightRaw, renderRaw] = await Promise.all([
            evalExpr(rpc, perkPkg, "TotalWeight()"),
            evalExpr(rpc, perkPkg, 'Render("")'),
          ]);
          const rendered = parsePerkRender(renderRaw);
          next.totalWeight = parseEvalInt(weightRaw) || rendered.totalWeight;
          next.accountedUgnot = rendered.accountedUgnot;
          if (rendered.unsettledUgnot != null) {
            next.epoch = true;
            next.unsettledUgnot = rendered.unsettledUgnot;
            next.epochs = rendered.epochs ?? 0;
          }
        }
        if (address && perkPkg) {
          const quoted = JSON.stringify(address);
          const [discRaw, shareWRaw, factoryDiscRaw] = await Promise.all([
            evalExpr(rpc, perkPkg, `FeeDiscount(${quoted})`),
            evalExpr(rpc, perkPkg, `ShareWeight(${quoted})`),
            evalExpr(rpc, factory, `HolderDiscount(${quoted})`).catch(() => "0"),
          ]);
          next.perkDiscountBps = parseEvalInt(discRaw);
          next.weight = parseEvalInt(shareWRaw);
          next.discountBps = parseEvalInt(factoryDiscRaw);
        }
        const recount = !quiet || Date.now() - holdAt.current > 20_000;
        let countedOk = false;
        if (next.sealed) {
          countedOk = true;
        } else if (address && collection && recount) {
          try {
            const ids = parseIds(await evalExpr(rpc, collection, `TokensOf(${JSON.stringify(address)})`));
            const rows: HoldRow[] = [];
            const held: { id: string; rarity: string; revealed: boolean; listed: boolean }[] = [];
            for (let i = 0; i < ids.length && live; i += ITEM_LINE_WAVE) {
              const wave = ids.slice(i, i + ITEM_LINE_WAVE);
              const got = await Promise.all(
                wave.map(async (id) => {
                  try {
                    return parseItems(await evalExpr(rpc, collection, `ItemLine(${Number(id)})`))[0] ?? null;
                  } catch {
                    return null;
                  }
                }),
              );
              for (const row of got) {
                if (!row) continue;
                rows.push({ rarity: row.rarity, revealed: row.revealed, listed: row.listed });
                held.push({ id: row.id, rarity: row.rarity, revealed: row.revealed, listed: row.listed });
              }
            }
            const counted = countRevealedHold(rows);
            next.countedBps = counted.discountBps;
            next.countedWeight = counted.weight;
            next.countedNfts = counted.counted;
            next.syncIds = syncableIds(held);
            countedOk = true;
            holdAt.current = Date.now();
          } catch {
            /* Keep the previous NFT count. Perk numbers above still render. */
          }
        }
        let poolRead: number | null = null;
        let claimRead: number | null = null;
        let legacyRead: number | null = null;
        if (perkPkg) {
          const unsettledRaw = await evalExpr(rpc, perkPkg, "Unsettled()").catch(() => "");
          if (unsettledRaw && !/error|panic|undefined/i.test(unsettledRaw)) {
            next.epoch = true;
            next.unsettledUgnot = ugnotNumber(parseLedgerInt(unsettledRaw));
            const epochsRaw = await evalExpr(rpc, perkPkg, "Epochs()").catch(() => "");
            if (epochsRaw && !/error|panic|undefined/i.test(epochsRaw)) {
              next.epochs = ugnotNumber(parseLedgerInt(epochsRaw));
            }
          }
          try {
            const sink = parseEvalAddress(await evalExpr(rpc, factory, "GenesisSink()"));
            const balance = sink ? await readBankUgnot(rpc, sink) : 0;
            if (balance == null) throw new Error("pool balance unread");
            const pool = Math.max(balance, next.accountedUgnot);
            poolRead = pool;
            if (address) {
              const quoted = JSON.stringify(address);
              if (next.epoch) {
                const claimRaw = await evalExpr(rpc, perkPkg, `Claimable(${quoted})`);
                claimRead = ugnotNumber(parseLedgerInt(claimRaw));
              } else {
                const coins = BigInt(Math.max(0, Math.trunc(pool)));
                let claim: bigint | null = null;
                try {
                  const [accRaw, walletRaw] = await Promise.all([
                    evalExpr(rpc, perkPkg, "acc"),
                    evalExpr(rpc, perkPkg, `wallets.Get(${quoted})`),
                  ]);
                  const wallet = parseWalletGet(walletRaw);
                  if (wallet || walletGetAbsent(walletRaw)) {
                    claim = claimFromLedger({
                      balance: coins,
                      accounted: BigInt(Math.max(0, Math.trunc(next.accountedUgnot))),
                      totalWeight: BigInt(Math.max(0, Math.trunc(next.totalWeight))),
                      acc: parseLedgerInt(accRaw),
                      wallet,
                    });
                  }
                } catch {
                  claim = null;
                }
                if (claim == null) {
                  const pkgJson = await queryAbci(rpc, "vm/qpkg_json", perkPkg);
                  claim = await claimFromPkg(pkgJson, address, coins, (oid) =>
                    queryAbci(rpc, "vm/qobject_json", oid).then((raw) => JSON.parse(raw) as unknown),
                  );
                }
                claimRead = ugnotNumber(claim);
              }
            } else {
              claimRead = 0;
            }
          } catch {
            /* Keep the previous pool and claim. */
          }
          if (next.epoch && address && !samePkg(perkPkg, LEGACY_PERK_PKG)) {
            try {
              legacyRead = await readLegacyClaimUgnot(rpc, address);
            } catch {
              legacyRead = null;
            }
          } else {
            legacyRead = 0;
          }
        }
        if (!live) return;
        setDesk((prev) => {
          if (!countedOk) {
            next.countedBps = prev.countedBps;
            next.countedWeight = prev.countedWeight;
            next.countedNfts = prev.countedNfts;
            next.syncIds = prev.syncIds;
          }
          next.poolUgnot = poolRead == null ? prev.poolUgnot : poolRead;
          next.claimUgnot = claimRead == null ? prev.claimUgnot : claimRead;
          next.legacyClaimUgnot = legacyRead == null ? prev.legacyClaimUgnot : legacyRead;
          next.legacyPkg = next.epoch && !samePkg(next.perkPkg, LEGACY_PERK_PKG) ? LEGACY_PERK_PKG : "";
          return next;
        });
        setError("");
      } catch (e) {
        if (!live || quiet) return;
        setError(e instanceof Error ? e.message : "Could not read the perk realm.");
      } finally {
        inflight = false;
        if (live && !quiet) setLoading(false);
      }
    };
    void load(false);
    const id = window.setInterval(() => void load(true), 4000);
    const wake = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      live = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [preview, rpc, factory, collection, address, reload]);

  const exampleBps = rewardDiscountBps(desk);
  const weightShown = rewardWeight(desk);
  const countedOnly = connected && desk.discountBps <= 0 && desk.countedBps > 0;
  const usingCountedWeight = connected && desk.weight <= 0 && desk.countedWeight > 0;
  const view = feeSaved(REWARD_EXAMPLE_UGNOT, desk.protocolBps, exampleBps);
  const buyTier = discountTier(desk.discountBps);
  const perkTier = discountTier(desk.perkDiscountBps);
  const countedTier = discountTier(desk.countedBps);
  const syncIds = desk.syncIds ?? [];
  const showSync = holderNeedsSync({ ...desk, syncIds });
  const backlog = !desk.epoch && backlogUnassigned(desk.totalWeight, desk.poolUgnot, desk.accountedUgnot);
  const legacy = showLegacyClaim(desk.perkPkg, desk.legacyPkg, desk.legacyClaimUgnot);
  const syncLead = desk.epoch
    ? "Sync records a revealed NFT you hold. An admin Settle splits the unsettled pool. Then Claim pays this wallet."
    : "Sync records a revealed NFT you hold. Then Claim pays that weight.";
  const poolNote = desk.epoch
    ? "Sync records weight only. The unsettled pool stays unsplit until an admin Settle."
    : "Sync records your revealed NFTs. The GNOT already in the pool is claimable by the first wallet recorded.";
  const exampleGnot = formatRewardGnot(REWARD_EXAMPLE_UGNOT);
  const discountApplies = connected && exampleBps > 0;
  const eligible = holderEligible(desk);
  const notice = holderNotice(desk, connected);
  const shownTier = discountApplies ? discountTier(exampleBps) : "";
  const tier = tierKey(discountApplies ? exampleBps : 0);
  const showCounted = connected && (desk.countedBps > 0 || desk.countedNfts > 0);

  return (
    <section className="page rewards-page">
      <header className="page-head rewards-head">
        <p className="explore-kicker">Bazaar Gens</p>
        <h1>Rewards</h1>
        <p className="rewards-lead">
          Holder discount and pool share on a secondary sale. The buyer still pays the full list price. This is not the
          mint price.
        </p>
      </header>

      {error ? <p className="notice err">{error}</p> : null}
      {loading ? <p className="muted">Reading rewards…</p> : null}

      {loading || !connected ? null : (
        <p
          className={eligible ? "rewards-eligible" : "rewards-eligible is-no"}
          role="status"
          data-eligible={eligible ? "yes" : "no"}
          data-held={desk.held}
          data-counted={desk.countedBps}
          data-counted-weight={desk.countedWeight}
        >
          {notice}
        </p>
      )}

      {loading ? null : (
        <>
          {connected && showSync ? (
            <section className="rewards-nfts" aria-label="Your NFTs">
              <div className="rewards-nfts-head">
                <h2>Your NFTs</h2>
                <p>{syncLead}</p>
              </div>
              <ul className="rewards-nft-list">
                {syncIds.map((id) => (
                  <li key={id}>
                    <span>Bazaar Gens #{id}</span>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={blocked || busy || !desk.perkPkg}
                      onClick={() => {
                        void onSync(desk.perkPkg, [id]).then((ok) => {
                          if (ok) setReload((n) => n + 1);
                        });
                      }}
                    >
                      {busy ? "Syncing…" : "Sync NFT"}
                    </button>
                  </li>
                ))}
              </ul>
              {backlog || (desk.epoch && showSync) ? <p className="rewards-note">{poolNote}</p> : null}
            </section>
          ) : null}
          <div className="rewards-board">
            <article className="rewards-stat" data-tier={tier || undefined} aria-label="Protocol fee on a secondary sale">
              <p className="rewards-kicker">
                {countedOnly ? "Protocol fee this discount skips" : discountApplies ? "Protocol fee skipped" : "Protocol fee"}
              </p>
              <h2 className="rewards-num">{discountApplies ? bpsPercent(exampleBps) : bpsPercent(desk.protocolBps)}</h2>
              <p className="rewards-unit">{shownTier || "Before a holder discount"}</p>
              <p className="rewards-line" data-saved={view.saved} data-charged={view.charged}>
                {countedOnly
                  ? `On a ${exampleGnot} GNOT sale the fee is ${formatRewardGnot(view.full)} GNOT, then ${formatRewardGnot(view.charged)} GNOT. The seller receives ${formatRewardGnot(view.saved)} GNOT more.`
                  : discountApplies
                    ? `On a ${exampleGnot} GNOT sale the seller receives ${formatRewardGnot(view.saved)} GNOT more.`
                    : connected
                      ? `A ${exampleGnot} GNOT sale still charges the full ${formatRewardGnot(view.full)} GNOT protocol fee.`
                      : `Connect Adena to read this wallet. On a ${exampleGnot} GNOT sale the protocol fee is ${formatRewardGnot(view.full)} GNOT.`}
              </p>
              <dl className="rewards-meta">
                <div>
                  <dt>Protocol fee</dt>
                  <dd>{bpsPercent(desk.protocolBps)}</dd>
                </div>
                <div>
                  <dt>Buy uses</dt>
                  <dd>
                    {connected ? bpsPercent(desk.discountBps) : "—"}
                    {connected && buyTier ? ` · ${buyTier}` : ""}
                  </dd>
                </div>
                {showCounted ? (
                  <div>
                    <dt>Counted</dt>
                    <dd>
                      {bpsPercent(desk.countedBps)}
                      {countedTier ? ` · ${countedTier}` : ""}
                      {` · ${desk.countedNfts.toLocaleString("en-US")} ${desk.countedNfts === 1 ? "NFT" : "NFTs"}`}
                    </dd>
                  </div>
                ) : null}
                {connected && desk.perkDiscountBps > 0 ? (
                  <div>
                    <dt>Perk record</dt>
                    <dd>
                      {bpsPercent(desk.perkDiscountBps)}
                      {perkTier ? ` · ${perkTier}` : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {connected && desk.countedBps > 0 && desk.countedBps !== desk.discountBps ? (
                <p className="rewards-note">Sync writes the counted discount onto the factory.</p>
              ) : connected && desk.perkPkg && desk.perkDiscountBps !== desk.discountBps ? (
                <p className="rewards-note">
                  Perk record {bpsPercent(desk.perkDiscountBps)}. Buy is still using {bpsPercent(desk.discountBps)}. Sync
                  writes the perk figure onto the factory.
                </p>
              ) : null}
            </article>

            <article className="rewards-stat rewards-stat-share" aria-label="Pool">
              <p className="rewards-kicker">Pool</p>
              <h2 className="rewards-num" data-pool={desk.poolUgnot} data-unsettled={desk.epoch ? desk.unsettledUgnot : undefined}>
                {desk.epoch ? formatRewardGnotExact(desk.unsettledUgnot) : formatRewardGnot(desk.poolUgnot)}
              </h2>
              <p className="rewards-unit">{desk.epoch ? "GNOT unsettled" : "GNOT from secondary sales"}</p>
              <div className="rewards-claim">
                <p className="rewards-kicker">You can claim</p>
                <p className="rewards-claim-num" data-claim={connected ? desk.claimUgnot : undefined}>
                  {connected ? `${formatRewardGnotExact(desk.claimUgnot)} GNOT` : "—"}
                </p>
                {connected ? (
                  <p className="rewards-claim-ugnot" data-claim-ugnot={desk.claimUgnot}>
                    {formatUgnot(desk.claimUgnot)} ugnot
                  </p>
                ) : null}
                <p className="rewards-line">
                  {connected
                    ? claimShareLine({
                        claimUgnot: desk.claimUgnot,
                        weight: desk.weight,
                        totalWeight: desk.totalWeight,
                        countedWeight: desk.countedWeight,
                        countedNfts: desk.countedNfts,
                        usingCounted: usingCountedWeight,
                        epoch: desk.epoch,
                        unsettledUgnot: desk.unsettledUgnot,
                        epochs: desk.epochs,
                      })
                    : "Connect Adena to read this wallet's Share weight. The figure above is the pool total, not a personal balance."}
                </p>
              </div>
              <dl className="rewards-meta">
                <div>
                  <dt>Pool rate</dt>
                  <dd>{bpsPercent(desk.shareBps)} after the holder discount</dd>
                </div>
                <div>
                  <dt>{usingCountedWeight ? "Counted weight" : "Your weight"}</dt>
                  <dd>{connected ? weightShown.toLocaleString("en-US") : "—"}</dd>
                </div>
                <div>
                  <dt>Pool weight</dt>
                  <dd>{desk.totalWeight.toLocaleString("en-US")}</dd>
                </div>
                <div>
                  <dt>Accounted</dt>
                  <dd>{formatRewardGnot(desk.accountedUgnot)} GNOT</dd>
                </div>
                {desk.epoch ? (
                  <div>
                    <dt>Epochs</dt>
                    <dd>{desk.epochs.toLocaleString("en-US")}</dd>
                  </div>
                ) : null}
              </dl>
              {connected ? (
                <div className="rewards-actions">
                  {showSync ? (
                    <button
                      className={desk.claimUgnot > 0 ? "btn" : "btn primary"}
                      type="button"
                      disabled={blocked || busy || !desk.perkPkg}
                      onClick={() => {
                        void onSync(desk.perkPkg, syncIds).then((ok) => {
                          if (ok) setReload((n) => n + 1);
                        });
                      }}
                    >
                      {busy ? "Syncing…" : `Sync ${syncIds.length === 1 ? "1 NFT" : `${syncIds.length} NFTs`}`}
                    </button>
                  ) : null}
                  <button
                    className="btn primary"
                    type="button"
                    disabled={blocked || busy || !desk.perkPkg || desk.claimUgnot <= 0}
                    onClick={() => {
                      void onClaim(desk.perkPkg).then((ok) => {
                        if (ok) setReload((n) => n + 1);
                      });
                    }}
                  >
                    {busy ? "Claiming…" : "Claim"}
                  </button>
                  {legacy ? (
                    <button
                      className="btn"
                      type="button"
                      data-legacy-claim={desk.legacyClaimUgnot}
                      disabled={blocked || busy || !desk.legacyPkg}
                      onClick={() => {
                        void onClaim(desk.legacyPkg).then((ok) => {
                          if (ok) setReload((n) => n + 1);
                        });
                      }}
                    >
                      {busy ? "Claiming…" : "Claim earlier pool"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <button className="btn primary" type="button" onClick={onConnect}>
                  Connect Adena
                </button>
              )}
              {connected && legacy ? (
                <p className="rewards-note" data-legacy-claim={desk.legacyClaimUgnot}>
                  Earlier pool pays this wallet {formatRewardGnotExact(desk.legacyClaimUgnot)} GNOT (
                  {formatUgnot(desk.legacyClaimUgnot)} ugnot).
                </p>
              ) : null}
              {connected && showSync && (backlog || desk.epoch) ? <p className="rewards-note">{poolNote}</p> : null}
            </article>
          </div>
          <ul className="rewards-rules">
            <li>The discount is your highest tier. Another NFT does not raise it.</li>
            <li>Share weight adds every minted, revealed NFT. An unminted launch slot adds nothing. It is not a count of NFTs.</li>
            <li>
              {desk.epoch
                ? "Sync after reveal, transfer, or list. An admin Settle splits the unsettled pool by recorded weight. Then Claim pays this wallet. A listed NFT adds nothing."
                : "Sync after reveal, transfer, or list. Then Claim pays the recorded weight. A listed NFT adds nothing."}
            </li>
          </ul>
        </>
      )}
    </section>
  );
}

function tierKey(bps: number): string {
  switch (bps) {
    case 150:
      return "mythic";
    case 125:
      return "legendary";
    case 100:
      return "epic";
    case 75:
      return "rare";
    case 50:
      return "uncommon";
    case 25:
      return "common";
    default:
      return "";
  }
}

import { useEffect, useState, type ReactNode } from "react";
import type { ChainCollection, DropSale } from "../lib/chain";
import { isDropMintPrice, isLaunchpadMint, isOpenEdition, isPublicDrop, parseTokenURI, shortAddr, shortPkgPath, socialHref, ugnotFromGnot } from "../lib/chain";
import {
  clampMintQty,
  countdownParts,
  formatRoundCountdown,
  mintButtonLabel,
  mintDesk,
  mintQtyLimit,
  mintQtyNote,
  mintRoundCards,
  previewDropSale,
  readLaunchDraft,
  roundVisibleCountdown,
  type MintAction,
  type MintQtyRound,
  type MintRoundCard,
  type PlannedWhitelist,
  type RoundCountdown,
} from "../lib/mintrounds";
import { CopyLine } from "./CopyLine";
import { EmptyState } from "./EmptyState";
import { ItemArt } from "./ItemArt";
import { PriceMark } from "./PriceMark";

type Props = {
  drop: ChainCollection | null;
  slug: string;
  loaded: number;
  hidden?: boolean;
  allowN: number;
  mintCap: number;
  mintWlCap?: number;
  mintPubCap?: number;
  /** Mints before the whitelist close. Keeps that bar still and rolls the rest into public. */
  wlMinted?: number;
  /** True after whitelist has ended and the close count is not in yet. */
  wlMintedPending?: boolean;
  sale?: DropSale | null;
  planned?: PlannedWhitelist | null;
  creator?: boolean;
  tokenURI?: string;
  connected: boolean;
  /** null until the collection answers OnAllowlist for this wallet. */
  allowlisted?: boolean | null;
  blocked: boolean;
  busy: boolean;
  /** Successful PublicMint calls this wallet already made in each round. */
  walletWl?: number;
  walletPub?: number;
  /** False while this connected wallet's round count is still loading. */
  mintCountReady?: boolean;
  /** False until the collection's schedule and per-wallet caps have loaded. */
  roundReady?: boolean;
  onMint: (priceUgnot: number, qty: number, round: MintQtyRound) => void;
  onSaveWhitelist?: (priceUgnot: number, qty: number) => void;
  onConnect: () => void;
  onOpenCollection: () => void;
  onOpenProfile?: () => void;
  onRevealCollection?: () => void;
  onBack: () => void;
  walletHint?: string;
  justMinted?: boolean;
};

export function MintPage({
  drop,
  slug,
  loaded,
  hidden,
  allowN,
  mintCap,
  mintWlCap = 0,
  mintPubCap = 0,
  wlMinted,
  wlMintedPending = false,
  sale,
  planned = null,
  creator = false,
  tokenURI = "",
  connected,
  allowlisted = null,
  blocked,
  busy,
  walletWl = 0,
  walletPub = 0,
  mintCountReady = true,
  roundReady = true,
  onMint,
  onSaveWhitelist,
  onConnect,
  onOpenCollection,
  onOpenProfile,
  onRevealCollection,
  onBack,
  walletHint = "",
  justMinted = false,
}: Props) {
  const [wlPriceText, setWlPriceText] = useState("");
  const nowSec = useNowSec();
  if (!drop || !isPublicDrop(drop)) {
    const draft = readLaunchDraft(slug);
    if (draft) {
      const now = nowSec;
      const sale = previewDropSale({ now, ...draft });
      const rounds = mintRoundCards({
        now,
        maxSupply: draft.supply,
        mintPrice: draft.mintPrice,
        sale,
        mintWlCap: draft.wlCap,
        mintPubCap: draft.pubCap,
        minted: 0,
      });
      return (
        <section className="page mint-page">
          <div className="toolbar">
            <button className="btn" type="button" onClick={onBack}>
              Back
            </button>
          </div>
          <p className="hint">
            Preview from Launch. This collection is not initialized, so these rounds are not on chain yet. Reserve and
            initialize to publish this page.
          </p>
          <div className="mint-hero">
            <div className="featured-cover mint-cover">
              <ItemArt name={draft.name || slug} image={draft.cover} alt="" priority />
            </div>
            <div className="mint-copy">
              <h1>{draft.name || slug}</h1>
              <MintRounds rounds={rounds} nowSec={nowSec} />
            </div>
          </div>
        </section>
      );
    }
    return (
      <section className="page">
        <header className="page-head">
          <h1>Mint</h1>
          <p className="muted">{slug || "Unknown drop"}</p>
        </header>
        <EmptyState
          title="Collection not live"
          body="This slug is not in the factory list yet. Reserve and initialize it on Launch. A realm that is only added stays off this page until Init."
        >
          <button className="btn" type="button" onClick={onBack}>
            Back
          </button>
        </EmptyState>
      </section>
    );
  }
  if (!isLaunchpadMint(drop)) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Mint</h1>
          <p className="muted">{drop.name || slug}</p>
        </header>
        <EmptyState
          title="Mint is not on Nomaq"
          body="This collection mints outside the launchpad. Secondary sales stay on the collection page."
        >
          <button className="btn primary" type="button" onClick={onOpenCollection}>
            Collection
          </button>
        </EmptyState>
      </section>
    );
  }
  const open = isOpenEdition(drop);
  const remaining = open ? 1 : Math.max(0, drop.maxSupply - drop.minted);
  const slotLeft = loaded > 0 ? Math.max(0, loaded - drop.minted) : remaining;
  const soldOut = loaded > 0 ? drop.minted >= loaded : !open && remaining <= 0;
  const paused = drop.paused;
  const links = [
    { href: socialHref(drop.website || ""), label: "Website" },
    { href: socialHref(drop.twitter || ""), label: "X" },
    { href: socialHref(drop.discord || ""), label: "Discord" },
  ].filter((row) => row.href);
  const mintedPct = drop.maxSupply > 0 ? Math.min(100, (drop.minted / drop.maxSupply) * 100) : 0;
  const royaltyBps = drop.royaltyBps ?? sale?.royaltyBps ?? 0;
  const token = tokenURI ? parseTokenURI(tokenURI) : null;
  const art = drop.cover;
  const pkg = drop.pkg || "";
  const shortPkg = pkg ? shortPkgPath(pkg) : drop.slug;
  const desk = mintDesk({
    now: nowSec,
    maxSupply: drop.maxSupply,
    mintPrice: drop.mintPrice,
    sale,
    mintWlCap,
    mintPubCap,
    planned,
    minted: drop.minted,
    wlMinted,
    wlMintedPending,
    paused,
    soldOut,
    connected,
    allowlisted,
  });
  const rounds = desk.cards;
  const mintRound: MintQtyRound =
    desk.action.kind === "countdown" || desk.sale?.phase === "whitelist" ? "whitelist" : "public";
  const supplyLeft =
    loaded > 0 ? Math.max(0, loaded - drop.minted) : drop.maxSupply > 0 ? Math.max(0, drop.maxSupply - drop.minted) : -1;
  const qtyLimit = mintQtyLimit({
    round: mintRound,
    wlCap: mintWlCap,
    pubCap: mintPubCap,
    mintCap,
    walletWl,
    walletPub,
    supplyLeft,
  });
  const roundCap = mintRound === "whitelist" ? mintWlCap : mintPubCap;
  const roundUsed = mintRound === "whitelist" ? walletWl : walletPub;
  const unsavedWl = rounds.some((round) => round.state === "unsaved");
  const canSaveWl = creator && unsavedWl && !!planned && planned.qty > 0 && !!onSaveWhitelist;
  const mintCall = (
    <MintCall
      action={desk.action}
      blocked={blocked}
      busy={busy}
      round={mintRound}
      qtyLimit={roundReady ? qtyLimit : 0}
      countReady={roundReady && mintCountReady}
      qtyNote={
        !roundReady
          ? "Checking this round."
          : !mintCountReady
            ? "Checking this wallet's mints."
            : mintQtyNote({ limit: qtyLimit, roundCap, used: roundUsed })
      }
      onMint={onMint}
      onConnect={onConnect}
    />
  );

  return (
    <section className="page mint-page">
      <div className="toolbar">
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
        <button className="btn" type="button" onClick={onOpenCollection}>
          Collection
        </button>
      </div>
      <div className="mint-hero">
        <div className="featured-cover mint-cover">
          <ItemArt name={token?.name || drop.name} image={art} alt="" priority />
        </div>
        <div className="mint-copy">
          <h1>
            {drop.name}
            {paused ? <span className="tag">Paused</span> : null}
          </h1>
          {drop.bio ? <p className="collection-bio">{drop.bio}</p> : null}
          {links.length > 0 ? (
            <p className="collection-socials">
              {links.map((row) => (
                <a key={row.label} href={row.href} target="_blank" rel="noreferrer">
                  {row.label}
                </a>
              ))}
            </p>
          ) : null}
          {rounds.length > 0 ? (
            <MintRounds rounds={rounds} nowSec={nowSec} callFor={mintRound} call={mintCall} />
          ) : (
            mintCall
          )}
          {unsavedWl ? (
            <p className="hint">
              This whitelist is from the launch pack. It is not saved on the collection, so mint still uses the public price.
            </p>
          ) : null}
          {canSaveWl ? (
            <div className="mint-wl-save">
              <label>
                Whitelist price (GNOT)
                <input
                  value={wlPriceText}
                  onChange={(e) => setWlPriceText(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 0.5"
                />
                <span className="hint">0 is a free whitelist mint. Saving writes {planned?.qty} at this price. The pack open time is not a chain clock.</span>
              </label>
              <button
                className="btn"
                type="button"
                disabled={blocked || busy || !isDropMintPrice(wlPriceText)}
                onClick={() => onSaveWhitelist?.(ugnotFromGnot(wlPriceText), planned?.qty || 0)}
              >
                Save whitelist round
              </button>
            </div>
          ) : null}
          <dl className="featured-stats mint-facts">
            <div>
              <dt>Remaining</dt>
              <dd className="num">
                {open ? `${drop.minted} minted · open` : `${slotLeft}/${drop.maxSupply}`}
              </dd>
            </div>
            <div>
              <dt>Creator</dt>
              <dd className="mono">{shortAddr(drop.creator)}</dd>
            </div>
            {royaltyBps > 0 ? (
              <div>
                <dt>Royalty</dt>
                <dd className="num">{royaltyBps / 100}%</dd>
              </div>
            ) : null}
          </dl>
          {rounds.length === 0 ? (
            <div
              className="drop-progress"
              role="progressbar"
              aria-valuenow={drop.minted}
              aria-valuemax={drop.maxSupply}
              aria-label="Minted"
            >
              <div className="drop-progress-bar" style={{ width: `${mintedPct}%` }} />
            </div>
          ) : null}
          {hidden ? (
            <div className="mint-wallet-note">
              <p>
                Sealed. Reveal opens every minted NFT in one signature. Names and art replace Unrevealed.
                {(drop.minted || 0) < 1
                  ? " Nothing is minted yet, so reveal also publishes the slot list."
                  : ""}
              </p>
              {creator && connected ? (
                <button
                  className="btn primary"
                  type="button"
                  disabled={blocked || busy || loaded < 1 || !onRevealCollection}
                  onClick={() => onRevealCollection?.()}
                >
                  Reveal collection
                </button>
              ) : !connected ? (
                <p>Connect the creator wallet to reveal.</p>
              ) : null}
            </div>
          ) : null}
          <p className="hint">
            {loaded > 0
              ? hidden
                ? "You receive Unrevealed. Art and traits stay hidden until the creator reveals the collection. Primary mint is 0 bps — GNOT goes to the creator."
                : `${loaded} unique slots loaded in file order. Primary mint is 0 bps — GNOT goes to the creator.`
              : "Edition mint (cover + #n). Load unique JSON items when you initialize."}
            {allowN > 0 ? ` Allowlist on (${allowN}).` : ""}
            {mintCap > 0 ? ` Lifetime cap ${mintCap} per wallet.` : ""}
            {royaltyBps > 0 ? ` Secondary royalty ${royaltyBps / 100}%.` : ""}
          </p>
          {walletHint || justMinted ? (
            <div className="mint-wallet-note">
              {justMinted ? <p>Mint confirmed. The NFT is in your profile.</p> : null}
              {walletHint ? <p>{walletHint}</p> : null}
              {onOpenProfile && connected ? (
                <button className="btn" type="button" onClick={onOpenProfile}>
                  View in profile
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="collection-ids is-stack mint-ids">
            {pkg ? <CopyLine variant="row" label="Realm" display={shortPkg} value={pkg} /> : null}
            {drop.addr ? (
              <CopyLine variant="row" label="Address" display={shortAddr(drop.addr)} value={drop.addr} />
            ) : null}
          </div>
          {!hidden && token?.kind === "json" && token.json ? (
            <details className="token-json">
              <summary>Token metadata (GRC-721 JSON)</summary>
              <pre>{token.json}</pre>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MintCall({
  action,
  blocked,
  busy,
  round,
  qtyLimit,
  countReady,
  qtyNote,
  onMint,
  onConnect,
}: {
  action: MintAction;
  blocked: boolean;
  busy: boolean;
  round: MintQtyRound;
  qtyLimit: number;
  countReady: boolean;
  qtyNote: string;
  onMint: (priceUgnot: number, qty: number, round: MintQtyRound) => void;
  onConnect: () => void;
}) {
  const [qtyText, setQtyText] = useState("1");
  useEffect(() => {
    setQtyText("1");
  }, [round]);
  useEffect(() => {
    setQtyText((prev) => String(clampMintQty(prev, Math.max(1, qtyLimit))));
  }, [qtyLimit]);
  const qty = clampMintQty(qtyText, Math.max(1, qtyLimit));
  const qtyBox =
    qtyLimit > 0 || !countReady ? (
      <div className="mint-qty-wrap" data-mint-max={Math.max(0, qtyLimit)}>
        <div className="mint-qty">
          <button
            className="btn"
            type="button"
            aria-label="Decrease quantity"
            disabled={blocked || busy || !countReady || qty <= 1}
            onClick={() => setQtyText(String(Math.max(1, qty - 1)))}
          >
            −
          </button>
          <input
            aria-label="Mint quantity"
            inputMode="numeric"
            autoComplete="off"
            disabled={!countReady}
            value={qtyText}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              if (!digits) {
                setQtyText("");
                return;
              }
              setQtyText(String(Math.min(qtyLimit, Number(digits))));
            }}
            onBlur={() => setQtyText(String(clampMintQty(qtyText, qtyLimit)))}
          />
          <button
            className="btn"
            type="button"
            aria-label="Increase quantity"
            disabled={blocked || busy || !countReady || qty >= qtyLimit}
            onClick={() => setQtyText(String(Math.min(qtyLimit, qty + 1)))}
          >
            +
          </button>
        </div>
        {qtyNote ? <p className="mint-qty-note">{qtyNote}</p> : null}
      </div>
    ) : null;
  if (action.kind === "paused") return <p className="muted mint-cta-note">Mint is paused.</p>;
  if (action.kind === "soldout") return <p className="muted mint-cta-note">Sold out.</p>;
  if (action.kind === "note") return <p className="muted mint-cta-note">{action.note}</p>;
  if (action.kind === "connect") {
    return (
      <div className="mint-cta">
        {qtyBox}
        <button className="btn primary btn-block" type="button" onClick={onConnect}>
          Connect Adena to mint
        </button>
      </div>
    );
  }
  const eligible = action.eligible ? (
    <p className="mint-eligible" role="status">
      Eligible for whitelist
    </p>
  ) : null;
  if (countReady && qtyLimit < 1) {
    return (
      <div className="mint-cta">
        {eligible}
        <div className="mint-qty-wrap" data-mint-max="0">
          <div className="mint-qty">
            <button className="btn" type="button" aria-label="Decrease quantity" disabled>
              −
            </button>
            <input aria-label="Mint quantity" inputMode="numeric" value="0" disabled />
            <button className="btn" type="button" aria-label="Increase quantity" disabled>
              +
            </button>
          </div>
          <p className="mint-qty-note">This wallet has reached the mint cap for this round.</p>
        </div>
      </div>
    );
  }
  const price = action.priceUgnot;
  return (
    <div className="mint-cta">
      {eligible}
      {qtyBox}
      {action.kind === "countdown" ? (
        <button className="btn primary btn-block" type="button" disabled>
          {action.label}
        </button>
      ) : (
        <button
          className="btn primary btn-block"
          type="button"
          disabled={blocked || busy || !countReady}
          onClick={() => onMint(price, qty, round)}
        >
          {mintButtonLabel(qty, price)}
        </button>
      )}
    </div>
  );
}

function RoundClock({ tick }: { tick: RoundCountdown }) {
  if (tick.kind === "open" || tick.kind === "ended") {
    return (
      <p className={`mint-round-count is-${tick.kind}`} aria-live="polite">
        <strong>{tick.kind === "open" ? "Stays open" : "Ended"}</strong>
      </p>
    );
  }
  const parts = countdownParts(tick.left);
  const cells = [
    [parts.days, "Days"],
    [parts.hours, "Hours"],
    [parts.mins, "Min"],
    [parts.secs, "Sec"],
  ] as const;
  const label = tick.kind === "opens" ? "Opens in" : "Closes in";
  return (
    <div className={`mint-round-count is-${tick.kind}`} aria-live="polite" aria-label={`${label} ${formatRoundCountdown(tick.left)}`}>
      <span>{label}</span>
      <div className="mint-round-clock">
        {cells.map(([n, name]) => (
          <div key={name} className="mint-clock-cell">
            <strong>{String(n).padStart(2, "0")}</strong>
            <small>{name}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundCount({ round, nowSec }: { round: MintRoundCard; nowSec: number }) {
  const tick = roundVisibleCountdown(round, nowSec);
  if (!tick) return null;
  return <RoundClock tick={tick} />;
}

function RoundMeter({ round }: { round: MintRoundCard }) {
  if (round.fillCap <= 0) return null;
  const pending = round.fillKnown === false;
  const pct = pending ? 0 : Math.min(100, (round.filled / round.fillCap) * 100);
  return (
    <div className="mint-round-meter">
      <div className="mint-round-meter-top">
        <span>Minted</span>
        <strong>{pending ? "…" : `${round.filled} / ${round.fillCap}`}</strong>
      </div>
      <div
        className="drop-progress"
        role="progressbar"
        aria-busy={pending}
        aria-valuenow={pending ? undefined : round.filled}
        aria-valuemin={0}
        aria-valuemax={round.fillCap}
        aria-label={`${round.title} minted`}
      >
        <div className="drop-progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function useNowSec(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    let id = 0;
    const arm = () => {
      window.clearTimeout(id);
      const remain = 1000 - (Date.now() % 1000);
      id = window.setTimeout(() => {
        setNow(Math.floor(Date.now() / 1000));
        arm();
      }, remain || 1000);
    };
    const wake = () => {
      if (document.visibilityState === "hidden") return;
      setNow(Math.floor(Date.now() / 1000));
      arm();
    };
    arm();
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);
  return now;
}

export function MintRounds({
  rounds,
  nowSec: nowProp,
  callFor,
  call,
}: {
  rounds: MintRoundCard[];
  nowSec?: number;
  callFor?: MintQtyRound;
  call?: ReactNode;
}) {
  const [localNow, setLocalNow] = useState(() => Math.floor(Date.now() / 1000));
  const ticking = rounds.some((round) => round.opensAt > 0 || round.closesAt > 0);
  useEffect(() => {
    if (nowProp != null || !ticking) return;
    const id = window.setInterval(() => setLocalNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [ticking, nowProp]);
  const nowSec = nowProp ?? localNow;
  if (rounds.length === 0) return null;
  const hosted = !!call && rounds.some((round) => round.id === callFor);
  return (
    <section className="mint-rounds" aria-label="Mint rounds">
      <div className="mint-rounds-head">
        <h2>Mint rounds</h2>
        <p className="hint">Times are UTC.</p>
      </div>
      <div className={rounds.length === 1 ? "mint-round-grid is-single" : "mint-round-grid"}>
        {rounds.map((round) => (
          <article key={round.id} className={`mint-round is-${round.state}`}>
            <header className="mint-round-head">
              <h3>{round.title}</h3>
              <span className={`mint-round-state is-${round.state}`}>{round.stateLabel}</span>
            </header>
            <p className="mint-round-price">
              {round.priceLabel ? round.priceLabel : round.priceUgnot > 0 ? <PriceMark ugnot={round.priceUgnot} /> : "Free"}
            </p>
            {hosted && round.id === callFor ? <div className="mint-round-call">{call}</div> : null}
            <RoundCount round={round} nowSec={nowSec} />
            <RoundMeter round={round} />
            <dl>
              <div>
                <dt>Supply</dt>
                <dd>{round.supply}</dd>
              </div>
              <div>
                <dt>Opens</dt>
                <dd>{round.opens}</dd>
              </div>
              <div>
                <dt>Closes</dt>
                <dd>{round.closes}</dd>
              </div>
              <div>
                <dt>Wallet</dt>
                <dd>{round.wallet}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      {call && !hosted ? call : null}
    </section>
  );
}

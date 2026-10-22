import { useEffect, useRef, useState } from "react";
import { CopyLine } from "./CopyLine";
import { rarityClass, shortAddr } from "../lib/chain";
import { GENESIS_RARITIES, GENESIS_SUPPLY, WLIST_CAP, WLIST_OPENS_UTC_MS } from "../lib/wlist";
import { PassCelebrate, WhitelistPass } from "./WhitelistPass";

export const WHITELIST_OPENS_UTC_MS = WLIST_OPENS_UTC_MS;
export const WHITELIST_CAP = WLIST_CAP;

type Props = {
  count: number;
  cap: number;
  opensAtMs: number;
  place: number;
  registered: boolean;
  savedHandle: string;
  connected: boolean;
  address: string;
  blocked: boolean;
  busy: boolean;
  loadError: string;
  onConnect: () => void;
  onRegister: (handle: string) => void;
  celebrate?: boolean;
  onCelebrateDone?: () => void;
};

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

/** Match wlist.normalizeHandle: @ or x.com URL, 1–32 [A-Za-z0-9_]. */
export function normalizeXHandle(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("@")) s = s.slice(1);
  s = s.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "");
  const cut = s.search(/[/?]/);
  if (cut >= 0) s = s.slice(0, cut);
  if (!s || s.length > 32) return "";
  if (!/^[A-Za-z0-9_]+$/.test(s)) return "";
  return s;
}

function useNow(openMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (now >= openMs) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [openMs, now >= openMs]);
  return now;
}

export function GenesisWhitelist({
  count,
  cap,
  opensAtMs,
  place,
  registered,
  savedHandle,
  connected,
  address,
  blocked,
  busy,
  loadError,
  onConnect,
  onRegister,
  celebrate = false,
  onCelebrateDone,
}: Props) {
  const now = useNow(opensAtMs);
  const [handle, setHandle] = useState("");
  const [devPop, setDevPop] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).get("pass") === "1",
  );
  const prevCount = useRef<number | null>(null);
  const [joinGen, setJoinGen] = useState(0);
  const [joinDelta, setJoinDelta] = useState(0);
  useEffect(() => {
    if (prevCount.current == null) {
      prevCount.current = count;
      return;
    }
    if (count > prevCount.current) {
      setJoinDelta(count - prevCount.current);
      setJoinGen((n) => n + 1);
    }
    prevCount.current = count;
  }, [count]);
  useEffect(() => {
    if (joinGen < 1) return;
    const t = window.setTimeout(() => setJoinGen(0), 1200);
    return () => window.clearTimeout(t);
  }, [joinGen]);
  const joinPulse = joinGen > 0;
  const open = now >= opensAtMs;
  const full = count >= cap && cap > 0;
  const remain = Math.max(0, cap - count);
  const filledPct = cap > 0 ? Math.min(100, (count / cap) * 100) : 0;
  const left = Math.max(0, opensAtMs - now);
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  const mins = Math.floor((left % 3600000) / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  const utc = "28 September 2026, 00:00 UTC";
  const x = normalizeXHandle(handle);
  const handleOk = x !== "";
  const handleInvalid = handle.trim() !== "" && !handleOk;
  const onList = place > 0;
  const needsHandle = onList && !savedHandle;
  const canRegister =
    connected &&
    handleOk &&
    !blocked &&
    !busy &&
    (needsHandle || (open && !onList && !full));
  const popOpen = celebrate || devPop;
  const popPlace = place > 0 ? place : 7;
  const popHandle = savedHandle || "preview";
  const popAddress = address || "g1localpreview000000000000000000000000";
  const closePop = () => {
    setDevPop(false);
    onCelebrateDone?.();
  };

  return (
    <section className="page genesis-page">
      <header className="explore-hero genesis-hero">
        <p className="explore-kicker">Bazaar Gens · {GENESIS_SUPPLY.toLocaleString("en-US")} NFTs</p>
        <h1>Every Bazaar Gens NFT shares protocol fees</h1>
        <p className="explore-lead">
          {GENESIS_SUPPLY.toLocaleString("en-US")} Bazaar Gens NFTs. {WLIST_CAP} whitelist slots, first come, first served.
          Opens {utc}.
        </p>
        {!open ? (
          <div className="genesis-clock" aria-live="polite">
            {[
              [pad(days), "Days"],
              [pad(hours), "Hours"],
              [pad(mins), "Minutes"],
              [pad(secs), "Seconds"],
            ].map(([n, label]) => (
              <p className="genesis-clock-cell" key={label}>
                <strong className="num">{n}</strong>
                <span>{label}</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="genesis-clock-open">Whitelist is open</p>
        )}
        <div className={`genesis-slots${joinPulse ? " is-join" : ""}`}>
          <p className="genesis-slots-meta">
            <span className={joinPulse ? "is-pop" : undefined}>
              {count}/{cap} filled
              {joinPulse && joinDelta > 0 ? (
                <span className="genesis-join" aria-live="polite">
                  {" "}
                  +{joinDelta}
                </span>
              ) : null}
            </span>
            <span>{remain} left · FCFS</span>
          </p>
          <div
            className={`genesis-slot-bar${joinPulse ? " is-bump" : ""}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={cap}
            aria-valuenow={count}
          >
            <div
              className="genesis-slot-fill"
              style={{ width: count > 0 ? `max(${filledPct}%, 12px)` : "0%" }}
            />
          </div>
          <p className="hint">Collection supply {GENESIS_SUPPLY.toLocaleString("en-US")}. This bar is the {WLIST_CAP} whitelist.</p>
        </div>
      </header>

      <div className="genesis-desk">
        <aside className="genesis-share-banner" aria-label="Bazaar Gens fee share">
          <p className="genesis-perk-kicker">Minted NFTs</p>
          <h2>
            <span className="genesis-share-num">11%</span>
            <span className="genesis-share-sub">protocol pool, split like FeeDiscount</span>
          </h2>
          <p>
            11% of protocol GNOT from secondary Buys (after FeeDiscount) is split across minted Bazaar Gens NFTs by
            Share weight — the same bps as that NFT’s FeeDiscount. An unminted launch slot takes no share. Common is
            included. Not royalty, not launch fees. Sync, then Claim.
          </p>
        </aside>

        <section className="panel genesis-register">
          {registered && savedHandle ? (
            <>
              <p className="status-pill is-live">You are #{place} on the list</p>
              <WhitelistPass key={`${place}-${savedHandle}`} place={place} handle={savedHandle} address={address} />
              <dl className="genesis-bound">
                <div>
                  <dt>Place</dt>
                  <dd className="num">#{place}</dd>
                </div>
                <div>
                  <dt>Wallet</dt>
                  <dd>
                    {address ? (
                      <CopyLine variant="row" label="g1" display={shortAddr(address)} value={address} />
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>X handle</dt>
                  <dd className="mono">@{savedHandle}</dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <h2>{needsHandle ? "Bind X handle" : "Register"}</h2>
              <p className="genesis-register-lead">
                {needsHandle
                  ? "Your wallet is already on the list. Bind an X handle to render your pass. Public signup stays closed until 28 September 2026, 00:00 UTC."
                  : "Binds this X handle to your connected wallet. Off-chain list — no realm."}
              </p>
              <label htmlFor="genesis-handle">
                X handle
                <span className={`genesis-handle-field${handleInvalid ? " is-invalid" : ""}`}>
                  <span className="genesis-handle-at" aria-hidden="true">
                    @
                  </span>
                  <input
                    id="genesis-handle"
                    value={handle.replace(/^@+/, "")}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/^@+/, "");
                      setHandle(normalizeXHandle(raw) || raw);
                    }}
                    maxLength={64}
                    spellCheck={false}
                    autoComplete="username"
                    autoCapitalize="off"
                    autoCorrect="off"
                    placeholder="handle"
                    aria-invalid={handleInvalid}
                    aria-describedby={handleInvalid ? "genesis-handle-hint" : undefined}
                  />
                </span>
              </label>
              {handleInvalid ? (
                <p id="genesis-handle-hint" className="hint genesis-field-hint is-bad">
                  Use 1–32 letters, numbers, or _. Paste an @handle or x.com URL.
                </p>
              ) : (
                <p className="hint genesis-field-hint">Letters, numbers, and _ · 1–32 characters.</p>
              )}
              <label htmlFor="genesis-wallet">
                Wallet
                <input
                  id="genesis-wallet"
                  className="mono"
                  value={connected && address ? address : ""}
                  readOnly
                  placeholder="Connect Adena — g1 attached automatically"
                  title={address || undefined}
                />
              </label>
              <div className="explore-hero-actions">
                {!connected ? (
                  <button className="btn primary" type="button" onClick={onConnect}>
                    Connect Adena
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    type="button"
                    disabled={!canRegister}
                    onClick={() => onRegister(x)}
                  >
                    {busy
                      ? "Submitting…"
                      : full && !needsHandle
                        ? "List is full"
                        : !open && !needsHandle
                          ? "Not open yet"
                            : !handleOk
                              ? "Enter X handle"
                              : needsHandle
                                ? "Bind handle"
                                : "Submit"}
                  </button>
                )}
              </div>
            </>
          )}
          {loadError ? <p className="hint">{loadError}</p> : null}
          {import.meta.env.DEV ? (
            <p className="hint">
              <button className="btn" type="button" onClick={() => setDevPop(true)}>
                Preview celebration
              </button>
            </p>
          ) : null}
        </section>
      </div>
      {popOpen ? (
        <PassCelebrate place={popPlace} handle={popHandle} address={popAddress} onClose={closePop} />
      ) : null}

      <section className="genesis-perk-grid" aria-label="Bazaar Gens holder perks">
        <article className="genesis-perk-card is-featured">
          <p className="genesis-perk-kicker">Same scale</p>
          <h2>FeeDiscount and Share weight</h2>
          <p>
            Every minted rarity, including Common, cuts protocol on Buys and takes a slice of the 11% pool. Share
            weight equals FeeDiscount. Buyer still pays the listed GNOT price. An unminted launch slot takes no share.
          </p>
          <div className="genesis-table-wrap">
            <table className="market-table">
              <thead>
                <tr>
                  <th>Rarity</th>
                  <th>Supply</th>
                  <th>FeeDiscount</th>
                  <th>Protocol after</th>
                  <th>Share weight</th>
                </tr>
              </thead>
              <tbody>
                {GENESIS_RARITIES.map((row) => (
                  <tr key={row.rarity}>
                    <td><span className={rarityClass(row.rarity)}>{row.rarity}</span></td>
                    <td className="num">{row.supply.toLocaleString("en-US")}</td>
                    <td className="num">{row.discount}</td>
                    <td className="num">{row.protocolAfter}</td>
                    <td className="num">{row.shareWeight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            {GENESIS_SUPPLY.toLocaleString("en-US")} is the collection cap. Only a minted NFT takes a share. Not the{" "}
            {WLIST_CAP} whitelist.
          </p>
        </article>
        <article className="genesis-perk-card">
          <p className="genesis-perk-kicker">Trading discount</p>
          <h2>Highest FeeDiscount</h2>
          <p>
            On a Buy, protocol is cut by the highest <span className="mono">FeeDiscount</span> in that wallet. Two NFTs
            do not add. Existing bazaarv2 collections apply this only after a new col copy.
          </p>
        </article>
        <article className="genesis-perk-card">
          <p className="genesis-perk-kicker">Fee share</p>
          <h2>Minted NFTs count</h2>
          <p>
            The 11% pool is split by Share weight of minted Bazaar Gens NFTs held (not listed). An unminted slot is
            outside the pool. Two minted Commons both earn. Sync, then Claim.
          </p>
        </article>
      </section>
    </section>
  );
}

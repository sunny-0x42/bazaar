import { useEffect, useState } from "react";
import { itemRowKey, protocolFeeLabel, protocolFeeUgnot, rarityClass, ugnotFromGnot, type Item } from "../lib/chain";
import { applyPrice, dropMissing, listButtonLabel, LIST_PER_TX, selectAll, togglePick } from "../lib/bulklist";
import { PriceMark } from "./PriceMark";
import { EmptyState } from "./EmptyState";
import { ItemArt } from "./ItemArt";
import type { Tab } from "./types";

export type ListRequest = {
  item: Item;
  priceUgnot: number;
};

type Props = {
  items: Item[];
  focusKey: string;
  focusPrice: string;
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  loading?: boolean;
  onList: (rows: ListRequest[]) => void;
  onConnect: () => void;
  onOpenTab: (tab: Tab) => void;
};

export function Sell({
  items,
  focusKey,
  focusPrice,
  connected,
  blocked,
  busy,
  onList,
  onConnect,
  onOpenTab,
  loading,
}: Props) {
  const [batchPrice, setBatchPrice] = useState(focusPrice || "1");
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    focusKey ? { [focusKey]: focusPrice || "1" } : {},
  );
  const [seenFocus, setSeenFocus] = useState(focusKey);

  if (focusKey && seenFocus !== focusKey) {
    setSeenFocus(focusKey);
    setSelected((prev) => ({ ...prev, [focusKey]: prev[focusKey] ?? (focusPrice || batchPrice || "1") }));
    if (focusPrice) setBatchPrice(focusPrice);
  }

  useEffect(() => {
    if (items.length === 0) return;
    setSelected((prev) => dropMissing(prev, items.map((row) => itemRowKey(row))));
  }, [items]);

  const picks: ListRequest[] = [];
  for (const item of items) {
    const key = itemRowKey(item);
    if (!Object.prototype.hasOwnProperty.call(selected, key)) continue;
    picks.push({ item, priceUgnot: ugnotFromGnot(selected[key] || "") });
  }
  const ready = picks.length > 0 && picks.every((row) => row.priceUgnot > 0);
  const updating = picks.length > 0 && picks.every((row) => row.item.listed);
  const receive = picks.reduce(
    (sum, row) => sum + Math.max(0, row.priceUgnot - protocolFeeUgnot(row.priceUgnot)),
    0,
  );
  const keys = items.map((row) => itemRowKey(row));

  return (
    <section className="page">
      <header className="page-head">
        <h1>{updating ? "Update prices" : "List"}</h1>
        <p className="muted">Checked items share one price. Up to {LIST_PER_TX} fit in one signature.</p>
      </header>

      {!connected ? (
        <EmptyState title="Connect Adena" body="Connect a wallet to list items you own.">
          <button className="btn primary" type="button" onClick={onConnect}>
            Connect Adena
          </button>
        </EmptyState>
      ) : null}

      {connected && loading && items.length === 0 ? <p className="muted">Loading holdings…</p> : null}

      {connected && !loading && items.length === 0 ? (
        <EmptyState
          title="No unlisted items"
          body="Nomaq reads TokensOf on each factory collection for this wallet. Mint or cancel a listing, then set a GNOT price here."
        >
          <button className="btn primary" type="button" onClick={() => onOpenTab("create")}>
            Launch
          </button>
        </EmptyState>
      ) : null}

      {connected && items.length > 0 ? (
        <>
          <form
            className="sweep-bar sell-bar"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && !blocked && !busy) onList(picks);
            }}
          >
            <span className="sweep-bar-label">Price</span>
            <label className="wallet-price">
              <input
                value={batchPrice}
                onChange={(e) => setBatchPrice(e.target.value)}
                inputMode="decimal"
                placeholder="1.5"
                aria-label="Price for selected"
              />
              <span>GNOT</span>
            </label>
            <button
              className="text-btn"
              type="button"
              aria-label="Select all"
              onClick={() => setSelected((prev) => selectAll(keys, batchPrice || "1", prev))}
            >
              All
            </button>
            <button className="text-btn" type="button" aria-label="Clear" onClick={() => setSelected({})}>
              None
            </button>
            <button
              className="text-btn"
              type="button"
              disabled={picks.length < 1}
              onClick={() => setSelected((prev) => applyPrice(prev, batchPrice))}
            >
              Apply
            </button>
            <span className="sweep-bar-meta" aria-label={`${picks.length} of ${items.length} selected`}>
              <strong>{picks.length}</strong>
              <span className="muted">/ {items.length}</span>
            </span>
            <span className="sweep-bar-total" title={`You get this after the ${protocolFeeLabel()} protocol fee`}>
              <PriceMark ugnot={receive} />
            </span>
            <div className="sweep-actions">
              <button className="btn primary" type="submit" disabled={blocked || busy || !ready}>
                {listButtonLabel(picks.map((row) => ({ listed: row.item.listed })))}
              </button>
            </div>
          </form>
          <div className="sell-grid">
            {items.map((row) => {
              const key = itemRowKey(row);
              const on = Object.prototype.hasOwnProperty.call(selected, key);
              return (
                <article key={key} className={on ? "sell-card is-on" : "sell-card"}>
                  <button
                    className={`pick-fab${on ? " is-on" : ""}`}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Select #${row.id} ${row.name}`}
                    onClick={() => setSelected((prev) => togglePick(prev, key, batchPrice || "1"))}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                      {on ? (
                        <path
                          d="M5 12.5 10 17.5 19 7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null}
                    </svg>
                  </button>
                  <ItemArt name={row.name} image={row.image} alt="" />
                  <div className="sell-card-copy">
                    <strong>{row.name}</strong>
                    <span className="muted">
                      #{row.id}
                      {row.rarity ? (
                        <>
                          {" · "}
                          <span className={rarityClass(row.rarity)}>{row.rarity}</span>
                        </>
                      ) : null}
                      {row.listed ? " · listed" : ""}
                    </span>
                  </div>
                  {on ? (
                    <input
                      className="sell-card-price"
                      value={selected[key] || ""}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [key]: e.target.value }))}
                      inputMode="decimal"
                      aria-label={`Price for #${row.id}`}
                    />
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}

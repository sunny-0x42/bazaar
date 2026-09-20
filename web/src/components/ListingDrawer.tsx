import { useEffect, useState } from "react";
import {
  activityKindLabel,
  canAddToCart,
  isOwnListing,
  itemTraitMap,
  isPreviewItem,
  protocolFeeLabel,
  shortAddr,
  ugnotFromGnot,
  type Activity,
  type Item,
  type OfferRow,
} from "../lib/chain";
import type { ChartPoint } from "../lib/chart";
import { ItemArt } from "./ItemArt";
import { PriceChart } from "./PriceChart";
import { PriceMark } from "./PriceMark";

type Props = {
  item: Item;
  points?: ChartPoint[];
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  owned?: boolean;
  onClose: () => void;
  onBuy: (item: Item) => void;
  onSell?: (item: Item) => void;
  onCancel?: (item: Item) => void;
  onConnect: () => void;
  onOpenCollection?: (slug: string) => void;
  wallet?: string;
  onOffer?: (id: string, ugnot: number) => void;
  onDepositNft?: (id: string) => void;
  topOffer?: OfferRow | null;
  onInstantSell?: (id: string) => void;
  onOpenProfile?: (addr: string) => void;
  peers?: Item[];
  activity?: Activity[];
  onCart?: (item: Item) => void;
  inCart?: boolean;
};

export function ListingDrawer({
  item,
  points = [],
  connected,
  blocked,
  busy,
  owned,
  onClose,
  onBuy,
  onSell,
  onCancel,
  onConnect,
  onOpenCollection,
  wallet,
  onOffer,
  onDepositNft,
  topOffer,
  onInstantSell,
  onOpenProfile,
  peers = [],
  activity = [],
  onCart,
  inCart,
}: Props) {

  const [offerGnot, setOfferGnot] = useState("1");
  const listed = item.listed && item.price > 0;
  const preview = isPreviewItem(item);
  const mine = isOwnListing(item, wallet);
  const collection = item.collection || "bazaar";
  const traits = itemTraitMap(item);
  const traitEntries = Object.entries(traits);
  const canCart = !!onCart && canAddToCart(item, wallet);
  const itemTape = activity.filter((row) => row.id && row.id === item.id).slice(0, 8);
  function traitPct(type: string, value: string): string {
    if (peers.length < 1) return "";
    const n = peers.filter((it) => itemTraitMap(it)[type] === value).length;
    return `${Math.max(1, Math.round((n / peers.length) * 100))}%`;
  }
  const canOpenCollection = !!item.collection && !!onOpenCollection;
  const canOffer = listed && !mine && !owned && (!!onOffer || !!onConnect);
  const canPool = !!item.id && !preview && !!owned && !listed && !!onDepositNft;
  const canInstant =
    !!item.id && !preview && (mine || !!owned) && !!topOffer && topOffer.amount > 0 && !!onInstantSell;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="drawer-root">
      <button className="drawer-overlay" type="button" aria-label="Close item" onClick={onClose} />
      <aside className="item-detail" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <button className="icon-btn item-detail-close" type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="item-detail-art">
          <ItemArt name={item.name} image={item.image} alt={item.name} />
        </div>
        <div className="item-detail-body">
          <div className="item-detail-copy">
            {canOpenCollection ? (
              <button
                className="collection-link is-link mono"
                type="button"
                onClick={() => onOpenCollection(item.collection)}
              >
                {collection}
              </button>
            ) : (
              <span className="collection-link mono">{collection}</span>
            )}
            <h2 id="drawer-title">{item.name}</h2>
            {item.id ? <p className="muted">Token #{item.id}</p> : null}

            <div className="item-price-box">
              <span className="muted">{listed ? "Listed for" : topOffer ? "Top offer" : "Unlisted"}</span>
              <div className="item-price-box-amt">
                {listed ? (
                  <PriceMark ugnot={item.price} size={20} />
                ) : topOffer ? (
                  <PriceMark ugnot={topOffer.amount} size={20} />
                ) : (
                  "—"
                )}
              </div>
              {listed ? <p className="hint">{protocolFeeLabel()} protocol included in the price.</p> : null}
            </div>

            <div className="properties">
              <h3>Attributes</h3>
              {item.revealed === false && (item.slot ?? -1) >= 0 ? (
                <p className="hint">Hidden until the owner reveals.</p>
              ) : traitEntries.length > 0 ? (
              <div className="properties-grid">
                {traitEntries.map(([type, value]) => (
                  <div className="property" key={`${type}:${value}`}>
                    <span className="property-type">{type}</span>
                    <span className="property-value">{value}</span>
                    {peers.length > 0 ? <span className="property-pct muted">{traitPct(type, value)}</span> : null}
                  </div>
                ))}
              </div>
              ) : (
                <p className="hint">No attributes on this item.</p>
              )}
            </div>

            <dl className="drawer-facts">
              <div>
                <dt>Owner</dt>
                <dd className="mono">
                  {item.owner && onOpenProfile ? (
                    <button className="text-btn" type="button" onClick={() => onOpenProfile(item.owner)}>
                      {shortAddr(item.owner)}
                    </button>
                  ) : item.owner ? (
                    shortAddr(item.owner)
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Seller</dt>
                <dd className="mono">
                  {item.seller && onOpenProfile ? (
                    <button className="text-btn" type="button" onClick={() => onOpenProfile(item.seller)}>
                      {shortAddr(item.seller)}
                    </button>
                  ) : item.seller ? (
                    shortAddr(item.seller)
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {topOffer && topOffer.amount > 0 ? (
                <div>
                  <dt>Top offer</dt>
                  <dd>
                    <PriceMark ugnot={topOffer.amount} />
                  </dd>
                </div>
              ) : null}
            </dl>

            {points.length > 0 ? <PriceChart points={points} height={120} /> : null}

            {itemTape.length > 0 ? (
              <div className="item-tape">
                <h3>Activity</h3>
                <ul>
                  {itemTape.map((row, i) => (
                    <li key={`${row.kind}-${row.id}-${i}`}>
                      <span>{activityKindLabel(row.kind)}</span>
                      {row.price > 0 ? <PriceMark ugnot={row.price} size={13} /> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="item-detail-cta">
            {listed && mine ? (
              <>
                <p className="muted">You listed this item. A different wallet must buy it.</p>
                {canInstant ? (
                  <button
                    className="btn primary btn-block"
                    type="button"
                    disabled={blocked || busy}
                    onClick={() => onInstantSell?.(item.id)}
                  >
                    Instant Sell · <PriceMark ugnot={topOffer?.amount || 0} size={13} />
                  </button>
                ) : null}
                {onSell ? (
                  <button className="btn btn-block" type="button" onClick={() => onSell(item)}>
                    Update price
                  </button>
                ) : null}
                {onCancel ? (
                  <button className="btn btn-block" type="button" disabled={blocked || busy} onClick={() => onCancel(item)}>
                    Cancel listing
                  </button>
                ) : null}
              </>
            ) : listed ? (
              connected ? (
                <div className="item-cta-row">
                <button
                  className="btn primary"
                  type="button"
                  disabled={blocked || busy}
                  onClick={() => onBuy(item)}
                >
                  Buy now
                </button>
                {canCart ? (
                  <button className="btn" type="button" onClick={() => onCart?.(item)}>
                    {inCart ? "In cart" : "Add to cart"}
                  </button>
                ) : null}
                </div>
              ) : (
                <button className="btn primary btn-block" type="button" onClick={onConnect}>
                  Connect Adena to buy
                </button>
              )
            ) : owned && onSell ? (
              <>
                {canInstant ? (
                  <button
                    className="btn primary btn-block"
                    type="button"
                    disabled={blocked || busy}
                    onClick={() => onInstantSell?.(item.id)}
                  >
                    Instant Sell · <PriceMark ugnot={topOffer?.amount || 0} size={13} />
                  </button>
                ) : null}
                <button className="btn primary btn-block" type="button" onClick={() => onSell(item)}>
                  Sell
                </button>
                {canPool ? (
                  <button
                    className="btn btn-block"
                    type="button"
                    disabled={blocked || busy}
                    onClick={() => onDepositNft?.(item.id)}
                  >
                    Add to pool
                  </button>
                ) : null}
              </>
            ) : (
              <p className="muted">
                {preview ? "Connect on local gnodev to buy and sell this item." : "Not listed."}
              </p>
            )}
            {canOffer ? (
              <div className="drawer-offer">
                {connected ? (
                  <>
                    <label>
                      Offer (GNOT)
                      <input
                        inputMode="decimal"
                        value={offerGnot}
                        onChange={(e) => setOfferGnot(e.target.value)}
                      />
                    </label>
                    <button
                      className="btn btn-block"
                      type="button"
                      disabled={blocked || busy || !item.id || !onOffer}
                      onClick={() => onOffer?.(item.id, ugnotFromGnot(offerGnot))}
                    >
                      Make offer
                    </button>
                  </>
                ) : (
                  <button className="btn btn-block" type="button" onClick={onConnect}>
                    Connect Adena to offer
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

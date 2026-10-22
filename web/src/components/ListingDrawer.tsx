import { useEffect, useState, type ReactNode } from "react";
import {
  activityKindLabel,
  canAddToCart,
  isOwnListing,
  formatTraitPct,
  rarityClass,
  traitRarityKind,
  traitShares,
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
  sellLabel?: string;
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
  /** Kept so callers still compile. Sync NFT is signed from Admin by the deploy wallet. */
  onSync?: (item: Item) => void;
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
  sellLabel,
  onCancel,
  onConnect,
  onOpenCollection,
  wallet,
  onOffer,

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
  const collection = item.collection || "Nomaq";
  const shares = traitShares(item, peers);
  const canCart = !!onCart && canAddToCart(item, wallet);
  const itemTape = activity.filter((row) => row.id && row.id === item.id).slice(0, 8);
  const canOpenCollection = !!item.collection && !!onOpenCollection;
  const canOffer = listed && !mine && !owned && !!onOffer;

  const canInstant =
    !!item.id && !preview && (mine || !!owned) && !!topOffer && topOffer.amount > 0 && !!onInstantSell;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function Addr({ addr }: { addr: string }) {
    if (!addr) return <span>—</span>;
    if (onOpenProfile) {
      return (
        <button className="text-btn" type="button" onClick={() => onOpenProfile(addr)}>
          {shortAddr(addr)}
        </button>
      );
    }
    return <span className="mono">{shortAddr(addr)}</span>;
  }

  let actions: ReactNode;
  if (listed && mine) {
    actions = (
      <>
        <p className="hint">
          You listed this item. It is in realm escrow, so it leaves Adena until you cancel or a buyer pays.
        </p>
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
    );
  } else if (listed) {
    actions = connected ? (
      canCart ? (
        <div className="item-cta-row">
          <button className="btn primary" type="button" disabled={blocked || busy} onClick={() => onBuy(item)}>
            Buy now
          </button>
          <button className="btn" type="button" onClick={() => onCart?.(item)}>
            {inCart ? "In cart" : "Add to cart"}
          </button>
        </div>
      ) : (
        <button className="btn primary btn-block" type="button" disabled={blocked || busy} onClick={() => onBuy(item)}>
          Buy now
        </button>
      )
    ) : (
      <button className="btn primary btn-block" type="button" onClick={onConnect}>
        Connect Adena to buy
      </button>
    );
  } else if (owned && onSell) {
    actions = (
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
        <p className="hint">
          {sellLabel
            ? "Checked items on your profile share one GNOT price."
            : "Sell moves this NFT to the collection realm until you cancel or a buyer pays."}
        </p>
        <button className="btn primary btn-block" type="button" onClick={() => onSell(item)}>
          {sellLabel || "Sell"}
        </button>

      </>
    );
  } else {
    actions = (
      <p className="muted">
        {preview ? "Connect on local gnodev to buy and sell this item." : "Not listed."}
      </p>
    );
  }

  return (
    <div className="drawer-root">
      <button className="drawer-overlay" type="button" aria-label="Close item" onClick={onClose} />
      <aside className="item-detail" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <button className="icon-btn item-detail-close" type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>

        <div className="item-detail-art">
          <ItemArt name={item.name} image={item.image} alt={item.name} priority />
        </div>

        <div className="item-detail-body">
          <div className="item-detail-head">
            {canOpenCollection ? (
              <button
                className="collection-link is-link"
                type="button"
                onClick={() => onOpenCollection(item.collection)}
              >
                {collection}
              </button>
            ) : (
              <span className="collection-link">{collection}</span>
            )}
            <div className="item-detail-title">
              <h2 id="drawer-title">{item.name}</h2>
              {item.id ? <span className="item-token-id mono">#{item.id}</span> : null}
              {item.rarity ? <span className={rarityClass(item.rarity)}>{item.rarity}</span> : null}
            </div>
            <p className="item-owned">
              Owned by <Addr addr={item.owner} />
            </p>
          </div>

          <div className="item-price-box">
            <span className="item-price-box-label">
              {listed ? "Current price" : topOffer ? "Top offer" : "Unlisted"}
            </span>
            <div className="item-price-box-amt">
              {listed ? (
                <PriceMark ugnot={item.price} size={32} />
              ) : topOffer ? (
                <PriceMark ugnot={topOffer.amount} size={32} />
              ) : (
                "—"
              )}
            </div>
            {listed ? <p className="hint">{protocolFeeLabel()} protocol included in the price.</p> : null}
            <div className="item-detail-cta">
              {actions}
            </div>
            {canOffer ? (
              <div className="drawer-offer">
                {connected ? (
                  <div className="item-offer-row">
                    <label>
                      <span className="sr-only">Offer (GNOT)</span>
                      <input
                        inputMode="decimal"
                        value={offerGnot}
                        onChange={(e) => setOfferGnot(e.target.value)}
                        aria-label="Offer (GNOT)"
                        placeholder="Offer (GNOT)"
                      />
                    </label>
                    <button
                      className="btn"
                      type="button"
                      disabled={blocked || busy || !item.id || !onOffer}
                      onClick={() => onOffer?.(item.id, ugnotFromGnot(offerGnot))}
                    >
                      Make offer
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-block" type="button" onClick={onConnect}>
                    Connect Adena to offer
                  </button>
                )}
              </div>
            ) : null}
          </div>

          <div className="item-details-card">
            <h3>Details</h3>
            <dl className="drawer-facts">
              {item.id ? (
                <div>
                  <dt>Token</dt>
                  <dd className="mono">#{item.id}</dd>
                </div>
              ) : null}
              <div>
                <dt>Owner</dt>
                <dd className="mono">
                  <Addr addr={item.owner} />
                </dd>
              </div>
              <div>
                <dt>Seller</dt>
                <dd className="mono">
                  <Addr addr={item.seller} />
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
          </div>

          {points.length > 0 ? <PriceChart points={points} height={120} /> : null}

          {itemTape.length > 0 ? (
            <div className="item-tape item-details-card">
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

        <div className="properties">
          <h3>Attributes</h3>
          {item.revealed === false && (item.slot ?? -1) >= 0 ? (
            <p className="hint">Hidden until the owner reveals.</p>
          ) : shares.length > 0 ? (
            <div className="properties-grid">
              {shares.map((row) => {
                const tier = rarityClass(row.value).match(/rarity-(common|uncommon|rare|epic|legendary|mythic)$/)?.[1] || "";
                const freq = !tier && row.total > 0 ? traitRarityKind(row.pct) : "";
                const kind = tier || freq;
                return (
                  <div className={`property${kind ? ` is-${kind}` : ""}`} key={`${row.type}:${row.value}`}>
                    <span className="property-type">
                      <span>{row.type}</span>
                      {kind ? <em className="property-rare">{kind}</em> : null}
                    </span>
                    <span className={tier ? "property-value is-tier" : "property-value"} title={row.value}>
                      {row.value}
                    </span>
                    {row.total > 0 ? (
                      <span className="property-pct">
                        {formatTraitPct(row.pct)} have this
                        <span className="property-n">
                          {row.count}/{row.total}
                        </span>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="hint">No attributes on this item.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

import { canAddToCart, isOwnListing, isPreviewItem, type Item, type OfferRow } from "../lib/chain";
import { ItemArt } from "./ItemArt";
import { PriceMark } from "./PriceMark";

type Props = {
  item: Item;
  onOpen: (item: Item) => void;
  onBuy?: (item: Item) => void;
  onSell?: (item: Item) => void;
  onCancel?: (item: Item) => void;
  onMakeOffer?: (item: Item) => void;
  onInstantSell?: (item: Item) => void;
  onReveal?: (item: Item) => void;
  onCart?: (item: Item) => void;
  inCart?: boolean;
  owned?: boolean;
  wallet?: string;
  topOffer?: OfferRow | null;
};

export function ListingCard({
  item,
  onOpen,
  onBuy,
  onSell,
  onCancel,
  onMakeOffer,
  onInstantSell,
  onReveal,
  onCart,
  inCart,
  owned,
  wallet,
  topOffer,
}: Props) {
  const preview = isPreviewItem(item);
  const listed = item.listed && item.price > 0;
  const mine = isOwnListing(item, wallet) || (!listed && !!owned);
  const label = preview ? `Open ${item.name}` : `Open ${item.name} #${item.id}`;
  const canOffer = !!onMakeOffer && listed && !isOwnListing(item, wallet);
  const canCart = !!onCart && canAddToCart(item, wallet);
  const canInstant = !!onInstantSell && mine && !!topOffer && topOffer.amount > 0 && !!item.id && !preview;
  const canReveal =
    !!onReveal && mine && item.revealed === false && (item.slot ?? -1) >= 0 && !!item.id && !preview;
  const hidden = item.revealed === false && (item.slot ?? -1) >= 0;

  return (
    <article
      className="listing-card is-compact"
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className="listing-card-media">
        <ItemArt name={item.name} image={item.image} />
        {hidden ? <span className="rarity rarity-chip">Unrevealed</span> : null}
        {canCart ? (
          <button
            className={`cart-fab${inCart ? " is-on" : ""}`}
            type="button"
            aria-label={inCart ? "Remove from cart" : "Add to cart"}
            title={inCart ? "Remove from cart" : "Add to cart"}
            onClick={(e) => {
              e.stopPropagation();
              onCart?.(item);
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path
                fill="currentColor"
                d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6.2 6l.4 2h12.9l-1.2 6H8.1L6.2 6Zm-1-2H3v2h1.3l2.4 11h12.6l1.8-9H6.1L5.2 4Z"
              />
            </svg>
          </button>
        ) : null}
      </div>
      <div className="listing-card-body">
        <h2>{item.name}</h2>
        <div className="listing-meta">
          {item.id ? <span className="listing-id muted">#{item.id}</span> : null}
          {listed ? (
            <div className="listing-price">
              <PriceMark ugnot={item.price} />
            </div>
          ) : topOffer ? (
            <div className="listing-price listing-offer-px">
              <PriceMark ugnot={topOffer.amount} />
            </div>
          ) : (
            <div className="listing-price listing-price-muted">—</div>
          )}
        </div>
      </div>
      <div
        className="card-actions"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {canReveal ? (
          <button className="btn primary" type="button" onClick={() => onReveal?.(item)}>
            Reveal
          </button>
        ) : null}
        {canInstant ? (
          <button className="btn primary" type="button" onClick={() => onInstantSell?.(item)}>
            Instant Sell
            {topOffer ? (
              <span className="btn-amt">
                <PriceMark ugnot={topOffer.amount} size={12} />
              </span>
            ) : null}
          </button>
        ) : null}
        {listed && isOwnListing(item, wallet) && !canInstant ? (
          <button className="btn" type="button" onClick={() => (onCancel ? onCancel(item) : onOpen(item))}>
            Listed
          </button>
        ) : null}
        {listed && !isOwnListing(item, wallet) ? (
          <>
            <button className="btn primary" type="button" onClick={() => (onBuy ? onBuy(item) : onOpen(item))}>
              Buy
            </button>
            {canOffer ? (
              <button className="btn" type="button" onClick={() => onMakeOffer?.(item)}>
                Offer
              </button>
            ) : null}
          </>
        ) : null}
        {!listed && owned && onSell && !canInstant ? (
          <button className="btn" type="button" onClick={() => onSell(item)}>
            Sell
          </button>
        ) : null}
      </div>
    </article>
  );
}

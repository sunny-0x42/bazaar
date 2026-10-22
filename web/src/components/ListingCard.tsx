import { canAddToCart, isOwnListing, isPreviewItem, rarityClass, type Item, type OfferRow } from "../lib/chain";
import { nftCanSync } from "../lib/perksync";
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
  onSync?: (item: Item) => void;
  onCart?: (item: Item) => void;
  inCart?: boolean;
  /** Wallet bulk list. Checked NFTs share one price on the profile bar. */
  picked?: boolean;
  onTogglePick?: (item: Item) => void;
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
  onSync,
  onCart,
  inCart,
  picked,
  onTogglePick,
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
  const hidden = item.revealed === false && (item.slot ?? -1) >= 0;
  const showNftSync = !!owned && !!onSync && nftCanSync(item);

  return (
    <article
      className={`listing-card is-compact${picked ? " is-picked" : ""}`}
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
        {hidden ? (
          <span className="rarity rarity-chip">Unrevealed</span>
        ) : item.rarity ? (
          <span className={`${rarityClass(item.rarity)} rarity-chip`}>{item.rarity}</span>
        ) : null}
        {onTogglePick && !listed && !preview ? (
          <button
            className={`pick-fab${picked ? " is-on" : ""}`}
            type="button"
            aria-pressed={!!picked}
            aria-label={picked ? `Remove #${item.id} from wallet list` : `Include #${item.id} in wallet list`}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePick(item);
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              {picked ? (
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
        ) : null}
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
        {showNftSync ? (
          <button
            className="btn primary nft-sync-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSync?.(item);
            }}
          >
            Sync NFT
          </button>
        ) : null}
      </div>
      <div
        className="card-actions"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
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
            Cancel listing
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

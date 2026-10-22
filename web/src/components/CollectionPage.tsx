import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatFloorPct, type ExploreCollection } from "../lib/catalog";
import {
  activityKindLabel,
  filterListedItems,
  hasListedAsk,
  isOwnListing,
  itemRowKey,
  sameAddr,
  sweepQuote,
  SWEEP_CAP,
  topOfferFor,
  shortAddr,
  sortItems,
  socialHref,
  isOpenEdition,
  isPublicDrop,
  shortPkgPath,
  ugnotFromGnot,
  type Activity,
  type Item,
  type ItemSort,
  type OfferRow,
  type PoolInfo,
  type PoolNft,
  type Socials,
  type SortDir,
} from "../lib/chain";
import type { ChartPoint } from "../lib/chart";
import { CollectionBio } from "./CollectionBio";
import type { MintRoundCard } from "../lib/mintrounds";
import { CopyLine } from "./CopyLine";
import { EmptyState } from "./EmptyState";
import { ItemArt } from "./ItemArt";
import { ListingCard } from "./ListingCard";
import { SkeletonGrid } from "./SkeletonGrid";
import { PriceChart } from "./PriceChart";
import { PriceMark } from "./PriceMark";
import { Select } from "./Select";
import { TraitFilters } from "./TraitFilters";

type Pane = "items" | "offers" | "chart" | "activity";

const ITEM_SORT_OPTIONS: { value: `${ItemSort}:${SortDir}`; label: string }[] = [
  { value: "price:asc", label: "Price: Low to high" },
  { value: "price:desc", label: "Price: High to low" },
  { value: "name:asc", label: "Name: A to Z" },
  { value: "name:desc", label: "Name: Z to A" },
  { value: "id:asc", label: "ID: Low to high" },
  { value: "id:desc", label: "ID: High to low" },
];

type Props = {
  collection: ExploreCollection | null;
  slug: string;
  items: Item[];
  activity: Activity[];
  chartPoints: ChartPoint[];
  chartPreview?: boolean;
  query: string;
  onQuery: (q: string) => void;
  onBack: () => void;
  onOpenItem: (item: Item) => void;
  onBuy: (item: Item) => void;
  onSell: (item: Item) => void;
  onCancel: (item: Item) => void;
  wallet?: string;
  offers?: OfferRow[];
  pool?: PoolInfo | null;
  poolNfts?: PoolNft[];
  poolShares?: number;
  socials?: Socials;
  connected?: boolean;
  blocked?: boolean;
  busy?: boolean;
  onOffer?: (id: string, ugnot: number) => void;
  onCancelOffer?: (id: string) => void;
  onAcceptOffer?: (id: string, bidder: string) => void;
  onDepositPool?: (slug: string, ugnot: number) => void;
  onWithdrawPool?: (slug: string, shares: number) => void;
  onDepositNft?: (id: string) => void;
  onWithdrawNft?: (id: string) => void;
  onConnect?: () => void;
  onInstantSell?: (id: string) => void;
  onSweep?: (ids: string[], ugnot: number) => void;
  cart?: Item[];
  onCart?: (item: Item) => void;
  onReveal?: (id: string) => void;
  onSyncNft?: (item: Item) => void;
  onOpenMint?: (slug: string) => void;
  onRevealCollection?: () => void;
  sealed?: boolean;
  creatorAddr?: string;
  mintRounds?: MintRoundCard[];
  hasOffers?: boolean;
  hasPool?: boolean;
  loading?: boolean;
  activityLoading?: boolean;
  moreCount?: number;
  moreBusy?: boolean;
  onLoadMore?: () => void;
};

export function CollectionPage({
  collection,
  slug,
  items,
  activity,
  chartPoints,
  chartPreview,
  query,
  onQuery,
  onBack,
  onOpenItem,
  onBuy,
  onSell,
  onCancel,
  wallet,
  offers = [],
  socials,
  connected,
  blocked,
  busy,
  onOffer,
  onCancelOffer,
  onAcceptOffer,
  onConnect,
  onInstantSell,
  onSweep,
  cart = [],
  onCart,
  onReveal,
  onSyncNft,
  onOpenMint,
  onRevealCollection,
  sealed = false,
  creatorAddr = "",
  mintRounds = [],
  hasOffers = true,
  loading = false,
  activityLoading = false,
  moreCount = 0,
  moreBusy = false,
  onLoadMore,
}: Props) {

  const [pane, setPane] = useState<Pane>("items");
  useEffect(() => {
    if (collection?.pkg && !hasOffers && pane === "offers") setPane("items");
  }, [collection?.pkg, hasOffers, pane]);
  const [sort, setSort] = useState<ItemSort>("price");
  const [dir, setDir] = useState<SortDir>("asc");
  const [rarity, setRarity] = useState("all");
  const [minGnot, setMinGnot] = useState("");
  const [maxGnot, setMaxGnot] = useState("");
  const [listedOnly, setListedOnly] = useState(true);
  const listedTouch = useRef(false);
  const [traitSel, setTraitSel] = useState<Record<string, string[]>>({});
  const [offerId, setOfferId] = useState("");
  const [offerGnot, setOfferGnot] = useState("1");
  const [sweepN, setSweepN] = useState(1);

  useEffect(() => {
    listedTouch.current = false;
    setPane("items");
    setRarity("all");
    setMinGnot("");
    setMaxGnot("");
    setListedOnly(true);
    setTraitSel({});
    setSweepN(1);
  }, [slug]);

  useEffect(() => {
    if (loading || listedTouch.current) return;
    setListedOnly(hasListedAsk(items));
  }, [slug, items, loading]);

  const visibleItems = useMemo(
    () =>
      sortItems(
        filterListedItems(items, { query, rarity, minGnot, maxGnot, listedOnly, traits: traitSel }),
        sort,
        dir,
      ),
    [items, query, rarity, minGnot, maxGnot, listedOnly, traitSel, sort, dir],
  );

  const name = collection?.name || slug;
  const cover = collection?.cover || "";
  const floor = minListedPrice(items) || collection?.floor || 0;
  const itemCount = items.length;
  const listedCount = items.filter((it) => it.listed && it.price > 0).length;
  const supply = collection?.maxSupply || itemCount;
  const owners = new Set(
    items.map((it) => (it.listed ? it.seller : it.owner).toLowerCase()).filter(Boolean),
  );
  const ownerPct = itemCount > 0 ? Math.round((owners.size / itemCount) * 100) : 0;
  const mcap = floor > 0 && itemCount > 0 ? floor * itemCount : 0;
  const sales = activity.filter((row) => row.kind === "buy" || row.kind === "accept");
  const vol = sales.reduce((n, row) => n + (row.price > 0 ? row.price : 0), 0);
  const topOffer = offers.reduce((n, row) => (row.amount > n ? row.amount : n), 0);
  const links = [
    { href: socialHref(socials?.website || collection?.website || ""), label: "Website" },
    { href: socialHref(socials?.twitter || collection?.twitter || ""), label: "X" },
    { href: socialHref(socials?.discord || collection?.discord || ""), label: "Discord" },
  ].filter((row) => row.href);
  const liveRound = mintRounds.find((row) => row.state === "live");
  const offerable = useMemo(
    () => items.filter((it) => it.id && !sameAddr(it.owner, wallet) && !isOwnListing(it, wallet)),
    [items, wallet],
  );
  const preview = !!collection?.preview;
  const activityPreview = activity.length > 0 && activity.every((row) => row.preview);
  const activitySource = activityPreview ? undefined : activity[0]?.source;
  const sourceLabel =
    activitySource === "indexed" ? "Indexed" : activitySource === "on-chain" ? "On-chain" : "";
  const byId = useMemo(() => {
    const map = new Map<string, Item>();
    for (const it of items) if (it.id) map.set(it.id, it);
    return map;
  }, [items]);
  const quote = useMemo(() => sweepQuote(items, sweepN, wallet), [items, sweepN, wallet]);
  const sweepMax = Math.min(SWEEP_CAP, items.filter((it) => it.listed && it.price > 0 && !isOwnListing(it, wallet)).length);

  useEffect(() => {
    if (!offerId || !offerable.some((it) => it.id === offerId)) {
      setOfferId(offerable[0]?.id || "");
    }
  }, [offerable, offerId]);

  const locked = !!blocked || !!busy;
  const offerOptions = offerable.map((it) => ({
    value: it.id,
    label: `${it.name} #${it.id}`,
  }));

  return (
    <>
      <div className="toolbar">
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
      </div>

      <header className="collection-hero">
        <div className="collection-banner">
          <ItemArt name={name} image={cover} alt="" priority />
        </div>
        <div className="collection-hero-copy">
          <div className="collection-hero-top">
            <div className="collection-hero-id">
              <h1>
                {name}
                {collection?.paused ? <span className="tag">Paused</span> : null}
              </h1>
              <div className="collection-ids">
                {collection?.pkg ? (
                  <CopyLine label="Realm" display={shortPkgPath(collection.pkg)} value={collection.pkg} />
                ) : null}
                {collection?.addr ? (
                  <CopyLine label="Address" display={shortAddr(collection.addr)} value={collection.addr} />
                ) : null}
              </div>
            </div>
            {collection && isPublicDrop(collection) && onOpenMint ? (
              <div className="collection-hero-actions">
                <button
                  className={
                    (!isOpenEdition(collection) && collection.minted >= collection.maxSupply) || collection.paused
                      ? "btn"
                      : "btn primary"
                  }
                  type="button"
                  onClick={() => onOpenMint(slug)}
                >
                  {!isOpenEdition(collection) && collection.minted >= collection.maxSupply
                    ? "Sold out"
                    : collection.paused
                      ? "Mint paused"
                      : liveRound && liveRound.priceUgnot > 0
                        ? (
                            <>
                              Mint · <PriceMark ugnot={liveRound.priceUgnot} size={13} />
                            </>
                          )
                      : liveRound
                        ? "Mint"
                        : mintRounds.length > 0
                          ? "View mint"
                          : collection.mintPrice > 0
                            ? (
                                <>
                                  Mint · <PriceMark ugnot={collection.mintPrice} size={13} />
                                </>
                              )
                            : "Mint"}
                </button>
              </div>
            ) : null}
          </div>
          <CollectionBio
            slug={slug}
            chainBio={collection?.bio || ""}
            creator={creatorAddr || ""}
            wallet={wallet || ""}
            name={collection?.name || slug}
            cover={collection?.cover || ""}
          />
          {links.length > 0 ? (
            <p className="collection-socials">
              {links.map((row) => (
                <a key={row.label} href={row.href} target="_blank" rel="noreferrer">
                  {row.label}
                </a>
              ))}
            </p>
          ) : null}
          {sealed ? (
            <div className="mint-wallet-note">
              <p>
                Sealed. Reveal opens every minted NFT in one signature. Names and art replace Unrevealed.
                {(collection?.minted || 0) < 1
                  ? " Nothing is minted yet, so reveal also publishes the slot list."
                  : ""}
              </p>
              {connected && sameAddr(wallet, creatorAddr) && onRevealCollection ? (
                <button
                  className="btn primary"
                  type="button"
                  disabled={locked}
                  onClick={onRevealCollection}
                >
                  Reveal collection
                </button>
              ) : !connected ? (
                <p>Connect the creator wallet to reveal.</p>
              ) : null}
            </div>
          ) : null}

          <div className="collection-stats stats-wide">
            {collection?.pkg && isPublicDrop(collection) ? (
              <>
                {mintRounds.length === 0 ? (
                  <Stat
                    label="Mint"
                    value={
                      collection.mintPrice > 0 ? <PriceMark ugnot={collection.mintPrice} /> : "Free"
                    }
                  />
                ) : null}
                <Stat
                  label="Remaining"
                  value={
                    isOpenEdition(collection)
                      ? "Open"
                      : `${Math.max(0, collection.maxSupply - collection.minted)} left`
                  }
                />
                {collection.royaltyBps && collection.royaltyBps > 0 ? (
                  <Stat label="Royalty" value={`${collection.royaltyBps / 100}%`} />
                ) : null}
              </>
            ) : null}
            <Stat
              label="Floor"
              value={floor > 0 ? <PriceMark ugnot={floor} /> : "—"}
              delta={
                collection?.floorPct7d != null && Number.isFinite(collection.floorPct7d)
                  ? collection.floorPct7d
                  : floorPctFromPoints(chartPoints)
              }
            />
            {!(collection?.pkg && vol === 0 && sales.length === 0) ? (
              <>
                <Stat label="Top offer" value={topOffer > 0 ? <PriceMark ugnot={topOffer} /> : "—"} />
                <Stat label="Volume" value={vol > 0 ? <PriceMark ugnot={vol} /> : "—"} />
                <Stat label="Sales" value={String(sales.length)} />
              </>
            ) : null}
            <Stat label="Listed" value={`${listedCount}/${supply || "—"}`} />
            <Stat label="Owners" value={itemCount ? `${ownerPct}%` : "—"} />
          </div>
        </div>
      </header>

      <div className="col-tabs" role="tablist" aria-label="Collection">
        {(
          (
            hasOffers || !collection?.pkg
              ? ([["items", "Items"], ["offers", "Offers"], ["chart", "Chart"], ["activity", "Activity"]] as const)
              : ([["items", "Items"], ["chart", "Chart"], ["activity", "Activity"]] as const)
          )
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pane === id}
            className={pane === id ? "active" : ""}
            onClick={() => setPane(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {pane === "items" ? null : (
        <div className="toolbar">
          <p className="muted toolbar-count">
            {pane === "offers"
              ? `${offers.length} ${offers.length === 1 ? "offer" : "offers"}`
              : pane === "chart"
                  ? `${chartPoints.length} ${chartPoints.length === 1 ? "price" : "prices"} · GNOT`
                  : activityLoading && activity.length === 0
                    ? "Loading activity…"
                    : `${activity.length} ${activity.length === 1 ? "event" : "events"}${sourceLabel ? ` · ${sourceLabel}` : ""}`}
          </p>
        </div>
      )}

      {pane === "chart" ? (
        <>

          <PriceChart points={chartPoints} height={240} />
        </>
      ) : null}

      {pane === "items" ? (
        <div className="collection-desk">
          <TraitFilters
            items={items}
            listedOnly={listedOnly}
            onListedOnly={(on) => {
              listedTouch.current = true;
              setListedOnly(on);
            }}
            minGnot={minGnot}
            maxGnot={maxGnot}
            onMin={setMinGnot}
            onMax={setMaxGnot}
            selected={traitSel}
            onToggle={(type, value) => {
              setTraitSel((prev) => {
                const cur = prev[type] || [];
                const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
                const out = { ...prev };
                if (next.length) out[type] = next;
                else delete out[type];
                return out;
              });
            }}
            onClear={() => {
              setListedOnly(false);
              setMinGnot("");
              setMaxGnot("");
              setRarity("all");
              setTraitSel({});
              onQuery("");
            }}
          />
          <div className="collection-items">
            <div className="collection-tools">
              <p className="muted toolbar-count">
                {visibleItems.length} of {Math.max(itemCount, supply || 0)}{" "}
                {Math.max(itemCount, supply || 0) === 1 ? "item" : "items"}
              </p>
              <Select
                ariaLabel="Sort items"
                value={`${sort}:${dir}`}
                onChange={(v) => {
                  const [nextSort, nextDir] = v.split(":");
                  if (nextSort === "price" || nextSort === "name" || nextSort === "id") setSort(nextSort);
                  if (nextDir === "asc" || nextDir === "desc") setDir(nextDir);
                }}
                options={ITEM_SORT_OPTIONS}
              />
            </div>
            {sweepMax > 0 && onSweep ? (
              <div className="sweep-bar">
                <span className="sweep-bar-label">Sweep</span>
                <label className="sweep-range">
                  <span className="sr-only">Sweep count</span>
                  <input
                    type="range"
                    min={1}
                    max={sweepMax}
                    value={Math.min(sweepN, sweepMax) || 1}
                    onChange={(e) => setSweepN(Number(e.target.value) || 1)}
                    aria-label="Sweep count"
                  />
                </label>
                <span className="sweep-bar-meta">
                  <strong className="num">{quote.count}</strong>
                  <span className="muted">{quote.count === 1 ? "item" : "items"}</span>
                </span>
                <span className="sweep-bar-total">
                  {quote.total > 0 ? <PriceMark ugnot={quote.total} size={16} /> : "—"}
                </span>
                {connected ? (
                  <button
                    className="btn primary"
                    type="button"
                    disabled={locked || quote.count < 1}
                    onClick={() => onSweep?.(quote.ids, quote.total)}
                  >
                    Buy {quote.count}
                  </button>
                ) : (
                  <button className="btn primary" type="button" onClick={onConnect}>
                    Connect
                  </button>
                )}
              </div>
            ) : null}
            {loading ? (
              <SkeletonGrid />
            ) : visibleItems.length > 0 ? (
              <div className="listing-grid">
                {visibleItems.map((row) => (
                  <ListingCard
                    key={itemRowKey(row)}
                    item={row}
                    onOpen={onOpenItem}
                    onBuy={onBuy}
                    onSell={onSell}
                    onCancel={onCancel}
                    onReveal={onReveal ? (it) => onReveal(it.id) : undefined}
                    onSync={onSyncNft}
                    onMakeOffer={onOffer ? onOpenItem : undefined}
                    onCart={onCart}
                    inCart={cart.some((c) => itemRowKey(c) === itemRowKey(row))}
                    onInstantSell={
                      onInstantSell
                        ? (it) => onInstantSell(it.id)
                        : onAcceptOffer
                          ? (it) => {
                              const top = topOfferFor(offers, it.id);
                              if (top) onAcceptOffer(it.id, top.bidder);
                            }
                          : undefined
                    }
                    wallet={wallet}
                    owned={!!wallet && (sameAddr(row.owner, wallet) || sameAddr(row.seller, wallet))}
                    topOffer={topOfferFor(offers, row.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={
                  query.trim() || minGnot.trim() || maxGnot.trim() || Object.keys(traitSel).length
                    ? "No matches"
                    : listedOnly && items.length > 0
                      ? "No listed items"
                      : "No items"
                }
                body={
                  query.trim() || minGnot.trim() || maxGnot.trim() || Object.keys(traitSel).length
                    ? "Nothing matches those filters."
                    : listedOnly && items.length > 0
                      ? "Turn off Listed in Filters to see the rest of the collection."
                      : "This collection has no items yet."
                }
              >
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    listedTouch.current = true;
                    onQuery("");
                    setRarity("all");
                    setMinGnot("");
                    setMaxGnot("");
                    setListedOnly(false);
                    setTraitSel({});
                  }}
                >
                  Clear filters
                </button>
              </EmptyState>
            )}
            {moreCount > 0 ? (
              <div className="load-more">
                <button className="btn" type="button" disabled={moreBusy || !onLoadMore} onClick={onLoadMore}>
                  {moreBusy ? "Loading…" : `Load ${moreCount} more`}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {pane === "offers" ? (
        !hasOffers ? (
          <EmptyState
            title="Offers not on this package"
            body="This package has List and Buy only."
          >
            <button className="btn" type="button" onClick={() => setPane("items")}>
              View items
            </button>
          </EmptyState>
        ) : (
        <div className="book-stack">
          <section className="panel book-form">
            <h2>Make offer</h2>
            {offerOptions.length > 0 ? (
              <>
                <label>
                  Item
                  <Select
                    ariaLabel="Offer item"
                    value={offerId}
                    options={offerOptions}
                    onChange={setOfferId}
                  />
                </label>
                <label>
                  Offer (GNOT)
                  <input
                    inputMode="decimal"
                    value={offerGnot}
                    onChange={(e) => setOfferGnot(e.target.value)}
                  />
                </label>
                {connected ? (
                  <button
                    className="btn primary"
                    type="button"
                    disabled={locked || !offerId}
                    onClick={() => onOffer?.(offerId, ugnotFromGnot(offerGnot))}
                  >
                    Place offer
                  </button>
                ) : (
                  <button className="btn primary" type="button" onClick={onConnect}>
                    Connect Adena
                  </button>
                )}
                <p className="hint">Escrowed ugnot. The owner or the seller can accept. Accept uses the same fee split as Buy.</p>
              </>
            ) : (
              <p className="muted">No items you can bid on in this collection.</p>
            )}
          </section>
          {offers.length > 0 ? (
            <table className="book-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>From</th>
                  <th>Offer</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {offers.map((row) => {
                  const item = byId.get(row.id);
                  const mine = sameAddr(row.bidder, wallet);
                  const canAccept = item
                    ? item.listed
                      ? isOwnListing(item, wallet)
                      : sameAddr(item.owner, wallet)
                    : false;
                  return (
                    <tr key={`${row.id}-${row.bidder}`}>
                      <td>
                        <button className="text-btn" type="button" onClick={() => item && onOpenItem(item)}>
                          {row.name || "Item"} <span className="muted">#{row.id}</span>
                        </button>
                      </td>
                      <td className="mono">{shortAddr(row.bidder)}</td>
                      <td className="num">{row.amount > 0 ? <PriceMark ugnot={row.amount} /> : "—"}</td>
                      <td className="book-actions">
                        {mine ? (
                          <button
                            className="btn"
                            type="button"
                            disabled={locked}
                            onClick={() => onCancelOffer?.(row.id)}
                          >
                            Cancel
                          </button>
                        ) : null}
                        {canAccept && !mine ? (
                          <button
                            className="btn primary"
                            type="button"
                            disabled={locked}
                            onClick={() => onAcceptOffer?.(row.id, row.bidder)}
                          >
                            Accept
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No offers" body="Place a GNOT offer on an item in this collection.">
              {connected ? null : (
                <button className="btn" type="button" onClick={onConnect}>
                  Connect Adena
                </button>
              )}
            </EmptyState>
          )}
        </div>
        )
      ) : null}

      {pane === "activity" ? (
        activity.length > 0 ? (
          <>

            <div className="activity-wrap">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Item</th>
                    <th>From</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((row, i) => {
                    const item = row.id ? byId.get(row.id) : undefined;
                    return (
                      <tr
                        key={`${row.kind}-${row.id}-${row.name}-${i}`}
                        className={item ? "is-link" : ""}
                        onClick={() => item && onOpenItem(item)}
                      >
                        <td>
                          <span className={`activity-chip kind-${row.kind.toLowerCase()}`}>
                            {activityKindLabel(row.kind)}
                          </span>
                        </td>
                        <td>
                          <strong>{item?.name || row.name || row.slug || "Item"}</strong>
                          {row.id ? <span className="muted"> #{row.id}</span> : null}
                        </td>
                        <td className="mono muted">{row.actor ? shortAddr(row.actor) : "—"}</td>
                        <td className="num">
                          {row.price > 0 ? (
                            <>
                              {row.price > 0 ? <PriceMark ugnot={row.price} /> : "—"}
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : activityLoading ? (
          <p className="muted">Loading activity…</p>
        ) : (
          <EmptyState title="No activity yet" body="Mints, lists, and sales show up here.">
            <button className="btn" type="button" onClick={() => setPane("items")}>
              View items
            </button>
          </EmptyState>
        )
      ) : null}
    </>
  );
}

function Stat({ label, value, delta }: { label: string; value: ReactNode; delta?: number | null }) {
  const hasDelta = delta != null && Number.isFinite(delta);
  return (
    <div>
      <span className="muted">{label}</span>
      <strong className="num">{value}</strong>
      {hasDelta ? (
        <span className={`stat-delta ${delta > 0 ? "is-up" : delta < 0 ? "is-down" : ""}`}>
          {formatFloorPct(delta)}
        </span>
      ) : null}
    </div>
  );
}

function floorPctFromPoints(points: ChartPoint[]): number | null {
  const priced = points.filter((p) => p.price > 0);
  if (priced.length < 2) return null;
  const a = priced[0].price;
  const b = priced[priced.length - 1].price;
  if (!(a > 0)) return null;
  return ((b - a) / a) * 100;
}

function minListedPrice(items: Item[]): number {
  let min = 0;
  for (const it of items) {
    if (!it.listed || it.price <= 0) continue;
    if (min === 0 || it.price < min) min = it.price;
  }
  return min;
}

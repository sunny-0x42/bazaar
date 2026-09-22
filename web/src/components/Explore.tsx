import { useEffect, useMemo, useState } from "react";
import {
  buildExploreCollections,
  collectionMarketRow,
  itemsForExploreCollection,
  parseCatalog,
  pickFeatured,
  previewActivityFor,
  previewItemsFor,
  type CatalogCollection,
  type CollectionMarket,
} from "../lib/catalog";
import {
  isRealmUnavailable,
  itemRowKey,
  liveTradeRows,
  type Activity,
  type ChainCollection,
  type Item,
  type OfferRow,
  type PoolInfo,
  type PoolNft,
  type Socials,
  topOfferFor,
} from "../lib/chain";
import { activityToPoints, fetchChart, listedPricesToPoints, pointsForItem, type ChartPoint } from "../lib/chart";
import { FeaturedCollections } from "./FeaturedCollections";
import { CollectionTable, type MarketSortKey } from "./CollectionTable";
import { LiveTicker } from "./LiveTicker";
import { CollectionPage } from "./CollectionPage";
import { EmptyState } from "./EmptyState";
import { ListingDrawer } from "./ListingDrawer";
import { SkeletonGrid } from "./SkeletonGrid";
import type { Tab } from "./types";

type Props = {
  items: Item[];
  chainCollections: ChainCollection[];
  collectionItems: Item[] | null;
  collectionActivity: Activity[] | null;
  homeActivity?: Activity[] | null;
  featuredSlugs?: string[];
  slug: string;
  onSlug: (slug: string) => void;
  query: string;
  onQuery: (q: string) => void;
  loading: boolean;
  chainNote: string;
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  onOpenTab: (tab: Tab) => void;
  onBuy: (item: Item) => void;
  onSell: (item: Item) => void;
  onCancel: (item: Item) => void;
  onConnect: () => void;
  wallet?: string;
  itemId?: string;
  onItemId?: (id: string) => void;
  collectionOffers?: OfferRow[];
  collectionPool?: PoolInfo | null;
  collectionPoolNfts?: PoolNft[];
  collectionPoolShares?: number;
  collectionSocials?: Socials;
  onOffer?: (id: string, ugnot: number) => void;
  onCancelOffer?: (id: string) => void;
  onAcceptOffer?: (id: string, bidder: string) => void;
  onDepositPool?: (slug: string, ugnot: number) => void;
  onWithdrawPool?: (slug: string, shares: number) => void;
  onDepositNft?: (id: string) => void;
  onWithdrawNft?: (id: string) => void;
  onInstantSell?: (id: string) => void;
  onSweep?: (ids: string[], ugnot: number) => void;
  cart?: Item[];
  onCart?: (item: Item) => void;
  onReveal?: (id: string) => void;
  onOpenMint?: (slug: string) => void;
  hasOffers?: boolean;
  hasPool?: boolean;
  onOpenProfile?: (addr: string) => void;
};

export function Explore({
  items,
  chainCollections,
  collectionItems,
  collectionActivity,
  homeActivity,
  featuredSlugs = [],
  slug,
  onSlug,
  query,
  onQuery,
  loading,
  chainNote,
  connected,
  blocked,
  busy,
  onOpenTab,
  onBuy,
  onSell,
  onCancel,
  onConnect,
  wallet,
  itemId,
  onItemId,
  collectionOffers,
  collectionPool,
  collectionPoolNfts,
  collectionPoolShares,
  collectionSocials,
  onOffer,
  onCancelOffer,
  onAcceptOffer,
  onDepositPool,
  onWithdrawPool,
  onDepositNft,
  onWithdrawNft,
  onInstantSell,
  onSweep,
  cart = [],
  onCart,
  onReveal,
  onOpenMint,
  hasOffers = true,
  hasPool = true,
  onOpenProfile,
}: Props) {
  const [selected, setSelected] = useState<Item | null>(null);
  const [catalog, setCatalog] = useState<CatalogCollection[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [apiPoints, setApiPoints] = useState<ChartPoint[] | null>(null);
  const [tableSort, setTableSort] = useState<MarketSortKey>("vol");
  const [tableDir, setTableDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let live = true;
    fetch("/samples/catalog.json")
      .then((r) => {
        if (!r.ok) throw new Error("catalog");
        return r.json();
      })
      .then((data: unknown) => {
        if (live) setCatalog(parseCatalog(data));
      })
      .catch(() => {
        if (live) setCatalog([]);
      })
      .finally(() => {
        if (live) setCatalogReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const collections = useMemo(
    () => buildExploreCollections(catalog, chainCollections, items),
    [catalog, chainCollections, items],
  );
  const factoryMode = useMemo(() => chainCollections.some((c) => !!c.pkg), [chainCollections]);

  const q = query.trim().toLowerCase();
  const visibleCollections = useMemo(() => {
    if (!q) return collections;
    return collections.filter((col) => {
      if (col.name.toLowerCase().includes(q) || col.slug.toLowerCase().includes(q)) return true;
      if ((col.pkg || "").toLowerCase().includes(q)) return true;
      const cat = catalog.find((c) => c.slug === col.slug);
      return !!cat?.items.some((it) => it.name.toLowerCase().includes(q));
    });
  }, [collections, catalog, q]);

  const listedPool = useMemo(() => {
    if (items.length > 0) return items.filter((row) => row.listed && row.price > 0);
    if (factoryMode) return [];
    return catalog.flatMap((col) => previewItemsFor(col).filter((row) => row.listed && row.price > 0));
  }, [items, catalog, factoryMode]);
  const tape = useMemo(() => {
    if (homeActivity && homeActivity.length > 0) return homeActivity;
    if (factoryMode) return [];
    return catalog.flatMap((col) => previewActivityFor(col));
  }, [homeActivity, catalog, factoryMode]);
  const markets = useMemo(() => {
    const map = new Map<string, CollectionMarket>();
    for (const col of collections) {
      map.set(col.slug, collectionMarketRow(col, listedPool, tape));
    }
    return map;
  }, [collections, listedPool, tape]);
  const featuredLaunchpads = useMemo(() => {
    if (featuredSlugs.length === 0) return [];
    const bySlug = new Map(collections.map((col) => [col.slug, col]));
    return featuredSlugs.map((s) => bySlug.get(s)).filter((col): col is (typeof collections)[number] => !!col);
  }, [collections, featuredSlugs]);
  const featuredCollections = useMemo(() => {
    return pickFeatured(collections, markets, 4, {
      exclude: new Set(featuredSlugs),
      requireVolume: true,
    });
  }, [collections, markets, featuredSlugs]);
  const recent = useMemo(() => {
    const source =
      homeActivity && homeActivity.length > 0
        ? homeActivity
        : collectionActivity && collectionActivity.length > 0
          ? collectionActivity
          : factoryMode
            ? []
            : catalog.flatMap((col) => previewActivityFor(col));
    const trades = liveTradeRows(source, 24);
    return trades.length > 0 ? trades : null;
  }, [homeActivity, collectionActivity, catalog, factoryMode]);
  const active = collections.find((c) => c.slug === slug) ?? null;
  const collectionRows = useMemo(() => {
    if (!slug) return [];
    const cat = active?.pkg ? [] : catalog;
    return itemsForExploreCollection(slug, cat, items, collectionItems);
  }, [slug, catalog, items, collectionItems, active?.pkg]);

  const collectionEvents = useMemo(() => {
    if (!slug) return [];
    if (collectionActivity && collectionActivity.length > 0) return collectionActivity;
    if (active?.pkg) return collectionActivity || [];
    const cat = catalog.find((c) => c.slug === slug);
    return cat ? previewActivityFor(cat) : [];
  }, [slug, catalog, collectionActivity, active?.pkg]);

  const localPoints = useMemo(() => {
    const fromActivity = activityToPoints(collectionEvents.filter((row) => !row.preview));
    if (fromActivity.length > 0) return fromActivity;
    if (active?.preview) {
      const cat = catalog.find((c) => c.slug === slug);
      if (cat) return listedPricesToPoints(cat.items);
    }
    const fromItems = listedPricesToPoints(collectionRows);
    if (fromItems.length > 0) return fromItems;
    return activityToPoints(collectionEvents);
  }, [collectionEvents, catalog, slug, collectionRows, active?.preview]);

  useEffect(() => {
    if (!slug) {
      setApiPoints(null);
      return;
    }
    let live = true;
    setApiPoints(null);
    void fetchChart({ slug }).then((rows) => {
      if (!live) return;
      if (rows && rows.length > 0) setApiPoints(rows);
    });
    return () => {
      live = false;
    };
  }, [slug]);

  const chartPoints = apiPoints && apiPoints.length > 0 ? apiPoints : localPoints;
  const chartPreview = !(apiPoints && apiPoints.length > 0) && !!active?.preview;

  const pool = useMemo(() => {
    const byKey = new Map<string, Item>();
    for (const row of [...collectionRows, ...items, ...listedPool]) {
      byKey.set(itemRowKey(row), row);
      if (row.id) byKey.set(row.id, row);
    }
    return byKey;
  }, [collectionRows, items, listedPool]);

  useEffect(() => {
    if (!itemId) {
      setSelected((cur) => (cur && cur.id ? null : cur));
      return;
    }
    const found = pool.get(itemId);
    setSelected(found ?? null);
  }, [itemId, pool]);

  function openItem(item: Item) {
    if (item.id && onItemId) onItemId(item.id);
    else setSelected(item);
  }

  const live = selected
    ? pool.get(itemRowKey(selected)) || (selected.id ? pool.get(selected.id) : undefined) || selected
    : null;
  const missing = chainNote && isRealmUnavailable(chainNote);
  const showHomeSkeleton = !catalogReady && collections.length === 0;

  function onTableSort(key: MarketSortKey) {
    if (key === tableSort) setTableDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setTableSort(key);
      setTableDir("desc");
    }
  }

  return (
    <section className="explore">
      {slug ? (
        <CollectionPage
          collection={active}
          slug={slug}
          items={collectionRows}
          activity={collectionEvents}
          chartPoints={chartPoints}
          chartPreview={chartPreview}
          query={query}
          onQuery={onQuery}
          onBack={() => onSlug("")}
          onOpenItem={openItem}
          onBuy={onBuy}
          onSell={onSell}
          onCancel={onCancel}
          wallet={wallet}
          offers={collectionOffers || []}
          pool={collectionPool || null}
          poolNfts={collectionPoolNfts || []}
          poolShares={collectionPoolShares || 0}
          socials={collectionSocials}
          connected={connected}
          blocked={blocked}
          busy={busy}
          onOffer={onOffer}
          onCancelOffer={onCancelOffer}
          onAcceptOffer={onAcceptOffer}
          onDepositPool={onDepositPool}
          onWithdrawPool={onWithdrawPool}
          onDepositNft={onDepositNft}
          onWithdrawNft={onWithdrawNft}
          onConnect={onConnect}
          onInstantSell={onInstantSell}
          onSweep={onSweep}
          cart={cart}
          onCart={onCart}
          onReveal={onReveal}
          onOpenMint={onOpenMint}
          hasOffers={hasOffers}
          hasPool={hasPool}
        />
      ) : (
        <>
          <header className="page-head">
            <h1>Explore</h1>
            <p className="muted">Live collections. Each has its own realm. Mint in GNOT.</p>
          </header>

          {chainNote && !(factoryMode && missing) ? (
            <p className="muted chain-note">
              {missing
                ? "Realm not on Pearl yet. Showing sample collections."
                : chainNote}{" "}
              <button className="text-btn" type="button" onClick={() => onOpenTab("settings")}>
                Open Settings
              </button>
            </p>
          ) : null}

          {showHomeSkeleton ? <SkeletonGrid count={3} /> : null}

          {!showHomeSkeleton && !slug && recent && recent.length > 0 ? <LiveTicker rows={recent} /> : null}

          {!showHomeSkeleton && !q && featuredLaunchpads.length > 0 ? (
            <FeaturedCollections
              title="Featured launchpads"
              collections={featuredLaunchpads}
              markets={markets}
              onOpen={onSlug}
              onMint={onOpenMint}
            />
          ) : null}

          {!showHomeSkeleton && !q && featuredCollections.length > 0 ? (
            <FeaturedCollections
              title="Featured collections"
              collections={featuredCollections}
              markets={markets}
              onOpen={onSlug}
            />
          ) : null}

          {!showHomeSkeleton && visibleCollections.length > 0 ? (
            <section className="market-section">
              <h2 className="section-title">
                Collections <span className="section-count">{visibleCollections.length}</span>
              </h2>
              <p className="hint market-note">Vol and Sales use the recent tape, not a calendar window.</p>
              <CollectionTable
                collections={visibleCollections}
                markets={markets}
                sort={tableSort}
                dir={tableDir}
                onSort={onTableSort}
                onOpen={onSlug}
              />
            </section>
          ) : null}

          {!showHomeSkeleton && collections.length > 0 && visibleCollections.length === 0 ? (
            <EmptyState title="No matches" body="Nothing matches that search.">
              <button className="btn" type="button" onClick={() => onQuery("")}>
                Clear search
              </button>
            </EmptyState>
          ) : null}

          {!showHomeSkeleton && catalogReady && collections.length === 0 ? (
            <EmptyState
              title="No collections"
              body="Create a drop, then list items at a fixed GNOT price."
            >
              <button className="btn primary" type="button" onClick={() => onOpenTab("create")}>
                Launch
              </button>
            </EmptyState>
          ) : null}
        </>
      )}

      {live ? (
        <ListingDrawer
          item={live}
          points={pointsForItem(chartPoints, live)}
          connected={connected}
          blocked={blocked}
          busy={busy}
          owned={!!wallet && (live.owner === wallet || live.seller === wallet)}
          onClose={() => {
            setSelected(null);
            onItemId?.("");
          }}
          onBuy={onBuy}
          onSell={onSell}
          onCancel={onCancel}
          onConnect={onConnect}
          onOpenCollection={(next) => {
            setSelected(null);
            onSlug(next);
          }}
          wallet={wallet}
          onOffer={onOffer}
          onDepositNft={onDepositNft}
          topOffer={live.id ? topOfferFor(collectionOffers || [], live.id) : null}
          onInstantSell={onInstantSell}
          onOpenProfile={onOpenProfile}
          peers={collectionRows}
          activity={collectionEvents.length ? collectionEvents : tape}
          onCart={onCart}
          inCart={cart.some((c) => itemRowKey(c) === itemRowKey(live))}
        />
      ) : null}
    </section>
  );
}

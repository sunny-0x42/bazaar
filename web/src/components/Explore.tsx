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
  BAZAAR_GENS_MINT_SLUG,
  isPkgPath,
  isRealmUnavailable,
  itemRowKey,
  networkById,
  sameAddr,
  parseItems,
  scopeLiveTape,
  type Activity,
  type ChainCollection,
  type Item,
  type NetworkId,
  type OfferRow,
  type PoolInfo,
  type PoolNft,
  type Socials,
  topOfferFor,
} from "../lib/chain";
import { activityToPoints, fetchChart, listedPricesToPoints, pointsForItem, type ChartPoint } from "../lib/chart";
import { ITEM_LINE_WAVE, readItemBookCache } from "../lib/itembook";
import { indexLiveArt, liveArtFor, liveArtKey, missingLiveArt } from "../lib/liveart";
import { evalExpr } from "../lib/wallets";
import type { MintRoundCard } from "../lib/mintrounds";
import { FeaturedCollections } from "./FeaturedCollections";
import { HomePulse } from "./HomePulse";
import { CollectionTable, type MarketSortKey } from "./CollectionTable";
import { LiveTicker } from "./LiveTicker";
import { CollectionPage } from "./CollectionPage";
import { EmptyState } from "./EmptyState";
import { ListingDrawer } from "./ListingDrawer";
import { SkeletonGrid } from "./SkeletonGrid";
import type { Tab } from "./types";

type Props = {
  items: Item[];
  holdings?: Item[];
  chainCollections: ChainCollection[];
  collectionItems: Item[] | null;
  collectionActivity: Activity[] | null;
  homeActivity?: Activity[] | null;
  /** Public slugs on the factory this UI is using. Null means the legacy book. */
  liveSlugs?: string[] | null;
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
  onItemId?: (id: string, slug?: string) => void;
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
  onSyncNft?: (item: Item) => void;
  onOpenMint?: (slug: string) => void;
  onRevealCollection?: (slug: string) => void;
  collectionHidden?: boolean;
  mintRounds?: MintRoundCard[];
  hasOffers?: boolean;
  hasPool?: boolean;
  onOpenProfile?: (addr: string) => void;
  /** Mainnet: never fall back to /samples/catalog.json (Pearl preview collections). */
  factoryOnly?: boolean;
  networkId?: NetworkId;
  moreCount?: number;
  moreBusy?: boolean;
  onLoadMore?: () => void;
};

export function Explore({
  items,
  holdings = [],
  chainCollections,
  collectionItems,
  collectionActivity,
  homeActivity,
  liveSlugs = null,
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
  onSyncNft,
  onOpenMint,
  onRevealCollection,
  collectionHidden = false,
  mintRounds = [],
  hasOffers = true,
  hasPool = true,
  onOpenProfile,
  factoryOnly = false,
  networkId = "mainnet",
  moreCount = 0,
  moreBusy = false,
  onLoadMore,
}: Props) {
  const [selected, setSelected] = useState<Item | null>(null);
  const [catalog, setCatalog] = useState<CatalogCollection[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [apiPoints, setApiPoints] = useState<ChartPoint[] | null>(null);
  const [tableSort, setTableSort] = useState<MarketSortKey>("vol");
  const [tableDir, setTableDir] = useState<"asc" | "desc">("desc");
  const [liveImages, setLiveImages] = useState<Record<string, { image: string; name: string }>>({});

  const factoryMode = useMemo(
    () => factoryOnly || chainCollections.some((c) => !!c.pkg),
    [factoryOnly, chainCollections],
  );

  useEffect(() => {
    if (factoryMode) {
      setCatalog([]);
      setCatalogReady(true);
      return;
    }
    if (loading) {
      setCatalogReady(false);
      return;
    }
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
  }, [factoryMode, loading]);

  const collections = useMemo(() => {
    if (loading && chainCollections.length === 0) return [];
    return buildExploreCollections(factoryMode ? [] : catalog, chainCollections, items);
  }, [loading, factoryMode, catalog, chainCollections, items]);

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
        : liveSlugs
          ? []
          : collectionActivity && collectionActivity.length > 0
            ? collectionActivity
            : factoryMode
              ? []
              : catalog.flatMap((col) => previewActivityFor(col));
    const trades = scopeLiveTape(source, liveSlugs, 24);
    return trades.length > 0 ? trades : null;
  }, [homeActivity, collectionActivity, catalog, factoryMode, liveSlugs]);
  const liveKnown = useMemo(() => {
    const known: Item[] = [...items, ...holdings];
    for (const col of chainCollections) {
      const pkg = col.pkg || "";
      if (!pkg) continue;
      const cached = readItemBookCache(pkg);
      if (!cached) continue;
      for (const row of cached.rows) known.push(row.collection ? row : { ...row, collection: col.slug });
    }
    if (!factoryMode) {
      for (const col of catalog) known.push(...previewItemsFor(col));
    }
    return indexLiveArt(known);
  }, [items, holdings, chainCollections, catalog, factoryMode]);
  useEffect(() => {
    const rows = recent || [];
    const ready: Record<string, { image: string; name: string }> = {};
    for (const row of rows) {
      const hit = liveArtFor(row, liveKnown);
      if (hit?.image) ready[liveArtKey(row)] = hit;
    }
    setLiveImages(ready);
    const missing = missingLiveArt(rows, liveKnown);
    if (missing.length === 0) return;
    const rpc = networkById(networkId).rpcUrl;
    const pkgOf = new Map(chainCollections.map((col) => [col.slug.trim().toLowerCase(), (col.pkg || "").trim()]));
    let stop = false;
    void (async () => {
      const jobs = missing
        .map((row) => ({ ...row, pkg: pkgOf.get(row.slug) || "" }))
        .filter((row) => isPkgPath(row.pkg));
      for (let i = 0; i < jobs.length; i += ITEM_LINE_WAVE) {
        const wave = jobs.slice(i, i + ITEM_LINE_WAVE);
        const found = await Promise.all(
          wave.map(async (job) => {
            try {
              const item = parseItems(await evalExpr(rpc, job.pkg, `ItemLine(${Number(job.id)})`))[0];
              const image = item?.image?.trim() || "";
              if (!image) return null;
              return [job.key, { image, name: item?.name?.trim() || "" }] as const;
            } catch {
              return null;
            }
          }),
        );
        if (stop) return;
        const add: Record<string, { image: string; name: string }> = {};
        for (const hit of found) {
          if (hit) add[hit[0]] = hit[1];
        }
        if (Object.keys(add).length > 0) setLiveImages((prev) => ({ ...prev, ...add }));
      }
    })();
    return () => {
      stop = true;
    };
  }, [recent, liveKnown, chainCollections, networkId]);
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
    for (const row of [...items, ...listedPool, ...holdings, ...collectionRows]) {
      byKey.set(itemRowKey(row), row);
    }
    return byKey;
  }, [collectionRows, items, listedPool, holdings]);

  useEffect(() => {
    if (!itemId) {
      setSelected((cur) => (cur && cur.id ? null : cur));
      return;
    }
    const match = [...collectionRows, ...holdings, ...items].find(
      (row) => row.id === itemId && (!slug || !row.collection || row.collection === slug),
    );
    setSelected(match || pool.get(itemId) || null);
  }, [itemId, pool, slug, collectionRows, holdings, items]);

  function openItem(item: Item) {
    if (item.id && onItemId) onItemId(item.id, item.collection);
    else setSelected(item);
  }

  const live = selected
    ? pool.get(itemRowKey(selected)) || selected
    : null;
  const missing = chainNote && isRealmUnavailable(chainNote);
  const showHomeSkeleton = (loading || !catalogReady) && collections.length === 0;

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
          activityLoading={Boolean(active?.pkg) && collectionActivity == null}
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
          onSyncNft={onSyncNft}
          onOpenMint={onOpenMint}
          onRevealCollection={
            onRevealCollection && slug ? () => onRevealCollection(slug) : undefined
          }
          sealed={collectionHidden}
          creatorAddr={chainCollections.find((col) => col.slug === slug)?.creator || ""}
          mintRounds={mintRounds}
          hasOffers={hasOffers}
          hasPool={hasPool}
          loading={collectionItems === null}
          moreCount={moreCount}
          moreBusy={moreBusy}
          onLoadMore={onLoadMore}
        />
      ) : (
        <>
          <header className="explore-hero">
            <div className="explore-hero-copy">
              <p className="explore-kicker">
                {networkId === "onyx"
                  ? "Onyx · onyx-1"
                  : networkId === "pearl"
                    ? "Pearl · pearl-1"
                    : networkId === "local"
                      ? "Local · gnodev"
                      : "gno.land · Mainnet"}
              </p>
              <h1>Discover NFTs</h1>
              <p className="explore-lead">
                Fixed-price collections on their own realms. Mint and trade in GNOT.
              </p>
              <div className="explore-hero-actions">
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => onOpenMint?.(BAZAAR_GENS_MINT_SLUG)}
                >
                  Bazaar Gens · 1,111
                </button>
                <button className="btn" type="button" onClick={() => onOpenTab("create")}>
                  Launch a collection
                </button>
              </div>
            </div>
            <HomePulse collections={chainCollections} networkId={networkId} />
          </header>

          {chainNote && !(factoryMode && missing) ? (
            <p className="muted chain-note">{chainNote}</p>
          ) : null}

          {showHomeSkeleton ? <SkeletonGrid count={3} /> : null}

          {!showHomeSkeleton && !slug && recent && recent.length > 0 ? <LiveTicker rows={recent} images={liveImages} /> : null}

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
              title="The market is open"
              body="No public collections on this factory yet. Launch a drop, mint, then list at a fixed GNOT price."
            >
              <button className="btn primary" type="button" onClick={() => onOpenTab("create")}>
                Launch a collection
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
          owned={!!wallet && (sameAddr(live.owner, wallet) || sameAddr(live.seller, wallet))}
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
          onSync={onSyncNft}
        />
      ) : null}
    </section>
  );
}

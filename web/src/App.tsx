import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { Admin } from "./components/Admin";
import { Launch } from "./components/Launch";
import type { LaunchPlan } from "./components/LaunchWizard";
import { DROP_ADD_CAP } from "./lib/dropjson";
import { MintPage } from "./components/MintPage";
import { Explore } from "./components/Explore";
import { CartBar } from "./components/CartBar";
import { Footer } from "./components/Footer";
import { Guide } from "./components/Guide";
import { Header } from "./components/Header";
import { Notices } from "./components/Notices";
import { Profile } from "./components/Profile";
import { Sell } from "./components/Sell";
import { Settings } from "./components/Settings";
import { SkipLink } from "./components/SkipLink";
import { TestnetRibbon } from "./components/TestnetRibbon";
import type { Account, Tab } from "./components/types";
import {
  collectionBookPath,
  collectionRealmPath,
  collectionHash,
  isNameNotDeclared,
  isOwnListing,
  isPkgPath,
  isRealmUnavailable,
  isPreviewItem,
  itemCollectionSlug,
  itemHash,
  mintHash,
  FACTORY_PKG,
  FACTORY_PKG_PEARL,
  FACTORY_PKG_PEARL_V2,
  factoryPkgFor,
  loadFactory,
  loadHub,
  loadNetwork,
  loadNft,
  networkById,
  normalizePkgPath,
  parseActivityLines,
  parseCollectionLines,
  parseEvalString,
  parseFactoryCollectionLines,
  parseHash,
  parseIds,
  tabHash,
  parseItems,
  parseDropSlotLines,
  parseEvalInt,
  parseFeaturedLines,
  parseDropSale,
  type DropSale,
  parseOfferLines,
  parsePoolNftLines,
  parsePoolOf,
  parseSocials,
  profileHash,
  sameAddr,
  SWEEP_CAP,
  canAddToCart,
  itemRowKey,
  topOfferFor,
  saveFactory,
  saveHub,
  saveNetwork,
  saveNft,
  UGNOT,
  ugnotFromGnot,
  type Activity,
  type ChainCollection,
  type DropSlot,
  type Item,
  type OfferRow,
  type PoolInfo,
  type PoolNft,
  type Socials,
} from "./lib/chain";
import { fetchActivity } from "./lib/indexer";
import { emptyProfile, loadLocalProfile, parseProfileLine, saveLocalProfile, type UserProfile } from "./lib/userProfile";
import { connectAdena, doContractCall, evalExpr } from "./lib/wallets";

async function loadListOpen(rpc: string, pkg: string): Promise<Item[]> {
  return parseItems(await evalExpr(rpc, pkg, "ListOpen()"));
}

async function loadItemLine(rpc: string, pkg: string, id: string | number): Promise<Item | null> {
  try {
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) return null;
    return parseItems(await evalExpr(rpc, pkg, `ItemLine(${n})`))[0] ?? null;
  } catch {
    return null;
  }
}

function tagCollectionSlug(items: Item[], slug: string): Item[] {
  return items.map((it) => (it.collection ? it : { ...it, collection: slug }));
}

async function loadCollectionBook(
  rpc: string,
  pkg: string,
  slug: string,
  minted = 0,
): Promise<Item[]> {
  let open: Item[] = [];
  try {
    open = tagCollectionSlug(await loadListOpen(rpc, pkg), slug);
  } catch {
    open = [];
  }
  const byId = new Map(open.filter((it) => it.id).map((it) => [it.id, it]));
  const cap = Math.min(50, Math.max(minted, 0));
  const missing: number[] = [];
  for (let n = 1; n <= cap; n++) {
    if (!byId.has(String(n))) missing.push(n);
  }
  if (missing.length > 0) {
    const extra = await Promise.all(missing.map((n) => loadItemLine(rpc, pkg, n)));
    for (const row of extra) {
      if (!row?.id) continue;
      byId.set(row.id, row.collection ? row : { ...row, collection: slug });
    }
  }
  return [...byId.values()];
}

async function loadHoldings(rpc: string, nftPath: string, addr: string, open: Item[]): Promise<Item[]> {
  const idsRaw = await evalExpr(rpc, nftPath, `TokensOf(${JSON.stringify(addr)})`);
  const ids = parseIds(idsRaw);
  const listedMap = new Map(open.map((row) => [row.id, row]));
  const missing = ids.filter((id) => !listedMap.has(id)).slice(0, 50);
  const extra = (
    await Promise.all(missing.map((id) => loadItemLine(rpc, nftPath, id)))
  ).filter((row): row is Item => !!row);
  const byId = new Map<string, Item>();
  for (const row of extra) byId.set(row.id, { ...row, listed: false });
  const who = addr.toLowerCase();
  for (const row of open) {
    if ((row.seller || "").toLowerCase() === who) byId.set(row.id, { ...row, listed: true });
  }
  return [...byId.values()];
}

async function resolveNftPath(rpc: string, hub: string, fallback: string): Promise<string> {
  if (!isPkgPath(hub)) return normalizePkgPath(fallback);
  for (const key of ["nft", "market"] as const) {
    try {
      const mod = parseEvalString(await evalExpr(rpc, hub, `GetModule("${key}")`));
      if (isPkgPath(mod)) return normalizePkgPath(mod);
    } catch {
      /* hub missing this module — try next */
    }
  }
  return normalizePkgPath(fallback);
}

export function App() {
  const [tab, setTab] = useState<Tab>("explore");
  const [hub, setHub] = useState(loadHub);
  const [nft, setNft] = useState(loadNft);
  const [factory, setFactory] = useState(loadFactory);
  const [account, setAccount] = useState<Account | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [owned, setOwned] = useState<Item[]>([]);
  const [chainCollections, setChainCollections] = useState<ChainCollection[]>([]);
  const [collectionSlug, setCollectionSlug] = useState("");
  const [collectionItems, setCollectionItems] = useState<Item[] | null>(null);
  const [collectionActivity, setCollectionActivity] = useState<Activity[] | null>(null);
  const [collectionOffers, setCollectionOffers] = useState<OfferRow[]>([]);
  const [collectionPool, setCollectionPool] = useState<PoolInfo | null>(null);
  const [collectionPoolNfts, setCollectionPoolNfts] = useState<PoolNft[]>([]);
  const [collectionPoolShares, setCollectionPoolShares] = useState(0);
  const [collectionSocials, setCollectionSocials] = useState<Socials>({ website: "", twitter: "", discord: "" });
  const [homeActivity, setHomeActivity] = useState<Activity[] | null>(null);
  const [featuredSlugs, setFeaturedSlugs] = useState<string[]>([]);
  const [chainNote, setChainNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [listId, setListId] = useState("");
  const [listPrice, setListPrice] = useState("1");
  const [net, setNet] = useState(loadNetwork);
  useEffect(() => {
    if (
      !factory ||
      factory === FACTORY_PKG ||
      factory === FACTORY_PKG_PEARL ||
      factory.endsWith("/bazaar/factory")
    ) {
      setFactory(factoryPkgFor(net.id));
    }
  }, [net.id]);
  const [openItemId, setOpenItemId] = useState("");
  const [profileAddr, setProfileAddr] = useState("");
  const [profileItems, setProfileItems] = useState<Item[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [slotSlug, setSlotSlug] = useState("");
  const [dropSlots, setDropSlots] = useState<DropSlot[]>([]);
  const [dropHidden, setDropHidden] = useState(false);
  const [dropLoaded, setDropLoaded] = useState(0);
  const [dropAllowN, setDropAllowN] = useState(0);
  const [dropMintCap, setDropMintCap] = useState(0);
  const [mintSlug, setMintSlug] = useState("");
  const [mintLoaded, setMintLoaded] = useState(0);
  const [mintHidden, setMintHidden] = useState(false);
  const [mintAllowN, setMintAllowN] = useState(0);
  const [mintCap, setMintCap] = useState(0);
  const [mintSale, setMintSale] = useState<DropSale | null>(null);
  const [mintTokenURI, setMintTokenURI] = useState("");
  const [hasOffers, setHasOffers] = useState(true);
  const [hasPool, setHasPool] = useState(true);
  const [launchFeeUgnot, setLaunchFeeUgnot] = useState(1_000_000_000);
  const [adminAddr, setAdminAddr] = useState("");
  const [cart, setCart] = useState<Item[]>([]);
  const [viewProfile, setViewProfile] = useState(emptyProfile());

  const rpc = net.rpcUrl;
  const connected = !!account?.address;
  const wrongNet = !!(account?.chainId && account.chainId !== net.chainId);
  const blocked = wrongNet;

  const refresh = useCallback(async () => {
    setChainNote("");
    const nftPath = await resolveNftPath(rpc, hub, nft);
    if (nftPath !== nft) setNft(nftPath);
    const factoryPath = isPkgPath(factory) ? normalizePkgPath(factory) : "";

    const factoryTask = (async () => {
      const paths = [factoryPath, net.id === "pearl" ? FACTORY_PKG_PEARL_V2 : ""].filter(
        (p, i, all) => p && isPkgPath(p) && all.indexOf(p) === i,
      );
      const packs = await Promise.all(
        paths.map((p) =>
          evalExpr(rpc, p, "ListCollections()")
            .then(parseFactoryCollectionLines)
            .catch(() => [] as ChainCollection[]),
        ),
      );
      const bySlug = new Map<string, ChainCollection>();
      for (const row of packs.flat()) bySlug.set(row.slug, row);
      return [...bySlug.values()];
    })();
    const openTask = isPkgPath(nftPath)
      ? loadListOpen(rpc, nftPath)
          .then((rows) => ({ rows, error: "" }))
          .catch((e) => ({
            rows: [] as Item[],
            error: e instanceof Error ? e.message : "Could not read listings from this package path.",
          }))
      : Promise.resolve({ rows: [] as Item[], error: "Set a valid NFT package path in Settings." });

    const [factoryCols, openResult] = await Promise.all([factoryTask, openTask]);

    async function nftExtras() {
      try {
        if (factoryPath) {
          setLaunchFeeUgnot(parseEvalInt(await evalExpr(rpc, factoryPath, "LaunchFee()")));
        } else if (isPkgPath(nftPath)) {
          setLaunchFeeUgnot(parseEvalInt(await evalExpr(rpc, nftPath, "LaunchFee()")));
        } else {
          setLaunchFeeUgnot(1_000_000_000);
        }
      } catch {
        setLaunchFeeUgnot(1_000_000_000);
      }
      try {
        if (factoryPath) {
          setAdminAddr(parseEvalString(await evalExpr(rpc, factoryPath, "Admin()")));
        } else if (isPkgPath(nftPath)) {
          setAdminAddr(parseEvalString(await evalExpr(rpc, nftPath, "Admin()")));
        } else {
          setAdminAddr("");
        }
      } catch {
        setAdminAddr("");
      }
      if (!isPkgPath(nftPath)) {
        setHasOffers(false);
        setHasPool(false);
        setFeaturedSlugs([]);
        return;
      }
      try {
        await evalExpr(rpc, nftPath, `ListOffers("bazaar")`);
        setHasOffers(true);
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        setHasOffers(!isNameNotDeclared(raw));
      }
      try {
        await evalExpr(rpc, nftPath, `PoolOf("bazaar")`);
        setHasPool(true);
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        setHasPool(!isNameNotDeclared(raw));
      }
      try {
        setFeaturedSlugs(parseFeaturedLines(await evalExpr(rpc, nftPath, "Featured()")));
      } catch {
        setFeaturedSlugs([]);
      }
    }

    if (factoryCols.length > 0) {
      setChainCollections(factoryCols);
      const openLists = await Promise.all(
        factoryCols.map(async (col) => {
          if (!col.pkg || !isPkgPath(col.pkg)) return [] as Item[];
          try {
            return tagCollectionSlug(await loadListOpen(rpc, col.pkg), col.slug);
          } catch {
            return [];
          }
        }),
      );
      const open = openLists.flat();
      setItems(open);
      setHomeActivity(null);
      if (account?.address) {
        const packs = await Promise.all(
          factoryCols.map(async (col) => {
            if (!col.pkg || !isPkgPath(col.pkg)) return [] as Item[];
            const listed = open.filter((row) => itemCollectionSlug(row) === col.slug);
            try {
              return tagCollectionSlug(await loadHoldings(rpc, col.pkg, account.address, listed), col.slug);
            } catch {
              return listed
                .filter((row) => row.seller === account.address)
                .map((row) => ({ ...row, listed: true }));
            }
          }),
        );
        const byKey = new Map<string, Item>();
        for (const row of packs.flat()) byKey.set(itemRowKey(row), row);
        setOwned([...byKey.values()]);
      } else {
        setOwned([]);
      }
      await nftExtras();
      setFeaturedSlugs(
        factoryCols.filter((col) => col.maxSupply === 0 || col.minted < col.maxSupply).map((col) => col.slug),
      );
      setLoading(false);
      return;
    }

    if (!isPkgPath(nftPath)) {
      setItems([]);
      setOwned([]);
      setChainCollections([]);
      setHomeActivity(null);
      setChainNote("Set a valid NFT package path in Settings.");
      setLoading(false);
      return;
    }
    if (openResult.error) {
      setItems([]);
      setOwned([]);
      setChainCollections([]);
      setHomeActivity(null);
      const raw = openResult.error;
      setChainNote(
        raw.startsWith("Could not read") || raw.startsWith("Set a valid") ? raw : `Could not read listings: ${raw}`,
      );
      setLoading(false);
      return;
    }
    const open = openResult.rows;
    setItems(open);
    try {
      const colRaw = await evalExpr(rpc, nftPath, "ListCollections()");
      setChainCollections(parseCollectionLines(colRaw));
    } catch {
      setChainCollections([]);
    }
    try {
      const actRaw = await evalExpr(rpc, nftPath, "Activity()");
      const rows = parseActivityLines(actRaw);
      setHomeActivity(rows.length > 0 ? rows : null);
    } catch {
      setHomeActivity(null);
    }
    if (account?.address) {
      try {
        setOwned(await loadHoldings(rpc, nftPath, account.address, open));
      } catch {
        setOwned(open.filter((row) => row.seller === account.address).map((row) => ({ ...row, listed: true })));
      }
    } else {
      setOwned([]);
    }
    await nftExtras();
    setLoading(false);
  }, [hub, nft, factory, rpc, account?.address]);

  useEffect(() => {
    if (!profileAddr || !isPkgPath(nft) || sameAddr(profileAddr, account?.address)) {
      if (sameAddr(profileAddr, account?.address)) setProfileItems(owned);
      else if (!profileAddr) setProfileItems([]);
      return;
    }
    let live = true;
    setProfileLoading(true);
    void (async () => {
      try {
        const next = await loadHoldings(rpc, nft, profileAddr, items);
        if (live) setProfileItems(next);
      } catch {
        if (live) {
          setProfileItems(
            items
              .filter((row) => sameAddr(row.seller, profileAddr) || sameAddr(row.owner, profileAddr))
              .map((row) => ({ ...row, listed: !!row.listed })),
          );
        }
      } finally {
        if (live) setProfileLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [profileAddr, nft, rpc, items, account?.address, owned]);

  useEffect(() => {
    if (!slotSlug || !isPkgPath(nft)) {
      setDropSlots([]);
      setDropHidden(false);
      setDropLoaded(0);
      setDropAllowN(0);
      setDropMintCap(0);
      return;
    }
    let live = true;
    void (async () => {
      const arg = JSON.stringify(slotSlug);
      const countOf = async (expr: string) => {
        try {
          return parseEvalInt(await evalExpr(rpc, nft, expr));
        } catch {
          return 0;
        }
      };
      try {
        const hidden = (await evalExpr(rpc, nft, `HiddenOf(${arg})`)).includes("true");
        const loaded = parseEvalInt(await evalExpr(rpc, nft, `LoadedOf(${arg})`));
        const raw = hidden ? "" : await evalExpr(rpc, nft, `ListDropSlots(${arg})`);
        const [allowN, cap] = await Promise.all([
          countOf(`AllowCount(${arg})`),
          countOf(`MintCapOf(${arg})`),
        ]);
        if (!live) return;
        setDropHidden(hidden);
        setDropLoaded(loaded);
        setDropSlots(hidden ? [] : parseDropSlotLines(raw));
        setDropAllowN(allowN);
        setDropMintCap(cap);
      } catch {
        if (live) {
          setDropHidden(false);
          setDropLoaded(0);
          setDropSlots([]);
          setDropAllowN(0);
          setDropMintCap(0);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [slotSlug, nft, rpc, items]);

  useEffect(() => {
    if (!mintSlug || !isPkgPath(nft)) {
      setMintLoaded(0);
      setMintHidden(false);
      setMintAllowN(0);
      setMintCap(0);
      setMintSale(null);
      return;
    }
    let live = true;
    const arg = JSON.stringify(mintSlug);
    void (async () => {
      const load = async (expr: string) => {
        try {
          return parseEvalInt(await evalExpr(rpc, nft, expr));
        } catch {
          return 0;
        }
      };
      const [loaded, allowN, cap, hiddenRaw, saleRaw] = await Promise.all([
        load(`LoadedOf(${arg})`),
        load(`AllowCount(${arg})`),
        load(`MintCapOf(${arg})`),
        evalExpr(rpc, nft, `HiddenOf(${arg})`).catch(() => ""),
        evalExpr(rpc, nft, `DropSaleOf(${arg})`).catch(() => ""),
      ]);
      if (!live) return;
      setMintLoaded(loaded);
      setMintHidden(hiddenRaw.includes("true"));
      setMintAllowN(allowN);
      setMintCap(cap);
      setMintSale(saleRaw ? parseDropSale(saleRaw) : null);
    })();
    return () => {
      live = false;
    };
  }, [mintSlug, nft, rpc, items]);

  useEffect(() => {
    const col = chainCollections.find((c) => c.slug === mintSlug);
    const pkg = col?.pkg && isPkgPath(col.pkg) ? normalizePkgPath(col.pkg) : "";
    const minted = col?.minted || col?.count || 0;
    if (!mintSlug || !pkg || minted < 1) {
      setMintTokenURI("");
      return;
    }
    let live = true;
    void evalExpr(rpc, pkg, `TokenURI(${minted})`)
      .then((raw) => {
        if (live) setMintTokenURI(raw);
      })
      .catch(() => {
        if (!live) return;
        void evalExpr(rpc, pkg, "TokenURI(1)")
          .then((raw) => {
            if (live) setMintTokenURI(raw);
          })
          .catch(() => {
            if (live) setMintTokenURI("");
          });
      });
    return () => {
      live = false;
    };
  }, [mintSlug, chainCollections, rpc, items]);

  useEffect(() => {
    saveHub(hub);
    saveNft(nft);
    saveFactory(factory);
    saveNetwork(net.id);
  }, [hub, nft, factory, net.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function clearCollection() {
      setCollectionItems(null);
      setCollectionActivity(null);
      setCollectionOffers([]);
      setCollectionPool(null);
      setCollectionPoolNfts([]);
      setCollectionPoolShares(0);
      setCollectionSocials({ website: "", twitter: "", discord: "" });
    }
    if (!collectionSlug) {
      clearCollection();
      return;
    }
    const col = chainCollections.find((c) => c.slug === collectionSlug);
    const book = collectionBookPath(collectionSlug, chainCollections, nft);
    const factoryBook = !!(col?.pkg && isPkgPath(col.pkg));
    if (!isPkgPath(book)) {
      clearCollection();
      return;
    }
    let live = true;
    const arg = JSON.stringify(collectionSlug);
    void (async () => {
      if (factoryBook) {
        const minted = col?.minted || col?.count || 0;
        const nextItems = await loadCollectionBook(rpc, book, collectionSlug, minted);
        let nextActivity: Activity[] = [];
        try {
          nextActivity = parseActivityLines(await evalExpr(rpc, book, "Activity()")).map((row) => ({
            ...row,
            preview: false,
            source: "on-chain" as const,
          }));
        } catch {
          nextActivity = [];
        }
        if (!live) return;
        setCollectionItems(nextItems);
        setCollectionActivity(nextActivity);
        setCollectionOffers([]);
        setCollectionPool(null);
        setCollectionPoolNfts([]);
        setCollectionPoolShares(0);
        setCollectionSocials({ website: "", twitter: "", discord: "" });
        return;
      }
      const itemsTask = (async () => {
        for (const expr of [`ListItemsByCollection(${arg})`, `ListByCollection(${arg})`]) {
          try {
            const parsed = parseItems(await evalExpr(rpc, nft, expr));
            if (parsed.length > 0) return parsed;
          } catch {
            /* realm may not expose this read yet */
          }
        }
        return null;
      })();
      const activityTask = (async () => {
        const indexed = await fetchActivity({ slug: collectionSlug, limit: 50 });
        if (indexed && indexed.length > 0) {
          return indexed.map((row) => ({ ...row, preview: false, source: "indexed" as const }));
        }
        try {
          const rows = parseActivityLines(await evalExpr(rpc, nft, `ActivityByCollection(${arg})`));
          return rows.map((row) => ({ ...row, preview: false, source: "on-chain" as const }));
        } catch {
          return [];
        }
      })();
      const offersTask = (async () => {
        try {
          return parseOfferLines(await evalExpr(rpc, nft, `ListOffers(${arg})`));
        } catch {
          return [];
        }
      })();
      const poolTask = (async () => {
        try {
          return parsePoolOf(await evalExpr(rpc, nft, `PoolOf(${arg})`));
        } catch {
          return null;
        }
      })();
      const socialsTask = (async () => {
        try {
          return parseSocials(await evalExpr(rpc, nft, `Socials(${arg})`));
        } catch {
          return { website: "", twitter: "", discord: "" };
        }
      })();
      const poolNftsTask = (async () => {
        try {
          return parsePoolNftLines(await evalExpr(rpc, nft, `ListPoolNfts(${arg})`));
        } catch {
          return [];
        }
      })();
      const sharesTask = (async () => {
        if (!account?.address) return 0;
        try {
          return parseEvalInt(
            await evalExpr(rpc, nft, `MyPoolShares(${arg},${JSON.stringify(account.address)})`),
          );
        } catch {
          return 0;
        }
      })();
      const [nextItems, nextActivity, nextOffers, nextPool, nextSocials, nextPoolNfts, nextShares] =
        await Promise.all([
          itemsTask,
          activityTask,
          offersTask,
          poolTask,
          socialsTask,
          poolNftsTask,
          sharesTask,
        ]);
      if (!live) return;
      setCollectionItems(nextItems);
      setCollectionActivity(nextActivity);
      setCollectionOffers(nextOffers);
      setCollectionPool(nextPool);
      setCollectionSocials(nextSocials);
      setCollectionPoolNfts(nextPoolNfts);
      setCollectionPoolShares(nextShares);
    })();
    return () => {
      live = false;
    };
  }, [collectionSlug, nft, chainCollections, rpc, items, account?.address]);

  function writeHash(next: string) {
    const cur = window.location.hash === "#" ? "" : window.location.hash || "";
    if (cur === next) return;
    const url = `${window.location.pathname}${window.location.search}${next}`;
    window.history.pushState(null, "", url);
  }

  function onExploreHome() {
    setTab("explore");
    setCollectionSlug("");
    setOpenItemId("");
    setProfileAddr("");
    setMintSlug("");
    writeHash("#/explore");
  }

  function goTab(next: Tab) {
    if (next !== "explore") {
      setOpenItemId("");
      setCollectionSlug("");
    }
    if (next === "portfolio") {
      const addr = account?.address || "";
      setProfileAddr(addr);
      setTab("portfolio");
      writeHash(addr ? profileHash(addr) : "#/profile");
      return;
    }
    setProfileAddr("");
    setMintSlug("");
    setTab(next);
    writeHash(tabHash(next));
  }

  function onOpenMint(slug: string) {
    setMintSlug(slug);
    setOpenItemId("");
    setCollectionSlug("");
    setTab("create");
    writeHash(mintHash(slug));
  }

  function onOpenProfile(addr: string) {
    if (!addr) return;
    setOpenItemId("");
    setCollectionSlug("");
    setProfileAddr(addr);
    setTab("portfolio");
    writeHash(profileHash(addr));
  }

  function onSlug(next: string) {
    setCollectionSlug(next);
    setOpenItemId("");
    setTab("explore");
    writeHash(next ? collectionHash(next) : "");
  }

  function onItemId(id: string) {
    setOpenItemId(id);
    if (id) {
      setTab("explore");
      writeHash(itemHash(id));
    } else if (collectionSlug) {
      writeHash(collectionHash(collectionSlug));
    } else {
      writeHash("");
    }
  }

  useEffect(() => {
    function apply() {
      const route = parseHash(window.location.hash);
      if (route.mintSlug) {
        setTab("create");
        setMintSlug(route.mintSlug);
        setCollectionSlug("");
        setOpenItemId("");
        setProfileAddr("");
        return;
      }
      if (route.slug) {
        setTab("explore");
        setCollectionSlug(route.slug);
        setOpenItemId("");
        setProfileAddr("");
        setMintSlug("");
        return;
      }
      if (route.itemId) {
        setTab("explore");
        setOpenItemId(route.itemId);
        setProfileAddr("");
        setMintSlug("");
        return;
      }
      if (route.tab === "portfolio") {
        setTab("portfolio");
        setOpenItemId("");
        setCollectionSlug("");
        setProfileAddr(route.profile);
        setMintSlug("");
        return;
      }
      setOpenItemId("");
      setCollectionSlug("");
      setProfileAddr("");
      setMintSlug("");
      setTab(route.tab);
    }
    apply();
    window.addEventListener("hashchange", apply);
    window.addEventListener("popstate", apply);
    return () => {
      window.removeEventListener("hashchange", apply);
      window.removeEventListener("popstate", apply);
    };
  }, []);

  const unlisted = useMemo(() => owned.filter((row) => !row.listed), [owned]);
  const sellItems = useMemo(() => {
    const extra = owned.find((row) => row.listed && row.id === listId);
    if (extra && !unlisted.some((row) => row.id === extra.id)) return [extra, ...unlisted];
    return unlisted;
  }, [owned, unlisted, listId]);

  useEffect(() => {
    if (owned.some((row) => row.id === listId)) return;
    if (!unlisted.some((row) => row.id === listId)) {
      setListId(unlisted[0]?.id || "");
    }
  }, [unlisted, owned, listId]);

  async function onConnect() {
    setErr("");
    setMsg("");
    try {
      const acc = await connectAdena(net);
      setAccount(acc);
      setMsg("Wallet connected.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  function bookOf(slug: string): string {
    return collectionBookPath(slug, chainCollections, nft);
  }

  function factoryPkgOf(slug: string): string {
    const pkg = collectionBookPath(slug, chainCollections, "");
    return isPkgPath(pkg) ? pkg : "";
  }

  async function call(func: string, args: string[], send = "", pkgPath?: string): Promise<boolean> {
    setBusy(func);
    setErr("");
    setMsg("");
    try {
      if (!account) throw new Error("Connect Adena first.");
      if (wrongNet) throw new Error(`Switch Adena to ${net.chainName} (${net.chainId}).`);
      const path = normalizePkgPath(pkgPath || nft);
      if (!isPkgPath(path)) throw new Error("Set a valid NFT package path.");
      const res = await doContractCall({
        caller: account.address,
        pkgPath: path,
        func,
        args,
        send,
        network: net,
      });
      setMsg(res.hash ? `Submitted ${res.hash.slice(0, 10)}…` : "Submitted.");
      await refresh();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy("");
    }
  }

  async function copyLocalCollection(slug: string): Promise<string> {
    const helperErr =
      "Local gnodev helper is required. Run npm run dev so POST /local/new-col can copy the collection realm.";
    let res: Response;
    try {
      res = await fetch("/local/new-col", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
    } catch {
      throw new Error(helperErr);
    }
    if (res.status === 404) throw new Error(helperErr);
    let data: { ok?: boolean; error?: string; pkg?: string } = {};
    try {
      data = (await res.json()) as { ok?: boolean; error?: string; pkg?: string };
    } catch {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data.error || `Could not copy collection realm (${res.status}).`);
    }
    const pkg = data.pkg ? normalizePkgPath(data.pkg) : collectionRealmPath(slug, "local");
    if (!isPkgPath(pkg)) throw new Error("Local helper did not return a collection package path.");
    return pkg;
  }

  async function collectionRealmOnChain(pkg: string): Promise<boolean> {
    let undeclared = false;
    for (const expr of ["GrcName()", "Creator()"]) {
      try {
        await evalExpr(rpc, pkg, expr);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/call Init first/i.test(msg)) return true;
        if (isNameNotDeclared(msg)) {
          undeclared = true;
          continue;
        }
        if (isRealmUnavailable(msg) || /package not found|not on this chain yet/i.test(msg)) {
          return false;
        }
        return true;
      }
    }
    return undeclared;
  }

  async function launchSendFor(slug: string): Promise<string> {
    const fee = launchFeeUgnot > 0 ? `${launchFeeUgnot}ugnot` : "";
    const factoryPath = isPkgPath(factory) ? normalizePkgPath(factory) : "";
    if (!factoryPath) return fee;
    try {
      const raw = await evalExpr(rpc, factoryPath, `ReservedCreator(${JSON.stringify(slug)})`);
      const reserved = parseEvalString(raw).trim();
      if (reserved) return "";
      return fee;
    } catch {
      return fee;
    }
  }

  async function launchWizard(plan: LaunchPlan) {
    setBusy("Init");
    setErr("");
    setMsg("");
    let pkg = collectionRealmPath(plan.slug, net.id);
    if (net.id === "local") {
      try {
        pkg = await copyLocalCollection(plan.slug);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setBusy("");
        return;
      }
    } else {
      const onChain = await collectionRealmOnChain(pkg);
      if (!onChain) {
        setErr("This collection realm is not on chain yet. Ask Bazaar to addpkg, then Initialize.");
        setBusy("");
        return;
      }
    }
    const send = await launchSendFor(plan.slug);
    const created = await call(
      "Init",
      [plan.name, plan.slug, plan.cover, plan.maxSupply, plan.priceUgnot, String(plan.royaltyBps)],
      send,
      pkg,
    );
    if (!created) return;
    if (plan.blob) {
      const lines = plan.blob.split("\n").filter(Boolean);
      for (let i = 0; i < lines.length; i += DROP_ADD_CAP) {
        const chunk = lines.slice(i, i + DROP_ADD_CAP).join("\n");
        if (!(await call("AddDropItems", [chunk], "", pkg))) return;
      }
    }
    onOpenMint(plan.slug);
  }

  const profileKey = (profileAddr || account?.address || "").trim();
  const mineProfile = sameAddr(profileKey, account?.address);

  useEffect(() => {
    const addr = profileKey;
    if (!addr) {
      setViewProfile(emptyProfile());
      return;
    }
    let live = true;
    const local = loadLocalProfile(addr);
    setViewProfile(local);
    if (!isPkgPath(nft)) return;
    void (async () => {
      try {
        const raw = await evalExpr(rpc, nft, `ProfileOf(${JSON.stringify(addr)})`);
        const chain = parseProfileLine(raw);
        if (!live) return;
        if (mineProfile) {
          setViewProfile({
            name: local.name || chain.name,
            avatar: local.avatar || chain.avatar,
            banner: local.banner || chain.banner,
            website: local.website || chain.website,
            twitter: local.twitter || chain.twitter,
            discord: local.discord || chain.discord,
          });
        } else if (chain.name || chain.avatar) {
          setViewProfile(chain);
        }
      } catch {
        /* ProfileOf is optional on the book */
      }
    })();
    return () => {
      live = false;
    };
  }, [profileKey, nft, rpc, mineProfile]);

  async function saveUserProfile(next: UserProfile) {
    if (!account?.address) return;
    saveLocalProfile(account.address, next);
    setViewProfile(next);
    setErr("");
    setMsg("Profile saved on this device.");
    try {
      if (!isPkgPath(nft)) return;
      await doContractCall({
        caller: account.address,
        pkgPath: nft,
        func: "SetProfile",
        args: [next.name, next.avatar, next.banner, next.website, next.twitter, next.discord],
        network: net,
      });
      setMsg("Profile saved on-chain.");
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (/not declared|SetProfile/i.test(raw)) {
        setMsg("Profile saved on this browser. On-chain profile needs a newer NFT module.");
      } else {
        setErr(raw);
      }
    }
  }

  function onCart(item: Item) {
    const key = itemRowKey(item);
    setCart((prev) => {
      if (prev.some((row) => itemRowKey(row) === key)) return prev.filter((row) => itemRowKey(row) !== key);
      if (prev.length >= SWEEP_CAP) return prev;
      if (!canAddToCart(item, account?.address)) return prev;
      return [...prev, item];
    });
  }

  function onBuy(row: Item) {
    if (!row.listed || row.price <= 0) return;
    if (!account || isPreviewItem(row) || !row.id) {
      void onConnect();
      return;
    }
    if (isOwnListing(row, account.address)) {
      setErr("This is your listing. Connect a different Adena account to buy, or Cancel.");
      return;
    }
    void call("Buy", [row.id], `${row.price}ugnot`, bookOf(itemCollectionSlug(row)));
  }

  function onSell(row: Item) {
    if (row.id) setListId(row.id);
    if (row.listed && row.price > 0) setListPrice(String(row.price / UGNOT));
    setTab("sell");
  }

  function onSubmitList() {
    const price = String(ugnotFromGnot(listPrice));
    const row = owned.find((it) => it.id === listId);
    const pkg = row ? bookOf(itemCollectionSlug(row)) : nft;
    const listed = row?.listed;
    if (listed) void call("UpdatePrice", [listId, price], "", pkg);
    else void call("List", [listId, price], "", pkg);
  }

  function onPickNetwork(id: string) {
    const next = networkById(id);
    saveNetwork(next.id);
    setNet(next);
    setAccount(null);
  }

  return (
    <>
      <SkipLink />
      <TestnetRibbon network={net} />
      <Header
        tab={tab}
        query={query}
        connected={connected}
        address={account?.address}
        coins={account?.coins}
        onTab={goTab}
        onExploreHome={onExploreHome}
        onQuery={setQuery}
        onConnect={() => void onConnect()}
        network={net}
        onNetwork={onPickNetwork}
        onProfile={account?.address ? () => onOpenProfile(account.address) : undefined}
        isAdmin={connected && sameAddr(account?.address, adminAddr)}
      />
      <Notices
        wrongNet={wrongNet}
        chainId={account?.chainId}
        wantChainId={net.chainId}
        err={err}
        msg={msg}
        busy={busy}
      />
      <main id="main" tabIndex={-1}>
        {tab === "explore" ? (
          <Explore
            items={items}
            chainCollections={chainCollections}
            collectionItems={collectionItems}
            collectionActivity={collectionActivity}
            collectionOffers={collectionOffers}
            collectionPool={collectionPool}
            collectionPoolNfts={collectionPoolNfts}
            collectionPoolShares={collectionPoolShares}
            collectionSocials={collectionSocials}
            homeActivity={homeActivity}
            featuredSlugs={featuredSlugs}
            slug={collectionSlug}
            onSlug={onSlug}
            itemId={openItemId}
            onItemId={onItemId}
            query={query}
            onQuery={setQuery}
            loading={loading}
            chainNote={chainNote}
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            onOpenTab={goTab}
            onBuy={onBuy}
            onSell={onSell}
            onCancel={(row) => void call("Cancel", [row.id], "", bookOf(itemCollectionSlug(row)))}
            onConnect={() => void onConnect()}
            wallet={account?.address}
            onOffer={hasOffers ? (id, ugnot) => void call("Offer", [id], `${ugnot}ugnot`) : undefined}
            onCancelOffer={hasOffers ? (id) => void call("CancelOffer", [id]) : undefined}
            onAcceptOffer={hasOffers ? (id, bidder) => void call("AcceptOffer", [id, bidder]) : undefined}
            onDepositPool={hasPool ? (slug, ugnot) => void call("DepositPool", [slug], `${ugnot}ugnot`) : undefined}
            onWithdrawPool={hasPool ? (slug, shares) => void call("WithdrawPool", [slug, String(shares)]) : undefined}
            onDepositNft={hasPool ? (id) => void call("DepositNftPool", [id]) : undefined}
            onWithdrawNft={hasPool ? (id) => void call("WithdrawNftPool", [id]) : undefined}
            onInstantSell={(id) => {
              if (hasOffers) {
                void call("InstantSell", [id]);
                return;
              }
              const top = topOfferFor(collectionOffers, id);
              if (top) void call("AcceptOffer", [id, top.bidder]);
            }}
            onSweep={(ids, ugnot) => void call("Sweep", [ids.join(",")], `${ugnot}ugnot`)}
            cart={cart}
            onCart={onCart}
            onReveal={(id) => {
              const row =
                items.find((it) => it.id === id) ||
                collectionItems?.find((it) => it.id === id) ||
                owned.find((it) => it.id === id);
              void call("Reveal", [id], "", row ? bookOf(itemCollectionSlug(row)) : nft);
            }}
            onOpenMint={onOpenMint}
            hasOffers={hasOffers}
            hasPool={hasPool}
            onOpenProfile={onOpenProfile}
          />
        ) : null}
        {tab === "sell" ? (
          <Sell
            items={sellItems}
            listId={listId}
            listPrice={listPrice}
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            onId={setListId}
            onPrice={setListPrice}
            onList={onSubmitList}
            onConnect={() => void onConnect()}
            onOpenTab={goTab}
          />
        ) : null}
        {tab === "create" && mintSlug ? (
          <MintPage
            drop={chainCollections.find((c) => c.slug === mintSlug) || null}
            slug={mintSlug}
            loaded={mintLoaded}
            hidden={mintHidden}
            allowN={mintAllowN}
            mintCap={mintCap}
            sale={mintSale}
            tokenURI={mintTokenURI}
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            onMint={() => {
              const drop = chainCollections.find((c) => c.slug === mintSlug);
              const pay =
                mintSale?.phase === "whitelist" ? mintSale.wlPrice : drop?.mintPrice || mintSale?.mintPrice || 0;
              const pkg = factoryPkgOf(mintSlug);
              void call("PublicMint", pkg ? [] : [mintSlug], pay > 0 ? `${pay}ugnot` : "", pkg || nft);
            }}
            onConnect={() => void onConnect()}
            onOpenCollection={() => onSlug(mintSlug)}
            onBack={() => goTab("create")}
          />
        ) : null}
        {tab === "create" && !mintSlug ? (
          <Launch
            chainCollections={chainCollections}
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            wallet={account?.address}
            onCreateDrop={(args) => void launchWizard({
              slug: args[0] || "",
              name: args[1] || "",
              cover: args[2] || "",
              bio: "",
              website: "",
              twitter: "",
              discord: "",
              extras: false,
              maxSupply: args[3] || "0",
              priceUgnot: args[4] || "0",
              blob: "",
              hide: false,
              allow: "",
              cap: 0,
              royaltyBps: 0,
              wlPriceUgnot: "0",
              wlSupply: 0,
            })}
            onLaunchCollection={(args) =>
              void launchWizard({
                slug: args[0] || "",
                name: args[1] || "",
                cover: args[2] || "",
                bio: args[3] || "",
                website: args[4] || "",
                twitter: args[5] || "",
                discord: args[6] || "",
                extras: true,
                maxSupply: args[7] || "0",
                priceUgnot: args[8] || "0",
                blob: "",
                hide: false,
                allow: "",
                cap: 0,
                royaltyBps: 0,
                wlPriceUgnot: "0",
                wlSupply: 0,
              })
            }
            onMintUnique={(slug, name, image) => {
              const pkg = slug ? factoryPkgOf(slug) : "";
              if (pkg) void call("Mint", [name, image], "", pkg);
              else void call(slug ? "MintIn" : "Mint", slug ? [slug, name, image] : [name, image]);
            }}
            onConnect={() => void onConnect()}
            dropSlots={dropSlots}
            onPickDrop={setSlotSlug}
            onAddDropItems={(slug, blob) => {
              const pkg = factoryPkgOf(slug);
              void call("AddDropItems", pkg ? [blob] : [slug, blob], "", pkg || nft);
            }}
            onSetHidden={(slug, hidden) => void call("SetHidden", [slug, hidden ? "true" : "false"])}
            dropHidden={dropHidden}
            dropLoaded={dropLoaded}
            dropAllowN={dropAllowN}
            dropMintCap={dropMintCap}
            onOpenMint={onOpenMint}
            onOpenCollection={onSlug}
            onPauseMint={(slug) => {
              const pkg = factoryPkgOf(slug);
              void call("PauseMint", pkg ? [] : [slug], "", pkg || nft);
            }}
            onResumeMint={(slug) => {
              const pkg = factoryPkgOf(slug);
              void call("ResumeMint", pkg ? [] : [slug], "", pkg || nft);
            }}
            onSetMintPrice={(slug, ugnot) => void call("SetMintPrice", [slug, String(ugnot)])}
            onAddAllowlist={(slug, blob) => void call("AddAllowlist", [slug, blob])}
            onSetMintCap={(slug, n) => void call("SetMintCap", [slug, String(n)])}
            onStartPublic={(slug) => void call("StartPublic", [slug])}
            onLaunchWizard={(plan: LaunchPlan) => void launchWizard(plan)}
            launchFeeUgnot={launchFeeUgnot}
            network={net.id}
          />
        ) : null}
        {tab === "portfolio" ? (
          <Profile
            address={profileAddr || (connected ? account?.address || "" : "")}
            network={net}
            connected={connected}
            wallet={account?.address}
            items={sameAddr(profileAddr || account?.address, account?.address) ? owned : profileItems}
            created={chainCollections.filter((c) => sameAddr(c.creator, profileAddr || account?.address))}
            activity={(homeActivity || []).filter((row) => sameAddr(row.actor, profileAddr || account?.address))}
            blocked={blocked}
            busy={!!busy}
            loading={profileLoading}
            onConnect={() => void onConnect()}
            onCancel={(row) => void call("Cancel", [row.id], "", bookOf(itemCollectionSlug(row)))}
            onOpenTab={goTab}
            onOpenItem={(item) => {
              if (item.id) onItemId(item.id);
            }}
            onOpenCollection={onSlug}
            onOpenMint={onOpenMint}
            onBuy={onBuy}
            onSell={onSell}
            onTransfer={(id, to) => {
              const row = owned.find((it) => it.id === id) || profileItems.find((it) => it.id === id);
              void call("Transfer", [to, id], "", row ? bookOf(itemCollectionSlug(row)) : nft);
            }}
            onReveal={(id) => {
              const row =
                owned.find((it) => it.id === id) ||
                items.find((it) => it.id === id) ||
                collectionItems?.find((it) => it.id === id);
              void call("Reveal", [id], "", row ? bookOf(itemCollectionSlug(row)) : nft);
            }}
            userProfile={viewProfile}
            onSaveProfile={mineProfile ? saveUserProfile : undefined}
          />
        ) : null}
        {tab === "guide" ? (
          <Guide network={net} onTab={goTab} onExploreHome={onExploreHome} />
        ) : null}
        {tab === "settings" ? (
          <Settings
            hub={hub}
            nft={nft}
            factory={factory}
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            onHub={setHub}
            onNft={setNft}
            onFactory={setFactory}
            onConnect={() => void onConnect()}
            onSeed={() => void call("SeedSamples", [])}
            network={net}
            onNetwork={onPickNetwork}
            isAdmin={sameAddr(account?.address, adminAddr)}
            launchFeeUgnot={launchFeeUgnot}
            onSetLaunchFee={(ugnot) =>
              void call("SetLaunchFee", [String(ugnot)], "", isPkgPath(factory) ? factory : nft)
            }
          />
        ) : null}
        {tab === "admin" ? (
          <Admin
            allowed={connected && sameAddr(account?.address, adminAddr)}
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            drops={chainCollections}
            featured={featuredSlugs}
            onSave={(slugs) => void call("SetFeatured", [slugs.join(",")])}
            onConnect={() => void onConnect()}
          />
        ) : null}
      </main>
      <CartBar
        items={cart}
        connected={connected}
        busy={!!busy}
        onRemove={(id) => setCart((prev) => prev.filter((row) => itemRowKey(row) !== id && row.id !== id))}
        onClear={() => setCart([])}
        onCheckout={async () => {
          const live = cart.filter((row) => row.id);
          if (live.length < 1) {
            return { ok: true, preview: true };
          }
          if (blocked) {
            return { ok: false, error: `Switch Adena to ${net.chainName} (${net.chainId}).` };
          }
          const total = live.reduce((s, row) => s + row.price, 0);
          const ok = await call("Sweep", [live.map((row) => row.id).join(",")], `${total}ugnot`);
          if (ok) {
            setCart((prev) => prev.filter((row) => !row.id));
            return { ok: true };
          }
          return { ok: false, error: "Sweep failed. Check the notice above and Adena." };
        }}
        onConnect={() => void onConnect()}
      />
      <Footer network={net} nft={nft} onTab={goTab} onExploreHome={onExploreHome} />
      <BottomNav tab={tab} onTab={goTab} onExploreHome={onExploreHome} />
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { Analytics } from "./components/Analytics";
import { Admin } from "./components/Admin";
import { Launch } from "./components/Launch";
import type { LaunchPlan } from "./components/LaunchWizard";
import { applyLaunchPack } from "./lib/dropjson";
import { SETTLE_GAS_WANTED, nftCanSync, syncCalls } from "./lib/perksync";
import { MintPage } from "./components/MintPage";
import { Explore } from "./components/Explore";
import { CartBar } from "./components/CartBar";
import { Footer } from "./components/Footer";
import { GenesisWhitelist } from "./components/GenesisWhitelist";
import { Guide } from "./components/Guide";
import { Header } from "./components/Header";
import { Notices } from "./components/Notices";
import { Profile } from "./components/Profile";
import { RewardsPage } from "./components/RewardsPage";
import { EditionsPage } from "./components/EditionsPage";
import { Sell } from "./components/Sell";
import { Settings } from "./components/Settings";
import { SkipLink } from "./components/SkipLink";
import { TestnetRibbon } from "./components/TestnetRibbon";
import type { Account, Tab } from "./components/types";
import { absMetaImage, applyPageMeta, collectionTitle, fallbackBio } from "./lib/pagemeta";
import {
  fetchWlist,
  patchWlist,
  postWlist,
  removeWlist,
  seedWlist,
  WLIST_CAP,
  WLIST_OPENS_UTC_MS,
  type WlistRow,
} from "./lib/wlist";
import {
  collectionBookPath,
  BAZAAR_GENS_MINT_SLUG,
  collectionRealmPath,
  collectionHash,
  isNameNotDeclared,
  isOwnListing,
  isPkgPath,
  isRealmUnavailable,
  pkgMetaStatus,
  isPreviewItem,
  itemCollectionSlug,
  itemHash,
  mintHash,
  FACTORY_PKG_MAINNET,
  FACTORY_PKG_MAINNET_V1,
  FACTORY_PKG_MAINNET_V2,

  factoryPkgFor,
  loadHub,
  loadNetwork,
  loadNft,
  networkById,
  normalizePkgPath,
  parseActivityLines,
  parseCollectionLines,
  parseEvalString,
  parseEvalAddress,
  tokenURIExpr,
  parseFactoryCollectionLines,
  isPublicFactorySlug,
  parseHash,
  routeRaw,
  sharePath,
  parseIds,
  tabHash,
  parseItems,
  parseDropSlotLines,
  parseEvalInt,
  reserveSendUgnot,
  parseFeaturedLines,
  parseDropSale,
  parseEvalBool,
  parseUtcMinute,
  parseMintSchedule,
  parsePhaseMintCap,
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
import { adenaIndexerOrigin, fetchActivity, fetchCallerPublicMintHeights, fetchCollectionPublicMintHeights, fetchPkgActivity } from "./lib/indexer";
import { emptyProfile, loadLocalProfile, parseProfileLine, saveLocalProfile, type UserProfile } from "./lib/userProfile";
import { chunkDropLines, gasFeeUgnot, packLaunchTxs, skipLaunchSetup, txGasWanted, type LaunchMsg } from "./lib/launchtx";
import { ITEM_BOOK_CAP, ITEM_LINE_WAVE, mergeBookItems, missingItemIds, nextItemIds, nextPageSize, readItemBookCache, writeItemBookCache } from "./lib/itembook";
import { collectionShowsRounds, countMintsInHeightRange, firstBlockAtOrAfter, mergeMintedCount, mintLookbackHeight, mintRoundCards, resolveMintPhase, splitPhaseMints, type MintQtyRound, type MintRoundCard } from "./lib/mintrounds";
import { connectAdena, disconnectAdena, doContractCall, doContractCalls, evalExpr, fetchBankUgnot, fetchBlockUnix, fetchChainHead, queryGasPrice, queryPkgMeta, readBankUgnot } from "./lib/wallets";
import { bulkMessages, listGasWanted, packListTxs } from "./lib/bulklist";
import type { ListRequest } from "./components/Sell";

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

function wlCloseStorageKey(pkg: string, wlEnd: number): string {
  return `bazaar.wlClose.v1:${pkg}:${Math.floor(wlEnd)}`;
}

function readWlClose(pkg: string, wlEnd: number): number | null {
  try {
    const raw = localStorage.getItem(wlCloseStorageKey(pkg, wlEnd));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function writeWlClose(pkg: string, wlEnd: number, n: number): void {
  try {
    localStorage.setItem(wlCloseStorageKey(pkg, wlEnd), String(Math.floor(n)));
  } catch {
    /* private mode */
  }
}

async function loadWhitelistCloseCount(
  rpc: string,
  pkg: string,
  network: "mainnet" | "onyx" | "pearl" | "local",
  wlStart: number,
  wlEnd: number,
): Promise<number | null> {
  if (!(wlEnd > 0)) return null;
  const head = await fetchChainHead(rpc);
  if (!head) return null;
  const since = wlStart > 0 ? wlStart : 0;
  const [heights, startH, endH] = await Promise.all([
    fetchCollectionPublicMintHeights({
      pkg,
      network,
      afterHeight: mintLookbackHeight(head.height, head.time, since > 0 ? since : wlEnd),
    }),
    since > 0 ? firstBlockAtOrAfter(head, since, (height) => fetchBlockUnix(rpc, height)) : Promise.resolve(1),
    firstBlockAtOrAfter(head, wlEnd, (height) => fetchBlockUnix(rpc, height)),
  ]);
  if (!heights || startH == null || endH == null) return null;
  return countMintsInHeightRange(heights, startH, endH);
}

async function chainMintedCount(rpc: string, pkg: string, fallback: number): Promise<number> {
  try {
    const n = parseEvalInt(await evalExpr(rpc, pkg, "Minted()"));
    return Number.isFinite(n) && n > fallback ? n : Math.max(0, fallback);
  } catch {
    return Math.max(0, fallback);
  }
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

async function loadItemWaves(
  rpc: string,
  pkg: string,
  ids: number[],
  onWave: (rows: Item[]) => void,
  alive: () => boolean,
): Promise<boolean> {
  for (let i = 0; i < ids.length; i += ITEM_LINE_WAVE) {
    if (!alive()) return false;
    const wave = ids.slice(i, i + ITEM_LINE_WAVE);
    const rows = (await Promise.all(wave.map((n) => loadItemLine(rpc, pkg, n)))).filter((row): row is Item => !!row);
    if (!alive()) return false;
    if (rows.length > 0) onWave(rows);
  }
  return true;
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
  const [account, setAccount] = useState<Account | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [owned, setOwned] = useState<Item[]>([]);
  const [chainCollections, setChainCollections] = useState<ChainCollection[]>([]);
  const [deskCollections, setDeskCollections] = useState<ChainCollection[]>([]);
  const [deskListed, setDeskListed] = useState<Item[]>([]);
  const [collectionSlug, setCollectionSlug] = useState("");
  const [collectionItems, setCollectionItems] = useState<Item[] | null>(null);
  const [peerBySlug, setPeerBySlug] = useState<Record<string, Item[]>>({});
  const peerBySlugRef = useRef(peerBySlug);
  peerBySlugRef.current = peerBySlug;
  const collectionSlugRef = useRef("");
  const collectionItemsRef = useRef<{ slug: string; rows: Item[] }>({ slug: "", rows: [] });
  const bookProgressRef = useRef<{ slug: string; through: number; minted: number }>({ slug: "", through: 0, minted: 0 });
  const bookJobRef = useRef<{
    slug: string;
    pkg: string;
    rpc: string;
    through: number;
    minted: number;
    have: Set<string>;
    busy: boolean;
    publish: (rows: Item[]) => void;
  } | null>(null);
  const [collectionBook, setCollectionBook] = useState({ slug: "", through: 0, minted: 0, loading: false });
  const refreshGen = useRef(0);
  const [collectionActivity, setCollectionActivity] = useState<Activity[] | null>(null);
  const [collectionOffers, setCollectionOffers] = useState<OfferRow[]>([]);
  const [collectionPool, setCollectionPool] = useState<PoolInfo | null>(null);
  const [collectionPoolNfts, setCollectionPoolNfts] = useState<PoolNft[]>([]);
  const [collectionPoolShares, setCollectionPoolShares] = useState(0);
  const [collectionSocials, setCollectionSocials] = useState<Socials>({ website: "", twitter: "", discord: "" });
  const [homeActivity, setHomeActivity] = useState<Activity[] | null>(null);
  const [liveSlugs, setLiveSlugs] = useState<string[] | null>(null);
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
  const [factory, setFactory] = useState(() => factoryPkgFor(loadNetwork().id));
  useEffect(() => {
    setFactory(factoryPkgFor(net.id));
  }, [net.id]);
  const [openItemId, setOpenItemId] = useState("");
  const [profileAddr, setProfileAddr] = useState("");
  const [profileItems, setProfileItems] = useState<Item[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [slotSlug, setSlotSlug] = useState("");
  const [dropSlots, setDropSlots] = useState<DropSlot[]>([]);
  const [dropHidden, setDropHidden] = useState(false);
  const [dropPrereveal, setDropPrereveal] = useState("");
  const [dropLoaded, setDropLoaded] = useState(0);
  const [dropAllowN, setDropAllowN] = useState(0);
  const [dropMintCap, setDropMintCap] = useState(0);
  const [mintSlug, setMintSlug] = useState("");
  const [mintedSlug, setMintedSlug] = useState("");
  const [mintLoaded, setMintLoaded] = useState(0);
  const [mintHidden, setMintHidden] = useState(false);
  const [mintAllowN, setMintAllowN] = useState(0);
  const [mintCap, setMintCap] = useState(0);
  const [mintWlCap, setMintWlCap] = useState(0);
  const [mintPubCap, setMintPubCap] = useState(0);
  const [mintSale, setMintSale] = useState<DropSale | null>(null);
  const [mintAllowlisted, setMintAllowlisted] = useState<boolean | null>(null);
  const [chainMints, setChainMints] = useState({ wl: 0, pub: 0 });
  const [localMints, setLocalMints] = useState({ wl: 0, pub: 0 });
  const [mintCountReady, setMintCountReady] = useState(false);
  const [mintMetaReady, setMintMetaReady] = useState(false);
  const [collectionRounds, setCollectionRounds] = useState<MintRoundCard[]>([]);
  const [collectionHidden, setCollectionHidden] = useState(false);
  const [plannedWl, setPlannedWl] = useState<{ qty: number; start: number } | null>(null);
  const [mintTokenURI, setMintTokenURI] = useState("");
  const [mintedLive, setMintedLive] = useState<{ slug: string; n: number } | null>(null);
  const [wlCloseMinted, setWlCloseMinted] = useState<{ slug: string; n: number } | null>(null);
  const [hasOffers, setHasOffers] = useState(true);
  const [colOffers, setColOffers] = useState(false);
  const [hasPool, setHasPool] = useState(true);
  const [launchFeeUgnot, setLaunchFeeUgnot] = useState(1_000_000_000);
  const [reserveDueUgnot, setReserveDueUgnot] = useState<number | null>(null);
  const [protocolBps, setProtocolBps] = useState(200);
  const [protocolSink, setProtocolSink] = useState("");
  const [genesisPkg, setGenesisPkg] = useState("");
  const [adminAddr, setAdminAddr] = useState("");
  const [factoryTreasuryUgnot, setFactoryTreasuryUgnot] = useState(0);
  const [wlistCount, setWlistCount] = useState(0);
  const [wlistPlace, setWlistPlace] = useState(0);
  const [wlistRegistered, setWlistRegistered] = useState(false);
  const [wlistHandle, setWlistHandle] = useState("");
  const [wlistCelebrate, setWlistCelebrate] = useState(false);
  const [wlistError, setWlistError] = useState("");
  const [wlistRows, setWlistRows] = useState<WlistRow[]>([]);
  const [cart, setCart] = useState<Item[]>([]);
  const [viewProfile, setViewProfile] = useState(emptyProfile());

  const rpc = net.rpcUrl;
  const connected = !!account?.address;
  const wrongNet = !!(account?.chainId && account.chainId !== net.chainId);
  const blocked = wrongNet;
  const isAdmin = connected && !!adminAddr && sameAddr(account?.address, adminAddr);
  const reserveSend = reserveSendUgnot(launchFeeUgnot, reserveDueUgnot);
  useEffect(() => {
    const factoryPath = isPkgPath(factory) ? normalizePkgPath(factory) : "";
    const addr = account?.address?.trim() || "";
    if (!factoryPath || !addr) {
      setReserveDueUgnot(null);
      return;
    }
    let live = true;
    void evalExpr(rpc, factoryPath, `ReserveDue(${JSON.stringify(addr)})`)
      .then((raw) => {
        if (live) setReserveDueUgnot(parseEvalInt(raw));
      })
      .catch(() => {
        if (live) setReserveDueUgnot(null);
      });
    return () => {
      live = false;
    };
  }, [factory, account?.address, rpc]);

  useEffect(() => {
    const addr = account?.address?.trim() || "";
    if (!addr) return;
    let live = true;
    const read = () => {
      if (document.visibilityState === "hidden") return;
      void readBankUgnot(rpc, addr).then((n) => {
        if (!live || n == null || !Number.isFinite(n)) return;
        const coins = `${Math.max(0, Math.floor(n))}ugnot`;
        setAccount((prev) => {
          if (!prev || !sameAddr(prev.address, addr) || prev.coins === coins) return prev;
          return { ...prev, coins };
        });
      });
    };
    read();
    const id = window.setInterval(read, 4000);
    const wake = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      live = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [account?.address, rpc]);
  const clearMsg = useCallback(() => setMsg(""), []);
  const clearErr = useCallback(() => setErr(""), []);

  const refresh = useCallback(async () => {
    const gen = ++refreshGen.current;
    const current = () => refreshGen.current === gen;
    setChainNote("");
    const remote = net.id === "mainnet" || net.id === "onyx";
    const nftPath = remote ? "" : await resolveNftPath(rpc, hub, nft);
    if (nftPath !== nft) setNft(nftPath);
    const factoryPath = isPkgPath(factory) ? normalizePkgPath(factory) : "";

    const factoryTask = (async () => {
      const paths = [
        factoryPath,
        remote ? FACTORY_PKG_MAINNET_V2 : "",
        remote ? FACTORY_PKG_MAINNET_V1 : "",
        remote ? FACTORY_PKG_MAINNET : "",
      ].filter((p, i, all) => p && isPkgPath(p) && all.indexOf(p) === i);
      const packs = await Promise.all(
        paths.map((p) =>
          evalExpr(rpc, p, "ListCollections()")
            .then((raw) => parseFactoryCollectionLines(raw, { includeHidden: remote }))
            .catch(() => [] as ChainCollection[]),
        ),
      );
      const bySlug = new Map<string, ChainCollection>();
      for (const row of packs.flat()) bySlug.set(row.slug, row);
      const current = factoryPath && paths[0] === factoryPath ? packs[0] || [] : [];
      const live = current.filter((col) => isPublicFactorySlug(col.slug)).map((col) => col.slug);
      return { cols: [...bySlug.values()], liveSlugs: factoryPath ? live : null };
    })();
    const openTask = isPkgPath(nftPath)
      ? loadListOpen(rpc, nftPath)
          .then((rows) => ({ rows, error: "" }))
          .catch((e) => ({
            rows: [] as Item[],
            error: e instanceof Error ? e.message : "Could not read listings from this package path.",
          }))
      : Promise.resolve({ rows: [] as Item[], error: "Set a valid NFT package path in Settings." });

    const [factoryPack, openResult] = await Promise.all([factoryTask, openTask]);
    if (!current()) return;
    const factoryCols = factoryPack.cols;
    setLiveSlugs(factoryPack.liveSlugs);

    async function loadAdmin() {
      const apply = (fn: () => void) => {
        if (current()) fn();
      };
      try {
        if (factoryPath) {
          const fee = parseEvalInt(await evalExpr(rpc, factoryPath, "LaunchFee()"));
          apply(() => setLaunchFeeUgnot(fee));
        } else if (isPkgPath(nftPath)) {
          const fee = parseEvalInt(await evalExpr(rpc, nftPath, "LaunchFee()"));
          apply(() => setLaunchFeeUgnot(fee));
        } else {
          apply(() => setLaunchFeeUgnot(1_000_000_000));
        }
      } catch {
        apply(() => setLaunchFeeUgnot(1_000_000_000));
      }
      try {
        if (factoryPath) {
          const admin = parseEvalString(await evalExpr(rpc, factoryPath, "Admin()"));
          apply(() => setAdminAddr(admin));
        } else if (isPkgPath(nftPath)) {
          const admin = parseEvalString(await evalExpr(rpc, nftPath, "Admin()"));
          apply(() => setAdminAddr(admin));
        } else {
          apply(() => setAdminAddr(""));
        }
      } catch {
        apply(() => setAdminAddr(""));
      }
      try {
        if (factoryPath) {
          const bps = parseEvalInt(await evalExpr(rpc, factoryPath, "ProtocolBps()"));
          apply(() => setProtocolBps(bps));
        }
      } catch {
        apply(() => setProtocolBps(200));
      }
      try {
        if (factoryPath) {
          const sink = parseEvalAddress(await evalExpr(rpc, factoryPath, "ProtocolSink()"));
          apply(() => setProtocolSink(sink));
        } else {
          apply(() => setProtocolSink(""));
        }
      } catch {
        apply(() => setProtocolSink(""));
      }
      try {
        if (factoryPath) {
          const genesis = parseEvalString(await evalExpr(rpc, factoryPath, "GenesisPkg()"));
          apply(() => setGenesisPkg(genesis));
        } else {
          apply(() => setGenesisPkg(""));
        }
      } catch {
        apply(() => setGenesisPkg(""));
      }
      try {
        if (factoryPath) {
          const realm = parseEvalAddress(await evalExpr(rpc, factoryPath, "Address()"));
          const bal = realm ? await fetchBankUgnot(rpc, realm) : 0;
          apply(() => setFactoryTreasuryUgnot(bal));
        } else {
          apply(() => setFactoryTreasuryUgnot(0));
        }
      } catch {
        apply(() => setFactoryTreasuryUgnot(0));
      }
      if (!isPkgPath(nftPath)) {
        apply(() => {
          setHasOffers(false);
          setHasPool(false);
          if (!factoryCols.some((col) => isPublicFactorySlug(col.slug))) setFeaturedSlugs([]);
        });
        return;
      }
      try {
        await evalExpr(rpc, nftPath, `ListOffers("bazaar")`);
        apply(() => setHasOffers(true));
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const offers = !isNameNotDeclared(raw);
        apply(() => setHasOffers(offers));
      }
      apply(() => setHasPool(false));
      try {
        const featured = parseFeaturedLines(await evalExpr(rpc, nftPath, "Featured()")).filter(isPublicFactorySlug);
        apply(() => setFeaturedSlugs(featured));
      } catch {
        apply(() => setFeaturedSlugs([]));
      }
    }

    const publicCols = factoryCols.filter((col) => isPublicFactorySlug(col.slug));
    const holdingCols = factoryCols.filter((col) => col.pkg && isPkgPath(col.pkg));
    setDeskCollections(holdingCols);

    if (publicCols.length > 0) {
      setChainCollections(publicCols);
      setHasOffers(false);
      setHasPool(false);
      setFeaturedSlugs(publicCols.map((col) => col.slug));
      setLoading(false);
      void loadAdmin();
      void (async () => {
        const opens = await Promise.all(
          holdingCols.map(async (col) => {
            const pkg = col.pkg || "";
            if (!isPkgPath(pkg)) return [] as Item[];
            try {
              return tagCollectionSlug(await loadListOpen(rpc, pkg), col.slug);
            } catch {
              return [] as Item[];
            }
          }),
        );
        if (!current()) return;
        const listed = opens.flat();
        setDeskListed(listed);
        const publicSlugs = new Set(publicCols.map((col) => col.slug));
        setItems(listed.filter((row) => publicSlugs.has(row.collection)));
        const addr = account?.address || "";
        if (!addr) {
          setOwned([]);
          return;
        }
        const packs = await Promise.all(
          holdingCols.map(async (col, i) => {
            const pkg = col.pkg || "";
            const open = opens[i] || [];
            if (!isPkgPath(pkg)) return [] as Item[];
            try {
              return tagCollectionSlug(await loadHoldings(rpc, pkg, addr, open), col.slug);
            } catch {
              return open.filter((row) => sameAddr(row.seller, addr)).map((row) => ({ ...row, listed: true }));
            }
          }),
        );
        if (!current()) return;
        const byKey = new Map<string, Item>();
        for (const row of packs.flat()) byKey.set(itemRowKey(row), row);
        setOwned([...byKey.values()]);
      })();
      const liveNow = factoryPack.liveSlugs;
      const tapeCols = (liveNow ? publicCols.filter((col) => liveNow.includes(col.slug)) : publicCols).slice(0, 16);
      void (async () => {
        try {
          const tapes = await Promise.all(
            tapeCols.map((col) =>
              col.pkg
                ? fetchPkgActivity({ pkg: col.pkg, slug: col.slug, network: net.id }).then((rows) => rows || [])
                : Promise.resolve([] as Activity[]),
            ),
          );
          if (!current()) return;
          const home = tapes.flat().slice(0, 50);
          setHomeActivity(home.length > 0 ? home : null);
        } catch {
          if (current()) setHomeActivity(null);
        }
      })();
      return;
    }

    if (net.id === "mainnet" || net.id === "onyx" || !isPkgPath(nftPath)) {
      setItems([]);
      setChainCollections([]);
      setHomeActivity(null);
      setChainNote("");
      setLoading(false);
      void loadAdmin();
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
      void loadAdmin();
      return;
    }
    const open = openResult.rows;
    setItems(open);
    setLoading(false);
    void loadAdmin();
    void (async () => {
      try {
        const colRaw = await evalExpr(rpc, nftPath, "ListCollections()");
        if (!current()) return;
        setChainCollections(parseCollectionLines(colRaw));
      } catch {
        if (current()) setChainCollections([]);
      }
      try {
        const actRaw = await evalExpr(rpc, nftPath, "Activity()");
        if (!current()) return;
        const rows = parseActivityLines(actRaw);
        setHomeActivity(rows.length > 0 ? rows : null);
      } catch {
        if (current()) setHomeActivity(null);
      }
      const addr = account?.address || "";
      if (!addr) {
        if (current()) setOwned([]);
        return;
      }
      try {
        const held = await loadHoldings(rpc, nftPath, addr, open);
        if (current()) setOwned(held);
      } catch {
        if (current()) setOwned(open.filter((row) => row.seller === addr).map((row) => ({ ...row, listed: true })));
      }
    })();
  }, [hub, nft, factory, rpc, account?.address, net.id]);

  useEffect(() => {
    if (!profileAddr || sameAddr(profileAddr, account?.address)) {
      if (sameAddr(profileAddr, account?.address)) setProfileItems(owned);
      else if (!profileAddr) setProfileItems([]);
      return;
    }
    let live = true;
    setProfileLoading(true);
    void (async () => {
      try {
        const factoryCols = chainCollections.filter((col) => col.pkg && isPkgPath(col.pkg));
        if (factoryCols.length > 0) {
          const packs = await Promise.all(
            factoryCols.map(async (col) => {
              const pkg = col.pkg || "";
              const listed = items.filter((row) => itemCollectionSlug(row) === col.slug);
              if (!isPkgPath(pkg)) return [] as Item[];
              try {
                return tagCollectionSlug(await loadHoldings(rpc, pkg, profileAddr, listed), col.slug);
              } catch {
                return listed
                  .filter((row) => sameAddr(row.seller, profileAddr) || sameAddr(row.owner, profileAddr))
                  .map((row) => ({ ...row, listed: !!row.listed }));
              }
            }),
          );
          const byKey = new Map<string, Item>();
          for (const row of packs.flat()) byKey.set(itemRowKey(row), row);
          if (live) setProfileItems([...byKey.values()]);
          return;
        }
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
  }, [profileAddr, nft, rpc, items, account?.address, owned, chainCollections]);

  useEffect(() => {
    const pkg = slotSlug ? factoryPkgOf(slotSlug) : "";
    const book = isPkgPath(pkg) ? pkg : isPkgPath(nft) ? nft : "";
    if (!slotSlug || !book) {
      setDropSlots([]);
      setDropHidden(false);
      setDropPrereveal("");
      setDropLoaded(0);
      setDropAllowN(0);
      setDropMintCap(0);
      return;
    }
    let live = true;
    void (async () => {
      const arg = JSON.stringify(slotSlug);
      const onPkg = isPkgPath(pkg);
      const countOf = async (expr: string) => {
        try {
          return parseEvalInt(await evalExpr(rpc, book, expr));
        } catch {
          return 0;
        }
      };
      try {
        const hidden = (await evalExpr(rpc, book, onPkg ? "Hidden()" : `HiddenOf(${arg})`)).includes("true");
        const loaded = parseEvalInt(await evalExpr(rpc, book, onPkg ? "LoadedOf()" : `LoadedOf(${arg})`));
        const preRaw = await evalExpr(rpc, book, onPkg ? "Prereveal()" : `PrerevealOf(${arg})`).catch(() => "");
        const [allowN, cap] = await Promise.all([
          countOf(onPkg ? "AllowN()" : `AllowCount(${arg})`),
          countOf(onPkg ? "MintCapOf()" : `MintCapOf(${arg})`),
        ]);
        if (!live) return;
        setDropHidden(hidden);
        setDropPrereveal(parseEvalString(preRaw));
        setDropLoaded(loaded);
        setDropAllowN(allowN);
        setDropMintCap(cap);
        if (hidden) {
          setDropSlots([]);
          return;
        }
        try {
          const raw = await evalExpr(rpc, book, onPkg ? "ListDropSlots()" : `ListDropSlots(${arg})`);
          if (live) setDropSlots(parseDropSlotLines(raw));
        } catch {
          if (live) setDropSlots([]);
        }
      } catch {
        if (live) {
          setDropHidden(false);
          setDropPrereveal("");
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
  }, [slotSlug, nft, rpc, items, chainCollections]);

  useEffect(() => {
    // Onyx and mainnet clear the legacy single-realm nft path. The collection
    // pkg from the factory list is what DropSaleOf and MintScheduleOf live on.
    const pkg = mintSlug ? factoryPkgOf(mintSlug) : "";
    const book = isPkgPath(pkg) ? pkg : isPkgPath(nft) ? nft : "";
    if (!mintSlug || !book) {
      setMintLoaded(0);
      setMintHidden(false);
      setMintAllowN(0);
      setMintCap(0);
      setMintWlCap(0);
      setMintPubCap(0);
      setMintSale(null);
      return;
    }
    let live = true;
    const arg = JSON.stringify(mintSlug);
    void (async () => {
      const load = async (expr: string) => {
        try {
          return parseEvalInt(await evalExpr(rpc, book, expr));
        } catch {
          return 0;
        }
      };
      const [loaded, allowN, cap, hiddenRaw, saleRaw, scheduleRaw, phaseRaw] = await Promise.all([
        load(pkg ? "LoadedOf()" : `LoadedOf(${arg})`),
        load(pkg ? "AllowN()" : `AllowCount(${arg})`),
        load(pkg ? "MintCapOf()" : `MintCapOf(${arg})`),
        evalExpr(rpc, book, pkg ? "Hidden()" : `HiddenOf(${arg})`).catch(() => ""),
        evalExpr(rpc, book, pkg ? "DropSaleOf()" : `DropSaleOf(${arg})`).catch(() => ""),
        evalExpr(rpc, book, pkg ? "MintScheduleOf()" : `MintScheduleOf(${arg})`).catch(() => ""),
        evalExpr(rpc, book, pkg ? "PhaseMintCapOf()" : `PhaseMintCapOf(${arg})`).catch(() => ""),
      ]);
      if (!live) return;
      const phaseCap = parsePhaseMintCap(phaseRaw);
      setMintLoaded(loaded);
      setMintHidden(hiddenRaw.includes("true"));
      setMintAllowN(allowN);
      setMintCap(cap);
      setMintWlCap(phaseCap.wl);
      setMintPubCap(phaseCap.pub);
      if (saleRaw) {
        const sale = parseDropSale(saleRaw);
        const schedule = scheduleRaw ? parseMintSchedule(scheduleRaw) : { wlStart: 0, wlEnd: 0, publicStart: 0, publicEnd: 0 };
        setMintSale({ ...sale, ...schedule });
      } else {
        setMintSale(null);
      }
      setMintMetaReady(true);
    })();
    return () => {
      live = false;
    };
  }, [mintSlug, nft, rpc, items, chainCollections]);

  useEffect(() => {
    setMintAllowlisted(null);
  }, [account?.address, mintSlug]);

  useEffect(() => {
    const addr = account?.address?.trim() || "";
    const pkg = mintSlug ? factoryPkgOf(mintSlug) : "";
    const book = isPkgPath(pkg) ? pkg : isPkgPath(nft) ? nft : "";
    if (tab !== "create" || !mintSlug || !book || !addr) return;
    let live = true;
    const read = () => {
      void evalExpr(rpc, book, `OnAllowlist(${JSON.stringify(addr)})`)
        .then((raw) => {
          if (live) setMintAllowlisted(parseEvalBool(raw));
        })
        .catch(() => {
          /* keep the last answer; a failed read must not mark the wallet ineligible */
        });
    };
    read();
    const id = window.setInterval(read, 15000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [tab, mintSlug, nft, rpc, account?.address, chainCollections]);

  useEffect(() => {
    setMintMetaReady(false);
  }, [mintSlug]);

  const mintPkg = mintSlug ? collectionBookPath(mintSlug, chainCollections, "") : "";
  const mintDrop = useMemo(() => {
    const col = chainCollections.find((c) => c.slug === mintSlug) || null;
    if (!col) return null;
    const polled = mintedLive?.slug === mintSlug ? mintedLive.n : col.minted;
    const minted = mergeMintedCount(col.minted, polled);
    return minted === col.minted ? col : { ...col, minted };
  }, [chainCollections, mintSlug, mintedLive]);

  useEffect(() => {
    if (tab !== "create" || !mintSlug || !isPkgPath(mintPkg)) return;
    let live = true;
    const read = () => {
      if (document.visibilityState === "hidden") return;
      void evalExpr(rpc, mintPkg, "Minted()")
        .then((raw) => {
          if (!live) return;
          const n = parseEvalInt(raw);
          setMintedLive((prev) => {
            const shown = prev?.slug === mintSlug ? prev.n : 0;
            const next = mergeMintedCount(shown, n);
            if (prev?.slug === mintSlug && prev.n === next) return prev;
            return { slug: mintSlug, n: next };
          });
        })
        .catch(() => {
          /* keep the last minted count */
        });
    };
    read();
    const id = window.setInterval(read, 4000);
    const wake = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      live = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [tab, mintSlug, mintPkg, rpc]);

  const wlCloseVerified = useRef("");
  useEffect(() => {
    if (tab !== "create" || !mintSlug || !isPkgPath(mintPkg)) return;
    if (wlCloseVerified.current === mintSlug) return;
    let live = true;
    let inflight = false;
    let timer = 0;
    const run = () => {
      if (!live || inflight || wlCloseVerified.current === mintSlug) return;
      inflight = true;
      void (async () => {
        let start = 0;
        let end = 0;
        try {
          const schedule = parseMintSchedule(await evalExpr(rpc, mintPkg, "MintScheduleOf()"));
          start = schedule.wlStart;
          end = schedule.wlEnd;
        } catch {
          return;
        }
        if (!live || !(end > 0) || Math.floor(Date.now() / 1000) < end) return;
        const cached = readWlClose(mintPkg, end);
        if (cached != null) setWlCloseMinted({ slug: mintSlug, n: cached });
        const n = await loadWhitelistCloseCount(rpc, mintPkg, net.id, start, end);
        if (!live || n == null) return;
        writeWlClose(mintPkg, end, n);
        wlCloseVerified.current = mintSlug;
        window.clearInterval(timer);
        setWlCloseMinted({ slug: mintSlug, n });
      })().finally(() => {
        inflight = false;
      });
    };
    run();
    timer = window.setInterval(run, 5000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [tab, mintSlug, mintPkg, rpc, net.id]);

  useEffect(() => {
    setChainMints({ wl: 0, pub: 0 });
    setLocalMints({ wl: 0, pub: 0 });
    setMintCountReady(false);
  }, [account?.address, mintSlug]);

  useEffect(() => {
    const addr = (account?.address || "").trim();
    const pkg = mintSlug ? factoryPkgOf(mintSlug) : "";
    if (tab !== "create" || !mintSlug || !addr || !isPkgPath(pkg) || !mintMetaReady) return;
    let live = true;
    const publicStart = mintSale?.publicStart || 0;
    const since =
      (mintSale?.wlStart || 0) > 0
        ? mintSale?.wlStart || 0
        : publicStart > 0
          ? publicStart
          : Math.floor(Date.now() / 1000) - 86400;
    const mintedNow = chainCollections.find((c) => c.slug === mintSlug)?.minted || 0;
    void (async () => {
      let held = 0;
      try {
        held = parseIds(await evalExpr(rpc, pkg, `TokensOf(${JSON.stringify(addr)})`)).length;
      } catch {
        held = 0;
      }
      if (!live) return;
      const phase = mintSale ? resolveMintPhase(mintSale, Math.floor(Date.now() / 1000), mintedNow) : "public";
      setChainMints(phase === "public" ? { wl: 0, pub: held } : { wl: held, pub: 0 });
      setMintCountReady(true);
      const head = await fetchChainHead(rpc);
      if (!live || !head) return;
      const heights = await fetchCallerPublicMintHeights({
        pkg,
        caller: addr,
        network: net.id,
        afterHeight: mintLookbackHeight(head.height, head.time, since),
      });
      if (!live || !heights) return;
      const unique = [...new Set(heights)];
      const stamped = await Promise.all(unique.map(async (height) => [height, await fetchBlockUnix(rpc, height)] as const));
      if (!live || stamped.some(([, unix]) => unix == null)) return;
      const cache = new Map(stamped);
      const times = heights.map((height) => cache.get(height) || 0);
      let split = splitPhaseMints(times, publicStart);
      if (!(publicStart > 0)) {
        split = phase === "whitelist" ? { wl: times.length, pub: 0 } : { wl: 0, pub: times.length };
      }
      if (!live) return;
      setChainMints(split);
    })();
    return () => {
      live = false;
    };
  }, [
    tab,
    mintSlug,
    account?.address,
    net.id,
    rpc,
    mintMetaReady,
    mintSale?.wlStart,
    mintSale?.publicStart,
    chainCollections.find((c) => c.slug === mintSlug)?.minted,
    nft,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV || mintSlug !== "bazaargens") {
      setPlannedWl(null);
      return;
    }
    let live = true;
    void fetch("/local/bazaar-gens.json")
      .then((res) => (res.ok ? res.text() : ""))
      .then((text) => {
        if (!live) return;
        const meta = applyLaunchPack(text);
        const qty = Math.floor(Number(meta.wlQty || "0"));
        const start = meta.wlStart ? parseUtcMinute(meta.wlStart) || 0 : 0;
        setPlannedWl(qty > 0 || start > 0 ? { qty: Number.isFinite(qty) ? qty : 0, start } : null);
      })
      .catch(() => {
        if (live) setPlannedWl(null);
      });
    return () => {
      live = false;
    };
  }, [mintSlug]);

  useEffect(() => {
    const col = chainCollections.find((c) => c.slug === mintSlug);
    const pkg = col?.pkg && isPkgPath(col.pkg) ? normalizePkgPath(col.pkg) : "";
    if (!mintSlug || !isPublicFactorySlug(mintSlug) || !pkg) {
      setMintTokenURI("");
      return;
    }
    let live = true;
    setMintTokenURI("");
    void (async () => {
      let sealed = true;
      try {
        sealed = String(await evalExpr(rpc, pkg, "Hidden()")).includes("true");
      } catch {
        sealed = true;
      }
      if (!live || sealed) return;
      const minted = await chainMintedCount(rpc, pkg, col?.minted || col?.count || 0);
      if (!live || minted < 1) return;
      const load = async (expr: string) => {
        const raw = await evalExpr(rpc, pkg, expr);
        if (live) setMintTokenURI(raw);
      };
      try {
        await load(tokenURIExpr(minted));
      } catch {
        try {
          await load(`TokenURI(${minted})`);
        } catch {
          try {
            await load("TokenURI(1)");
          } catch {
            if (live) setMintTokenURI("");
          }
        }
      }
    })();
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
      setColOffers(false);
      setCollectionPool(null);
      setCollectionPoolNfts([]);
      setCollectionPoolShares(0);
      setCollectionSocials({ website: "", twitter: "", discord: "" });
      setCollectionRounds([]);
      setCollectionHidden(false);
    }
    if (!collectionSlug || (!isPublicFactorySlug(collectionSlug) && !isAdmin)) {
      collectionSlugRef.current = "";
      collectionItemsRef.current = { slug: "", rows: [] };
      bookProgressRef.current = { slug: "", through: 0, minted: 0 };
      bookJobRef.current = null;
      setCollectionBook({ slug: "", through: 0, minted: 0, loading: false });
      clearCollection();
      return;
    }
    const col =
      chainCollections.find((c) => c.slug === collectionSlug) ||
      deskCollections.find((c) => c.slug === collectionSlug);
    const book = collectionBookPath(collectionSlug, deskCollections.length ? deskCollections : chainCollections, nft);
    const factoryBook = !!(col?.pkg && isPkgPath(col.pkg));
    if (!factoryBook && loading && chainCollections.length === 0 && deskCollections.length === 0) return;
    if (!isPkgPath(book)) {
      clearCollection();
      return;
    }
    let live = true;
    const arg = JSON.stringify(collectionSlug);
    const slugNow = collectionSlug;
    const alive = () => live && collectionSlugRef.current === slugNow;
    if (factoryBook) {
      const changed = collectionSlugRef.current !== slugNow;
      collectionSlugRef.current = slugNow;
      const peer = peerBySlugRef.current[slugNow];
      const memory = !changed && collectionItemsRef.current.slug === slugNow ? collectionItemsRef.current.rows : [];
      const cached = readItemBookCache(book);
      const seed =
        (memory.length > 0 ? memory : null) ||
        (peer && peer.length > 0 ? peer : null) ||
        (cached && cached.rows.length > 0 ? cached.rows : null);
      const seeded = seed && seed.length > 0 ? seed : [];
      const progress = Math.max(
        bookProgressRef.current.slug === slugNow ? bookProgressRef.current.through : 0,
        cached?.through || 0,
      );
      bookProgressRef.current = {
        slug: slugNow,
        through: progress,
        minted: bookProgressRef.current.slug === slugNow ? bookProgressRef.current.minted : 0,
      };
      if (changed) {
        setCollectionRounds([]);
        setCollectionActivity(null);
        setCollectionOffers([]);
        setColOffers(false);
        setCollectionPool(null);
        setCollectionPoolNfts([]);
        setCollectionPoolShares(0);
        setCollectionSocials({ website: "", twitter: "", discord: "" });
        setCollectionHidden(false);
      }
      collectionItemsRef.current = { slug: slugNow, rows: seeded };
      setCollectionItems(seeded.length > 0 ? seeded : null);
      const have = new Set<string>();
      let shown = seeded.slice();
      const publish = (rows: Item[]) => {
        if (!alive() || rows.length < 1) return;
        shown = mergeBookItems(shown, rows);
        for (const row of rows) {
          if (row.id) have.add(row.id);
        }
        const snap = shown;
        collectionItemsRef.current = { slug: slugNow, rows: snap };
        setCollectionItems((prev) => (collectionSlugRef.current === slugNow ? mergeBookItems(prev, snap) : prev));
        const done = bookProgressRef.current.slug === slugNow ? bookProgressRef.current.through : 0;
        writeItemBookCache(book, snap, done);
      };
      const job = {
        slug: slugNow,
        pkg: book,
        rpc,
        through: progress,
        minted: Math.max(progress, col?.minted || col?.count || 0),
        have,
        busy: true,
        publish,
      };
      bookJobRef.current = job;
      if (progress > 0) {
        setCollectionBook({ slug: slugNow, through: progress, minted: job.minted, loading: true });
      }
      void (async () => {
        const hint = Math.max(0, col?.minted || col?.count || 0);
        const mintedP = chainMintedCount(rpc, book, hint);
        const openP = loadListOpen(rpc, book)
          .then((rows) => tagCollectionSlug(rows, slugNow))
          .catch(() => [] as Item[]);
        void evalExpr(rpc, book, "Hidden()")
          .then((raw) => {
            if (alive()) setCollectionHidden(String(raw).includes("true"));
          })
          .catch(() => {
            if (alive()) setCollectionHidden(false);
          });
        void (async () => {
          try {
            const minted = await mintedP;
            const [saleRaw, scheduleRaw, phaseRaw] = await Promise.all([
              evalExpr(rpc, book, "DropSaleOf()"),
              evalExpr(rpc, book, "MintScheduleOf()").catch(() => ""),
              evalExpr(rpc, book, "PhaseMintCapOf()").catch(() => ""),
            ]);
            const sale = parseDropSale(saleRaw);
            const schedule = scheduleRaw
              ? parseMintSchedule(scheduleRaw)
              : { wlStart: 0, wlEnd: 0, publicStart: 0, publicEnd: 0 };
            const caps = parsePhaseMintCap(phaseRaw);
            const now = Math.floor(Date.now() / 1000);
            const wlMinted =
              schedule.wlEnd > 0 && now >= schedule.wlEnd
                ? await loadWhitelistCloseCount(rpc, book, net.id, schedule.wlStart, schedule.wlEnd)
                : null;
            if (!alive()) return;
            const cards = mintRoundCards({
              now,
              maxSupply: col?.maxSupply || 0,
              mintPrice: col?.mintPrice || sale.mintPrice,
              sale: { ...sale, ...schedule },
              mintWlCap: caps.wl,
              mintPubCap: caps.pub,
              minted,
              wlMinted: wlMinted == null ? undefined : wlMinted,
            });
            setCollectionRounds(collectionShowsRounds(cards) ? cards : []);
          } catch {
            if (alive()) setCollectionRounds([]);
          }
        })();
        void (async () => {
          const indexed = await fetchPkgActivity({ pkg: book, slug: slugNow, network: net.id });
          if (!alive()) return;
          setCollectionActivity(indexed || []);
          setCollectionPool(null);
          setCollectionPoolNfts([]);
          setCollectionPoolShares(0);
          setCollectionSocials({ website: "", twitter: "", discord: "" });
          setHasPool(false);
        })();
        void (async () => {
          try {
            const raw = await evalExpr(rpc, book, "ListOffers()");
            if (!alive()) return;
            setCollectionOffers(parseOfferLines(raw));
            setColOffers(true);
          } catch {
            if (!alive()) return;
            setCollectionOffers([]);
            setColOffers(false);
          }
        })();
        let minted = Math.max(0, col?.minted || col?.count || 0);
        try {
          if (hint > 0) await loadItemWaves(rpc, book, missingItemIds(have, hint), publish, alive);
          const [open, fresh] = await Promise.all([openP, mintedP]);
          minted = fresh;
          if (!alive()) return;
          publish(open);
          const cap = Math.max(hint, minted);
          await loadItemWaves(rpc, book, missingItemIds(have, cap), publish, alive);
        } catch {
          /* keep whatever wave already painted */
        }
        if (!alive() || bookJobRef.current !== job) return;
        const pageEnd = Math.min(ITEM_BOOK_CAP, Math.max(0, minted));
        const through = Math.max(progress, pageEnd);
        job.through = through;
        job.minted = minted;
        job.busy = false;
        bookProgressRef.current = { slug: slugNow, through, minted };
        collectionItemsRef.current = { slug: slugNow, rows: shown };
        setCollectionItems((prev) => {
          if (collectionSlugRef.current !== slugNow) return prev;
          if (shown.length > 0) return mergeBookItems(prev, shown);
          return prev && prev.length > 0 ? prev : [];
        });
        setCollectionBook({ slug: slugNow, through, minted, loading: false });
        if (shown.length > 0) {
          setPeerBySlug((prev) => ({ ...prev, [slugNow]: shown }));
          writeItemBookCache(book, shown, through);
        }
      })();
      return () => {
        live = false;
      };
    }
    setCollectionRounds([]);
    setCollectionHidden(false);
    void (async () => {
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
      const socialsTask = (async () => {
        try {
          return parseSocials(await evalExpr(rpc, nft, `Socials(${arg})`));
        } catch {
          return { website: "", twitter: "", discord: "" };
        }
      })();
      const [nextItems, nextActivity, nextOffers, nextSocials] = await Promise.all([
        itemsTask,
        activityTask,
        offersTask,
        socialsTask,
      ]);
      if (!live) return;
      setCollectionItems(nextItems);
      setCollectionActivity(nextActivity);
      setCollectionOffers(nextOffers);
      setCollectionPool(null);
      setCollectionSocials(nextSocials);
      setCollectionPoolNfts([]);
      setCollectionPoolShares(0);
    })();
    return () => {
      live = false;
    };
  }, [collectionSlug, nft, chainCollections, deskCollections, isAdmin, rpc, net.id, loading]);

  async function onLoadMoreCollection() {
    const job = bookJobRef.current;
    if (!job || job.busy || job.through <= 0 || job.through >= job.minted) return;
    if (collectionSlugRef.current !== job.slug) return;
    job.busy = true;
    const slug = job.slug;
    setCollectionBook({ slug, through: job.through, minted: job.minted, loading: true });
    try {
      const minted = await chainMintedCount(job.rpc, job.pkg, job.minted);
      if (bookJobRef.current !== job || collectionSlugRef.current !== slug) return;
      job.minted = minted;
      const end = Math.min(minted, job.through + ITEM_BOOK_CAP);
      const ids = nextItemIds(job.have, minted, job.through, ITEM_BOOK_CAP);
      const finished = await loadItemWaves(
        job.rpc,
        job.pkg,
        ids,
        job.publish,
        () => bookJobRef.current === job && collectionSlugRef.current === slug,
      );
      if (bookJobRef.current !== job || collectionSlugRef.current !== slug) return;
      if (!finished) {
        setCollectionBook({ slug, through: job.through, minted: job.minted, loading: false });
        return;
      }
      job.through = end;
      bookProgressRef.current = { slug, through: end, minted };
      const rows = collectionItemsRef.current.slug === slug ? collectionItemsRef.current.rows : [];
      if (rows.length > 0) {
        setPeerBySlug((prev) => ({ ...prev, [slug]: rows }));
        writeItemBookCache(job.pkg, rows, end);
      }
      setCollectionBook({ slug, through: end, minted, loading: false });
    } catch {
      if (bookJobRef.current === job) {
        setCollectionBook({ slug, through: job.through, minted: job.minted, loading: false });
      }
    } finally {
      if (bookJobRef.current === job) job.busy = false;
    }
  }

  function writeHash(next: string) {
    const path = sharePath(next);
    const hash = path === "/" ? next : "";
    const curHash = window.location.hash === "#" ? "" : window.location.hash || "";
    if (curHash === hash && window.location.pathname === path) return;
    window.history.pushState(null, "", `${path}${window.location.search}${hash}`);
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

  useEffect(() => {
    if (tab !== "admin") return;
    if (!connected || (adminAddr && !sameAddr(account?.address, adminAddr))) {
      goTab("explore");
    }
  }, [tab, connected, adminAddr, account?.address]);

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

  function onItemId(id: string, slug = "") {
    const col = (slug || collectionSlug).trim();
    setOpenItemId(id);
    if (id) {
      if (col) setCollectionSlug(col);
      setTab("explore");
      setProfileAddr("");
      setMintSlug("");
      writeHash(itemHash(id, col));
    } else if (col) {
      writeHash(collectionHash(col));
    } else {
      writeHash("");
    }
  }

  useEffect(() => {
    function apply() {
      const raw = routeRaw();
      const path = sharePath(raw);
      const route = parseHash(raw);
      const keepHash =
        route.slug || route.mintSlug || route.itemId
          ? ""
          : window.location.hash && window.location.hash !== "#"
            ? window.location.hash
            : "";
      const nextUrl = `${path}${window.location.search}${keepHash}`;
      const curUrl = `${window.location.pathname || "/"}${window.location.search}${window.location.hash || ""}`;
      if (nextUrl !== curUrl) window.history.replaceState(null, "", nextUrl);
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
        setOpenItemId(route.itemId);
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

  useEffect(() => {
    const slug = (collectionSlug || mintSlug || "").trim().toLowerCase();
    const itemId = /^\d+$/.test(openItemId) ? openItemId : "";
    const col = slug ? chainCollections.find((row) => row.slug === slug) : undefined;
    if (!col) {
      if (itemId && !collectionSlug && !mintSlug) {
        applyPageMeta({
          title: `NFT #${itemId} · Nomaq`,
          description: `NFT #${itemId} on Nomaq. Trade this piece in GNOT on gno.land.`,
          image: "https://nomaq.xyz/og.jpg",
          url: `https://nomaq.xyz/i/${itemId}`,
          card: "summary",
        });
        return;
      }
      if (!slug) applyPageMeta({});
      return;
    }
    const name = (col.name || slug).trim();
    const onCollection = !!collectionSlug;
    const image = absMetaImage(col.cover);
    const url = `https://nomaq.xyz/${onCollection ? "c" : "m"}/${slug}${onCollection && itemId ? `/${itemId}` : ""}`;
    const title = collectionTitle(onCollection && itemId ? `${name} #${itemId}` : name);
    const description = (col.bio || "").trim() || fallbackBio(slug, name);
    applyPageMeta({ title, description, image, url, card: "summary" });
    let stop = false;
    fetch(`/api/bio?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (stop || !body) return;
        const next = String(body.description || "").trim() || description;
        applyPageMeta({ title, description: next, image, url, card: "summary" });
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [collectionSlug, mintSlug, openItemId, chainCollections]);

  useEffect(() => {
    if (tab !== "genesis" && tab !== "admin") return;
    let live = true;
    const load = async () => {
      try {
        const data = await fetchWlist({ address: account?.address, full: tab === "admin" && isAdmin });
        if (!live) return;
        setWlistCount(data.count);
        setWlistPlace(data.place);
        setWlistRegistered(data.registered);
        setWlistHandle(data.handle);
        setWlistRows(data.rows || []);
        setWlistError("");
      } catch {
        if (!live) return;
        setWlistError("Whitelist list is stored off-chain. Start local Vite if submit fails.");
        if (tab !== "admin") {
          setWlistCount(0);
          setWlistPlace(0);
          setWlistRegistered(false);
          setWlistHandle("");
        }
      }
    };
    void load();
    const tick = window.setInterval(() => {
      void load();
    }, 4000);
    return () => {
      live = false;
      window.clearInterval(tick);
    };
  }, [tab, account?.address, busy, isAdmin]);

  const unlisted = useMemo(() => owned.filter((row) => !row.listed), [owned]);
  const sellItems = useMemo(() => {
    const extra = owned.find((row) => row.listed && itemRowKey(row) === listId);
    if (extra && !unlisted.some((row) => itemRowKey(row) === itemRowKey(extra))) return [extra, ...unlisted];
    return unlisted;
  }, [owned, unlisted, listId]);

  useEffect(() => {
    if (owned.some((row) => itemRowKey(row) === listId)) return;
    setListId(unlisted[0] ? itemRowKey(unlisted[0]) : "");
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

  async function onDisconnect() {
    setErr("");
    setMsg("");
    try {
      await disconnectAdena();
    } catch {
      /* still drop the local session */
    }
    setAccount(null);
    setOwned([]);
    setCart([]);
    setMsg("Wallet disconnected.");
  }

  function bookOf(slug: string): string {
    return collectionBookPath(slug, chainCollections, nft);
  }

  async function ensureCollectionPeers(slug: string) {
    const key = slug.trim();
    if (!key || peerBySlug[key]) return;
    const col = chainCollections.find((c) => c.slug === key);
    const book = collectionBookPath(key, chainCollections, nft);
    if (!isPkgPath(book)) return;
    const minted = await chainMintedCount(rpc, book, col?.minted || col?.count || 0);
    try {
      const rows = await loadCollectionBook(rpc, book, key, minted);
      setPeerBySlug((prev) => (prev[key] ? prev : { ...prev, [key]: rows }));
    } catch {
      /* keep listed-only fallback */
    }
  }

  function factoryPkgOf(slug: string): string {
    const pkg = collectionBookPath(slug, chainCollections, "");
    return isPkgPath(pkg) ? pkg : "";
  }

  async function callDetail(
    func: string,
    args: string[],
    send = "",
    pkgPath?: string,
  ): Promise<{ ok: boolean; error: string }> {
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
      return { ok: true, error: "" };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setErr(error);
      return { ok: false, error };
    } finally {
      setBusy("");
    }
  }

  async function call(func: string, args: string[], send = "", pkgPath?: string): Promise<boolean> {
    return (await callDetail(func, args, send, pkgPath)).ok;
  }

  async function syncPerk(pkg: string, messages: { func: string; args: string[] }[], gasEach: number): Promise<boolean> {
    setBusy("Sync");
    setErr("");
    setMsg("");
    try {
      if (!account) throw new Error("Connect Adena first.");
      if (wrongNet) throw new Error(`Switch Adena to ${net.chainName} (${net.chainId}).`);
      const path = normalizePkgPath(pkg);
      if (!isPkgPath(path)) throw new Error("Set a valid perk package path.");
      if (messages.length < 1) throw new Error("No NFTs to record.");
      const price = await queryGasPrice(rpc);
      const gasWanted = gasEach * messages.length;
      const gasFee = Math.max(1, Math.ceil((gasWanted * price.ugnot) / Math.max(1, price.gas)));
      const res = await doContractCalls({
        caller: account.address,
        messages: messages.map((msg) => ({ pkgPath: path, func: msg.func, args: msg.args })),
        gasWanted,
        gasFee,
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

  async function settlePerk(pkg: string): Promise<boolean> {
    setBusy("Settle");
    setErr("");
    setMsg("");
    try {
      if (!account) throw new Error("Connect Adena first.");
      if (wrongNet) throw new Error(`Switch Adena to ${net.chainName} (${net.chainId}).`);
      const path = normalizePkgPath(pkg);
      if (!isPkgPath(path)) throw new Error("Set a valid perk package path.");
      const price = await queryGasPrice(rpc);
      const gasFee = Math.max(1, Math.ceil((SETTLE_GAS_WANTED * price.ugnot) / Math.max(1, price.gas)));
      const res = await doContractCall({
        caller: account.address,
        pkgPath: path,
        func: "Settle",
        args: [],
        gasWanted: SETTLE_GAS_WANTED,
        gasFee,
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

  async function syncOwnedNft(item: Item): Promise<void> {
    if (!nftCanSync(item)) return;
    let pkg = genesisPkg;
    if (!isPkgPath(pkg)) {
      const factoryPath = isPkgPath(factory) ? factory : factoryPkgFor(net.id);
      pkg = parseEvalString(await evalExpr(rpc, factoryPath, "GenesisPkg()"));
    }
    const id = Math.floor(Number(item.id));
    await syncPerk(pkg, syncCalls([id]), 15_000_000);
  }

  async function mintQuantity(slug: string, unitUgnot: number, qty: number, round: MintQtyRound) {
    const n = Math.max(0, Math.floor(qty));
    if (!slug || n < 1) return;
    const pay = Number.isFinite(unitUgnot) && unitUgnot > 0 ? Math.floor(unitUgnot) : 0;
    const pkg = factoryPkgOf(slug);
    const path = normalizePkgPath(pkg || nft);
    const send = pay > 0 ? `${pay}ugnot` : "";
    const args = pkg ? [] : [slug];
    setBusy("PublicMint");
    setErr("");
    setMsg("");
    try {
      if (!account) throw new Error("Connect Adena first.");
      if (wrongNet) throw new Error(`Switch Adena to ${net.chainName} (${net.chainId}).`);
      if (!isPkgPath(path)) throw new Error("Set a valid NFT package path.");
      // PublicMint mints one NFT. takeExact wants that round's unit price on each MsgCall.
      const res = await doContractCalls({
        caller: account.address,
        messages: Array.from({ length: n }, () => ({
          pkgPath: path,
          func: "PublicMint",
          args,
          send,
        })),
        gasWanted: 80_000_000 * n,
        gasFee: 2_000_000 * n,
        network: net,
      });
      setMsg(res.hash ? `Submitted ${res.hash.slice(0, 10)}…` : "Submitted.");
      setMintedSlug(slug);
      setLocalMints((prev) =>
        round === "whitelist" ? { ...prev, wl: prev.wl + n } : { ...prev, pub: prev.pub + n },
      );
      setMintedLive((prev) => {
        const listed = chainCollections.find((c) => c.slug === slug)?.minted || 0;
        const shown = prev?.slug === slug ? prev.n : listed;
        return { slug, n: mergeMintedCount(shown, shown + n) };
      });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function refreshWlist(full = false) {
    const data = await fetchWlist({ address: account?.address, full: full || (tab === "admin" && isAdmin) });
    setWlistCount(data.count);
    setWlistPlace(data.place);
    setWlistRegistered(data.registered);
    setWlistHandle(data.handle);
    setWlistRows(data.rows || []);
    setWlistError("");
  }

  async function seedWhitelist(blob: string) {
    setBusy("Seed");
    setErr("");
    setMsg("");
    try {
      const addrs = blob
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await seedWlist(addrs);
      setMsg(`Added ${res.added} wallet${res.added === 1 ? "" : "s"}.`);
      await refreshWlist(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function patchWhitelist(patch: { address: string; handle?: string; newAddress?: string }) {
    setBusy("Update");
    setErr("");
    setMsg("");
    try {
      await patchWlist(patch);
      setMsg("Whitelist row updated.");
      await refreshWlist(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function removeWhitelist(address: string) {
    setBusy("Remove");
    setErr("");
    setMsg("");
    try {
      await removeWlist(address);
      setMsg("Whitelist row removed.");
      await refreshWlist(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function submitWlist(handle: string) {
    setBusy("Submit");
    setErr("");
    setMsg("");
    try {
      if (!account) throw new Error("Connect Adena first.");
      const res = await postWlist(account.address, handle);
      setWlistCount(res.count);
      setWlistPlace(res.place);
      setWlistRegistered(true);
      setWlistHandle(res.handle);
      setWlistCelebrate(true);
      setWlistError("");
      setMsg(`You are #${res.place} on the list.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
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

  async function launchWizard(plan: LaunchPlan) {
    setBusy("Reserve");
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
        const meta = pkgMetaStatus(await queryPkgMeta(rpc, pkg));
        setErr(
          meta === "inert"
            ? "This collection realm is submitted and waiting for the package approver. Reserve again after it is enabled."
            : "This collection realm is not on chain yet. Ask Nomaq to addpkg, then Reserve and Initialize.",
        );
        setBusy("");
        return;
      }
    }
    const factoryPath = isPkgPath(factory) ? normalizePkgPath(factory) : "";
    let reserved = "";
    if (factoryPath) {
      try {
        reserved = parseEvalString(await evalExpr(rpc, factoryPath, `ReservedCreator(${JSON.stringify(plan.slug)})`)).trim();
      } catch {
        reserved = "";
      }
      if (reserved && account?.address && !sameAddr(reserved, account.address)) {
        setErr("This slug is reserved by another wallet.");
        setBusy("");
        return;
      }
    }
    let needsInit = true;
    try {
      await evalExpr(rpc, pkg, "GrcName()");
      needsInit = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      needsInit = /call Init first/i.test(msg) || needsInit;
    }
    let loaded = 0;
    const chainSale = { wlPrice: 0, wlSupply: 0, wlStart: 0, wlEnd: 0, publicStart: 0, publicEnd: 0, wlCap: 0, pubCap: 0 };
    if (!needsInit) {
      const [loadedRaw, saleRaw, schRaw, capRaw] = await Promise.all([
        evalExpr(rpc, pkg, "LoadedOf()").catch(() => ""),
        evalExpr(rpc, pkg, "DropSaleOf()").catch(() => ""),
        evalExpr(rpc, pkg, "MintScheduleOf()").catch(() => ""),
        evalExpr(rpc, pkg, "PhaseMintCapOf()").catch(() => ""),
      ]);
      if (loadedRaw) loaded = parseEvalInt(loadedRaw);
      if (saleRaw) {
        const sale = parseEvalString(saleRaw).split("|");
        chainSale.wlPrice = Number(sale[1] || 0);
        chainSale.wlSupply = Number(sale[2] || 0);
      }
      if (schRaw) {
        const sch = parseEvalString(schRaw).split("|");
        chainSale.wlStart = Number(sch[0] || 0);
        chainSale.wlEnd = Number(sch[1] || 0);
        chainSale.publicStart = Number(sch[2] || 0);
        chainSale.publicEnd = Number(sch[3] || 0);
      }
      if (capRaw) {
        const cap = parseEvalString(capRaw).split("|");
        chainSale.wlCap = Number(cap[0] || 0);
        chainSale.pubCap = Number(cap[1] || 0);
      }
    }
    const skip = skipLaunchSetup({ needsInit, reserved: !!reserved, ...chainSale });
    const msgs: Array<LaunchMsg & { pkgPath: string }> = [];
    if (factoryPath && !skip.reserve) {
      const fee = reserveSend > 0 ? `${reserveSend}ugnot` : "";
      msgs.push({ func: "Reserve", args: [plan.slug], send: fee, pkgPath: factoryPath });
    }
    if (!skip.init) {
      msgs.push({
        func: "Init",
        args: [plan.name, plan.slug, plan.cover, plan.maxSupply, plan.priceUgnot, String(plan.royaltyBps)],
        pkgPath: pkg,
      });
    }
    if (plan.wlSupply > 0 && !skip.sale) {
      msgs.push({ func: "SetDropSale", args: [plan.wlPriceUgnot, String(plan.wlSupply)], pkgPath: pkg });
    }
    if ((plan.wlStart > 0 || plan.wlEnd > 0 || plan.publicStart > 0 || plan.publicEnd > 0) && !skip.clock) {
      msgs.push({
        func: "SetMintSchedule",
        args: [String(plan.wlStart), String(plan.wlEnd), String(plan.publicStart), String(plan.publicEnd)],
        pkgPath: pkg,
      });
    }
    if ((plan.wlCap > 0 || plan.pubCap > 0) && !skip.caps) {
      msgs.push({ func: "SetPhaseMintCap", args: [String(plan.wlCap), String(plan.pubCap)], pkgPath: pkg });
    }
    if (plan.blob) {
      const lines = plan.blob.split("\n").filter(Boolean).slice(Math.max(0, loaded));
      msgs.push(...chunkDropLines(lines).map((msg) => ({ ...msg, pkgPath: pkg })));
      if (plan.hide) msgs.push({ func: "SetHidden", args: ["true"], pkgPath: pkg });
      if (plan.prereveal) msgs.push({ func: "SetPrereveal", args: [plan.prereveal], pkgPath: pkg });
    }
    if (plan.allow) {
      const addrs = plan.allow.split(/\n/).map((s) => s.trim()).filter(Boolean);
      for (let i = 0; i < addrs.length; i += 50) {
        msgs.push({ func: "AddAllowlist", args: [addrs.slice(i, i + 50).join("\n")], pkgPath: pkg });
      }
    }
    if (plan.blob && plan.maxSupply !== "0") {
      msgs.push({ func: "ResumeMint", args: [], pkgPath: pkg });
    }
    if (!account) {
      setErr("Connect Adena first.");
      setBusy("");
      return;
    }
    const groups = packLaunchTxs(msgs);
    const price = await queryGasPrice(rpc);
    try {
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const gasWanted = txGasWanted(group);
        setBusy(`Launch ${i + 1}/${groups.length}`);
        setErr("");
        setMsg("");
        const res = await doContractCalls({
          caller: account.address,
          messages: group.map((msg) => ({
            pkgPath: msg.pkgPath,
            func: msg.func,
            args: msg.args,
            send: msg.send,
          })),
          gasWanted,
          gasFee: gasFeeUgnot(gasWanted, price.ugnot, price.gas),
          network: net,
        });
        setMsg(res.hash ? `Submitted ${res.hash.slice(0, 10)}…` : "Submitted.");
        await refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy("");
      return;
    }
    setBusy("");
    onOpenMint(plan.slug);
  }

  const profileKey = (profileAddr || account?.address || "").trim();
  const mineProfile = sameAddr(profileKey, account?.address);
  const factoryPad = chainCollections.some((c) => !!c.pkg && isPkgPath(c.pkg));
  const offerBook = collectionSlug ? bookOf(collectionSlug) : "";
  const offerPkg = collectionSlug && colOffers && isPkgPath(offerBook) ? offerBook : undefined;
  const offerOn = !!offerPkg || (!factoryPad && hasOffers);

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

  async function buyListed(rows: Item[]): Promise<boolean> {
    const live = rows.filter((row) => row.id && row.listed && row.price > 0 && !isPreviewItem(row));
    if (live.length < 1) return true;
    for (const row of live) {
      const ok = await call("Buy", [row.id], `${row.price}ugnot`, bookOf(itemCollectionSlug(row)));
      if (!ok) return false;
    }
    return true;
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
    void buyListed([row]);
  }

  function onSell(row: Item) {
    if (row.id) setListId(itemRowKey(row));
    if (row.listed && row.price > 0) setListPrice(String(row.price / UGNOT));
    setTab("sell");
  }

  async function onSubmitList(rows: ListRequest[]) {
    const groups = packListTxs(
      bulkMessages(
        rows.map((row) => ({
          id: row.item.id,
          listed: row.item.listed,
          pkgPath: bookOf(itemCollectionSlug(row.item)),
          priceUgnot: row.priceUgnot,
        })),
      ),
    );
    if (groups.length < 1) {
      setErr("Enter a GNOT price for each selected item.");
      return;
    }
    setBusy("List");
    setErr("");
    setMsg("");
    let done = 0;
    try {
      if (!account) throw new Error("Connect Adena first.");
      if (wrongNet) throw new Error(`Switch Adena to ${net.chainName} (${net.chainId}).`);
      const price = await queryGasPrice(rpc);
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const gasWanted = listGasWanted(group.length);
        const gasFee = Math.max(1, Math.ceil((gasWanted * price.ugnot) / Math.max(1, price.gas)));
        if (groups.length > 1) setMsg(`Signature ${i + 1} of ${groups.length}.`);
        const res = await doContractCalls({
          caller: account.address,
          messages: group.map((msg) => ({ pkgPath: msg.pkgPath, func: msg.func, args: msg.args })),
          gasWanted,
          gasFee,
          memo: "bazaar list",
          network: net,
        });
        done += 1;
        setMsg(
          res.hash
            ? `Submitted ${res.hash.slice(0, 10)}… (${done}/${groups.length})`
            : `Submitted ${done}/${groups.length}.`,
        );
      }
      await refresh();
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      setErr(done > 0 ? `Submitted ${done} of ${groups.length} signatures. ${why}` : why);
      if (done > 0) await refresh();
    } finally {
      setBusy("");
    }
  }

  function onPickNetwork(id: string) {
    const next = networkById(id);
    saveNetwork(next.id);
    setNet(next);
    setAccount(null);
  }

  return (
    <>
      <Analytics />
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
        onDisconnect={() => void onDisconnect()}
        network={net}
        onNetwork={onPickNetwork}
        onProfile={account?.address ? () => onOpenProfile(account.address) : undefined}
        isAdmin={isAdmin}
        mintSlug={mintSlug}
        onOpenMint={onOpenMint}
      />
      <Notices
        wrongNet={wrongNet}
        chainId={account?.chainId}
        wantChainId={net.chainId}
        err={err}
        msg={msg}
        busy={busy}
        onClearMsg={clearMsg}
        onClearErr={clearErr}
      />
      <main id="main" tabIndex={-1}>
        {tab === "explore" ? (
          <Explore
            items={items}
            holdings={[...owned, ...profileItems]}
            chainCollections={chainCollections}
            collectionItems={collectionItems}
            collectionActivity={collectionActivity}
            collectionOffers={collectionOffers}
            collectionPool={collectionPool}
            collectionPoolNfts={collectionPoolNfts}
            collectionPoolShares={collectionPoolShares}
            collectionSocials={collectionSocials}
            factoryOnly={net.id === "mainnet" || net.id === "onyx"}
            networkId={net.id}
            homeActivity={homeActivity}
            liveSlugs={liveSlugs}
            featuredSlugs={featuredSlugs}
            slug={collectionSlug}
            mintRounds={collectionRounds}
            collectionHidden={collectionHidden}
            moreCount={collectionBook.slug === collectionSlug ? nextPageSize(collectionBook.through, collectionBook.minted) : 0}
            moreBusy={collectionBook.slug === collectionSlug && collectionBook.loading}
            onLoadMore={() => void onLoadMoreCollection()}
            onRevealCollection={(slug) => {
              const pkg = factoryPkgOf(slug);
              void call("RevealCollection", pkg ? [] : [slug], "", pkg || nft);
            }}
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
            onOffer={
              offerOn
                ? (id, ugnot) => void call("Offer", [id], `${ugnot}ugnot`, offerPkg)
                : undefined
            }
            onCancelOffer={offerOn ? (id) => void call("CancelOffer", [id], "", offerPkg) : undefined}
            onAcceptOffer={
              offerOn ? (id, bidder) => void call("AcceptOffer", [id, bidder], "", offerPkg) : undefined
            }
            onDepositPool={!factoryPad && hasPool ? (slug, ugnot) => void call("DepositPool", [slug], `${ugnot}ugnot`) : undefined}
            onWithdrawPool={!factoryPad && hasPool ? (slug, shares) => void call("WithdrawPool", [slug, String(shares)]) : undefined}
            onDepositNft={!factoryPad && hasPool ? (id) => void call("DepositNftPool", [id]) : undefined}
            onWithdrawNft={!factoryPad && hasPool ? (id) => void call("WithdrawNftPool", [id]) : undefined}
            onInstantSell={
              factoryPad
                ? offerOn
                  ? (id) => void call("InstantSell", [id], "", offerPkg)
                  : undefined
                : (id) => {
                    if (hasOffers) {
                      void call("InstantSell", [id]);
                      return;
                    }
                    const top = topOfferFor(collectionOffers, id);
                    if (top) void call("AcceptOffer", [id, top.bidder]);
                  }
            }
            onSweep={(ids) => {
              const pool = [...(collectionItems || []), ...items];
              const rows = ids
                .map((id) =>
                  pool.find(
                    (row) => row.id === id && (!collectionSlug || itemCollectionSlug(row) === collectionSlug),
                  ),
                )
                .filter((row): row is Item => !!row);
              void buyListed(rows);
            }}
            cart={cart}
            onCart={onCart}
            onReveal={(id) => {
              const row =
                items.find((it) => it.id === id) ||
                collectionItems?.find((it) => it.id === id) ||
                owned.find((it) => it.id === id);
              void call("Reveal", [id], "", row ? bookOf(itemCollectionSlug(row)) : nft);
            }}
            onSyncNft={(item) => void syncOwnedNft(item)}
            onOpenMint={onOpenMint}
            hasOffers={offerOn}
            hasPool={!factoryPad && hasPool}
            onOpenProfile={onOpenProfile}
          />
        ) : null}
        {tab === "sell" ? (
          <Sell
            items={sellItems}
            focusKey={listId}
            focusPrice={listPrice}
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            onList={(rows) => void onSubmitList(rows)}
            onConnect={() => void onConnect()}
            onOpenTab={goTab}
            loading={loading}
          />
        ) : null}
        {tab === "create" && mintSlug ? (
          <MintPage
            drop={mintDrop}
            slug={mintSlug}
            loaded={mintLoaded}
            hidden={mintHidden}
            allowN={mintAllowN}
            mintCap={mintCap}
            mintWlCap={mintWlCap}
            mintPubCap={mintPubCap}
            wlMinted={wlCloseMinted?.slug === mintSlug ? wlCloseMinted.n : undefined}
            wlMintedPending={
              (mintSale?.wlEnd || 0) > 0 &&
              Math.floor(Date.now() / 1000) >= (mintSale?.wlEnd || 0) &&
              wlCloseMinted?.slug !== mintSlug
            }
            sale={mintSale}
            planned={plannedWl}
            creator={!!account && sameAddr(account.address, chainCollections.find((c) => c.slug === mintSlug)?.creator)}
            tokenURI={mintTokenURI}
            connected={connected}
            allowlisted={mintAllowlisted}
            blocked={blocked}
            busy={!!busy}
            onSaveWhitelist={(priceUgnot, qty) => {
              if (!mintSlug || qty <= 0) return;
              const pkg = factoryPkgOf(mintSlug);
              void call(
                "SetDropSale",
                pkg ? [String(priceUgnot), String(qty)] : [mintSlug, String(priceUgnot), String(qty)],
                "",
                pkg || nft,
              );
            }}
            walletHint={
              net.id === "onyx"
                ? `Adena lists NFTs from the network indexer. On Onyx that field is empty until you set it. In Adena open Change Network, turn on Testnet Mode, edit Gno Onyx, set Indexer URL to ${adenaIndexerOrigin("onyx")}, then Save. This profile shows the piece immediately. A hidden collection names it Unrevealed.`
                : ""
            }
            justMinted={mintedSlug === mintSlug && mintedSlug !== ""}
            walletWl={Math.max(chainMints.wl, localMints.wl)}
            walletPub={Math.max(chainMints.pub, localMints.pub)}
            mintCountReady={!connected || mintCountReady}
            roundReady={mintMetaReady}
            onOpenProfile={account ? () => onOpenProfile(account.address) : undefined}
            onMint={(priceUgnot, qty, round) => {
              void mintQuantity(mintSlug, priceUgnot, qty, round);
            }}
            onConnect={() => void onConnect()}
            onOpenCollection={() => onSlug(mintSlug)}
            onRevealCollection={() => {
              const pkg = factoryPkgOf(mintSlug);
              void call("RevealCollection", pkg ? [] : [mintSlug], "", pkg || nft);
            }}
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
              wlCap: 0,
              pubCap: 0,
              royaltyBps: 0,
              wlPriceUgnot: "0",
              wlSupply: 0,
              wlStart: 0,
              wlEnd: 0,
              publicStart: 0,
              publicEnd: 0,
              prereveal: "",
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
                wlCap: 0,
                pubCap: 0,
                royaltyBps: 0,
                wlPriceUgnot: "0",
                wlSupply: 0,
                wlStart: 0,
                wlEnd: 0,
                publicStart: 0,
                publicEnd: 0,
                prereveal: "",
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
            onSetHidden={(slug, hidden) => {
              const pkg = factoryPkgOf(slug);
              void call("SetHidden", pkg ? [hidden ? "true" : "false"] : [slug, hidden ? "true" : "false"], "", pkg || nft);
            }}
            onSetPrereveal={(slug, image) => {
              const pkg = factoryPkgOf(slug);
              void call("SetPrereveal", pkg ? [image] : [slug, image], "", pkg || nft);
            }}
            onRevealCollection={(slug) => {
              const pkg = factoryPkgOf(slug);
              void call("RevealCollection", pkg ? [] : [slug], "", pkg || nft);
            }}
            dropHidden={dropHidden}
            dropPrereveal={dropPrereveal}
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
            onSetMintPrice={(slug, ugnot) => {
              const pkg = factoryPkgOf(slug);
              void call("SetMintPrice", pkg ? [String(ugnot)] : [slug, String(ugnot)], "", pkg || nft);
            }}
            onSetDropSale={(slug, priceUgnot, qty) => {
              const pkg = factoryPkgOf(slug);
              void call(
                "SetDropSale",
                pkg ? [String(priceUgnot), String(qty)] : [slug, String(priceUgnot), String(qty)],
                "",
                pkg || nft,
              );
            }}
            onAddAllowlist={(slug, blob) => {
              const pkg = factoryPkgOf(slug);
              void call("AddAllowlist", pkg ? [blob] : [slug, blob], "", pkg || nft);
            }}
            onSetMintCap={(slug, n) => {
              const pkg = factoryPkgOf(slug);
              void call("SetMintCap", pkg ? [String(n)] : [slug, String(n)], "", pkg || nft);
            }}
            onSetPhaseMintCap={(slug, wl, pub) => {
              const pkg = factoryPkgOf(slug);
              if (!pkg) return;
              void call("SetPhaseMintCap", [String(wl), String(pub)], "", pkg);
            }}
            onStartPublic={(slug) => {
              const pkg = factoryPkgOf(slug);
              void call("StartPublic", pkg ? [] : [slug], "", pkg || nft);
            }}
            onSetMintSchedule={(slug, wlStart, wlEnd, publicStart, publicEnd) => {
              const pkg = factoryPkgOf(slug);
              void call(
                "SetMintSchedule",
                pkg
                  ? [String(wlStart), String(wlEnd), String(publicStart), String(publicEnd)]
                  : [slug, String(wlStart), String(wlEnd), String(publicStart), String(publicEnd)],
                "",
                pkg || nft,
              );
            }}
            onLaunchWizard={(plan: LaunchPlan) => void launchWizard(plan)}
            launchFeeUgnot={launchFeeUgnot}
            reserveSendUgnot={reserveSend}
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
            marketItems={items}
            collectionPeers={peerBySlug}
            onNeedPeers={(slug) => void ensureCollectionPeers(slug)}
            created={chainCollections.filter((c) => sameAddr(c.creator, profileAddr || account?.address))}
            activity={(homeActivity || []).filter((row) => sameAddr(row.actor, profileAddr || account?.address))}
            blocked={blocked}
            busy={!!busy}
            loading={mineProfile ? loading : profileLoading}
            onConnect={() => void onConnect()}
            onCancel={(row) => void call("Cancel", [row.id], "", bookOf(itemCollectionSlug(row)))}
            onOpenTab={goTab}
            onOpenCollection={onSlug}
            onOpenMint={onOpenMint}
            onBuy={onBuy}
            onSell={onSell}
            onListWallet={(rows) => void onSubmitList(rows)}
            onTransfer={(item, to) => {
              void call("Transfer", [to, item.id], "", bookOf(itemCollectionSlug(item)));
            }}
            onReveal={(id) => {
              const row =
                owned.find((it) => it.id === id) ||
                items.find((it) => it.id === id) ||
                collectionItems?.find((it) => it.id === id);
              void call("Reveal", [id], "", row ? bookOf(itemCollectionSlug(row)) : nft);
            }}
            onSyncNft={(item) => void syncOwnedNft(item)}
            userProfile={viewProfile}
            onSaveProfile={mineProfile ? saveUserProfile : undefined}
          />
        ) : null}
        {tab === "genesis" ? (
          <GenesisWhitelist
            count={wlistCount}
            cap={WLIST_CAP}
            opensAtMs={WLIST_OPENS_UTC_MS}
            place={wlistPlace}
            registered={wlistRegistered}
            savedHandle={wlistHandle}
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            loadError={wlistError}
            address={account?.address || ""}
            onConnect={() => void onConnect()}
            onRegister={(handle) => void submitWlist(handle)}
            celebrate={wlistCelebrate}
            onCelebrateDone={() => setWlistCelebrate(false)}
          />
        ) : null}
        {tab === "editions" ? (
          <EditionsPage
            rpc={rpc}
            network={net}
            address={account?.address || ""}
            connected={connected}
            blocked={blocked}
            onConnect={() => void onConnect()}
          />
        ) : null}
        {tab === "rewards" ? (
          <RewardsPage
            rpc={rpc}
            factory={isPkgPath(factory) ? factory : factoryPkgFor(net.id)}
            address={account?.address || ""}
            collection={collectionRealmPath(BAZAAR_GENS_MINT_SLUG, net.id)}
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            onConnect={() => void onConnect()}
            onClaim={async (pkg) => call("Claim", [], "", pkg)}
            onSync={async (pkg, ids) => syncPerk(pkg, syncCalls(ids), 15_000_000)}
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
            isAdmin={isAdmin}
            launchFeeUgnot={launchFeeUgnot}
            adminReserveFree={reserveDueUgnot === 0}
            onSetLaunchFee={(ugnot) =>
              void call("SetLaunchFee", [String(ugnot)], "", isPkgPath(factory) ? factory : nft)
            }
          />
        ) : null}
        {tab === "admin" && isAdmin ? (
          <Admin
            allowed
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            drops={deskCollections}
            featured={featuredSlugs}
            listed={deskListed.length > 0 ? deskListed : items}
            onOpenCollection={onSlug}
            onLaunch={() => goTab("create")}
            launchFeeUgnot={launchFeeUgnot}
            adminReserveFree={reserveDueUgnot === 0}
            protocolBps={protocolBps}
            factoryPkg={factory}
            adminAddr={adminAddr}
            onSave={(slugs) => void call("SetFeatured", [slugs.join(",")])}
            onConnect={() => void onConnect()}
            onSetLaunchFee={(ugnot) =>
              void call("SetLaunchFee", [String(ugnot)], "", isPkgPath(factory) ? factory : nft)
            }
            factoryTreasuryUgnot={factoryTreasuryUgnot}
            onSetProtocolBps={(_pkg, bps) =>
              void call("SetProtocolBps", [String(bps)], "", isPkgPath(factory) ? factory : nft)
            }
            protocolSink={protocolSink}
            onSetProtocolSink={(addr) =>
              void call("SetProtocolSink", [addr], "", isPkgPath(factory) ? factory : nft)
            }
            genesisPkg={genesisPkg}
            onSetGenesis={(pkg) =>
              void call("SetGenesis", [pkg], "", isPkgPath(factory) ? factory : nft)
            }
            onWithdraw={() => void call("Withdraw", [], "", isPkgPath(factory) ? factory : nft)}
            wlistRows={wlistRows}
            wlistCount={wlistCount}
            wlistCap={WLIST_CAP}
            wlistError={wlistError}
            onSeedWlist={(blob) => void seedWhitelist(blob)}
            onPatchWlist={(patch) => void patchWhitelist(patch)}
            onRemoveWlist={(addr) => void removeWhitelist(addr)}
            rpc={rpc}
            collection={collectionRealmPath(BAZAAR_GENS_MINT_SLUG, net.id)}
            onSyncSpan={async (pkg, start, end) =>
              syncPerk(pkg, [{ func: "SyncSpan", args: [String(start), String(end)] }], 8_000_000 * (end - start + 1) + 20_000_000)
            }
            onSettle={(pkg) => settlePerk(pkg)}
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
          const live = cart.filter((row) => row.id && row.listed && row.price > 0);
          if (live.length < 1) {
            return { ok: true, preview: true };
          }
          if (blocked) {
            return { ok: false, error: `Switch Adena to ${net.chainName} (${net.chainId}).` };
          }
          const ok = await buyListed(live);
          if (ok) {
            const keys = new Set(live.map((row) => itemRowKey(row)));
            setCart((prev) => prev.filter((row) => !keys.has(itemRowKey(row))));
            return { ok: true };
          }
          return { ok: false, error: "Buy failed. Check the notice above and Adena." };
        }}
        onConnect={() => void onConnect()}
      />
      <Footer network={net} factory={factory} onTab={goTab} onExploreHome={onExploreHome} />
      <BottomNav
        tab={tab}
        onTab={goTab}
        onExploreHome={onExploreHome}
        onOpenMint={onOpenMint}
        mintSlug={mintSlug}
        isAdmin={isAdmin}
      />
    </>
  );
}

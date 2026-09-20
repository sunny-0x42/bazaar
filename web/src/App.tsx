import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { Launch } from "./components/Launch";
import type { LaunchPlan } from "./components/LaunchWizard";
import { DROP_ADD_CAP } from "./lib/dropjson";
import { MintPage } from "./components/MintPage";
import { Explore } from "./components/Explore";
import { CartBar } from "./components/CartBar";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Notices } from "./components/Notices";
import { Profile } from "./components/Profile";
import { Sell } from "./components/Sell";
import { Settings } from "./components/Settings";
import { SkipLink } from "./components/SkipLink";
import { TestnetRibbon } from "./components/TestnetRibbon";
import type { Account, Tab } from "./components/types";
import {
  collectionHash,
  isNameNotDeclared,
  isOwnListing,
  isPkgPath,
  isPreviewItem,
  itemHash,
  mintHash,
  loadHub,
  loadNetwork,
  loadNft,
  networkById,
  normalizePkgPath,
  parseActivityLines,
  parseCollectionLines,
  parseEvalString,
  parseHash,
  parseIds,
  tabHash,
  parseItems,
  parseDropSlotLines,
  parseEvalInt,
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

async function loadHoldings(rpc: string, nftPath: string, addr: string, open: Item[]): Promise<Item[]> {
  const idsRaw = await evalExpr(rpc, nftPath, `TokensOf(${JSON.stringify(addr)})`);
  const ids = parseIds(idsRaw);
  const listedMap = new Map(open.map((row) => [row.id, row]));
  const missing = ids.filter((id) => !listedMap.has(id)).slice(0, 50);
  const extra = (
    await Promise.all(
      missing.map(async (id) => {
        try {
          const n = Number(id);
          if (!Number.isInteger(n) || n <= 0) return null;
          const raw = await evalExpr(rpc, nftPath, `ItemLine(${n})`);
          return parseItems(raw)[0] ?? null;
        } catch {
          return null;
        }
      }),
    )
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
  const [collectionSlug, setCollectionSlug] = useState("");
  const [collectionItems, setCollectionItems] = useState<Item[] | null>(null);
  const [collectionActivity, setCollectionActivity] = useState<Activity[] | null>(null);
  const [collectionOffers, setCollectionOffers] = useState<OfferRow[]>([]);
  const [collectionPool, setCollectionPool] = useState<PoolInfo | null>(null);
  const [collectionPoolNfts, setCollectionPoolNfts] = useState<PoolNft[]>([]);
  const [collectionPoolShares, setCollectionPoolShares] = useState(0);
  const [collectionSocials, setCollectionSocials] = useState<Socials>({ website: "", twitter: "", discord: "" });
  const [homeActivity, setHomeActivity] = useState<Activity[] | null>(null);
  const [chainNote, setChainNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [listId, setListId] = useState("");
  const [listPrice, setListPrice] = useState("1");
  const [net, setNet] = useState(loadNetwork);
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
    if (!isPkgPath(nftPath)) {
      setItems([]);
      setOwned([]);
      setChainCollections([]);
      setHomeActivity(null);
      setChainNote("Set a valid NFT package path in Settings.");
      setLoading(false);
      return;
    }
    let open: Item[] = [];
    try {
      const openRaw = await evalExpr(rpc, nftPath, "ListOpen()");
      open = parseItems(openRaw);
      setItems(open);
    } catch (e) {
      setItems([]);
      setOwned([]);
      setChainCollections([]);
      setHomeActivity(null);
      const raw = e instanceof Error ? e.message : "Could not read listings from this package path.";
      setChainNote(raw.startsWith("Could not read") ? raw : `Could not read listings: ${raw}`);
      setLoading(false);
      return;
    }
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
      setLaunchFeeUgnot(parseEvalInt(await evalExpr(rpc, nftPath, "LaunchFee()")));
    } catch {
      setLaunchFeeUgnot(1_000_000_000);
    }
    try {
      setAdminAddr(parseEvalString(await evalExpr(rpc, nftPath, "Admin()")));
    } catch {
      setAdminAddr("");
    }
    setLoading(false);
  }, [hub, nft, rpc, account?.address]);

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
    saveHub(hub);
    saveNft(nft);
    saveNetwork(net.id);
  }, [hub, nft, net.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!collectionSlug || !isPkgPath(nft)) {
      setCollectionItems(null);
      setCollectionActivity(null);
      setCollectionOffers([]);
      setCollectionPool(null);
      setCollectionPoolNfts([]);
      setCollectionPoolShares(0);
      setCollectionSocials({ website: "", twitter: "", discord: "" });
      return;
    }
    let live = true;
    const arg = JSON.stringify(collectionSlug);
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
  }, [collectionSlug, nft, rpc, items, account?.address]);

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

  async function call(func: string, args: string[], send = ""): Promise<boolean> {
    setBusy(func);
    setErr("");
    setMsg("");
    try {
      if (!account) throw new Error("Connect Adena first.");
      if (wrongNet) throw new Error(`Switch Adena to ${net.chainName} (${net.chainId}).`);
      if (!isPkgPath(nft)) throw new Error("Set a valid NFT package path.");
      const res = await doContractCall({
        caller: account.address,
        pkgPath: nft,
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

  async function launchWizard(plan: LaunchPlan) {
    const created = plan.extras
      ? await call(
          "LaunchCollection",
          [
            plan.slug,
            plan.name,
            plan.cover,
            plan.bio,
            plan.website,
            plan.twitter,
            plan.discord,
            plan.maxSupply,
            plan.priceUgnot,
          ],
          launchFeeUgnot > 0 ? `${launchFeeUgnot}ugnot` : "",
        )
      : await call(
          "CreateDrop",
          [plan.slug, plan.name, plan.cover, plan.maxSupply, plan.priceUgnot],
          launchFeeUgnot > 0 ? `${launchFeeUgnot}ugnot` : "",
        );
    if (!created) return;
    if (plan.blob) {
      const lines = plan.blob.split("\n").filter(Boolean);
      for (let i = 0; i < lines.length; i += DROP_ADD_CAP) {
        const chunk = lines.slice(i, i + DROP_ADD_CAP).join("\n");
        if (!(await call("AddDropItems", [plan.slug, chunk]))) return;
      }
      if (plan.hide) await call("SetHidden", [plan.slug, "true"]);
    }
    if (plan.royaltyBps > 0 || plan.wlSupply > 0) {
      if (
        !(await call("SetDropSale", [
          plan.slug,
          String(plan.royaltyBps),
          plan.wlPriceUgnot,
          String(plan.wlSupply),
        ]))
      )
        return;
    }
    if (plan.allow) await call("AddAllowlist", [plan.slug, plan.allow]);
    if (plan.cap > 0) await call("SetMintCap", [plan.slug, String(plan.cap)]);
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
        /* nftv5 has no ProfileOf */
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
    void call("Buy", [row.id], `${row.price}ugnot`);
  }

  function onSell(row: Item) {
    if (row.id) setListId(row.id);
    if (row.listed && row.price > 0) setListPrice(String(row.price / UGNOT));
    setTab("sell");
  }

  function onSubmitList() {
    const price = String(ugnotFromGnot(listPrice));
    const listed = owned.find((row) => row.id === listId && row.listed);
    if (listed) void call("UpdatePrice", [listId, price]);
    else void call("List", [listId, price]);
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
            onCancel={(row) => void call("Cancel", [row.id])}
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
            onReveal={(id) => void call("Reveal", [id])}
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
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            onMint={() => {
              const drop = chainCollections.find((c) => c.slug === mintSlug);
              const pay =
                mintSale?.phase === "whitelist" ? mintSale.wlPrice : drop?.mintPrice || mintSale?.mintPrice || 0;
              void call("PublicMint", [mintSlug], `${pay}ugnot`);
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
            onCreateDrop={(args) => void call("CreateDrop", args, launchFeeUgnot > 0 ? `${launchFeeUgnot}ugnot` : "")}
            onLaunchCollection={(args) =>
              void call("LaunchCollection", args, launchFeeUgnot > 0 ? `${launchFeeUgnot}ugnot` : "")
            }
            onMintUnique={(slug, name, image) =>
              void call(slug ? "MintIn" : "Mint", slug ? [slug, name, image] : [name, image])
            }
            onConnect={() => void onConnect()}
            dropSlots={dropSlots}
            onPickDrop={setSlotSlug}
            onAddDropItems={(slug, blob) => void call("AddDropItems", [slug, blob])}
            onSetHidden={(slug, hidden) => void call("SetHidden", [slug, hidden ? "true" : "false"])}
            dropHidden={dropHidden}
            dropLoaded={dropLoaded}
            dropAllowN={dropAllowN}
            dropMintCap={dropMintCap}
            onOpenMint={onOpenMint}
            onOpenCollection={onSlug}
            onPauseMint={(slug) => void call("PauseMint", [slug])}
            onResumeMint={(slug) => void call("ResumeMint", [slug])}
            onSetMintPrice={(slug, ugnot) => void call("SetMintPrice", [slug, String(ugnot)])}
            onAddAllowlist={(slug, blob) => void call("AddAllowlist", [slug, blob])}
            onSetMintCap={(slug, n) => void call("SetMintCap", [slug, String(n)])}
            onStartPublic={(slug) => void call("StartPublic", [slug])}
            onLaunchWizard={(plan: LaunchPlan) => void launchWizard(plan)}
            launchFeeUgnot={launchFeeUgnot}
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
            onCancel={(row) => void call("Cancel", [row.id])}
            onOpenTab={goTab}
            onOpenItem={(item) => {
              if (item.id) onItemId(item.id);
            }}
            onOpenCollection={onSlug}
            onOpenMint={onOpenMint}
            onBuy={onBuy}
            onSell={onSell}
            onTransfer={(id, to) => void call("Transfer", [to, id])}
            onReveal={(id) => void call("Reveal", [id])}
            userProfile={viewProfile}
            onSaveProfile={mineProfile ? saveUserProfile : undefined}
          />
        ) : null}
        {tab === "settings" ? (
          <Settings
            hub={hub}
            nft={nft}
            connected={connected}
            blocked={blocked}
            busy={!!busy}
            onHub={setHub}
            onNft={setNft}
            onConnect={() => void onConnect()}
            onSeed={() => void call("SeedSamples", [])}
            network={net}
            onNetwork={onPickNetwork}
            isAdmin={sameAddr(account?.address, adminAddr)}
            launchFeeUgnot={launchFeeUgnot}
            onSetLaunchFee={(ugnot) => void call("SetLaunchFee", [String(ugnot)])}
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

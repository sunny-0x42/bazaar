import { useEffect, useMemo, useState } from "react";
import {
  accountExplorer,
  activityKindLabel,
  isG1Addr,
  itemCollectionSlug,
  itemRowKey,
  itemSendKey,
  protocolFeeUgnot,
  sameAddr,
  ugnotFromGnot,
  shortAddr,
  type Activity,
  type ChainCollection,
  type Item,
  type Network,
} from "../lib/chain";
import { isArtSrc } from "../lib/chain";
import { listButtonLabel } from "../lib/bulklist";
import { emptyProfile, type UserProfile } from "../lib/userProfile";
import { CopyLine } from "./CopyLine";
import { EmptyState } from "./EmptyState";
import { SkeletonGrid } from "./SkeletonGrid";
import { ItemArt } from "./ItemArt";
import { ListingCard } from "./ListingCard";
import { ListingDrawer } from "./ListingDrawer";
import { Select } from "./Select";
import { TokenMark } from "./TokenMark";
import { PriceMark } from "./PriceMark";
import type { Tab } from "./types";

type Pane = "collected" | "listed" | "created" | "activity";

type Props = {
  address: string;
  network: Network;
  connected: boolean;
  wallet?: string;
  items: Item[];
  marketItems?: Item[];
  collectionPeers?: Record<string, Item[]>;
  onNeedPeers?: (slug: string) => void;
  created: ChainCollection[];
  activity: Activity[];
  blocked: boolean;
  busy: boolean;
  loading?: boolean;
  onConnect: () => void;
  onCancel: (item: Item) => void;
  onOpenTab: (tab: Tab) => void;
  onOpenItem?: (item: Item) => void;
  onOpenCollection: (slug: string) => void;
  onOpenMint?: (slug: string) => void;
  launchEnded?: ReadonlySet<string>;
  launchKnown?: boolean;
  onBuy: (item: Item) => void;
  onSell?: (item: Item) => void;
  onListWallet?: (rows: { item: Item; priceUgnot: number }[]) => void;
  onTransfer?: (item: Item, to: string) => void;
  onReveal?: (id: string) => void;
  onSyncNft?: (item: Item) => void;
  userProfile?: UserProfile;
  onSaveProfile?: (p: UserProfile) => void;
};

export function Profile({
  address,
  network,
  connected,
  wallet,
  items,
  marketItems = [],
  collectionPeers = {},
  onNeedPeers,
  created,
  activity,
  blocked,
  busy,
  loading,
  onConnect,
  onCancel,
  onOpenTab,
  onOpenItem,
  onOpenCollection,
  onOpenMint,
  launchEnded,
  launchKnown = true,
  onBuy,
  onSell,
  onListWallet,
  onTransfer,
  onReveal,
  onSyncNft,
  userProfile,
  onSaveProfile,
}: Props) {

  const [pane, setPane] = useState<Pane>("collected");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(emptyProfile());
  const [sendKey, setSendKey] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sending, setSending] = useState(false);
  const [openItem, setOpenItem] = useState<Item | null>(null);
  const [walletPrice, setWalletPrice] = useState("1");
  const [picked, setPicked] = useState<Record<string, boolean> | null>(null);
  const mine = sameAddr(address, wallet);
  const listed = items.filter((row) => row.listed && row.price > 0);
  const collected = items;
  const sendable = useMemo(
    () => items.filter((row) => !!row.id && !row.listed && (!wallet || sameAddr(row.owner, wallet))),
    [items, wallet],
  );
  const sendItem = sendable.find((row) => itemSendKey(row) === sendKey) || sendable[0] || null;
  const canSend = !!onTransfer && !!sendItem && isG1Addr(sendTo) && !sameAddr(sendTo, wallet);
  const walletOn = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (const row of sendable) {
      const key = itemRowKey(row);
      next[key] = picked ? !!picked[key] : true;
    }
    return next;
  }, [picked, sendable]);
  const walletChosen = sendable.filter((row) => walletOn[itemRowKey(row)]);
  const walletUgnot = ugnotFromGnot(walletPrice);
  const canListWallet = !!onListWallet && walletChosen.length > 0 && walletUgnot > 0;
  const walletReceive = Math.max(0, walletUgnot * walletChosen.length - walletChosen.length * protocolFeeUgnot(walletUgnot));

  function selectWallet(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const row of sendable) next[itemRowKey(row)] = on;
    setPicked(next);
  }

  function toggleWallet(item: Item) {
    const key = itemRowKey(item);
    setPicked({ ...walletOn, [key]: !walletOn[key] });
  }

  useEffect(() => {
    if (!sendable.some((row) => itemSendKey(row) === sendKey)) {
      setSendKey(sendable[0] ? itemSendKey(sendable[0]) : "");
    }
  }, [sendable, sendKey]);

  useEffect(() => {
    if (pane !== "collected") setSending(false);
  }, [pane]);

  useEffect(() => {
    setOpenItem((cur) => {
      if (!cur?.id) return cur;
      const key = itemSendKey(cur);
      return items.find((row) => itemSendKey(row) === key) || null;
    });
  }, [items]);
  const listedValue = listed.reduce((n, row) => n + row.price, 0);
  const collectionsHeld = new Set(items.map((it) => it.collection).filter(Boolean)).size;
  const explorer = accountExplorer(address, network);
  const hue = hashHue(address);

  const shown = useMemo(() => {
    if (pane === "listed") return listed;
    return collected;
  }, [pane, listed, collected]);

  if (!address) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Profile</h1>
          <p className="muted">Connect to open your collector profile, or open any g1 from an item.</p>
        </header>
        <EmptyState title="Connect Adena" body="Your collected items, listings, and activity live on your profile.">
          <button className="btn primary" type="button" onClick={onConnect}>
            Connect Adena
          </button>
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="page profile-page">
      <header className="profile-hero">
        <div
          className="profile-banner"
          style={
            userProfile?.banner && isArtSrc(userProfile.banner)
              ? { backgroundImage: `url(${userProfile.banner})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: banner(hue) }
          }
        />
        <div className="profile-ident">
          <div className="profile-avatar">
            {userProfile?.avatar && isArtSrc(userProfile.avatar) ? (
              <ItemArt name={userProfile.name || address} image={userProfile.avatar} alt="" priority />
            ) : (
              <TokenMark symbol={address} size={72} />
            )}
          </div>
          <div className="profile-copy">
            <div className="profile-hero-top">
              <div className="profile-hero-id">
                <h1>
                  {userProfile?.name || (mine ? "Your profile" : "Collector")}
                  {mine ? <span className="tag">You</span> : null}
                </h1>
                <div className="profile-ids">
                  <CopyLine label="Address" display={shortAddr(address)} value={address} />
                  {explorer ? (
                    <a className="profile-link-chip" href={explorer} target="_blank" rel="noreferrer">
                      gnoscan
                    </a>
                  ) : null}
                  {userProfile?.website ? (
                    <a className="profile-link-chip" href={userProfile.website} target="_blank" rel="noreferrer">
                      Website
                    </a>
                  ) : null}
                  {userProfile?.twitter ? (
                    <a
                      className="profile-link-chip"
                      href={userProfile.twitter.startsWith("http") ? userProfile.twitter : `https://x.com/${userProfile.twitter.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      X
                    </a>
                  ) : null}
                  {userProfile?.discord ? (
                    <a className="profile-link-chip" href={userProfile.discord} target="_blank" rel="noreferrer">
                      Discord
                    </a>
                  ) : null}
                </div>
              </div>
              {mine ? (
                <div className="profile-hero-actions">
                  <button className="btn" type="button" onClick={() => onOpenTab("sell")}>
                    List
                  </button>
                  {onSaveProfile ? (
                    <button
                      className={editing ? "btn primary" : "btn"}
                      type="button"
                      onClick={() => {
                        setDraft(userProfile || emptyProfile());
                        setEditing((v) => !v);
                      }}
                    >
                      {editing ? "Close" : "Edit"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="profile-stats">
          <div>
            <span className="muted">Collected</span>
            <strong className="num">{collected.length}</strong>
          </div>
          <div>
            <span className="muted">Listed</span>
            <strong className="num">{listed.length}</strong>
          </div>
          <div>
            <span className="muted">Listed value</span>
            <strong>{listedValue > 0 ? <PriceMark ugnot={listedValue} /> : "—"}</strong>
          </div>
          <div>
            <span className="muted">Collections</span>
            <strong className="num">{collectionsHeld}</strong>
          </div>
          <div>
            <span className="muted">Created</span>
            <strong className="num">{created.length}</strong>
          </div>
        </div>
      </header>

      {mine && editing && onSaveProfile ? (
        <form
          className="panel profile-editor"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveProfile(draft);
            setEditing(false);
          }}
        >
          <h2>Edit profile</h2>
          <div className="launch-grid">
            <label>
              Display name
              <input value={draft.name} maxLength={32} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Harbor" />
            </label>
            <label>
              Website
              <input value={draft.website} maxLength={120} onChange={(e) => setDraft({ ...draft, website: e.target.value })} />
            </label>
            <label>
              X
              <input value={draft.twitter} maxLength={120} onChange={(e) => setDraft({ ...draft, twitter: e.target.value })} placeholder="@handle" />
            </label>
            <label>
              Discord
              <input value={draft.discord} maxLength={120} onChange={(e) => setDraft({ ...draft, discord: e.target.value })} />
            </label>
          </div>
          <label>
            Banner URL
            <input value={draft.banner} maxLength={200} onChange={(e) => setDraft({ ...draft, banner: e.target.value })} placeholder="https:// or /samples/" />
          </label>
          <label>
            Avatar URL
            <input value={draft.avatar} maxLength={200} onChange={(e) => setDraft({ ...draft, avatar: e.target.value })} placeholder="https:// or /samples/" />
          </label>
          {collected.length > 0 ? (
            <div>
              <p className="hint">Or pick an NFT you hold as avatar</p>
              <div className="avatar-pick">
                {collected.slice(0, 24).map((it) => (
                  <button
                    key={itemRowKey(it)}
                    className={`avatar-pick-btn${draft.avatar === it.image ? " is-on" : ""}`}
                    type="button"
                    title={it.name}
                    onClick={() => setDraft({ ...draft, avatar: it.image })}
                  >
                    <ItemArt name={it.name} image={it.image} alt="" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="hint">Hold an NFT on this book to use it as avatar, or paste a URL.</p>
          )}
          <button className="btn primary" type="submit">
            Save profile
          </button>
        </form>
      ) : null}

      <div className="col-tabs" role="tablist" aria-label="Profile">
        {(
          [
            ["collected", `Collected ${collected.length}`],
            ["listed", `Listed ${listed.length}`],
            ["created", `Created ${created.length}`],
            ["activity", `Activity${activity.length ? ` ${activity.length}` : ""}`],
          ] as const
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

      {pane === "listed" ? (
        <p className="muted">Listed items live on Nomaq. They leave Adena until you cancel or a buyer pays.</p>
      ) : null}

      {loading && (pane === "collected" || pane === "listed") && shown.length === 0 ? (
        <SkeletonGrid />
      ) : null}

      {mine && pane === "collected" ? (
        sendable.length > 0 && onListWallet ? (
          <form
            className="sweep-bar wallet-list"
            aria-label="List wallet"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canListWallet || blocked || busy) return;
              onListWallet(walletChosen.map((item) => ({ item, priceUgnot: walletUgnot })));
            }}
          >
            <p className="muted toolbar-count">
              {shown.length} {shown.length === 1 ? "item" : "items"}
            </p>
            <span className="sweep-bar-label">List</span>
            <label className="wallet-price">
              <input
                value={walletPrice}
                onChange={(e) => setWalletPrice(e.target.value)}
                inputMode="decimal"
                placeholder="1.5"
                aria-label="Wallet list price"
              />
              <span>GNOT</span>
            </label>
            <button className="text-btn" type="button" aria-label="Select all" onClick={() => selectWallet(true)}>
              All
            </button>
            <button className="text-btn" type="button" aria-label="Clear" onClick={() => selectWallet(false)}>
              None
            </button>
            <span className="sweep-bar-meta" aria-label={`${walletChosen.length} of ${sendable.length} still in the wallet`}>
              <strong>{walletChosen.length}</strong>
              <span className="muted">/ {sendable.length}</span>
            </span>
            {walletReceive > 0 ? (
              <span className="sweep-bar-total" title="After the 2% protocol fee">
                <PriceMark ugnot={walletReceive} />
              </span>
            ) : null}
            <div className="sweep-actions">
              <button className="btn primary" type="submit" disabled={blocked || busy || !canListWallet}>
                {listButtonLabel(walletChosen.map(() => ({ listed: false })))}
              </button>
              {onTransfer ? (
                <button className="btn" type="button" aria-pressed={sending} onClick={() => setSending((v) => !v)}>
                  {sending ? "Close" : "Send"}
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="collection-tools">
            <p className="muted toolbar-count">
              {shown.length} {shown.length === 1 ? "item" : "items"}
            </p>
            {onTransfer ? (
              <button className={sending ? "btn primary" : "btn"} type="button" onClick={() => setSending((v) => !v)}>
                {sending ? "Close send" : "Send NFT"}
              </button>
            ) : null}
          </div>
        )
      ) : null}

      {mine && pane === "collected" && onTransfer && sending ? (
        <form
          className="panel profile-send"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSend || !sendItem) return;
            onTransfer(sendItem, sendTo.trim());
          }}
        >
          {sendable.length === 0 ? (
            <p className="muted">No unlisted items. Cancel a listing first.</p>
          ) : (
            <>
              <div className="profile-send-row">
                <label>
                  Item
                  <Select
                    ariaLabel="Item to send"
                    value={sendItem ? itemSendKey(sendItem) : ""}
                    onChange={setSendKey}
                    options={sendable.map((row) => ({
                      value: itemSendKey(row),
                      label: `#${row.id} ${row.name} · ${row.collection || "Nomaq"}`,
                    }))}
                  />
                </label>
                <label>
                  To (g1)
                  <input
                    className="mono"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value.trim())}
                    placeholder="g1…"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Recipient g1 address"
                  />
                </label>
                {connected ? (
                  <button className="btn primary" type="submit" disabled={blocked || busy || !canSend}>
                    Send
                  </button>
                ) : (
                  <button className="btn primary" type="button" onClick={onConnect}>
                    Connect Adena
                  </button>
                )}
              </div>
              {sendTo.trim() && !isG1Addr(sendTo) ? <p className="hint">Enter a 40-character g1 address.</p> : null}
              {isG1Addr(sendTo) && sameAddr(sendTo, wallet) ? <p className="hint">Recipient must be a different wallet.</p> : null}
            </>
          )}
        </form>
      ) : null}

      {pane === "collected" || pane === "listed" ? (
        loading && shown.length === 0 ? null : shown.length > 0 ? (
          <div className="listing-grid">
            {shown.map((row) => (
              <ListingCard
                key={itemRowKey(row)}
                item={row}
                onOpen={(item) => {
                  setOpenItem(item);
                  onNeedPeers?.(itemCollectionSlug(item));
                }}
                onBuy={onBuy}
                onSell={mine && (pane !== "collected" || row.listed) ? onSell : undefined}
                onTogglePick={mine && pane === "collected" && onListWallet && !row.listed && row.id ? toggleWallet : undefined}
                picked={!!walletOn[itemRowKey(row)]}
                onCancel={mine ? onCancel : undefined}
                onReveal={mine && onReveal ? (it) => onReveal(it.id) : undefined}
                onSync={mine ? onSyncNft : undefined}
                wallet={wallet}
                owned={mine}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={pane === "listed" ? "No listings" : "No items"}
            body={
              mine
                ? pane === "listed"
                  ? "List from Sell when you want a GNOT price."
                  : "Mint from Launch or buy on Explore."
                : "This wallet has no items on this book."
            }
          >
            {mine ? (
              <button className="btn primary" type="button" onClick={() => onOpenTab(pane === "listed" ? "sell" : "create")}>
                {pane === "listed" ? "Sell" : "Launch"}
              </button>
            ) : null}
          </EmptyState>
        )
      ) : null}

      {pane === "created" ? (
        created.length > 0 ? (
          <div className="created-grid">
            {created.map((col) => (
              <article key={col.slug} className="created-card">
                <button className="created-card-cover" type="button" onClick={() => onOpenCollection(col.slug)}>
                  <ItemArt name={col.name} image={col.cover} alt="" />
                </button>
                <div className="created-card-body">
                  <h2>{col.name}</h2>
                  <p className="muted">
                    {col.minted || col.count}/{col.maxSupply || "—"} minted
                  </p>
                  <div className="created-card-actions">
                    <button className="btn" type="button" onClick={() => onOpenCollection(col.slug)}>
                      Collection
                    </button>
                    {(col.drop || col.maxSupply > 0) && onOpenMint && launchKnown && !launchEnded?.has(col.slug) ? (
                      <button className="btn primary" type="button" onClick={() => onOpenMint(col.slug)}>
                        Mint
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No collections created"
            body={mine ? "Launch a collection to appear here." : "This wallet has not created a drop on this book."}
          >
            {mine ? (
              <button className="btn primary" type="button" onClick={() => onOpenTab("create")}>
                Launch
              </button>
            ) : null}
          </EmptyState>
        )
      ) : null}

      {pane === "activity" ? (
        activity.length > 0 ? (
          <div className="activity-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Item</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row, i) => (
                  <tr key={`${row.kind}-${row.id}-${i}`}>
                    <td>
                      <span className={`activity-chip kind-${row.kind.toLowerCase()}`}>{activityKindLabel(row.kind)}</span>
                    </td>
                    <td>
                      <strong>{row.name || row.slug || "Item"}</strong>
                      {row.id ? <span className="muted"> #{row.id}</span> : null}
                    </td>
                    <td className="num">{row.price > 0 ? <PriceMark ugnot={row.price} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No activity" body="Mints, lists, and sales for this address show up from the recent tape." />
        )
      ) : null}

      {openItem ? (
        <ListingDrawer
          item={openItem}
          connected={connected}
          blocked={blocked}
          busy={busy}
          owned={mine || sameAddr(openItem.owner, wallet) || sameAddr(openItem.seller, wallet)}
          onClose={() => setOpenItem(null)}
          onBuy={onBuy}
          onSell={
            mine
              ? (item) => {
                  if (!item.listed && item.id && onListWallet) {
                    setOpenItem(null);
                    setPane("collected");
                    setPicked({ ...walletOn, [itemRowKey(item)]: true });
                    return;
                  }
                  onSell?.(item);
                }
              : undefined
          }
          sellLabel={openItem && !openItem.listed && onListWallet ? "Include in list" : undefined}
          onCancel={mine ? onCancel : undefined}
          onConnect={onConnect}
          onOpenCollection={(slug) => {
            setOpenItem(null);
            onOpenCollection(slug);
          }}
          wallet={wallet}
          peers={(() => {
            const slug = itemCollectionSlug(openItem);
            if (collectionPeers[slug]?.length) return collectionPeers[slug];
            const byKey = new Map<string, Item>();
            for (const row of [...items, ...marketItems]) {
              if (itemCollectionSlug(row) === slug) byKey.set(itemRowKey(row), row);
            }
            return [...byKey.values()];
          })()}
          activity={activity}
          onSync={mine ? onSyncNft : undefined}
        />
      ) : null}
    </section>
  );
}

function banner(hue: number): string {
  return `linear-gradient(120deg, hsl(${hue} 42% 18%), hsl(${(hue + 40) % 360} 38% 10%) 55%, hsl(${(hue + 190) % 360} 28% 8%))`;
}

function hashHue(s: string): number {
  let h = 2166136261;
  const t = s.toLowerCase();
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

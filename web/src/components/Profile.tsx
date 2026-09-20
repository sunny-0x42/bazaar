import { useMemo, useState } from "react";
import {
  accountExplorer,
  activityKindLabel,
  itemRowKey,
  sameAddr,
  shortAddr,
  type Activity,
  type ChainCollection,
  type Item,
  type Network,
} from "../lib/chain";
import { isArtSrc } from "../lib/chain";
import { emptyProfile, type UserProfile } from "../lib/userProfile";
import { EmptyState } from "./EmptyState";
import { ItemArt } from "./ItemArt";
import { ListingCard } from "./ListingCard";
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
  created: ChainCollection[];
  activity: Activity[];
  blocked: boolean;
  busy: boolean;
  loading?: boolean;
  onConnect: () => void;
  onCancel: (item: Item) => void;
  onOpenTab: (tab: Tab) => void;
  onOpenItem: (item: Item) => void;
  onOpenCollection: (slug: string) => void;
  onOpenMint?: (slug: string) => void;
  onBuy: (item: Item) => void;
  onSell?: (item: Item) => void;
  onTransfer?: (id: string, to: string) => void;
  onReveal?: (id: string) => void;
  userProfile?: UserProfile;
  onSaveProfile?: (p: UserProfile) => void;
};

export function Profile({
  address,
  network,
  connected,
  wallet,
  items,
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
  onBuy,
  onSell,
  onTransfer,
  onReveal,
  userProfile,
  onSaveProfile,
}: Props) {

  const [pane, setPane] = useState<Pane>("collected");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(emptyProfile());
  const mine = sameAddr(address, wallet);
  const listed = items.filter((row) => row.listed && row.price > 0);
  const collected = items;
  const listedValue = listed.reduce((n, row) => n + row.price, 0);
  const collectionsHeld = new Set(items.map((it) => it.collection).filter(Boolean)).size;
  const explorer = accountExplorer(address, network);
  const hue = hashHue(address);

  const shown = useMemo(() => {
    if (pane === "listed") return listed;
    return collected;
  }, [pane, listed, collected]);

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

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
              <ItemArt name={userProfile.name || address} image={userProfile.avatar} alt="" />
            ) : (
              <TokenMark symbol={address} size={88} />
            )}
          </div>
          <div className="profile-copy">
            <h1>
              {userProfile?.name || (mine ? "Your profile" : "Collector")}
              {mine ? <span className="tag">You</span> : null}
            </h1>
            <p className="profile-addr mono" title={address}>
              {shortAddr(address)}
            </p>
            <div className="profile-links">
              <button className="btn" type="button" onClick={() => void copyAddr()}>
                {copied ? "Copied" : "Copy address"}
              </button>
              {explorer ? (
                <a className="btn" href={explorer} target="_blank" rel="noreferrer">
                  gnoscan
                </a>
              ) : null}
              {userProfile?.website ? (
                <a className="btn" href={userProfile.website} target="_blank" rel="noreferrer">
                  Website
                </a>
              ) : null}
              {userProfile?.twitter ? (
                <a className="btn" href={userProfile.twitter.startsWith("http") ? userProfile.twitter : `https://x.com/${userProfile.twitter.replace(/^@/, "")}`} target="_blank" rel="noreferrer">
                  X
                </a>
              ) : null}
              {userProfile?.discord ? (
                <a className="btn" href={userProfile.discord} target="_blank" rel="noreferrer">
                  Discord
                </a>
              ) : null}
              {mine ? (
                <button className="btn" type="button" onClick={() => onOpenTab("sell")}>
                  List an item
                </button>
              ) : null}
              {mine && onSaveProfile ? (
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => {
                    setDraft(userProfile || emptyProfile());
                    setEditing((v) => !v);
                  }}
                >
                  {editing ? "Close editor" : "Edit profile"}
                </button>
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
            ["collected", "Collected"],
            ["listed", "Listed"],
            ["created", "Created"],
            ["activity", "Activity"],
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

      {loading ? <p className="muted">Loading holdings…</p> : null}

      {pane === "collected" || pane === "listed" ? (
        shown.length > 0 ? (
          <div className="listing-grid">
            {shown.map((row) => (
              <ListingCard
                key={itemRowKey(row)}
                item={row}
                onOpen={onOpenItem}
                onBuy={onBuy}
                onSell={mine ? onSell : undefined}
                onCancel={mine ? onCancel : undefined}
                onReveal={mine && onReveal ? (it) => onReveal(it.id) : undefined}
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
                    {(col.drop || col.maxSupply > 0) && onOpenMint ? (
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

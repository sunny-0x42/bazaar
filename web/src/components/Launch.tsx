import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ipfsToHttp,
  isDropSlug,
  isMintImage,
  isMintName,
  isOpenEdition,
  isPublicDrop,
  sameAddr,
  ugnotFromGnot,
  type ChainCollection,
  type DropSlot,
} from "../lib/chain";
import { jsonToSlotBlob, looksLikeJson } from "../lib/dropjson";
import { ItemArt } from "./ItemArt";
import { LaunchWizard, type LaunchPlan } from "./LaunchWizard";
import { Select } from "./Select";
import { hasAdena } from "../lib/wallets";

type Pane = "studio" | "slots" | "unique";

type Props = {
  chainCollections: ChainCollection[];
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  wallet?: string;
  onCreateDrop: (args: string[]) => void;
  onLaunchCollection: (args: string[]) => void;
  onMintUnique: (slug: string, name: string, image: string) => void;
  onConnect: () => void;
  dropSlots?: DropSlot[];
  onPickDrop?: (slug: string) => void;
  onAddDropItems?: (slug: string, blob: string) => void;
  onOpenMint?: (slug: string) => void;
  onOpenCollection?: (slug: string) => void;
  onPauseMint?: (slug: string) => void;
  onResumeMint?: (slug: string) => void;
  onSetMintPrice?: (slug: string, ugnot: number) => void;
  onAddAllowlist?: (slug: string, blob: string) => void;
  onSetMintCap?: (slug: string, n: number) => void;
  onStartPublic?: (slug: string) => void;
  dropHidden?: boolean;
  dropLoaded?: number;
  dropAllowN?: number;
  dropMintCap?: number;
  onSetHidden?: (slug: string, hidden: boolean) => void;
  onLaunchWizard?: (plan: LaunchPlan) => void;
  launchFeeUgnot?: number;
};

const JSON_TEMPLATE = "/samples/drop-items.example.json";

export function Launch({
  chainCollections,
  connected,
  blocked,
  busy,
  wallet,
  onCreateDrop,
  onLaunchCollection,
  onMintUnique,
  onConnect,
  dropSlots = [],
  onPickDrop,
  onAddDropItems,
  onOpenMint,
  onOpenCollection,
  onPauseMint,
  onResumeMint,
  onSetMintPrice,
  onAddAllowlist,
  onSetMintCap,
  onStartPublic,
  dropHidden,
  dropLoaded,
  dropAllowN = 0,
  dropMintCap = 0,
  onSetHidden,
  onLaunchWizard,
  launchFeeUgnot = 1_000_000_000,
}: Props) {
  const [pane, setPane] = useState<Pane>("studio");
  const [studioPrice, setStudioPrice] = useState("");
  const [allowBlob, setAllowBlob] = useState("");
  const [capN, setCapN] = useState("");
  const [hideMeta, setHideMeta] = useState(true);
  const [itemName, setItemName] = useState("");
  const [itemImage, setItemImage] = useState("");
  const [itemSlug, setItemSlug] = useState("");
  const [slotSlug, setSlotSlug] = useState("");
  const [slotBlob, setSlotBlob] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const ownCols = useMemo(
    () => chainCollections.filter((c) => sameAddr(c.creator, wallet)),
    [chainCollections, wallet],
  );
  const drops = useMemo(() => ownCols.filter((c) => isPublicDrop(c)), [ownCols]);

  const itemOk = isMintName(itemName) && isMintImage(itemImage);

  function submitUnique() {
    if (!connected) {
      onConnect();
      return;
    }
    if (!itemOk) return;
    onMintUnique(itemSlug.trim(), itemName.trim(), ipfsToHttp(itemImage.trim()));
  }

  const destOptions = [
    { value: "", label: "Bazaar (1/1)" },
    ...ownCols.map((c) => ({ value: c.slug, label: `${c.name} (${c.slug})` })),
  ];
  const slotOptions = drops.map((c) => ({
    value: c.slug,
    label: `${c.name} (${c.slug}) / ${c.minted}/${isOpenEdition(c) ? "open" : c.maxSupply}`,
  }));

  useEffect(() => {
    if (slotSlug && drops.some((c) => c.slug === slotSlug)) return;
    if (slotSlug && drops.length === 0) return;
    if (slotSlug && !drops.some((c) => c.slug === slotSlug) && isDropSlug(slotSlug)) return;
    const next = drops[0]?.slug || "";
    setSlotSlug(next);
    if (next) onPickDrop?.(next);
  }, [drops, slotSlug, onPickDrop]);

  function pickSlotDrop(next: string) {
    setSlotSlug(next);
    onPickDrop?.(next);
  }

  function submitSlots() {
    if (!connected) {
      onConnect();
      return;
    }
    if (!slotSlug || !slotBlob.trim()) return;
    let blob = slotBlob.trim();
    if (looksLikeJson(blob)) blob = jsonToSlotBlob(blob);
    else {
      blob = blob
        .split(/\n/)
        .map((line) => {
          const t = line.trim();
          if (!t) return "";
          if (t.includes("|")) return t;
          const parts = t.split(",").map((p) => p.trim());
          return [parts[0] || "", parts[1] || "", parts[2] || "", parts[3] || ""].join("|");
        })
        .filter(Boolean)
        .join("\n");
    }
    const lines = blob.split("\n").filter(Boolean);
    blob = (lines.length > 20 ? lines.slice(0, 20) : lines)
      .map((line) => {
        const parts = line.split("|");
        if (parts[1]) parts[1] = ipfsToHttp(parts[1]);
        return parts.join("|");
      })
      .join("\n");
    onAddDropItems?.(slotSlug, blob);
    if (hideMeta) onSetHidden?.(slotSlug, true);
  }

  const createForm = (
    <LaunchWizard
      connected={connected}
      blocked={blocked}
      busy={busy}
      onConnect={onConnect}
      onCancel={drops.length > 0 ? () => setShowCreate(false) : undefined}
      launchFeeUgnot={launchFeeUgnot}
      onLaunch={(plan) => {
        pickSlotDrop(plan.slug);
        setShowCreate(false);
        if (onLaunchWizard) onLaunchWizard(plan);
        else if (plan.extras) {
          onLaunchCollection([
            plan.slug,
            plan.name,
            plan.cover,
            plan.bio,
            plan.website,
            plan.twitter,
            plan.discord,
            plan.maxSupply,
            plan.priceUgnot,
          ]);
        } else {
          onCreateDrop([plan.slug, plan.name, plan.cover, plan.maxSupply, plan.priceUgnot]);
        }
      }}
    />
  );

  return (
    <section className="page launch-page">
      <header className="page-head">
        <h1>Launch</h1>
        <p className="muted">
          Follow steps 1-5 to launch. Collectors mint at <span className="mono">#/m/{`{slug}`}</span>.
        </p>
        <p className="launch-banner" role="status">
          Create fee is set by the platform admin (default 1000 GNOT). Primary mint 0 bps. Secondary 50 bps.
        </p>
      </header>

      <div className="col-tabs" role="tablist" aria-label="Launch">
        <button
          type="button"
          role="tab"
          aria-selected={pane === "studio"}
          className={pane === "studio" ? "active" : ""}
          onClick={() => setPane("studio")}
        >
          Studio
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === "slots"}
          className={pane === "slots" ? "active" : ""}
          onClick={() => setPane("slots")}
        >
          Load items
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === "unique"}
          className={pane === "unique" ? "active" : ""}
          onClick={() => setPane("unique")}
        >
          Mint 1/1
        </button>
      </div>

      {pane === "studio" ? (
        <Studio
          drops={drops}
          connected={connected}
          blocked={blocked}
          busy={busy}
          slotSlug={slotSlug}
          studioPrice={studioPrice}
          allowBlob={allowBlob}
          capN={capN}
          showCreate={showCreate || drops.length === 0}
          createForm={createForm}
          onPick={pickSlotDrop}
          onPrice={setStudioPrice}
          onAllow={setAllowBlob}
          onCap={setCapN}
          onConnect={onConnect}
          onOpenMint={onOpenMint}
          onOpenCollection={onOpenCollection}
          onGoSlots={() => setPane("slots")}
          onToggleCreate={() => setShowCreate((v) => !v)}
          onPauseMint={onPauseMint}
          onResumeMint={onResumeMint}
          onSetMintPrice={onSetMintPrice}
          onAddAllowlist={onAddAllowlist}
          onSetMintCap={onSetMintCap}
          onStartPublic={onStartPublic}
          dropHidden={dropHidden}
          dropLoaded={dropLoaded}
          dropAllowN={dropAllowN}
          dropMintCap={dropMintCap}
          onSetHidden={onSetHidden}
        />
      ) : pane === "slots" ? (
        <form
          className="panel launch-form launch-shell"
          onSubmit={(e) => {
            e.preventDefault();
            submitSlots();
          }}
        >
          <h2>Load drop items</h2>
          <p className="hint">
            OpenSea JSON (<span className="mono">name</span>, <span className="mono">image</span>,{" "}
            <span className="mono">attributes</span>). Prefer <span className="mono">ipfs://CID</span> for art - the
            book stores an IPFS gateway URL (max 200 chars). Hide until Reveal. Up to 10,000 unique NFTs; 20 per
            transaction.
          </p>
          <p className="profile-links">
            <a className="btn primary" href="/samples/launch-collection.json" download="bazaar-launch-collection.json">
              Download Harbor Foxes pack
            </a>
            <a className="btn" href={JSON_TEMPLATE} download="bazaar-drop-items.example.json">
              Empty items template
            </a>
          </p>
          {slotOptions.length > 0 || (slotSlug && isDropSlug(slotSlug)) ? (
            <>
              {slotOptions.length === 0 ? (
                <p className="hint">
                  Drop <span className="mono">{slotSlug}</span> is submitting. Load JSON after the transaction confirms.
                </p>
              ) : (
                <label>
                  Your drop
                  <Select ariaLabel="Drop to load" value={slotSlug} options={slotOptions} onChange={pickSlotDrop} />
                </label>
              )}
              <p className="muted">
                Loaded {dropHidden ? dropLoaded || 0 : dropSlots.length}
                {drops.find((c) => c.slug === slotSlug)?.maxSupply
                  ? ` / ${drops.find((c) => c.slug === slotSlug)?.maxSupply}`
                  : ""}{" "}
                slots{dropHidden ? " (hidden until reveal)" : ""}. Supply is the cap you set in Studio.
              </p>
              {dropHidden ? (
                <p className="hint">Slot art and traits are not listed here so collectors cannot snipe.</p>
              ) : dropSlots.length > 0 ? (
                <ol className="slot-list">
                  {dropSlots.map((row) => (
                    <li key={row.index}>
                      <strong>
                        #{row.index} {row.name}
                      </strong>
                      <span className="muted">
                        {row.rarity || "-"}
                        {row.traits ? ` / ${row.traits}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="hint">No slots yet. Edition mint uses cover + #n.</p>
              )}
              <label>
                Metadata JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    void f.text().then((t) => setSlotBlob(t));
                  }}
                />
              </label>
              <label>
                JSON or pipe lines
                <textarea
                  value={slotBlob}
                  onChange={(e) => setSlotBlob(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  placeholder={
                    '[\n  {\n    "name": "Dusk Fox #1",\n    "image": "ipfs://bafybei...",\n    "attributes": [\n      { "trait_type": "Rarity", "value": "Rare" }\n    ]\n  }\n]'
                  }
                />
                <span className="hint">
                  Prefer ipfs://CID. Also accepts https IPFS gateways, http(s), or /samples/. Pipe:
                  name|image|rarity|Trait:Value
                </span>
              </label>
              <label className="trait-check">
                <input type="checkbox" checked={hideMeta} onChange={(e) => setHideMeta(e.target.checked)} />
                Hide art and traits until the owner reveals
              </label>
              {connected ? (
                <button
                  className="btn primary btn-block"
                  type="submit"
                  disabled={blocked || busy || !slotBlob.trim() || slotOptions.length === 0}
                >
                  Add items
                </button>
              ) : (
                hasAdena() ? (
                  <button className="btn primary btn-block" type="button" onClick={onConnect}>
                    Connect Adena
                  </button>
                ) : (
                  <a className="btn primary btn-block" href="https://adena.app/" target="_blank" rel="noreferrer">
                    Install Adena
                  </a>
                )
              )}
            </>
          ) : (
            <>
              <p className="muted">Create a collection in Studio first, then load unique items into it.</p>
              <button className="btn primary" type="button" onClick={() => setPane("studio")}>
                Open Studio
              </button>
            </>
          )}
        </form>
      ) : (
        <form
          className="panel launch-form launch-shell"
          onSubmit={(e) => {
            e.preventDefault();
            submitUnique();
          }}
        >
          <h2>Mint a unique NFT</h2>
          <p className="hint">
            One item, your name and image. Prefer ipfs:// for art. Not a public drop. List it from Sell when you want a
            price.
          </p>
          <div className="launch-grid">
          <label>
            Item name
            <input value={itemName} onChange={(e) => setItemName(e.target.value)} maxLength={64} placeholder="Ember Core" />
            <span className="hint">
              1-64 characters.
              {itemName && !isMintName(itemName) ? " Check the name." : ""}
            </span>
          </label>
          <label>
            Collection
            <Select ariaLabel="Mint into collection" value={itemSlug} options={destOptions} onChange={setItemSlug} />
            <span className="hint">Bazaar is the default 1/1 book. Other collections must be ones you launched.</span>
          </label>
          </div>
          <label>
            Image URL
            <input
              value={itemImage}
              onChange={(e) => setItemImage(e.target.value)}
              maxLength={200}
              spellCheck={false}
              placeholder="ipfs://... or https:// or /samples/"
            />
            <span className="hint">
              Prefer ipfs://CID. Empty, ipfs, http(s), or /samples/. Max 200 chars on-chain.
              {itemImage && !isMintImage(itemImage) ? " Check the image URL." : ""}
            </span>
          </label>
          {connected ? (
            <button className="btn primary btn-block" type="submit" disabled={blocked || busy || !itemOk}>
              Mint 1/1
            </button>
          ) : (
            hasAdena() ? (
              <button className="btn primary btn-block" type="button" onClick={onConnect}>
                Connect Adena
              </button>
            ) : (
              <a className="btn primary btn-block" href="https://adena.app/" target="_blank" rel="noreferrer">
                Install Adena
              </a>
            )
          )}
        </form>
      )}
    </section>
  );
}

function Studio({
  drops,
  connected,
  blocked,
  busy,
  slotSlug,
  studioPrice,
  allowBlob,
  capN,
  showCreate,
  createForm,
  onPick,
  onPrice,
  onAllow,
  onCap,
  onConnect,
  onOpenMint,
  onOpenCollection,
  onGoSlots,
  onToggleCreate,
  onPauseMint,
  onResumeMint,
  onSetMintPrice,
  onAddAllowlist,
  onSetMintCap,
  onStartPublic,
  dropHidden,
  dropLoaded,
  dropAllowN,
  dropMintCap,
  onSetHidden,
}: {
  drops: ChainCollection[];
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  slotSlug: string;
  studioPrice: string;
  allowBlob: string;
  capN: string;
  showCreate: boolean;
  createForm: ReactNode;
  onPick: (slug: string) => void;
  onPrice: (v: string) => void;
  onAllow: (v: string) => void;
  onCap: (v: string) => void;
  onConnect: () => void;
  onOpenMint?: (slug: string) => void;
  onOpenCollection?: (slug: string) => void;
  onGoSlots?: () => void;
  onToggleCreate: () => void;
  onPauseMint?: (slug: string) => void;
  onResumeMint?: (slug: string) => void;
  onSetMintPrice?: (slug: string, ugnot: number) => void;
  onAddAllowlist?: (slug: string, blob: string) => void;
  onSetMintCap?: (slug: string, n: number) => void;
  onStartPublic?: (slug: string) => void;
  dropHidden?: boolean;
  dropLoaded?: number;
  dropAllowN?: number;
  dropMintCap?: number;
  onSetHidden?: (slug: string, hidden: boolean) => void;
}) {
  if (!connected) {
    return <div className="studio-stack">{createForm}</div>;
  }
  if (drops.length === 0 || showCreate) {
    return (
      <div className="studio-stack">
        {drops.length > 0 ? (
          <p className="profile-links">
            <button className="btn" type="button" onClick={onToggleCreate}>
              Back to drops
            </button>
          </p>
        ) : null}
        {createForm}
      </div>
    );
  }
  const selected = drops.find((d) => d.slug === slotSlug) || drops[0];
  const slug = selected?.slug || "";
  return (
    <div className="studio-desk">
      <div>
        <ul className="profile-created">
          {drops.map((d) => (
            <li key={d.slug}>
              <button
                className={`profile-created-row${d.slug === slug ? " is-on" : ""}`}
                type="button"
                onClick={() => onPick(d.slug)}
              >
                <span className="market-thumb">
                  <ItemArt name={d.name} image={d.cover} alt="" />
                </span>
                <span>
                  <strong>{d.name}</strong>
                  <span className="muted mono">{d.slug}</span>
                </span>
                <span className="muted">
                  {d.minted}/{d.maxSupply}
                  {d.paused ? " / paused" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="profile-links">
          <button className="btn btn-block" type="button" onClick={onToggleCreate}>
            New collection
          </button>
        </p>
      </div>
      {selected ? (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <h2>{selected.name}</h2>
          <p className="hint">
            Collectors mint on <span className="mono">#/m/{selected.slug}</span>. Hidden slots mint Unrevealed until the
            owner Reveals.
          </p>
          <dl className="studio-facts">
            <div>
              <dt>Supply (locked)</dt>
              <dd>{isOpenEdition(selected) ? "Open edition" : selected.maxSupply}</dd>
            </div>
            <div>
              <dt>Minted</dt>
              <dd>
                {selected.minted}/{isOpenEdition(selected) ? "∞" : selected.maxSupply}
              </dd>
            </div>
            <div>
              <dt>Slots loaded</dt>
              <dd>
                {dropLoaded || 0}
                {dropHidden ? " / hidden" : ""}
              </dd>
            </div>
            <div>
              <dt>Allowlist</dt>
              <dd>{dropAllowN && dropAllowN > 0 ? `${dropAllowN} wallets` : "Public"}</dd>
            </div>
            <div>
              <dt>Per-wallet cap</dt>
              <dd>{dropMintCap && dropMintCap > 0 ? dropMintCap : "Unlimited"}</dd>
            </div>
          </dl>
          <div className="profile-links">
            {onOpenMint ? (
              <button className="btn primary" type="button" onClick={() => onOpenMint(selected.slug)}>
                Open mint page
              </button>
            ) : null}
            {onOpenCollection ? (
              <button className="btn" type="button" onClick={() => onOpenCollection(selected.slug)}>
                Collection
              </button>
            ) : null}
            {onGoSlots ? (
              <button className="btn" type="button" onClick={onGoSlots}>
                Load items
              </button>
            ) : null}
            {onStartPublic ? (
              <button className="btn" type="button" disabled={blocked || busy} onClick={() => onStartPublic(selected.slug)}>
                Start public
              </button>
            ) : null}
            {selected.paused ? (
              <button className="btn" type="button" disabled={blocked || busy} onClick={() => onResumeMint?.(selected.slug)}>
                Resume
              </button>
            ) : (
              <button className="btn" type="button" disabled={blocked || busy} onClick={() => onPauseMint?.(selected.slug)}>
                Pause
              </button>
            )}
            {onSetHidden ? (
              <button
                className="btn"
                type="button"
                disabled={blocked || busy || !(dropLoaded && dropLoaded > 0)}
                onClick={() => onSetHidden(selected.slug, !dropHidden)}
              >
                {dropHidden ? "Unhide slots" : "Hide until Reveal"}
              </button>
            ) : null}
          </div>
          <label>
            Mint price (GNOT)
            <input value={studioPrice} onChange={(e) => onPrice(e.target.value)} inputMode="decimal" placeholder="e.g. 1" />
          </label>
          <button
            className="btn"
            type="button"
            disabled={blocked || busy || !studioPrice.trim()}
            onClick={() => onSetMintPrice?.(selected.slug, ugnotFromGnot(studioPrice))}
          >
            Set price
          </button>
          <label>
            Per-wallet mint cap
            <input value={capN} onChange={(e) => onCap(e.target.value)} inputMode="numeric" placeholder="0 = unlimited" />
          </label>
          <button
            className="btn"
            type="button"
            disabled={blocked || busy || capN.trim() === ""}
            onClick={() => onSetMintCap?.(selected.slug, Number(capN) || 0)}
          >
            Set cap
          </button>
          <label>
            Allowlist (g1, one per line)
            <textarea value={allowBlob} onChange={(e) => onAllow(e.target.value)} rows={5} spellCheck={false} placeholder="g1..." />
            <span className="hint">Empty allowlist = public mint. Up to 50 addresses per transaction.</span>
          </label>
          <button
            className="btn"
            type="button"
            disabled={blocked || busy || !allowBlob.trim()}
            onClick={() => onAddAllowlist?.(selected.slug, allowBlob)}
          >
            Add allowlist
          </button>
        </form>
      ) : null}
    </div>
  );
}

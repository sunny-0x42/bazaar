import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ipfsToHttp,
  isDropMintPrice,
  isDropSlug,
  isMintImage,
  isMintName,
  isOpenEdition,
  isPublicDrop,
  sameAddr,
  parseUtcMinute,
  rarityClass,
  ugnotFromGnot,
  type ChainCollection,
  type DropSlot,
  type NetworkId,
} from "../lib/chain";
import { jsonToSlotBlob, looksLikeJson } from "../lib/dropjson";
import { ItemArt } from "./ItemArt";
import { LaunchWizard, type LaunchPlan } from "./LaunchWizard";
import { UtcMinuteField } from "./UtcMinuteField";
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
  onSetDropSale?: (slug: string, priceUgnot: number, qty: number) => void;
  onAddAllowlist?: (slug: string, blob: string) => void;
  onSetMintCap?: (slug: string, n: number) => void;
  onSetPhaseMintCap?: (slug: string, wl: number, pub: number) => void;
  onStartPublic?: (slug: string) => void;
  onSetMintSchedule?: (slug: string, wlStart: number, wlEnd: number, publicStart: number, publicEnd: number) => void;
  dropHidden?: boolean;
  dropPrereveal?: string;
  dropLoaded?: number;
  dropAllowN?: number;
  dropMintCap?: number;
  onSetHidden?: (slug: string, hidden: boolean) => void;
  onSetPrereveal?: (slug: string, image: string) => void;
  onRevealCollection?: (slug: string) => void;
  onLaunchWizard?: (plan: LaunchPlan) => void;
  launchFeeUgnot?: number;
  reserveSendUgnot?: number;
  network?: NetworkId;
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
  onSetDropSale,
  onAddAllowlist,
  onSetMintCap,
  onSetPhaseMintCap,
  onStartPublic,
  onSetMintSchedule,
  dropHidden,
  dropPrereveal = "",
  dropLoaded,
  dropAllowN = 0,
  dropMintCap = 0,
  onSetHidden,
  onSetPrereveal,
  onRevealCollection,
  onLaunchWizard,
  launchFeeUgnot = 1_000_000_000,
  reserveSendUgnot,
  network = "pearl",
}: Props) {
  const [pane, setPane] = useState<Pane>("studio");
  const [studioPrice, setStudioPrice] = useState("");
  const [allowBlob, setAllowBlob] = useState("");
  const [capN, setCapN] = useState("");
  const [wlCapN, setWlCapN] = useState("");
  const [pubCapN, setPubCapN] = useState("");
  const [hideMeta, setHideMeta] = useState(true);
  const [itemName, setItemName] = useState("");
  const [itemImage, setItemImage] = useState("");
  const [itemSlug, setItemSlug] = useState("");
  const [slotSlug, setSlotSlug] = useState("");
  const [slotBlob, setSlotBlob] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  useEffect(() => {
    if (!connected) setShowCreate(true);
  }, [connected]);

  const ownCols = useMemo(
    () => chainCollections.filter((c) => sameAddr(c.creator, wallet)),
    [chainCollections, wallet],
  );
  const drops = useMemo(() => ownCols.filter((c) => isPublicDrop(c)), [ownCols]);
  const factoryPad = network === "pearl" || network === "mainnet" || network === "onyx" || chainCollections.some((c) => !!c.pkg);

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
    { value: "", label: "Nomaq (1/1)" },
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
      key="launch-wizard"
      connected={connected}
      blocked={blocked}
      busy={busy}
      onConnect={onConnect}
      onCancel={factoryPad || drops.length === 0 ? undefined : () => setShowCreate(false)}
      launchFeeUgnot={launchFeeUgnot}
      reserveSendUgnot={reserveSendUgnot}
      network={network}
      onLaunch={(plan) => {
        pickSlotDrop(plan.slug);
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
          One collection, one realm. Collectors mint at <span className="mono">#/m/{`{slug}`}</span>.
          {reserveSendUgnot === 0 && launchFeeUgnot > 0
            ? ` This wallet reserves free. Other wallets pay ${launchFeeUgnot / 1_000_000} GNOT.`
            : launchFeeUgnot > 0
              ? ` Reserve fee ${launchFeeUgnot / 1_000_000} GNOT.`
              : ""}{" "}
          Primary mint 0 bps ·
          secondary 2% protocol (admin).
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
          wlCapN={wlCapN}
          pubCapN={pubCapN}
          showCreate={showCreate || drops.length === 0}
          createForm={createForm}
          onPick={pickSlotDrop}
          onPrice={setStudioPrice}
          onAllow={setAllowBlob}
          onCap={setCapN}
          onWlCap={setWlCapN}
          onPubCap={setPubCapN}
          onConnect={onConnect}
          onOpenMint={onOpenMint}
          onOpenCollection={onOpenCollection}
          onGoSlots={() => setPane("slots")}
          onToggleCreate={() => setShowCreate((v) => !v)}
          onPauseMint={onPauseMint}
          onResumeMint={onResumeMint}
          onSetMintPrice={onSetMintPrice}
          onSetDropSale={onSetDropSale}
          onAddAllowlist={onAddAllowlist}
          onSetMintCap={onSetMintCap}
          onSetPhaseMintCap={onSetPhaseMintCap}
          onStartPublic={onStartPublic}
          onSetMintSchedule={onSetMintSchedule}
          dropHidden={dropHidden}
          dropPrereveal={dropPrereveal}
          dropLoaded={dropLoaded}
          dropAllowN={dropAllowN}
          dropMintCap={dropMintCap}
          onSetHidden={onSetHidden}
          onSetPrereveal={onSetPrereveal}
          onRevealCollection={onRevealCollection}
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
                        {row.rarity ? <span className={rarityClass(row.rarity)}>{row.rarity}</span> : "-"}
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
                Hide art and traits until you reveal the collection
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
            <span className="hint">Nomaq is the default 1/1 book. Other collections must be ones you launched.</span>
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
  wlCapN,
  pubCapN,
  showCreate,
  createForm,
  onPick,
  onPrice,
  onAllow,
  onCap,
  onWlCap,
  onPubCap,
  onConnect,
  onOpenMint,
  onOpenCollection,
  onGoSlots,
  onToggleCreate,
  onPauseMint,
  onResumeMint,
  onSetMintPrice,
  onSetDropSale,
  onAddAllowlist,
  onSetMintCap,
  onSetPhaseMintCap,
  onStartPublic,
  onSetMintSchedule,
  dropHidden,
  dropPrereveal,
  dropLoaded,
  dropAllowN,
  dropMintCap,
  onSetHidden,
  onSetPrereveal,
  onRevealCollection,
}: {
  drops: ChainCollection[];
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  slotSlug: string;
  studioPrice: string;
  allowBlob: string;
  capN: string;
  wlCapN: string;
  pubCapN: string;
  showCreate: boolean;
  createForm: ReactNode;
  onPick: (slug: string) => void;
  onPrice: (v: string) => void;
  onAllow: (v: string) => void;
  onCap: (v: string) => void;
  onWlCap: (v: string) => void;
  onPubCap: (v: string) => void;
  onConnect: () => void;
  onOpenMint?: (slug: string) => void;
  onOpenCollection?: (slug: string) => void;
  onGoSlots?: () => void;
  onToggleCreate: () => void;
  onPauseMint?: (slug: string) => void;
  onResumeMint?: (slug: string) => void;
  onSetMintPrice?: (slug: string, ugnot: number) => void;
  onSetDropSale?: (slug: string, priceUgnot: number, qty: number) => void;
  onAddAllowlist?: (slug: string, blob: string) => void;
  onSetMintCap?: (slug: string, n: number) => void;
  onSetPhaseMintCap?: (slug: string, wl: number, pub: number) => void;
  onStartPublic?: (slug: string) => void;
  onSetMintSchedule?: (slug: string, wlStart: number, wlEnd: number, publicStart: number, publicEnd: number) => void;
  dropHidden?: boolean;
  dropPrereveal?: string;
  dropLoaded?: number;
  dropAllowN?: number;
  dropMintCap?: number;
  onSetHidden?: (slug: string, hidden: boolean) => void;
  onSetPrereveal?: (slug: string, image: string) => void;
  onRevealCollection?: (slug: string) => void;
}) {
  const [preImage, setPreImage] = useState(dropPrereveal || "");
  useEffect(() => {
    setPreImage(dropPrereveal || "");
  }, [dropPrereveal, slotSlug]);
  const [wlPriceText, setWlPriceText] = useState("");
  const [wlQtyText, setWlQtyText] = useState("");
  const [wlStartText, setWlStartText] = useState("");
  const [wlEndText, setWlEndText] = useState("");
  const [publicStartText, setPublicStartText] = useState("");
  const [publicEndText, setPublicEndText] = useState("");
  const wlUnix = wlStartText.trim() ? parseUtcMinute(wlStartText) : 0;
  const wlEndUnix = wlEndText.trim() ? parseUtcMinute(wlEndText) : 0;
  const publicUnix = publicStartText.trim() ? parseUtcMinute(publicStartText) : 0;
  const publicEndUnix = publicEndText.trim() ? parseUtcMinute(publicEndText) : 0;
  const scheduleOk =
    (wlStartText.trim() === "" || wlUnix != null) &&
    (wlEndText.trim() === "" || wlEndUnix != null) &&
    (publicStartText.trim() === "" || publicUnix != null) &&
    (publicEndText.trim() === "" || publicEndUnix != null) &&
    !(wlUnix && publicUnix && publicUnix <= wlUnix) &&
    !(wlUnix && wlEndUnix && wlEndUnix <= wlUnix) &&
    !(publicUnix && publicEndUnix && publicEndUnix <= publicUnix) &&
    !(wlEndUnix && publicUnix && publicUnix < wlEndUnix);
  if (!connected || drops.length === 0 || showCreate) {
    return (
      <div className="studio-stack">
        {connected && drops.length > 0 ? (
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
            {dropHidden && onRevealCollection ? (
              <button
                className="btn primary"
                type="button"
                disabled={blocked || busy || !(dropLoaded && dropLoaded > 0)}
                onClick={() => onRevealCollection(selected.slug)}
              >
                Reveal collection
              </button>
            ) : null}
            {onSetHidden && !dropHidden && (selected?.minted || 0) === 0 ? (
              <button
                className="btn"
                type="button"
                disabled={blocked || busy || !(dropLoaded && dropLoaded > 0)}
                onClick={() => onSetHidden(selected.slug, true)}
              >
                Hide until Reveal
              </button>
            ) : null}
          </div>
          {dropHidden ? (
            <label>
              Image before reveal
              <input
                value={preImage}
                onChange={(e) => setPreImage(e.target.value)}
                maxLength={200}
                spellCheck={false}
                placeholder="ipfs://... or https:// or /samples/"
              />
              <span className="hint">
                Collectors see this image until you reveal. Empty keeps the cover. Reveal opens every minted NFT.
              </span>
              <button
                className="btn"
                type="button"
                disabled={blocked || busy || !onSetPrereveal || (preImage.trim() !== "" && !isMintImage(ipfsToHttp(preImage.trim())))}
                onClick={() => onSetPrereveal?.(selected.slug, preImage.trim() ? ipfsToHttp(preImage.trim()) : "")}
              >
                Set pre-reveal image
              </button>
            </label>
          ) : null}
          <label>
            Public mint price (GNOT)
            <input value={studioPrice} onChange={(e) => onPrice(e.target.value)} inputMode="decimal" placeholder="e.g. 1" />
          </label>
          <button
            className="btn"
            type="button"
            disabled={blocked || busy || !studioPrice.trim()}
            onClick={() => onSetMintPrice?.(selected.slug, ugnotFromGnot(studioPrice))}
          >
            Set public price
          </button>
          <label>
            Lifetime cap (all rounds)
            <input value={capN} onChange={(e) => onCap(e.target.value)} inputMode="numeric" placeholder="0 = unlimited" />
            <span className="hint">Total PublicMint calls for one wallet across whitelist and public. 0 is unlimited.</span>
          </label>
          <button
            className="btn"
            type="button"
            disabled={blocked || busy || capN.trim() === ""}
            onClick={() => onSetMintCap?.(selected.slug, Number(capN) || 0)}
          >
            Set lifetime cap
          </button>
          {selected.pkg ? (
            <>
              <label>
                Whitelist mints per wallet
                <input value={wlCapN} onChange={(e) => onWlCap(e.target.value)} inputMode="numeric" placeholder="0 = unlimited" />
              </label>
              <label>
                Public mints per wallet
                <input value={pubCapN} onChange={(e) => onPubCap(e.target.value)} inputMode="numeric" placeholder="0 = unlimited" />
                <span className="hint">Each round has its own count. A whitelist mint does not use the public allowance.</span>
              </label>
              <button
                className="btn"
                type="button"
                disabled={blocked || busy || wlCapN.trim() === "" || pubCapN.trim() === ""}
                onClick={() => onSetPhaseMintCap?.(selected.slug, Number(wlCapN) || 0, Number(pubCapN) || 0)}
              >
                Set round caps
              </button>
            </>
          ) : null}
          <label>
            Whitelist price (GNOT)
            <input value={wlPriceText} onChange={(e) => setWlPriceText(e.target.value)} inputMode="decimal" placeholder="e.g. 0.5" />
            <span className="hint">0 is a free whitelist mint. This is separate from the public price.</span>
          </label>
          <label>
            Whitelist quantity
            <input value={wlQtyText} onChange={(e) => setWlQtyText(e.target.value)} inputMode="numeric" placeholder="e.g. 333" />
            <span className="hint">How many mints use the whitelist price. The mint page shows this round after it is saved on chain.</span>
          </label>
          <button
            className="btn"
            type="button"
            disabled={blocked || busy || !onSetDropSale || !isDropMintPrice(wlPriceText) || !(Number(wlQtyText) > 0)}
            onClick={() => onSetDropSale?.(selected.slug, ugnotFromGnot(wlPriceText), Math.floor(Number(wlQtyText)))}
          >
            Set whitelist round
          </button>
          <div className="time-pair">
            <UtcMinuteField label="Whitelist start (UTC)" value={wlStartText} onChange={setWlStartText} />
            <UtcMinuteField label="Whitelist end (UTC)" value={wlEndText} onChange={setWlEndText} />
          </div>
          <div className="time-pair">
            <UtcMinuteField label="Public start (UTC)" value={publicStartText} onChange={setPublicStartText} />
            <UtcMinuteField label="Public end (UTC)" value={publicEndText} onChange={setPublicEndText} />
          </div>
          <span className="hint">Click the box. Pick a day, then an hour and a minute. The line under each box is the UTC time that was saved. Empty end stays open. Clear the time to remove it. Locked after the first mint.</span>
          <button
            className="btn"
            type="button"
            disabled={blocked || busy || !onSetMintSchedule || !scheduleOk}
            onClick={() => onSetMintSchedule?.(selected.slug, wlUnix || 0, wlEndUnix || 0, publicUnix || 0, publicEndUnix || 0)}
          >
            Set round times
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

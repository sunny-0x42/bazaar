import { useState } from "react";
import {
  ipfsToHttp,
  isDropCover,
  isDropMaxSupply,
  isDropMintPrice,
  isDropSlug,
  isMintName,
  UGNOT,
} from "../lib/chain";
import { DROP_ADD_CAP, JSON_SLOT_CAP, applyLaunchPack, countSlotLines, parseSlotBlob } from "../lib/dropjson";
import { hasAdena } from "../lib/wallets";

const JSON_TEMPLATE = "/samples/drop-items.example.json";
const JSON_PACK = "/samples/launch-collection.json";

export type LaunchPlan = {
  slug: string;
  name: string;
  cover: string;
  bio: string;
  website: string;
  twitter: string;
  discord: string;
  extras: boolean;
  maxSupply: string;
  priceUgnot: string;
  blob: string;
  hide: boolean;
  allow: string;
  cap: number;
  royaltyBps: number;
  wlPriceUgnot: string;
  wlSupply: number;
};

type Props = {
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  onConnect: () => void;
  onLaunch: (plan: LaunchPlan) => void;
  onCancel?: () => void;
  launchFeeUgnot?: number;
};

const STEPS = [
  { id: 1, label: "Collection" },
  { id: 2, label: "Items" },
  { id: 3, label: "Supply" },
  { id: 4, label: "Access" },
  { id: 5, label: "Launch" },
] as const;

export function LaunchWizard({ connected, blocked, busy, onConnect, onLaunch, onCancel, launchFeeUgnot = 1_000_000_000 }: Props) {
  const [step, setStep] = useState(1);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [cover, setCover] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [discord, setDiscord] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [maxSupply, setMaxSupply] = useState("");
  const [mintPrice, setMintPrice] = useState("");
  const [slotBlob, setSlotBlob] = useState("");
  const [hideMeta, setHideMeta] = useState(true);
  const [allowBlob, setAllowBlob] = useState("");
  const [capN, setCapN] = useState("");
  const [saleDual, setSaleDual] = useState(false);
  const [wlPrice, setWlPrice] = useState("");
  const [wlQty, setWlQty] = useState("");
  const [pubQty, setPubQty] = useState("");
  const [royaltyPct, setRoyaltyPct] = useState("0");

  function ingestJson(text: string) {
    setSlotBlob(text);
    const m = applyLaunchPack(text);
    if (m.name) setName(m.name);
    if (m.slug) setSlug(m.slug);
    if (m.cover) setCover(m.cover);
    if (m.bio) setBio(m.bio);
    if (m.website) setWebsite(m.website);
    if (m.twitter) setTwitter(m.twitter);
    if (m.discord) setDiscord(m.discord);
    if (m.maxSupply) {
      setUnlimited(false);
      setMaxSupply(m.maxSupply);
    }
    if (m.mintPrice) setMintPrice(m.mintPrice);
    if (m.royaltyPct) setRoyaltyPct(m.royaltyPct);
    if (m.hideUntilReveal != null) setHideMeta(m.hideUntilReveal);
  }

  const slugOk = isDropSlug(slug);
  const nameOk = isMintName(name);
  const coverOk = isDropCover(cover);
  const bioOk = bio.length <= 200 && !/[\r\n|]/.test(bio);
  const socialOk = [website, twitter, discord].every((s) => !s.trim() || (s.trim().length <= 120 && !/\s/.test(s)));
  const slotInfo = countSlotLines(slotBlob);
  const jsonCount = slotInfo.n;
  const fromJson = jsonCount > 0 && !slotInfo.err;
  const royaltyN = Number(royaltyPct);
  const royaltyOk = Number.isFinite(royaltyN) && royaltyN >= 0 && royaltyN <= 10;
  const wlQtyN = Number(wlQty) || 0;
  const pubQtyN = Number(pubQty) || 0;
  const dualQtyOk = !saleDual || (wlQtyN > 0 && isDropMintPrice(wlPrice) && (unlimited || fromJson || pubQtyN > 0));
  const dualSumOk =
    !saleDual ||
    unlimited ||
    (fromJson ? wlQtyN <= jsonCount : true);
  const maxOk = fromJson || unlimited || isDropMaxSupply(maxSupply) || (saleDual && pubQtyN + wlQtyN >= 1);
  const priceOk = isDropMintPrice(mintPrice);
  const step1 = slugOk && nameOk && coverOk && bioOk && socialOk;
  const step2 = !slotBlob.trim() || (fromJson && jsonCount <= JSON_SLOT_CAP);
  const step3 = maxOk && priceOk && royaltyOk && dualQtyOk && dualSumOk;
  const step4 = !saleDual || !!allowBlob.trim();

  function blobForChain(): string {
    return parseSlotBlob(slotBlob)
      .slice(0, JSON_SLOT_CAP)
      .map((line) => {
        const parts = line.split("|");
        if (parts[1]) parts[1] = ipfsToHttp(parts[1]);
        return parts.join("|");
      })
      .join("\n");
  }

  function goNext() {
    if (step === 1 && !step1) return;
    if (step === 2 && !step2) return;
    if (step === 3 && !step3) return;
    if (step === 4 && !step4) return;
    if (step === 2 && fromJson) {
      setUnlimited(false);
      setMaxSupply(String(jsonCount));
    }
    setStep((s) => Math.min(5, s + 1));
  }

  function submit() {
    if (!connected) {
      onConnect();
      return;
    }
    if (!step1 || !step2 || !step3 || !step4) return;
    const extras = !!(bio.trim() || website.trim() || twitter.trim() || discord.trim());
    let supply = fromJson ? String(jsonCount) : unlimited ? "0" : maxSupply.trim();
    if (saleDual && !fromJson && !unlimited) supply = String(wlQtyN + pubQtyN);
    onLaunch({
      slug: slug.trim(),
      name: name.trim(),
      cover: ipfsToHttp(cover.trim()),
      bio: bio.trim(),
      website: website.trim(),
      twitter: twitter.trim(),
      discord: discord.trim(),
      extras,
      maxSupply: supply,
      priceUgnot: String(Math.round(Number(mintPrice) * UGNOT)),
      blob: blobForChain(),
      hide: hideMeta,
      allow: allowBlob.trim(),
      cap: Number(capN) || 0,
      royaltyBps: Math.round(royaltyN * 100),
      wlPriceUgnot: saleDual ? String(Math.round(Number(wlPrice) * UGNOT)) : "0",
      wlSupply: saleDual ? wlQtyN : 0,
    });
  }

  const batches = fromJson ? Math.ceil(jsonCount / DROP_ADD_CAP) : 0;

  return (
    <div className="panel launch-form launch-wizard launch-shell">
      {onCancel ? (
        <p className="profile-links">
          <button className="btn" type="button" onClick={onCancel}>
            Back to drops
          </button>
        </p>
      ) : null}
      <h2>Create collection</h2>
      <ol className="wizard-steps" aria-label="Launch steps">
        {STEPS.map((s) => (
          <li key={s.id} className={s.id === step ? "is-on" : s.id < step ? "is-done" : ""}>
            <span className="wizard-n">{s.id}</span>
            {s.label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <>
          <p className="hint">Name, slug, and cover. Collectors see these on the mint page.</p>
          <div className="launch-grid">
          <label>
            Collection name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder="Signal Stones" />
            <span className="hint">{name && !nameOk ? " Check the name (1-64)." : "1-64 characters."}</span>
          </label>
          <label>
            Slug
            <input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={16} spellCheck={false} placeholder="stones" />
            <span className="hint">
              {slug && !slugOk ? " 2-16 lowercase letters, digits, or hyphens." : "Becomes #/m/" + (slug || "slug")}
            </span>
          </label>
          </div>
          <label>
            Cover URL
            <input
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              maxLength={200}
              spellCheck={false}
              placeholder="ipfs://... or https:// or /samples/"
            />
            <span className="hint">Prefer ipfs://CID.{cover && !coverOk ? " Check the URL." : ""}</span>
          </label>
          <label>
            Description
            <input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="Optional" />
          </label>
          <div className="launch-grid launch-grid-3">
          <label>
            Website
            <input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={120} spellCheck={false} />
          </label>
          <label>
            X
            <input value={twitter} onChange={(e) => setTwitter(e.target.value)} maxLength={120} spellCheck={false} placeholder="@handle" />
          </label>
          <label>
            Discord
            <input value={discord} onChange={(e) => setDiscord(e.target.value)} maxLength={120} spellCheck={false} />
          </label>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <p className="hint">
            Optional JSON (name, image, attributes). Prefer ipfs://. Skip for numbered editions (cover + #n). If you
            load a file, supply becomes that many NFTs (max {JSON_SLOT_CAP}).
          </p>
          <p className="profile-links">
            <a className="btn primary" href={JSON_PACK} download="bazaar-launch-collection.json">
              Download Harbor Foxes pack
            </a>
            <a className="btn" href={JSON_TEMPLATE} download="bazaar-drop-items.example.json">
              Empty items template
            </a>
          </p>
          <label>
            Metadata JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void f.text().then((t) => ingestJson(t));
              }}
            />
          </label>
          <label>
            JSON or pipe lines
            <textarea
              value={slotBlob}
              onChange={(e) => setSlotBlob(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder={'[\n  { "name": "Dusk Fox #1", "image": "ipfs://bafybei…", "attributes": [] }\n]'}
            />
            <span className="hint">
              {slotInfo.err
                ? slotInfo.err
                : fromJson
                  ? `${jsonCount} NFT${jsonCount === 1 ? "" : "s"} in file → supply ${jsonCount}. Launch signs ${Math.ceil(jsonCount / DROP_ADD_CAP)} batch${Math.ceil(jsonCount / DROP_ADD_CAP) === 1 ? "" : "es"} (20 per tx).`
                  : "Leave empty to set supply yourself on the next step."}
            </span>
          </label>
          <label className="trait-check">
            <input type="checkbox" checked={hideMeta} onChange={(e) => setHideMeta(e.target.checked)} />
            Hide art and traits until the owner Reveals
          </label>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <p className="hint">
            {fromJson
              ? `Supply is ${jsonCount} from your JSON. Price is still yours to set.`
              : "How many NFTs can be minted, and the GNOT price. Supply is locked after launch."}
          </p>
          {fromJson ? (
            <p className="muted">
              Max supply: <strong>{jsonCount}</strong> (from JSON, max {JSON_SLOT_CAP}).
            </p>
          ) : (
            <>
              <label className="trait-check">
                <input
                  type="checkbox"
                  checked={unlimited}
                  onChange={(e) => {
                    setUnlimited(e.target.checked);
                    if (e.target.checked) setMaxSupply("");
                  }}
                />
                Open edition (unlimited mint — pause in Studio to stop)
              </label>
              {unlimited ? (
                <p className="hint">No mint cap. Unique JSON later still max {JSON_SLOT_CAP}. Pause when you want it to end.</p>
              ) : (
                <label>
                  Max supply
                  <input
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 333"
                    required
                  />
                  <span className="hint">
                    Whole number 1–1,000,000, or load JSON to use the file length (max {JSON_SLOT_CAP}).
                    {!maxSupply ? " Required, or check open edition." : !maxOk ? " Enter a whole number from 1 to 1,000,000." : ""}
                  </span>
                </label>
              )}
            </>
          )}
          <label>
            {saleDual ? "Public mint price (GNOT)" : "Mint price (GNOT)"}
            <input value={mintPrice} onChange={(e) => setMintPrice(e.target.value)} inputMode="decimal" placeholder="e.g. 1" />
            <span className="hint">
              Paid on each public mint. 0 is allowed.{mintPrice && !priceOk ? " Enter a GNOT amount ≥ 0." : ""}
            </span>
          </label>
          <fieldset className="launch-sale">
            <legend>Mint rounds</legend>
            <label className="trait-check">
              <input type="radio" name="sale" checked={!saleDual} onChange={() => setSaleDual(false)} />
              Public mint only
            </label>
            <label className="trait-check">
              <input type="radio" name="sale" checked={saleDual} onChange={() => setSaleDual(true)} />
              Whitelist mint, then public
            </label>
            {saleDual ? (
              <>
                <label>
                  Whitelist price (GNOT)
                  <input value={wlPrice} onChange={(e) => setWlPrice(e.target.value)} inputMode="decimal" placeholder="e.g. 0.5" />
                </label>
                <label>
                  Whitelist quantity
                  <input value={wlQty} onChange={(e) => setWlQty(e.target.value)} inputMode="numeric" placeholder="e.g. 100" />
                  <span className="hint">
                    {fromJson ? `Public quantity will be ${Math.max(0, jsonCount - wlQtyN)} of ${jsonCount}.` : unlimited ? "Then unlimited public." : "Public quantity is the rest of supply."}
                  </span>
                </label>
                {!fromJson && !unlimited ? (
                  <label>
                    Public quantity
                    <input value={pubQty} onChange={(e) => setPubQty(e.target.value)} inputMode="numeric" placeholder="e.g. 900" />
                  </label>
                ) : null}
              </>
            ) : null}
          </fieldset>
          <label>
            Creator royalty on secondary sales (%)
            <input value={royaltyPct} onChange={(e) => setRoyaltyPct(e.target.value)} inputMode="decimal" placeholder="0" />
            <span className="hint">
              0–10. Locked after launch. Protocol still takes 0.50% on Buy. Primary mint has no royalty cut.
              {!royaltyOk ? " Enter 0 to 10." : ""}
            </span>
          </label>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <p className="hint">
            {saleDual ? "Whitelist round needs g1 addresses. Public round is open after that quantity mints (or Start public in Studio)." : "Optional. Empty allowlist = public mint. Cap 0 = unlimited per wallet."}
          </p>
          <label>
            Per-wallet mint cap
            <input value={capN} onChange={(e) => setCapN(e.target.value)} inputMode="numeric" placeholder="0 = unlimited" />
          </label>
          <label>
            Allowlist (g1, one per line)
            <textarea value={allowBlob} onChange={(e) => setAllowBlob(e.target.value)} rows={5} spellCheck={false} placeholder="g1…" />
            <span className="hint">Up to 50 addresses on Launch. Add more later in Studio.</span>
          </label>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <p className="hint">
            Review, then Launch. Create fee is {launchFeeUgnot > 0 ? `${launchFeeUgnot / 1_000_000} GNOT` : "free"} (admin
            can change later). Adena signs create
            {fromJson ? `, then ${batches} item batch${batches === 1 ? "" : "es"} (20 NFTs each)` : ""}
            {allowBlob.trim() || Number(capN) > 0 ? ", then access" : ""}.
          </p>
          <dl className="studio-facts">
            <div>
              <dt>Name</dt>
              <dd>{name || "—"}</dd>
            </div>
            <div>
              <dt>Mint page</dt>
              <dd className="mono">#/m/{slug || "slug"}</dd>
            </div>
            <div>
              <dt>Supply</dt>
              <dd>{fromJson ? `${jsonCount} (from JSON)` : unlimited ? "Open edition" : maxSupply || "—"}</dd>
            </div>
            <div>
              <dt>Sale</dt>
              <dd>
                {saleDual
                  ? `WL ${wlQtyN} @ ${wlPrice || "0"} GNOT → public ${mintPrice || "0"} GNOT`
                  : mintPrice === ""
                    ? "—"
                    : mintPrice === "0"
                      ? "Public free"
                      : `Public ${mintPrice} GNOT`}
              </dd>
            </div>
            <div>
              <dt>Royalty</dt>
              <dd>{royaltyN}% secondary</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>
                {fromJson
                  ? `${jsonCount} unique · ${batches} Adena batch${batches === 1 ? "" : "es"} · hidden ${hideMeta ? "yes" : "no"}`
                  : "Edition #n"}
              </dd>
            </div>
            <div>
              <dt>Create fee</dt>
              <dd>{launchFeeUgnot > 0 ? `${launchFeeUgnot / 1_000_000} GNOT` : "Free"}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>
                {allowBlob.trim() ? "Allowlist" : "Public"}
                {Number(capN) > 0 ? ` · cap ${capN}/wallet` : ""}
              </dd>
            </div>
          </dl>
          <p className="hint">Primary mint 0 bps. Secondary list/buy 50 bps. Supply cannot change after Launch.</p>
        </>
      ) : null}

      <div className="wizard-nav">
        <button className="btn" type="button" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
          Back
        </button>
        {step < 5 ? (
          <button
            className="btn primary"
            type="button"
            disabled={(step === 1 && !step1) || (step === 2 && !step2) || (step === 3 && !step3) || (step === 4 && !step4)}
            onClick={goNext}
          >
            Next
          </button>
        ) : connected ? (
          <button className="btn primary" type="button" disabled={blocked || busy || !step1 || !step2 || !step3 || !step4} onClick={submit}>
            Launch
          </button>
        ) : (
          hasAdena() ? (
            <button className="btn primary" type="button" onClick={onConnect}>
              Connect Adena to launch
            </button>
          ) : (
            <a className="btn primary" href="https://adena.app/" target="_blank" rel="noreferrer">
              Install Adena
            </a>
          )
        )}
      </div>
    </div>
  );
}

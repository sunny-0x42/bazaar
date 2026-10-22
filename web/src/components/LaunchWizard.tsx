import { useEffect, useRef, useState } from "react";
import {
  collectionRealmPath,
  ipfsToHttp,
  isDropCover,
  isDropMaxSupply,
  isDropMintPrice,
  isDropSlug,
  isMintName,
  parseUtcMinute,
  UGNOT,
  type NetworkId,
} from "../lib/chain";
import { JSON_SLOT_CAP, applyLaunchPack, countSlotLines, parseSlotBlob } from "../lib/dropjson";
import { dropSignatureCount } from "../lib/launchtx";
import { mintRoundCards, previewDropSale, writeLaunchDraft } from "../lib/mintrounds";
import { hasAdena } from "../lib/wallets";
import { MintRounds } from "./MintPage";
import { ItemArt } from "./ItemArt";
import { UtcMinuteField } from "./UtcMinuteField";

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
  wlCap: number;
  pubCap: number;
  royaltyBps: number;
  wlPriceUgnot: string;
  wlSupply: number;
  wlStart: number;
  wlEnd: number;
  publicStart: number;
  publicEnd: number;
  prereveal: string;
};

type Props = {
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  onConnect: () => void;
  onLaunch: (plan: LaunchPlan) => void;
  onCancel?: () => void;
  launchFeeUgnot?: number;
  reserveSendUgnot?: number;
  network?: NetworkId;
};

const STEPS = [
  { id: 1, label: "Collection" },
  { id: 2, label: "Items" },
  { id: 3, label: "Supply" },
  { id: 4, label: "Access" },
  { id: 5, label: "Launch" },
] as const;

export function LaunchWizard({ connected, blocked, busy, onConnect, onLaunch, onCancel, launchFeeUgnot = 1_000_000_000, reserveSendUgnot, network = "pearl" }: Props) {
  const reserveUgnot = reserveSendUgnot ?? launchFeeUgnot;
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
  const [preImage, setPreImage] = useState("");
  const [allowBlob, setAllowBlob] = useState("");
  const [wlCapN, setWlCapN] = useState("");
  const [pubCapN, setPubCapN] = useState("");
  const [saleDual, setSaleDual] = useState(false);
  const [wlPrice, setWlPrice] = useState("");
  const [wlQty, setWlQty] = useState("");
  const [wlStartText, setWlStartText] = useState("");
  const [wlEndText, setWlEndText] = useState("");
  const [publicStartText, setPublicStartText] = useState("");
  const [publicEndText, setPublicEndText] = useState("");
  const [royaltyPct, setRoyaltyPct] = useState("0");
  const packOnce = useRef(false);

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
    if (m.prereveal) setPreImage(m.prereveal);
    if (m.wlQty || m.wlStart || m.wlPrice || m.publicStart) {
      setSaleDual(true);
      if (m.wlPrice) setWlPrice(m.wlPrice);
      if (m.wlQty) setWlQty(m.wlQty);
      if (m.wlStart) setWlStartText(m.wlStart);
      if (m.wlEnd) setWlEndText(m.wlEnd);
      if (m.publicStart) setPublicStartText(m.publicStart);
      if (m.publicEnd) setPublicEndText(m.publicEnd);
    }
  }

  function loadBazaarGens() {
    void fetch("/local/bazaar-gens.json")
      .then((r) => {
        if (!r.ok) throw new Error("pack");
        return r.text();
      })
      .then((text) => {
        ingestJson(text);
        setStep(2);
      })
      .catch(() => {});
  }

  function loadBazaarGens2() {
    void fetch("/local/bazaar-gens.json")
      .then((r) => {
        if (!r.ok) throw new Error("pack");
        return r.text();
      })
      .then((text) => {
        ingestJson(text);
        setName("Bazaar Gens 2");
        setSlug("bazaargens2");
        setUnlimited(false);
        setMaxSupply("1111");
        setMintPrice("20");
        setSaleDual(true);
        setWlPrice("0.5");
        setWlQty("333");
        setWlStartText("2026-09-28 00:00");
        setWlEndText("");
        setPublicStartText("2026-10-06 00:00");
        setPublicEndText("");
        setAllowBlob("g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt");
        setStep(2);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!import.meta.env.DEV || packOnce.current) return;
    packOnce.current = true;
    loadBazaarGens2();
  }, []);

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
  const wlStartUnix = wlStartText.trim() ? parseUtcMinute(wlStartText) : null;
  const wlEndUnix = wlEndText.trim() ? parseUtcMinute(wlEndText) : null;
  const publicStartUnix = publicStartText.trim() ? parseUtcMinute(publicStartText) : null;
  const publicEndUnix = publicEndText.trim() ? parseUtcMinute(publicEndText) : null;
  const endsOk =
    (!wlEndText.trim() || (wlEndUnix != null && wlStartUnix != null && wlEndUnix > wlStartUnix)) &&
    (!publicEndText.trim() || (publicEndUnix != null && publicStartUnix != null && publicEndUnix > publicStartUnix)) &&
    !(wlEndUnix != null && publicStartUnix != null && publicStartUnix < wlEndUnix);
  const timesOk = saleDual
    ? wlStartUnix != null && publicStartUnix != null && publicStartUnix > wlStartUnix && endsOk
    : (!publicStartText.trim() || (publicStartUnix != null && publicStartUnix > 0)) && endsOk;
  const dualOk =
    !saleDual ||
    (wlQtyN > 0 &&
      isDropMintPrice(wlPrice) &&
      timesOk &&
      (unlimited || fromJson || isDropMaxSupply(maxSupply)) &&
      (fromJson ? wlQtyN <= jsonCount : unlimited || wlQtyN <= Number(maxSupply)));
  const maxOk = fromJson || unlimited || isDropMaxSupply(maxSupply);
  const priceOk = isDropMintPrice(mintPrice);
  const step1 = slugOk && nameOk && coverOk && bioOk && socialOk;
  const step2 = !slotBlob.trim() || (fromJson && jsonCount <= JSON_SLOT_CAP);
  const step3 = maxOk && priceOk && royaltyOk && dualOk && timesOk;
  const step4 = !saleDual || !!allowBlob.trim();
  const publicEndOrder =
    publicEndUnix != null && publicStartUnix != null && publicEndUnix < publicStartUnix
      ? `Public end ${publicEndText} UTC is before public start ${publicStartText} UTC.`
      : publicEndUnix != null && publicStartUnix != null && publicEndUnix === publicStartUnix
        ? `Public end ${publicEndText} UTC is the same minute as public start ${publicStartText} UTC.`
        : "";
  const step3Reason = step3
    ? ""
    : !priceOk
      ? mintPrice.trim()
        ? "Mint price must be a number, 0 or more."
        : "Enter a mint price to continue. 0 is a free mint."
      : !maxOk
        ? "Enter a max supply, or choose open edition."
        : !royaltyOk
          ? "Royalty must be from 0 to 10."
          : saleDual && !isDropMintPrice(wlPrice)
            ? "Enter an allowlist price. 0 is free."
            : saleDual && wlQtyN <= 0
              ? "Enter the allowlist quantity."
              : saleDual && ((fromJson && wlQtyN > jsonCount) || (!fromJson && !unlimited && wlQtyN > Number(maxSupply)))
                ? "Allowlist quantity is above the supply."
                : saleDual && wlStartUnix == null
                  ? "Pick a whitelist start."
                  : (saleDual && publicStartUnix == null) || (publicEndText.trim() && publicStartUnix == null)
                    ? "Pick a public start, or clear the public end."
                    : wlStartUnix != null && publicStartUnix != null && publicStartUnix <= wlStartUnix
                      ? "Public start must be after the whitelist start."
                      : wlEndUnix != null && wlStartUnix != null && wlEndUnix <= wlStartUnix
                        ? "Whitelist end must be after the whitelist start."
                        : publicEndOrder
                          ? publicEndOrder
                          : wlEndUnix != null && publicStartUnix != null && publicStartUnix < wlEndUnix
                            ? "Public start overlaps the whitelist window."
                            : "Finish the mint price and round times to continue.";

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
    const supply = fromJson ? String(jsonCount) : unlimited ? "0" : maxSupply.trim();
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
      hide: hideMeta && !!blobForChain(),
      allow: allowBlob.trim(),
      wlCap: saleDual ? Number(wlCapN) || 0 : 0,
      pubCap: Number(pubCapN) || 0,
      royaltyBps: Math.round(royaltyN * 100),
      wlPriceUgnot: saleDual ? String(Math.round(Number(wlPrice) * UGNOT)) : "0",
      wlSupply: saleDual ? wlQtyN : 0,
      wlStart: saleDual && wlStartUnix ? wlStartUnix : 0,
      wlEnd: saleDual && wlEndUnix ? wlEndUnix : 0,
      publicStart: publicStartUnix || 0,
      prereveal: hideMeta && preImage.trim() ? ipfsToHttp(preImage.trim()) : "",
      publicEnd: publicEndUnix || 0,
    });
  }

  const previewNow = Math.floor(Date.now() / 1000);
  const previewSupply = fromJson ? jsonCount : unlimited ? 0 : Number(maxSupply) || 0;
  const previewMintUgnot = Math.round((Number(mintPrice) || 0) * UGNOT);
  const previewSale = previewDropSale({
    now: previewNow,
    royaltyBps: Math.round((Number.isFinite(royaltyN) ? royaltyN : 0) * 100),
    mintPrice: previewMintUgnot,
    saleDual,
    wlPrice: Math.round((Number(wlPrice) || 0) * UGNOT),
    wlSupply: wlQtyN,
    wlStart: wlStartUnix || 0,
    wlEnd: wlEndUnix || 0,
    publicStart: publicStartUnix || 0,
    publicEnd: publicEndUnix || 0,
  });
  const previewRounds = mintRoundCards({
    now: previewNow,
    maxSupply: previewSupply,
    mintPrice: previewMintUgnot,
    sale: previewSale,
    mintWlCap: saleDual ? Number(wlCapN) || 0 : 0,
    mintPubCap: Number(pubCapN) || 0,
  });
  const previewCover = ipfsToHttp((hideMeta && preImage.trim() ? preImage : cover).trim());

  useEffect(() => {
    if (!slugOk) return;
    writeLaunchDraft({
      slug: slug.trim(),
      name: name.trim(),
      cover: previewCover,
      supply: previewSupply,
      mintPrice: previewMintUgnot,
      royaltyBps: previewSale.royaltyBps,
      saleDual,
      wlPrice: previewSale.wlPrice,
      wlSupply: previewSale.wlSupply,
      wlStart: previewSale.wlStart,
      wlEnd: previewSale.wlEnd,
      publicStart: previewSale.publicStart,
      publicEnd: previewSale.publicEnd,
      wlCap: saleDual ? Number(wlCapN) || 0 : 0,
      pubCap: Number(pubCapN) || 0,
    });
  }, [
    slugOk,
    slug,
    name,
    previewCover,
    previewSupply,
    previewMintUgnot,
    previewSale.royaltyBps,
    previewSale.wlPrice,
    previewSale.wlSupply,
    previewSale.wlStart,
    previewSale.wlEnd,
    previewSale.publicStart,
    previewSale.publicEnd,
    saleDual,
    wlCapN,
    pubCapN,
  ]);

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
            <input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={11} spellCheck={false} placeholder="stones" />
            <span className="hint">
              {slug && !slugOk
                ? " 2–11 lowercase letters or digits, start with a letter, no hyphen."
                : `Package name. Realm …/c/${slug || "slug"} · mint #/m/${slug || "slug"}`}
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
            {import.meta.env.DEV ? (
              <>
                <button className="btn primary" type="button" onClick={loadBazaarGens2}>
                  Load Bazaar Gens 2
                </button>
                <button className="btn" type="button" onClick={loadBazaarGens}>
                  Load Bazaar Gens
                </button>
              </>
            ) : null}
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
                  ? `${jsonCount} NFT${jsonCount === 1 ? "" : "s"} in file → supply ${jsonCount}. Launch signs ${dropSignatureCount(jsonCount)} transaction${dropSignatureCount(jsonCount) === 1 ? "" : "s"} (one batch of at most 20 NFTs per signature, under Adena's gas limit). NFTs already stored are skipped.`
                  : "Leave empty to set supply yourself on the next step."}
            </span>
          </label>
          <label className="trait-check">
            <input type="checkbox" checked={hideMeta} onChange={(e) => setHideMeta(e.target.checked)} />
            Hide art and traits until you reveal the collection
          </label>
          {hideMeta ? (
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
                Every minted NFT shows this image until you reveal in Studio. Empty uses the collection cover.
              </span>
            </label>
          ) : null}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <p className="hint">
            {fromJson
              ? `Supply is ${jsonCount} from your JSON. Price is still yours to set.`
              : "How many NFTs can be minted, and the GNOT price. Supply is locked after launch."}
          </p>
          {slug === "bazaargens2" ? (
            <p className="hint">
              Onyx trial. Whitelist 0.5 GNOT for 333, then public 20 GNOT from 2026-10-06 00:00 UTC. Change any number before Reserve.
            </p>
          ) : null}
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
              Paid on each public mint.
              {!mintPrice.trim() ? " Required before Next. 0 is a free mint." : !priceOk ? " Enter a number, 0 or more." : " 0 is a free mint."}
            </span>
          </label>
          <fieldset className="launch-sale">
            <legend>Mint stages</legend>
            <label className="trait-check">
              <input type="radio" name="sale" checked={!saleDual} onChange={() => setSaleDual(false)} />
              Public mint only
            </label>
            <label className="trait-check">
              <input type="radio" name="sale" checked={saleDual} onChange={() => setSaleDual(true)} />
              Allowlist stage, then public
            </label>
            {saleDual ? (
              <>
                <label>
                  Allowlist price (GNOT)
                  <input value={wlPrice} onChange={(e) => setWlPrice(e.target.value)} inputMode="decimal" placeholder="e.g. 0.5" />
                  <span className="hint">
                    {!wlPrice.trim() ? "Required before Next. 0 is free." : !isDropMintPrice(wlPrice) ? "Enter a number, 0 or more." : "0 is free."}
                  </span>
                </label>
                <label>
                  Allowlist quantity
                  <input value={wlQty} onChange={(e) => setWlQty(e.target.value)} inputMode="numeric" placeholder="e.g. 100" />
                  <span className="hint">
                    {wlQtyN > 0 ? "" : "Required before Next. "}
                    First {wlQtyN || "N"} mints: allowlist wallets at this price. Public starts at the time below, or earlier if Studio calls Start public.
                  </span>
                </label>
                <div className="time-pair">
                  <UtcMinuteField label="Whitelist start (UTC)" value={wlStartText} onChange={setWlStartText} />
                  <UtcMinuteField label="Whitelist end (UTC)" value={wlEndText} onChange={setWlEndText} />
                </div>
                <div className="time-pair">
                  <UtcMinuteField label="Public start (UTC)" value={publicStartText} onChange={setPublicStartText} />
                  <UtcMinuteField label="Public end (UTC)" value={publicEndText} onChange={setPublicEndText} />
                </div>
                <div className="time-note">
                  <span className="hint">
                    Click the box. Pick a day, then an hour and a minute. The line under each box is the UTC time that was saved. A date alone is 00:00 UTC. Empty end stays open.
                    Public start must be after whitelist start, and not before whitelist end.
                    {wlStartUnix != null && publicStartUnix != null && publicStartUnix <= wlStartUnix
                      ? " Public start must be later."
                      : ""}
                    {wlEndUnix != null && wlStartUnix != null && wlEndUnix <= wlStartUnix ? " Whitelist end must be later." : ""}
                    {publicEndOrder ? ` ${publicEndOrder}` : ""}
                    {wlEndUnix != null && publicStartUnix != null && publicStartUnix < wlEndUnix
                      ? " Public start overlaps the whitelist window."
                      : ""}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="time-pair">
                  <UtcMinuteField label="Public start (UTC, optional)" value={publicStartText} onChange={setPublicStartText} />
                  <UtcMinuteField label="Public end (UTC, optional)" value={publicEndText} onChange={setPublicEndText} />
                </div>
                <div className="time-note">
                  <span className="hint">
                    Click the box. Pick a day, then an hour and a minute. The line under each box is the UTC time that was saved. Empty start mints once the drop is resumed. Empty end stays open.
                    {publicEndOrder ? ` ${publicEndOrder}` : ""}
                  </span>
                </div>
              </>
            )}
          </fieldset>
          <label>
            Creator royalty on secondary sales (%)
            <input value={royaltyPct} onChange={(e) => setRoyaltyPct(e.target.value)} inputMode="decimal" placeholder="0" />
            <span className="hint">
              0–10. Locked after launch. Protocol takes 2% on Buy (admin can retune). Primary mint has no royalty cut.
              {!royaltyOk ? " Enter 0 to 10." : ""}
            </span>
          </label>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <p className="hint">
            {saleDual
              ? "Allowlist stage needs g1 wallets. After that quantity mints (or Start public in Studio), anyone pays the public price."
              : "Optional. Empty allowlist = public mint. A non-empty list without a two-stage sale stays allowlist-only."}
          </p>
          {saleDual ? (
            <label>
              Whitelist mints per wallet
              <input value={wlCapN} onChange={(e) => setWlCapN(e.target.value)} inputMode="numeric" placeholder="0 = unlimited" />
            </label>
          ) : null}
          <label>
            {saleDual ? "Public mints per wallet" : "Mints per wallet"}
            <input value={pubCapN} onChange={(e) => setPubCapN(e.target.value)} inputMode="numeric" placeholder="0 = unlimited" />
            <span className="hint">
              {saleDual
                ? "Each round has its own count. A whitelist mint does not use the public allowance. 0 is unlimited for that round."
                : "0 is unlimited. An allowlist-only drop uses this public-round count."}
            </span>
          </label>
          <label>
            Allowlist (g1, one per line)
            <textarea value={allowBlob} onChange={(e) => setAllowBlob(e.target.value)} rows={5} spellCheck={false} placeholder="g1…" />
            <span className="hint">Up to 50 addresses per tx. Fixed-supply mint stays paused until slots are loaded and you Resume.</span>
          </label>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <div className="launch-preview">
            <div className="mint-hero">
              <div className="featured-cover mint-cover">
                <ItemArt name={name || "Collection"} image={previewCover} alt="" priority />
              </div>
              <div className="mint-copy">
                <h3 className="launch-preview-name">{name || "Collection"}</h3>
                <p className="hint">Preview. Collectors see this after Reserve and Initialize. Times are UTC.</p>
                <MintRounds rounds={previewRounds} />
              </div>
            </div>
          </div>
          <p className="hint">
            {network === "local"
              ? "Local copies the collection realm, then Adena Reserve (if fee) and Init with empty send."
              : `${network === "onyx" ? "Onyx" : network === "pearl" ? "Pearl" : "Mainnet"}: ask Nomaq to addpkg the collection realm first. Adena then Reserve (LaunchFee) and Init (empty send).`}{" "}
            Fee {reserveUgnot > 0 ? `${reserveUgnot / 1_000_000} GNOT on Reserve` : launchFeeUgnot > 0 ? "free for this wallet" : "free"}
            {fromJson ? ` · ${dropSignatureCount(jsonCount)} transaction${dropSignatureCount(jsonCount) === 1 ? "" : "s"} for ${jsonCount} NFTs` : ""}. A rerun skips NFTs already stored and does not rewrite a round already on chain. Fixed-supply drops stay paused until items are loaded and you Resume.
            {saleDual
              ? " Init stores the public price and clears the whitelist. Approve SetDropSale and SetMintSchedule after it, or the mint page stays public-only."
              : ""}
          </p>
          <dl className="studio-facts">
            <div>
              <dt>Name</dt>
              <dd>{name || "—"}</dd>
            </div>
            <div>
              <dt>Realm</dt>
              <dd className="mono">{collectionRealmPath(slug || "slug", network)}</dd>
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
                  ? `Allowlist ${wlQtyN} @ ${wlPrice || "0"} GNOT ${wlStartText || "—"}–${wlEndText || "open"} UTC → public ${mintPrice || "0"} GNOT ${publicStartText || "—"}–${publicEndText || "open"} UTC`
                  : `${mintPrice === "" ? "—" : mintPrice === "0" ? "Public free" : `Public ${mintPrice} GNOT`}${publicStartText.trim() ? ` from ${publicStartText} UTC` : ""}${publicEndText.trim() ? ` until ${publicEndText} UTC` : ""}`}
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
                  ? `${jsonCount} unique · ${dropSignatureCount(jsonCount)} signature${dropSignatureCount(jsonCount) === 1 ? "" : "s"} · hidden ${hideMeta ? "yes" : "no"}`
                  : "Edition #n"}
              </dd>
            </div>
            <div>
              <dt>Create fee</dt>
              <dd>{reserveUgnot > 0 ? `${reserveUgnot / 1_000_000} GNOT` : "Free"}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>
                {saleDual ? "Allowlist then public" : allowBlob.trim() ? "Allowlist only" : "Public"}
                {saleDual && Number(wlCapN) > 0 ? ` · whitelist ${wlCapN}/wallet` : ""}
                {Number(pubCapN) > 0 ? ` · public ${pubCapN}/wallet` : ""}
                {hideMeta && fromJson ? " · hidden until Reveal" : ""}
              </dd>
            </div>
          </dl>
          <p className="hint">Primary mint 0 bps. Secondary Buy 2% protocol (admin). Supply cannot change after Launch.</p>
        </>
      ) : null}

      <div className="wizard-nav">
        {step === 3 && step3Reason ? (
          <p className="hint wizard-block" role="status">
            {step3Reason}
          </p>
        ) : null}
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
            Reserve and initialize
          </button>
        ) : (
          hasAdena() ? (
            <button className="btn primary" type="button" onClick={onConnect}>
              Connect Adena to initialize
            </button>
          ) : (
            <a className="btn primary" href="https://adena.app/" target="_blank" rel="noreferrer">
              Install Adena
            </a>
          )
        )}
      </div>
      <div className="wizard-scroll-pad" aria-hidden="true" />
    </div>
  );
}

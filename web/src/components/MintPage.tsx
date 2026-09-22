import type { ChainCollection, DropSale } from "../lib/chain";
import { isOpenEdition, isPublicDrop, parseTokenURI, shortAddr, shortPkgPath, socialHref } from "../lib/chain";
import { CopyLine } from "./CopyLine";
import { EmptyState } from "./EmptyState";
import { ItemArt } from "./ItemArt";
import { PriceMark } from "./PriceMark";

type Props = {
  drop: ChainCollection | null;
  slug: string;
  loaded: number;
  hidden?: boolean;
  allowN: number;
  mintCap: number;
  sale?: DropSale | null;
  tokenURI?: string;
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  onMint: () => void;
  onConnect: () => void;
  onOpenCollection: () => void;
  onBack: () => void;
};

export function MintPage({
  drop,
  slug,
  loaded,
  hidden,
  allowN,
  mintCap,
  sale,
  tokenURI = "",
  connected,
  blocked,
  busy,
  onMint,
  onConnect,
  onOpenCollection,
  onBack,
}: Props) {

  if (!drop || !isPublicDrop(drop)) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Mint</h1>
          <p className="muted">{slug || "Unknown drop"}</p>
        </header>
        <EmptyState title="Collection not live" body="This slug is not a factory collection on this network.">
          <button className="btn" type="button" onClick={onBack}>
            Back
          </button>
        </EmptyState>
      </section>
    );
  }
  const open = isOpenEdition(drop);
  const remaining = open ? 1 : Math.max(0, drop.maxSupply - drop.minted);
  const slotLeft = loaded > 0 ? Math.max(0, loaded - drop.minted) : remaining;
  const soldOut = loaded > 0 ? drop.minted >= loaded : !open && remaining <= 0;
  const paused = drop.paused;
  const links = [
    { href: socialHref(drop.website || ""), label: "Website" },
    { href: socialHref(drop.twitter || ""), label: "X" },
    { href: socialHref(drop.discord || ""), label: "Discord" },
  ].filter((row) => row.href);
  const mintedPct = drop.maxSupply > 0 ? Math.min(100, (drop.minted / drop.maxSupply) * 100) : 0;
  const royaltyBps = drop.royaltyBps ?? sale?.royaltyBps ?? 0;
  const token = tokenURI ? parseTokenURI(tokenURI) : null;
  const art = drop.cover;
  const pkg = drop.pkg || "";
  const shortPkg = pkg ? shortPkgPath(pkg) : drop.slug;

  return (
    <section className="page mint-page">
      <div className="toolbar">
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
        <button className="btn" type="button" onClick={onOpenCollection}>
          Collection
        </button>
      </div>
      <div className="mint-hero">
        <div className="featured-cover mint-cover">
          <ItemArt name={token?.name || drop.name} image={art} alt="" />
        </div>
        <div className="mint-copy">
          <h1>
            {drop.name}
            {paused ? <span className="tag">Paused</span> : null}
            {sale?.phase === "whitelist" ? <span className="tag">Whitelist</span> : null}
          </h1>
          <div className="collection-ids is-stack">
            {pkg ? <CopyLine variant="row" label="Realm" display={shortPkg} value={pkg} /> : null}
            {drop.addr ? (
              <CopyLine variant="row" label="Address" display={shortAddr(drop.addr)} value={drop.addr} />
            ) : null}
          </div>
          {drop.bio ? <p className="collection-bio">{drop.bio}</p> : null}
          {links.length > 0 ? (
            <p className="collection-socials">
              {links.map((row) => (
                <a key={row.label} href={row.href} target="_blank" rel="noreferrer">
                  {row.label}
                </a>
              ))}
            </p>
          ) : null}
          {token?.kind === "json" && token.json ? (
            <details className="token-json">
              <summary>Token metadata (ERC-721 JSON)</summary>
              <pre>{token.json}</pre>
            </details>
          ) : null}
          <dl className="featured-stats">
            <div>
              <dt>{sale?.phase === "whitelist" ? "Whitelist" : "Mint"}</dt>
              <dd className="num">
                {(sale?.phase === "whitelist" ? sale.wlPrice : drop.mintPrice) > 0 ? (
                  <PriceMark ugnot={sale?.phase === "whitelist" ? sale.wlPrice : drop.mintPrice} />
                ) : (
                  "Free"
                )}
              </dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd className="num">
                {open ? `${drop.minted} minted · open` : `${slotLeft}/${drop.maxSupply}`}
              </dd>
            </div>
            <div>
              <dt>Creator</dt>
              <dd className="mono">{shortAddr(drop.creator)}</dd>
            </div>
            {royaltyBps > 0 ? (
              <div>
                <dt>Royalty</dt>
                <dd className="num">{royaltyBps / 100}%</dd>
              </div>
            ) : null}
          </dl>
          <div
            className="drop-progress"
            role="progressbar"
            aria-valuenow={drop.minted}
            aria-valuemax={drop.maxSupply}
          >
            <div className="drop-progress-bar" style={{ width: `${mintedPct}%` }} />
          </div>
          <p className="hint">
            {loaded > 0
              ? hidden
                ? "You receive Unrevealed (cover only). Art and traits stay hidden until you Reveal on the collection page. Primary mint is 0 bps — GNOT goes to the creator."
                : `${loaded} unique slots loaded in file order. Primary mint is 0 bps — GNOT goes to the creator.`
              : "Edition mint (cover + #n). Load unique JSON items when you initialize."}
            {sale?.phase === "whitelist"
              ? ` Whitelist round ${drop.minted}/${sale.wlSupply}.`
              : sale?.wlSupply
                ? " Public round."
                : allowN > 0
                  ? ` Allowlist on (${allowN}).`
                  : " Public mint."}
            {royaltyBps > 0 ? ` Secondary royalty ${royaltyBps / 100}%.` : ""}
            {mintCap > 0 ? ` Max ${mintCap} per wallet.` : ""}
          </p>
          {paused ? (
            <p className="muted">Mint is paused.</p>
          ) : soldOut ? (
            <p className="muted">Sold out.</p>
          ) : connected ? (
            <button className="btn primary btn-block" type="button" disabled={blocked || busy} onClick={onMint}>
              Mint
            </button>
          ) : (
            <button className="btn primary btn-block" type="button" onClick={onConnect}>
              Connect Adena to mint
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

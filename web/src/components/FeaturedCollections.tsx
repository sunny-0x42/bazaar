import { listedShare, type CollectionMarket, type ExploreCollection } from "../lib/catalog";
import { isOpenEdition, isPublicDrop, shortPkgPath } from "../lib/chain";
import { CopyLine } from "./CopyLine";
import { ItemArt } from "./ItemArt";
import { PriceMark } from "./PriceMark";

type Props = {
  title: string;
  collections: ExploreCollection[];
  markets: Map<string, CollectionMarket>;
  onOpen: (slug: string) => void;
  onMint?: (slug: string) => void;
};

export function FeaturedCollections({ title, collections, markets, onOpen, onMint }: Props) {
  if (collections.length === 0) return null;
  const launchpad = !!onMint;
  return (
    <section className="market-section">
      <h2 className="section-title">{title}</h2>
      <div className="featured-grid">
        {collections.map((col) => {
          const m = markets.get(col.slug);
          const floor = m && m.floor > 0 ? m.floor : col.floor;
          const share = listedShare(m?.listed || 0, m?.supply || 0);
          const open = isOpenEdition(col);
          const remaining = open ? 0 : Math.max(0, col.maxSupply - col.minted);
          const royaltyBps = col.royaltyBps ?? 0;
          const mintable = isPublicDrop(col);
          return (
            <article
              key={col.slug}
              className="featured-card"
              role="button"
              tabIndex={0}
              aria-label={`Open ${col.name}`}
              onClick={() => onOpen(col.slug)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(col.slug);
                }
              }}
            >
              <div className="featured-cover">
                <ItemArt name={col.name} image={col.cover} alt="" />
              </div>
              <div className="featured-body">
                <h3>
                  {col.name}
                  {mintable && !col.paused && (open || col.minted < col.maxSupply) ? (
                    <span className="tag">Mint</span>
                  ) : col.paused ? (
                    <span className="tag">Paused</span>
                  ) : null}
                </h3>
                {col.pkg ? <CopyLine display={shortPkgPath(col.pkg)} value={col.pkg} /> : null}
                {launchpad ? (
                  <>
                    <dl className="featured-stats">
                      <div>
                        <dt>Mint</dt>
                        <dd className="num">
                          {col.mintPrice > 0 ? <PriceMark ugnot={col.mintPrice} /> : "Free"}
                        </dd>
                      </div>
                      <div>
                        <dt>Remaining</dt>
                        <dd className="num">{open ? "Open" : `${remaining} left`}</dd>
                      </div>
                      {royaltyBps > 0 ? (
                        <div>
                          <dt>Royalty</dt>
                          <dd className="num">{royaltyBps / 100}%</dd>
                        </div>
                      ) : null}
                    </dl>
                    {mintable && !col.paused && (open || remaining > 0) ? (
                    <div className="drop-actions featured-mint">
                      <button
                        className="btn primary btn-block"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          (onMint || onOpen)(col.slug);
                        }}
                      >
                        Mint
                      </button>
                    </div>
                    ) : null}
                  </>
                ) : (
                  <dl className="featured-stats">
                    <div>
                      <dt>Floor</dt>
                      <dd className="num">{floor > 0 ? <PriceMark ugnot={floor} /> : "—"}</dd>
                    </div>
                    <div>
                      <dt>Vol</dt>
                      <dd className="num">{m && m.vol > 0 ? <PriceMark ugnot={m.vol} /> : "—"}</dd>
                    </div>
                    <div>
                      <dt>Listed</dt>
                      <dd className="num listed-stack">
                        <span className="listed-pct">{share.pct || "—"}</span>
                        <span className="listed-ratio muted">{share.ratio}</span>
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

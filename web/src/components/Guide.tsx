import type { Network } from "../lib/chain";
import type { Tab } from "./types";

type Props = {
  network: Network;
  onTab: (tab: Tab) => void;
  onExploreHome: () => void;
};

export function Guide({ network, onTab, onExploreHome }: Props) {
  const pearl = network.id === "pearl";
  return (
    <section className="page guide-page">
      <header className="page-head">
        <h1>Guide</h1>
        <p className="muted">How Bazaar works on gno.land. Unique NFTs, fixed GNOT prices, Adena.</p>
      </header>

      <article className="guide-block">
        <h2>What Bazaar is</h2>
        <p>
          A collection launchpad and secondary book. Each live collection is its own Gno realm (its own package
          path and <span className="mono">g1</span> address). Items are unique GRC721 tokens, listed at a fixed GNOT
          price. Not a DEX, not a token pad, not the Gnomies collection.
        </p>
      </article>

      <article className="guide-block">
        <h2>Wallet and network</h2>
        <ol>
          <li>
            Install{" "}
            <a href="https://adena.app" target="_blank" rel="noreferrer">
              Adena
            </a>{" "}
            and connect on this site.
          </li>
          <li>
            Use {pearl ? "Pearl (pearl-1)" : "local gnodev"} in the header. Mismatch shows a network warning.
          </li>
          {network.faucet ? (
            <li>
              Get test GNOT from the{" "}
              <a href={network.faucet} target="_blank" rel="noreferrer">
                faucet
              </a>
              .
            </li>
          ) : null}
        </ol>
      </article>

      <article className="guide-block">
        <h2>Mint</h2>
        <ol>
          <li>
            Open{" "}
            <button className="text-btn" type="button" onClick={onExploreHome}>
              Explore
            </button>{" "}
            and pick a launchpad, or go to <span className="mono">#/m/slug</span>.
          </li>
          <li>Connect Adena. Pay the mint price in GNOT (or free if the drop is 0). Primary mint is 0 bps — GNOT goes to the creator.</li>
          <li>Your NFT lives on that collection realm. Metadata is ERC-721 JSON (<span className="mono">TokenURI</span>).</li>
        </ol>
      </article>

      <article className="guide-block">
        <h2>Trade</h2>
        <ol>
          <li>
            <button className="text-btn" type="button" onClick={() => onTab("sell")}>
              Sell
            </button>{" "}
            lists an item you own at a fixed GNOT price. The NFT moves into realm escrow until sold or cancelled.
          </li>
          <li>Buy from Explore or the collection page. Secondary fee is 50 bps protocol plus creator royalty (0–10%, set at launch).</li>
          <li>Listed items are not in your wallet balance until you cancel or someone buys.</li>
        </ol>
      </article>

      <article className="guide-block">
        <h2>Launch a collection</h2>
        <ol>
          <li>
            Open{" "}
            <button className="text-btn" type="button" onClick={() => onTab("create")}>
              Launch
            </button>
            . Pick a slug (2–11 letters or digits, no hyphen). That becomes the realm{" "}
            <span className="mono">…/c/slug</span>.
          </li>
          <li>Set name, cover, supply, mint price, and royalty (0–10% on secondary sales).</li>
          <li>
            On Pearl, the collection package must exist first (Bazaar addpkg). Then Adena{" "}
            <strong>Initialize</strong> — pay the platform reserve fee (shown on Launch; admin can change it). If you
            already Reserved the slug, Initialize sends nothing extra.
          </li>
          <li>Collectors mint at <span className="mono">#/m/slug</span>.</li>
        </ol>
      </article>

      <article className="guide-block">
        <h2>Fees</h2>
        <ul>
          <li>Create / reserve collection: platform <span className="mono">LaunchFee</span> in GNOT.</li>
          <li>Primary mint: 0 bps to the protocol.</li>
          <li>Secondary buy: 50 bps protocol + creator royalty.</li>
          <li>No self-buy. Send only native ugnot (GNOT).</li>
        </ul>
      </article>

      <article className="guide-block">
        <h2>List without launching here</h2>
        <p>
          Bazaar cannot pull an NFT contract it does not know. Gno has no runtime{" "}
          <span className="mono">TransferFrom</span> of a foreign package. To sell on Bazaar you still need a
          collection realm that implements list and buy (the public <span className="mono">col</span> template).
        </p>
        <ol>
          <li>
            Copy <span className="mono">gno.land/r/bazaar/col</span>, <span className="mono">addpkg</span> under your
            own <span className="mono">g1</span> path, then <span className="mono">Init</span> (royalty 0–10%). You
            can skip the Launch wizard.
          </li>
          <li>
            To appear on Explore, register with the Bazaar factory (reserve / launch fee, then Init). Otherwise Sell
            still works if the UI is pointed at your pkg.
          </li>
          <li>
            Holders list from{" "}
            <button className="text-btn" type="button" onClick={() => onTab("sell")}>
              Sell
            </button>
            . Escrow is your realm. Buyers pay GNOT on that same pkg.
          </li>
        </ol>
        <p className="muted">
          Full note: listing-external.md in the GitHub repo. Third-party collections that are not this template
          cannot be imported today.
        </p>
      </article>

      <article className="guide-block">
        <h2>Adena collectables</h2>
        <p>
          Each collection is one realm. In Adena, Manage Collectables, paste the realm path (copy chip on the
          collection page). Wallet qeval: <span className="mono">Name</span>, <span className="mono">BalanceOf</span>,{" "}
          <span className="mono">TokensOf</span>, <span className="mono">TokenURI</span>. Spec for Adena:{" "}
          <a href="https://github.com/sunny-0x42/bazaar/blob/master/docs/adena-collectables.md" target="_blank" rel="noreferrer">
            docs/adena-collectables.md
          </a>
          . Listed items sit in escrow, so they may not show in the wallet until you cancel.
        </p>
      </article>
    </section>
  );
}

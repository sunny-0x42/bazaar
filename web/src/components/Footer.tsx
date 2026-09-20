import type { Network } from "../lib/chain";
import type { Tab } from "./types";

type Props = {
  network: Network;
  nft: string;
  onTab: (tab: Tab) => void;
  onExploreHome: () => void;
};

export function Footer({ network, nft, onTab, onExploreHome }: Props) {
  const pearl = network.id === "pearl";
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <h2>Bazaar</h2>
          <p>
            NFT launchpad and secondary book on gno.land. Unique items, fixed GNOT prices, Adena
            wallet.
          </p>
          <p className="muted">Not a DEX. Not a token pad. Not the Gnomies collection.</p>
        </div>
        <div>
          <h3>Trade</h3>
          <ul>
            <li>
              <button type="button" onClick={onExploreHome}>
                Explore
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTab("create")}>
                Launch
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTab("sell")}>
                Sell
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTab("portfolio")}>
                Profile
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTab("settings")}>
                Settings
              </button>
            </li>
          </ul>
        </div>
        <div>
          <h3>Protocol</h3>
          <ul>
            <li>Quote: native ugnot (UI GNOT)</li>
            <li>Create collection: platform fee (`LaunchFee`, default 1000 GNOT)</li>
            <li>Primary mint: 0 bps — all GNOT to creator</li>
            <li>Secondary buy: 50 bps protocol + creator royalty (0–10%)</li>
            <li>No royalty. No self-buy.</li>
            <li>JSON supply up to 10,000 unique, or open edition. Slug 2–16.</li>
          </ul>
        </div>
        <div>
          <h3>Network</h3>
          <ul>
            <li>
              {pearl ? "Pearl testnet (pearl-1)" : "Local gnodev (dev)"}
            </li>
            <li>
              <a href={network.gnoweb} target="_blank" rel="noreferrer">
                gnoweb
              </a>
            </li>
            {network.faucet ? (
              <li>
                <a href={network.faucet} target="_blank" rel="noreferrer">
                  Faucet
                </a>
              </li>
            ) : null}
            <li>
              <a href="https://adena.app/" target="_blank" rel="noreferrer">
                Adena
              </a>
            </li>
            <li>
              <a href="https://docs.gno.land/" target="_blank" rel="noreferrer">
                gno.land docs
              </a>
            </li>
            <li>
              <a href="https://gno.land/" target="_blank" rel="noreferrer">
                gno.land
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer-meta">
        <p>
          {pearl
            ? "Pearl testnet — test GNOT has no market value. USD quotes use live mainnet GNOT/USD for display only."
            : "Local gnodev — Init the NFT realm, then Seed or Launch to trade."}
        </p>
        <p className="mono footer-pkg" title={nft}>
          {nft}
        </p>
      </div>
    </footer>
  );
}

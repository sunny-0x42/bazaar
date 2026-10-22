import { shortPkgPath, type Network } from "../lib/chain";
import type { Tab } from "./types";

type Props = {
  network: Network;
  factory: string;
  onTab: (tab: Tab) => void;
  onExploreHome: () => void;
};

export function Footer({ network, factory, onTab, onExploreHome }: Props) {
  const pearl = network.id === "pearl";
  const mainnet = network.id === "mainnet";
  const onyx = network.id === "onyx";
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <h2 className="footer-brand">
            <img className="logo-mark" src="/bazaar-mark.svg" width={28} height={28} alt="" />
            Nomaq
          </h2>
          <p>
            NFT launchpad and fixed-price book on gno.land. One collection is one realm. Unique GRC721
            tokens, GNOT, Adena.
          </p>
          <div className="footer-social">
            <span className="footer-social-label">Our social channels</span>
            <div className="footer-social-icons">
              <a className="social-link" href="https://t.me/nomaqlabs" target="_blank" rel="noreferrer" aria-label="Telegram">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.6 4.4 2.9 11.2c-.9.3-.9.9-.2 1.1l4.6 1.4 1.8 5.5c.2.6.1.9.7.9.4 0 .6-.2.8-.4l2.3-2.2 4.7 3.5c.8.4 1.4.2 1.6-.8l3-14.4c.3-1.2-.4-1.8-1.6-1.4ZM8.6 13.9l8.9-5.6c.4-.2.8-.1.5.2l-7.2 6.5-.3 3.1-1.9-4.2Z"
                  />
                </svg>
              </a>
              <span className="social-link is-soon" role="img" aria-label="Discord, coming soon" title="Discord link will be added later">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M19.27 5.33A16.4 16.4 0 0 0 15.2 4l-.4.8a14.6 14.6 0 0 1 3.6 1.5 15.2 15.2 0 0 0-13 0A12.4 12.4 0 0 1 9.1 4.8L8.7 4a16.4 16.4 0 0 0-4.1 1.3C2.1 8.8 1.4 12.2 1.6 15.5A16.5 16.5 0 0 0 6.9 18l.8-1.1a10.7 10.7 0 0 1-1.6-.8l.4-.3c3 1.4 6.4 1.4 9.4 0l.4.3a11 11 0 0 1-1.6.8l.8 1.1a16.5 16.5 0 0 0 5.3-2.5c.6-3.8-.5-7.1-2.9-10.2ZM8.7 13.8c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.7.8 1.7 1.8-.8 1.8-1.7 1.8Zm6.6 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.7.8 1.7 1.8-.8 1.8-1.7 1.8Z"
                  />
                </svg>
              </span>
            </div>
          </div>
        </div>
        <div>
          <h3>App</h3>
          <ul>
            <li>
              <button type="button" onClick={onExploreHome}>
                Explore
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTab("rewards")}>
                Rewards
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTab("create")}>
                Launch
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTab("guide")}>
                Guide
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTab("sell")}>
                Sell
              </button>
            </li>
            {onyx ? (
              <li>
                <button type="button" onClick={() => onTab("editions")}>
                  Editions
                </button>
              </li>
            ) : null}
            <li>
              <a href="https://github.com/sunny-0x42/bazaar" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3>Ecosystem</h3>
          <ul>
            <li>
              <a href="https://gnomi.fun" target="_blank" rel="noreferrer">
                Gnomi.fun
              </a>
            </li>
            <li>
              <a href="https://zdex.gnomi.fun" target="_blank" rel="noreferrer">
                zDex
              </a>
            </li>
            <li>
              <a href="https://gnofish.xyz" target="_blank" rel="noreferrer">
                GnoFish
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3>Protocol</h3>
          <ul>
            <li>One collection = one Gno realm + g1 address</li>
            <li>Quote: native ugnot (UI GNOT)</li>
            <li>Create / reserve: LaunchFee (see Launch)</li>
            <li>Primary mint: 0 bps to creator</li>
            <li>Secondary: 2% protocol + royalty 0–10%</li>
            <li>Slug 2–11, no hyphen (package name)</li>
          </ul>
        </div>
      </div>
      <div className="footer-meta">
        <p>
          {mainnet
            ? "gno.land mainnet (gnoland-1). GNOT has market value. Confirm Adena is on Mainnet before signing."
            : onyx
              ? "Onyx testnet (onyx-1). Test GNOT has no market value. Adena stays on Onyx."
              : pearl
                ? "Pearl testnet (pearl-1) — test GNOT has no market value. USD quotes are mainnet GNOT/USD for display only."
                : "Local gnodev — factory Init, then Launch a collection realm to mint and list."}
        </p>
        <p>
          {mainnet || pearl || onyx ? (
            <>
              <a href={network.gnoweb} target="_blank" rel="noreferrer">
                gnoweb
              </a>
              {network.faucet ? (
                <>
                  {" · "}
                  <a href={network.faucet} target="_blank" rel="noreferrer">
                    Faucet
                  </a>
                </>
              ) : null}
              {" · "}
              <a href="https://adena.app/" target="_blank" rel="noreferrer">
                Adena
              </a>
            </>
          ) : (
            <a href="https://adena.app/" target="_blank" rel="noreferrer">
              Adena
            </a>
          )}
        </p>
        {factory ? (
          <p className="mono footer-pkg" title={factory}>
            {shortPkgPath(factory) === factory ? factory : shortPkgPath(factory)}
          </p>
        ) : null}
      </div>
    </footer>
  );
}

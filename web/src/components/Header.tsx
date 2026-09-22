import { NETWORKS, parseCoinsUgnot, shortAddr, type Network } from "../lib/chain";
import { hasAdena } from "../lib/wallets";
import { PriceMark } from "./PriceMark";
import { useQuote } from "./Quote";
import { Select } from "./Select";
import type { Tab } from "./types";

type Props = {
  tab: Tab;
  query: string;
  connected: boolean;
  address?: string;
  coins?: string;
  onTab: (tab: Tab) => void;
  onExploreHome: () => void;
  onQuery: (q: string) => void;
  onConnect: () => void;
  network: Network;
  onNetwork: (id: string) => void;
  onProfile?: () => void;
  isAdmin?: boolean;
};

const DESK_NAV: { id: Tab; label: string }[] = [
  { id: "explore", label: "Explore" },
  { id: "create", label: "Launch" },
  { id: "guide", label: "Guide" },
  { id: "sell", label: "Sell" },
  { id: "portfolio", label: "Profile" },
];

export function Header({
  tab,
  query,
  connected,
  address,
  coins,
  onTab,
  onExploreHome,
  onQuery,
  onConnect,
  network,
  onNetwork,
  onProfile,
  isAdmin,
}: Props) {
  const live = network.id === "pearl";
  const { quote, setQuote, gnotUsd } = useQuote();
  const ugnotBal = coins ? parseCoinsUgnot(coins) : null;

  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="logo" type="button" onClick={onExploreHome}>
          <span className="logo-mark" aria-hidden />
          <span className="wordmark">Bazaar</span>
        </button>

        <label className="search">
          <span className="sr-only">Search items, collections</span>
          <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.2-3.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            placeholder="Search collections"
            onFocus={onExploreHome}
            onChange={(e) => {
              onQuery(e.target.value);
              onExploreHome();
            }}
          />
        </label>

        <nav className="desk-nav" aria-label="Primary">
          {DESK_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "active" : ""}
              onClick={() => (item.id === "explore" ? onExploreHome() : onTab(item.id))}
            >
              {item.label}
            </button>
          ))}
          {isAdmin ? (
            <button
              type="button"
              className={tab === "admin" ? "active" : ""}
              onClick={() => onTab("admin")}
            >
              Admin
            </button>
          ) : null}
        </nav>

        <div className="header-tools">
        <div className="quote-toggle" role="group" aria-label="Display currency">
          <button
            type="button"
            className={quote === "gnot" ? "active" : ""}
            onClick={() => setQuote("gnot")}
          >
            GNOT
          </button>
          <button
            type="button"
            className={quote === "usd" ? "active" : ""}
            title={gnotUsd > 0 ? `GNOT $${gnotUsd}` : "No live GNOT/USD feed"}
            onClick={() => setQuote("usd")}
          >
            USD
          </button>
        </div>

        <div className={`status-pill net-select ${live ? "is-live" : "is-local"}`} title={live ? "Pearl testnet" : "Local gnodev"}>
          <span className="status-dot" aria-hidden />
          <Select
            ariaLabel="Network"
            variant="pill"
            value={network.id}
            onChange={onNetwork}
            options={NETWORKS.map((n) => ({
              value: n.id,
              label: n.id === "pearl" ? "Pearl" : "Local",
            }))}
          />
        </div>

        {isAdmin ? (
          <button
            type="button"
            className={`admin-nav ${tab === "admin" ? "active" : ""}`}
            onClick={() => onTab("admin")}
          >
            Admin
          </button>
        ) : null}

        {connected && address ? (
          <button className="wallet-chip" type="button" title={address} onClick={onProfile}>
            <span className="wallet-dot" aria-hidden />
            {ugnotBal != null && ugnotBal > 0 ? (
              <span className="wallet-bal">
                <PriceMark ugnot={ugnotBal} size={12} />
              </span>
            ) : null}
            <span className="wallet-addr mono">{shortAddr(address)}</span>
          </button>
        ) : hasAdena() ? (
          <button className="btn primary connect-btn" type="button" onClick={onConnect}>
            Connect
          </button>
        ) : (
          <a className="btn primary connect-btn" href="https://adena.app/" target="_blank" rel="noreferrer">
            Install Adena
          </a>
        )}

        <button
          className={`icon-btn ${tab === "settings" ? "active" : ""}`}
          type="button"
          aria-label="Settings"
          onClick={() => onTab("settings")}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.77 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06-.94s.02.63.06.94L2.89 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.4.31.64.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.24.09.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z"
            />
          </svg>
        </button>
        </div>
      </div>
    </header>
  );
}

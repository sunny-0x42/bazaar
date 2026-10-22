import { activatePrimary, PRIMARY_NAV, primaryNavActive } from "./nav";
import type { Tab } from "./types";

type Props = {
  tab: Tab;
  onTab: (tab: Tab) => void;
  onExploreHome: () => void;
  onOpenMint: (slug: string) => void;
  mintSlug?: string;
  isAdmin?: boolean;
};

export function BottomNav({ tab, onTab, onExploreHome, onOpenMint, mintSlug = "" }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Mobile">
      {PRIMARY_NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          className={primaryNavActive(item, tab, mintSlug) ? "active" : ""}
          onClick={() => activatePrimary(item, { onTab, onExploreHome, onOpenMint })}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

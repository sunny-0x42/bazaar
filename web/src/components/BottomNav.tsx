import type { Tab } from "./types";

type Props = {
  tab: Tab;
  onTab: (tab: Tab) => void;
  onExploreHome: () => void;
};

const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: "explore", label: "Explore", icon: "M4 10.5 12 4l8 6.5V20H4V10.5Z" },
  { id: "create", label: "Launch", icon: "M12 5v14M5 12h14" },
  { id: "sell", label: "Sell", icon: "M4 7h16l-2 12H6L4 7Zm4-3h8v3H8V4Z" },
  { id: "portfolio", label: "Profile", icon: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-8 2-8 4.5V20h16v-1.5C20 16 16 14 12 14Z" },
];

export function BottomNav({ tab, onTab, onExploreHome }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Mobile">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={tab === item.id ? "active" : ""}
          onClick={() => (item.id === "explore" ? onExploreHome() : onTab(item.id))}
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

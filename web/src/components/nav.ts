import { BAZAAR_GENS_MINT_SLUG } from "../lib/chain";
import type { Tab } from "./types";

export type PrimaryNavItem = {
  id: Tab;
  label: string;
  icon: string;
  /** Opens #/m/{mintSlug} instead of the tab page. */
  mintSlug?: string;
};

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { id: "explore", label: "Explore", icon: "M4 10.5 12 4l8 6.5V20H4V10.5Z" },
  {
    id: "rewards",
    label: "Rewards",
    icon: "M19 5 5 19M8.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm7 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  },
  {
    id: "portfolio",
    label: "Profile",
    icon: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-8 2-8 4.5V20h16v-1.5C20 16 16 14 12 14Z",
  },
];

export function primaryNavActive(item: PrimaryNavItem, tab: Tab, mintSlug: string): boolean {
  if (item.mintSlug) return mintSlug === item.mintSlug;
  if (item.id === "create") return tab === "create" && mintSlug !== BAZAAR_GENS_MINT_SLUG;
  return tab === item.id;
}

export function activatePrimary(
  item: PrimaryNavItem,
  actions: {
    onTab: (tab: Tab) => void;
    onExploreHome: () => void;
    onOpenMint: (slug: string) => void;
  },
): void {
  if (item.mintSlug) {
    actions.onOpenMint(item.mintSlug);
    return;
  }
  if (item.id === "explore") actions.onExploreHome();
  else actions.onTab(item.id);
}

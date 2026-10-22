import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BAZAAR_GENS_MINT_SLUG, MAINNET, mintHash } from "../lib/chain";
import { BottomNav } from "./BottomNav";
import { Explore } from "./Explore";
import { Header } from "./Header";
import { PRIMARY_NAV, activatePrimary, primaryNavActive } from "./nav";

function activeNavLabels(html: string, aria: string): string[] {
  const nav = html.match(new RegExp(`<nav\\b[^>]*aria-label="${aria}"[^>]*>[\\s\\S]*?</nav>`));
  expect(nav, aria).toBeTruthy();
  const labels: string[] = [];
  const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(nav![0]))) {
    if (!/\bclass="[^"]*\bactive\b/.test(match[1])) continue;
    labels.push(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }
  return labels;
}

describe("Primary nav", () => {
  it("lists Explore, Rewards, and Profile", () => {
    expect(PRIMARY_NAV.map((row) => row.label)).toEqual(["Explore", "Rewards", "Profile"]);
    expect(PRIMARY_NAV.some((row) => row.label === "Bazaar Gens")).toBe(false);
    expect(mintHash(BAZAAR_GENS_MINT_SLUG)).toBe("#/m/bazaargens");
  });

  it("highlights Rewards on the rewards page and no primary item on the Bazaar Gens mint page", () => {
    const explore = PRIMARY_NAV.find((row) => row.label === "Explore")!;
    const rewards = PRIMARY_NAV.find((row) => row.label === "Rewards")!;
    expect(primaryNavActive(rewards, "rewards", "")).toBe(true);
    expect(primaryNavActive(explore, "rewards", "")).toBe(false);
    expect(primaryNavActive(rewards, "create", "bazaargens")).toBe(false);
    expect(primaryNavActive(explore, "create", "bazaargens")).toBe(false);
    const home: string[] = [];
    activatePrimary(explore, {
      onTab: () => undefined,
      onExploreHome: () => home.push("home"),
      onOpenMint: () => undefined,
    });
    expect(home).toEqual(["home"]);
  });

  it("marks Rewards active in the header and the mobile nav", () => {
    const noop = () => undefined;
    const props = {
      tab: "rewards" as const,
      mintSlug: "",
      onTab: noop,
      onExploreHome: noop,
      onOpenMint: noop,
    };
    const header = renderToStaticMarkup(
      <Header
        {...props}
        query=""
        connected={false}
        onQuery={noop}
        onConnect={noop}
        onDisconnect={noop}
        network={MAINNET}
        onNetwork={noop}
      />,
    );
    const mobile = renderToStaticMarkup(<BottomNav {...props} />);
    expect(header).not.toContain(">Bazaar Gens<");
    expect(mobile).not.toContain(">Bazaar Gens<");
    expect(activeNavLabels(header, "Primary")).toEqual(["Rewards"]);
    expect(activeNavLabels(mobile, "Mobile")).toEqual(["Rewards"]);
  });

  it("keeps the home Bazaar Gens button on the explore page", () => {
    const html = renderToStaticMarkup(
      <Explore
        items={[]}
        chainCollections={[]}
        collectionItems={null}
        collectionActivity={null}
        slug=""
        onSlug={() => undefined}
        query=""
        onQuery={() => undefined}
        loading={false}
        chainNote=""
        connected={false}
        blocked={false}
        busy={false}
        onOpenTab={() => undefined}
        onBuy={() => undefined}
        onSell={() => undefined}
        onCancel={() => undefined}
        onConnect={() => undefined}
        itemId=""
        onItemId={() => undefined}
        factoryOnly
        onOpenMint={() => undefined}
      />,
    );
    expect(html).toContain(">Bazaar Gens · 1,111<");
  });
});

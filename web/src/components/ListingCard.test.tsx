import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingCard } from "./ListingCard";
import type { Item } from "../lib/chain";

const item: Item = {
  id: "119",
  name: "Bazaar Gens #0119",
  owner: "g1abc",
  seller: "",
  price: 0,
  listed: false,
  image: "/og.jpg",
  collection: "bazaargens",
  rarity: "Rare",
  traits: "",
  revealed: true,
  slot: 118,
};

describe("ListingCard sync", () => {
  it("does not show Sync NFT on a card", () => {
    const owned = renderToStaticMarkup(
      <ListingCard item={item} owned onOpen={() => undefined} onSync={() => undefined} />,
    );
    const listed = renderToStaticMarkup(
      <ListingCard item={{ ...item, listed: true, price: 1 }} owned onOpen={() => undefined} onSync={() => undefined} />,
    );
    const visitor = renderToStaticMarkup(
      <ListingCard item={item} onOpen={() => undefined} onSync={() => undefined} />,
    );
    expect(owned).not.toContain(">Sync NFT<");
    expect(listed).not.toContain(">Sync NFT<");
    expect(visitor).not.toContain(">Sync NFT<");
  });

  it("marks a wallet NFT that is included in the bulk list", () => {
    const html = renderToStaticMarkup(
      <ListingCard item={item} owned picked onOpen={() => undefined} onTogglePick={() => undefined} />,
    );
    expect(html).toContain('aria-label="Remove #119 from wallet list"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("<circle");
  });

  it("draws an empty rounded box when the wallet NFT is not picked", () => {
    const html = renderToStaticMarkup(
      <ListingCard item={item} owned picked={false} onOpen={() => undefined} onTogglePick={() => undefined} />,
    );
    expect(html).toContain('class="pick-fab"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("<circle");
  });
});

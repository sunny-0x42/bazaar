import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Item } from "../lib/chain";
import { Sell } from "./Sell";

function item(id: string, listed = false): Item {
  return {
    id,
    name: `Bazaar Gens #${id}`,
    owner: "g1abc",
    seller: listed ? "g1abc" : "",
    price: listed ? 2_000_000 : 0,
    listed,
    image: "/og.jpg",
    collection: "bazaargens",
    rarity: "Common",
    traits: "",
    revealed: true,
    slot: Number(id),
  };
}

function page(items: Item[], focusKey = "") {
  return renderToStaticMarkup(
    <Sell
      items={items}
      focusKey={focusKey}
      focusPrice="1.5"
      connected
      blocked={false}
      busy={false}
      onList={() => undefined}
      onConnect={() => undefined}
      onOpenTab={() => undefined}
    />,
  );
}

describe("Sell bulk list", () => {
  it("shows every holding and selects the item opened from a card", () => {
    const html = page([item("206"), item("207")], "bazaargens:206");
    expect(html).toContain("<h1>List</h1>");
    expect(html).toContain("Select all");
    expect(html).toContain("1 of 2 selected");
    expect(html).toContain('aria-label="Select #206 Bazaar Gens #206"');
    expect(html).toContain('aria-label="Price for #206"');
    expect(html).toContain(">List 1<");
    expect(html).not.toContain('aria-label="Price for #207"');
  });

  it("asks for a wallet before the grid", () => {
    const html = renderToStaticMarkup(
      <Sell
        items={[]}
        focusKey=""
        focusPrice="1"
        connected={false}
        blocked={false}
        busy={false}
        onList={() => undefined}
        onConnect={() => undefined}
        onOpenTab={() => undefined}
      />,
    );
    expect(html).toContain("Connect Adena");
    expect(html).not.toContain("Select all");
  });
});

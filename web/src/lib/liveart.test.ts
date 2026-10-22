import { describe, expect, it } from "vitest";
import { indexLiveArt, liveArtFor, liveArtKey, missingLiveArt } from "./liveart";

describe("live art", () => {
  const gens = { collection: "bazaargens", id: "12", name: "Bazaar Gens #0012", image: "ipfs://bafy12" };
  const other = { collection: "stones", id: "12", name: "Stone", image: "/samples/stones-01.png" };

  it("matches a sale by collection and token id", () => {
    const index = indexLiveArt([gens, other]);
    const row = { slug: "bazaargens", id: "12", name: "" };
    expect(liveArtKey(row)).toBe("bazaargens#12");
    expect(liveArtFor(row, index)).toEqual({ image: "ipfs://bafy12", name: "Bazaar Gens #0012" });
    expect(liveArtFor({ slug: "stones", id: "12", name: "" }, index)?.image).toBe("/samples/stones-01.png");
  });

  it("matches a preview row by name when the id is empty", () => {
    const index = indexLiveArt([{ collection: "foxes", name: "Dusk Fox", image: "/samples/foxes-01.png" }]);
    expect(liveArtFor({ slug: "foxes", id: "", name: "Dusk Fox" }, index)?.image).toBe("/samples/foxes-01.png");
  });

  it("asks ItemLine once per unseen numeric id", () => {
    const index = indexLiveArt([gens]);
    const rows = [
      { slug: "bazaargens", id: "12", name: "known" },
      { slug: "bazaargens", id: "40", name: "" },
      { slug: "bazaargens", id: "40", name: "again" },
      { slug: "bazaargens", id: "", name: "preview" },
      { slug: "bazaargens", id: "nope", name: "bad" },
    ];
    expect(missingLiveArt(rows, index)).toEqual([{ key: "bazaargens#40", slug: "bazaargens", id: "40" }]);
  });
});

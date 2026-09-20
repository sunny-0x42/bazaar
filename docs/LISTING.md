# How a project launches or lists on Bazaar

Gno cannot `TransferFrom` an unknown GRC721 at runtime. Pearl has no `p/demo/tokens/grc721`. So listing is **not** “paste a contract address” like OpenSea.

## Path A — Launch on our pad (default)

Use the live realm `gno.land/r/bazaar/nft` (or the copy under `gno.land/r/<g1>/bazaar/nft` after addpkg).

1. `CreateDrop(slug, name, cover, maxSupply, mintPriceUgnot)` — you are creator.
2. Collectors `PublicMint(slug)` paying exact ugnot. Primary fee = 0; GNOT goes to creator.
3. Holders `List(id, priceUgnot)` on the secondary book. Buyers `Buy(id)`. Protocol 50 bps.

Template for a **standalone** drop realm (same rules, your namespace): `gno.land/p/bazaar/dropstd/v1` plus copy `r/bazaar/nft` drop+book files. Then hub `SetModule` is not required; they trade on **their** realm. To appear on **this** Explore, they still mint through Path A or Path B.

## Path B — List an item you already own **here**

If `OwnerOf(id) == you` and not listed: `List(id, price)`. UI: Sell / Portfolio → Sell.

## Path C — NFT from another realm (Gnomies, etc.)

**Not supported as a pull listing.** The other realm would need a **push** (it imports Bazaar and calls `OpenListing`). That is a later upgrade. Until then: launch a Bazaar drop (Path A) or wait for a GRC721 registry on Pearl.

## Eligibility (enforced)

- Slug unique, 2–16 `[a-z0-9-]`.
- maxSupply 1–3000 for drops.
- List: owner EOA, price > 0 ugnot, not already listed.
- Buy: exact OriginSend, not self-buy.

`ListingRules()` on the nft realm returns a short English blurb for the UI.

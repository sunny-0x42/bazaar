# NFT launchpad (replaces freeform Mint tab)

Not gnomi.fun (token bonding curve). Not Gnomies. Bazaar launchpad = **fixed-price collection drop**.

## Realm

`CreateCollection` stays (no public mint: maxSupply=0).

`CreateDrop(cur, slug, name, cover, maxSupply, mintPriceUgnot)`
- EOA. slug 2–16 `[a-z0-9-]`. **maxSupply 0 = open edition** (pause to stop). Else 1–1_000_000. Unique JSON slots cap **10,000** (`dropSlotHardCap`); wizard sets supply = JSON length. AddDropItems still 20 lines/tx. mintPrice >= 0 ugnot.
- `drop=true`. creator = caller. minted starts 0.

`AddDropItems(cur, slug, blob)` — creator only. Up to 20 lines: `name|image|rarity|Trait:Value;Trait:Value`. Appends slots; `loaded` cannot exceed `maxSupply`. Empty loaded = numbered edition mint.

`SetHidden(cur, slug, true)` — hide slot metadata. `ListDropSlots` returns empty so collectors cannot snipe. `PublicMint` mints **Unrevealed** (cover only). Owner calls `Reveal(id)` to copy name, image, rarity, traits.

UI Load items accepts OpenSea JSON (`name`, `image`, `attributes[]`) or pipe lines, then sets hidden.

`PublicMint(cur, slug)`
- `IsUserCall` + `OriginSend` == mintPrice (0 allowed).
- If `loaded > 0`: consume next slot (name, image, rarity, traits). Panic `nft: no slot` when `minted >= loaded`.
- Else: name `{collection} #{n}`. Image `/samples/{slug}-0{n}.png` or cover. Rarity from `id % 10`.
- Owner = minter. Protocol fee: none on primary mint (fee is secondary List/Buy only).

`DropLine(slug)` = `slug|name|cover|count|mintPrice|maxSupply|minted|creator`

`ListCollections` same columns: `slug|name|cover|count|mintPrice|maxSupply|minted`

## SeedSamples

Each sample is a drop (maxSupply 6, mintPrice 0.5 / 0.8 / 1.0 GNOT). Seed still mints+lists 3 items per drop for the **secondary** book so Explore has GNOT prices. 3 mints remain for Launchpad PublicMint.

## UI

- **Explore**: marketplace. Collection cards show **floor** (min listed GNOT) or mint price. A live drop’s collection hero has a **Mint** CTA to `#/m/{slug}`.
- **Launch → Studio**: wizard 1–5 (Collection → Items → Supply/sale → Access → Launch). JSON length sets supply (max 10,000). Sale: public only, or whitelist then public (price + qty per round). Royalty 0–10% on secondary Buy, locked at launch. `SetDropSale` / `StartPublic` / `DropSaleOf`.
- **Launch → Load items**: OpenSea JSON. Prefer `ipfs://CID` for `image` (UI maps to `https://ipfs.io/ipfs/…` because nftv4 `validImage` is http(s) or `/samples/`). Download `/samples/drop-items.example.json`. Hide until Reveal. Max 20 lines per tx.
- Live collector mint is `#/m/{slug}` and the collection hero — not a second Launch grid.
- **Mint page** `#/m/{slug}`: collector surface. Hidden drops mint Unrevealed; owner Reveals on the collection page.
- **Launch → Mint 1/1**: unique item (`Mint` / `MintIn`). Not a public drop.
- **Profile → Created**: collection row + Mint page for drops.
- **Sell / Portfolio** unchanged.

`MintIn` is creator-only. Anyone may `Mint` a 1/1 into the default `bazaar` collection.

Preview catalog includes `mintPrice` (ugnot) and each item `listPrice` (ugnot) so prices show without Pearl.

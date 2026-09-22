# Bazaar NFT book (v2 product)

Pearl live book is **nftv7** — the **collection factory** (`SetFeatured` / `Featured`). Launch (`CreateDrop` / `LaunchCollection`) is a `MsgCall` on this one realm: each collection gets a GRC721 `Token` + `PrivateLedger` in nftv7 state. **No `addpkg` per collection.** GRC721 lib: `gno.land/p/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/grc721/v0`. **nftv5 and nftv6 are frozen.**

Local source: `gno.land/p/bazaar/grc721/{v0,metadata/v0,enumerable/v0,royalty/v0}` (rewritten from `p/nt/grc721`, not a homemade token). `item.owner` is a cache of `OwnerOf`. Per-realm collections (`docs/FACTORY.md`) are local/experimental only.

Fee: still 50 bps of the GNOT price (`p/bazaar/fee/v1`). Quote asset: native `ugnot`.

Admin `SetFeatured(csv)` / `Featured()` pick up to 8 **launchpad** drop slugs for the home Featured launchpads row. Empty list hides that row. **Featured collections** on Explore rank by secondary volume in the UI (`pickFeatured`); no admin set. Pearl deploy name is `nftv7`.

## Hub

`SetModule("nft", "gno.land/r/bazaar/nft")`. Pearl deploy name is `nftv7`. UI reads Hub first. Old `market` GRC20 module stays deployable but is not the default Explore.

## Realm `gno.land/r/bazaar/nft`

One item = one token id. Listing is 1:1 with the item (cannot list a fraction).

| Func | Who | Notes |
| --- | --- | --- |
| `Init(cur)` | first EOA | admin; default collection slug `bazaar` |
| `CreateCollection(cur, slug, name, cover)` | EOA | slug 2–16 `[a-z0-9-]`, once per slug |
| `Mint(cur, name, imageURL)` | EOA | mints to caller into `bazaar`; returns id (`int`) |
| `MintIn(cur, slug, name, imageURL)` | EOA | collection must exist; returns id |
| `SeedSamples(cur)` | admin | once; 3 collections × 3 listed items |
| `Transfer(cur, to, id)` | owner | |
| `List(cur, id, priceUgnot)` | owner | escrow: owner becomes realm; status listed |
| `Buy(cur, id)` | EOA | `OriginSend` == price; item to buyer |
| `Cancel(cur, id)` | seller | item back to seller |
| `OwnerOf(id) address` | read | listed items: realm address (cache of GRC721) |
| `GrcName()` / `GrcSymbol()` | read | default collection `bazaar` (`Bazaar` / `bazaar`) |
| `GrcBalanceOf(addr string) int64` | read | sum of GRC721 balances across collections |
| `GrcOwnerOf(id int) string` | read | GRC721 `OwnerOf` on the item's collection ledger |
| `TokenURI(id int) string` | read | `item.image` (Adena / qeval) |
| `SellerOf(id) address` | read | empty if not listed |
| `PriceOf(id) int64` | read | 0 if not listed |
| `NameOf` / `ImageOf` / `Listed(id) bool` / `CollectionOf(id) string` | read | |
| `ItemLine(id) string` | read | `id\|name\|owner\|seller\|price\|listed\|image\|collection\|rarity` |
| `RarityOf(id) string` | read | Common / Uncommon / Rare / Epic / Legendary |
| `ListOpen() string` | read | open ItemLine rows, cap 50 |
| `ListCollections() string` | read | `slug\|name\|cover\|count` lines |
| `ListByCollection(slug) string` | read | listed ItemLine rows in that collection, cap 50 |
| `TokensOf(owner) string` | read | comma ids |
| `NextID() int` | read | last minted id |
| `WithdrawFees` / `TransferAdmin` / `ProtocolBps` | admin / read | same as market |

Mint rules:

- name 1–64 chars, no newlines
- imageURL empty, `http://` / `https://`, or `/samples/` + `[a-z0-9._-]+` (local demo), max 200 chars, no whitespace
- one mint per call; no supply field (not fungible)

List rules: `priceUgnot > 0`; caller is current owner; not already listed.

Buy: not self-buy; exact ugnot; fee to protocol; seller gets `price - fee`.

## UI (English)

- Explore: **image cards** (or placeholder mark if no URL), name, `#id`, price GNOT. Click → drawer Buy.
- Create: **Mint item** (name + image URL), not “Create token / decimals / supply”.
- Sell: pick an owned unlisted id, set GNOT price, fee math.
- Portfolio: owned + listed; Cancel if listed.
- Copy: Item, Collection (Bazaar), not “tokens listed”.

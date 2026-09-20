# Bazaar NFT book (v2 product)

Pearl has `p/demo/tokens/grc20` only — no `grc721`. Official `grc721` in gnolang/gno is quarantined. Bazaar ships its own unique-item realm. Not Gnomies (separate collection). Not a GRC20 OTC book.

Fee: still 50 bps of the GNOT price (`p/bazaar/fee/v1`). Quote asset: native `ugnot`.

## Hub

`SetModule("nft", "gno.land/r/bazaar/nft")`. UI reads this first. Old `market` GRC20 module stays deployable but is not the default Explore.

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
| `OwnerOf(id) address` | read | listed items: realm address |
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

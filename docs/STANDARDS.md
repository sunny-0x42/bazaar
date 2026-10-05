# Bazaar listing standard

Bazaar is an NFT launchpad and a fixed-price secondary book on gno.land mainnet. Quote asset is native `ugnot` (UI: GNOT). Bonding-curve launch is gnomi.fun. The AMM is Zdex.

Live site: https://bazaar.gnomi.fun

Factory for a new collection: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

Getters below were read on 2026-10-05. Read them again before quoting a fee.

## NFT

| Step | Func | Fee |
| --- | --- | --- |
| Reserve slug | `Reserve` on bazaarv5 | `LaunchFee()` = **1000 GNOT**. The factory admin's `ReserveDue` is 0. Admin `SetLaunchFee`. |
| Init collection | `Init` on the new pkg | Empty send after that `Reserve`. `Register` runs inside `Init`. |
| Primary mint | `PublicMint` / creator `Mint` | 0 protocol. GNOT goes to the creator. |
| Secondary list | `List` / `UpdatePrice` / `Cancel` | 0 |
| Buy | `Buy` (exact ugnot) | Protocol `max(0, ProtocolBps − max(seller, buyer) HolderDiscount)`. `ProtocolBps()` is **200**. Admin `SetProtocolBps` accepts 0–500. Royalty 0–10% of the price goes to the creator. Of the protocol fee, `GenesisShareBps()` **1100** (11%) goes to `perk2`. The rest goes to `ProtocolSink()`. |
| Unlisted move | `Transfer` / `TransferFrom` | 0. Panics while listed. |

Eligibility: slug `[a-z][a-z0-9]{1,10}` (2–11, no hyphen). List price > 0. The seller cannot buy their own listing.

A foreign GRC721 cannot be pulled in. Copy `col`, retarget it, then `Reserve` and `Init`. See [listing-external.md](listing-external.md).

## Holder discount and the 11% share

`HolderDiscount` is a number stored on `bazaarv5`. `perk2` writes it when a wallet `Sync`s revealed Bazaar Gens it holds. `Buy` does not scan wallets itself.

Recorded discount and share weight, in bps: Common 25, Uncommon 50, Rare 75, Epic 100, Legendary 125, Mythic 150. A listed id and an unminted id add no weight. `GenesisPkg()` is `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/perk2`.

## Tokens (GRC20)

GRC20 tokens are not listed on Bazaar Explore. Frozen `r/bazaar/market` is not the product.

## What Explore shows

The public UI reads `bazaarv5` `ListCollections()`, and it still merges rows from the older on-chain registries `bazaarv2`, `bazaarv1`, and `factory`. A new collection registers on `bazaarv5`.

These slugs stay off the public grid: `test`, `stdcol`, `adcol`, `col3333`, `shown`.

Collection pages are Items, Chart, and Activity.

Adena indexes a collection whose realm imports genesis `gno.land/p/nt/grc721/v0`, with `OwnerOf(tid string) (address, error)`. `List` escrows the token to the collection realm, so the wallet hides it until `Cancel` or `Buy`.

Independent creators: [listing-external.md](listing-external.md), [col-realm.md](col-realm.md). Adena: [adena-collectables.md](adena-collectables.md).

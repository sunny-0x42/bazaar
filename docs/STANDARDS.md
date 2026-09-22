# Bazaar listing standard

Bazaar is an **NFT launchpad + NFT secondary book**. Quote asset is native `ugnot` (UI: GNOT). Not a DEX. Not a bonding-curve pad.

## NFT

| Step | Func | Fee |
| --- | --- | --- |
| Launch drop | `CreateDrop` / `LaunchCollection` | Platform create fee (`LaunchFee()`, default 1000 GNOT; admin `SetLaunchFee`) |
| Primary mint | `PublicMint` (exact ugnot, WL or public price) | 0 — all GNOT to creator |
| Secondary list | `List` / `UpdatePrice` | — |
| Buy | `Buy` (exact ugnot) | 50 bps protocol + creator royalty (0–10%, set at launch) |
| Unlisted move | `Transfer` | 0 |

Eligibility: unique slug 2–16 `[a-z0-9-]`, drop (JSON length up to 10,000, custom supply, or open edition), list price > 0, no self-buy.

External GRC721 pull is **not** supported (Gno cannot `TransferFrom` an unknown package). Path: drop here, or later a push from the other realm.

## Tokens (GRC20)

**Not listed on Bazaar Explore.** Bonding-curve launch = gnomi.fun. AMM = Zdex. Frozen `r/bazaar/market` is not the product.

Live Pearl **factory** (one collection = one realm): `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/factoryv3` (also v2 for older cols). Frozen slug book: `…/bazaar/nftv7`. Independent creators: [listing-external.md](listing-external.md). Adena: [adena-collectables.md](adena-collectables.md).

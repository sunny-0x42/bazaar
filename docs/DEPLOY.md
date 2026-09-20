# Deploy

## Local

`.\start-gnodev.ps1` then `cd web; npm run dev`.

Uses a nested workspace (`dev/ws`) and a **dedicated** gnodev home (`%AppData%\Roaming\gno-bazaar`). Do not share Zdex's `gno` home — a mixed store panics with `unexpected node with location gno.land/r/bazaar/nft:0:0`.

Pearl **nftv5** is live at `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv5`. Point the UI NFT path at that package.

After gnoweb is up: call `Init`, then Settings → Seed sample collections.

## Pearl

gnomcp treats `pearl-1` as **read-only** (no agent key, no faucet, no `gno_addpkg`). A 2026-09-19 `gno_profile_add test16` against pearl.testnets.gno.land confirmed `read_only: true`.

To trade on Pearl you (the human) sign `addpkg` with **your** gnokey under `gno.land/r/<your-g1>/bazaar/nft` (and `…/bazaar/fee/v1` first). Then:

1. Faucet: https://pearl.testnets.gno.land/faucet
2. `Init` then `SeedSamples` on the nft realm
3. UI: Settings NFT path = deployed pkg; Network stays Pearl

Live on Pearl (signer `g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt`):

- fee: `gno.land/p/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/fee/v1` (height 537347)
- nft v1 (frozen): `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nft`
- **nftv2** (frozen): `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv2` (addpkg 539125)
- **nftv3** (frozen): `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv3` (addpkg 558745, Init 558747, SeedSamples 558749).
- **nftv4** (frozen): `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv4` (addpkg 559860).
- **nftv5** (create fee `LaunchFee` default 1000 GNOT, admin `SetLaunchFee`; royalty + WL/public sale): `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv5` (addpkg 560586, Init 560588, SeedSamples 560589). Seed: 6 drops, 21 listings. UI default NFT path is nftv5. `loadNft` remaps empty, nft, nftv2, nftv3, nftv4 to nftv5.

UI default NFT path is that realm. Network: **Pearl**. Connect Adena, faucet, then Buy. Seller of seeded listings is the deployer — use a **different** wallet to Buy (self-buy panics).

Until that lands, buy/sell on **Local** gnodev (`.\start-gnodev.ps1`, network Local).

## Mainnet

Read-only for this company until transfers unlock and GPAO clears packages. No silent fallback to a testnet.

# NFT launchpad

Bazaar launchpad is a fixed-price collection drop on gno.land mainnet. Bonding-curve tokens are gnomi.fun. The Gnomies collection is a separate realm.

## Current product

1. Copy `gno.land/r/bazaar/col` and retarget it. The committed sample still hardcodes 50 bps and calls `CreditLaunchFee`. [listing-external.md](listing-external.md) is the checklist. Adena cannot `addpkg`.
2. `Reserve(slug)` on **bazaarv5** with `LaunchFee()` (1000 GNOT for a normal account).
3. `Init(name, symbol, cover, maxSupply, mintPriceUgnot, royaltyBps)` with an **empty** send. `Register` runs inside `Init`. A fixed supply starts paused until slots exist and the creator calls `ResumeMint`. `maxSupply` 0 is an open edition until `PauseMint`.
4. Creator `AddDropItems` (20 lines per tx), optional `SetHidden`, `AddAllowlist`, `SetDropSale`, `StartPublic`, `SetMintCap`.
5. Collectors `PublicMint` with no slug argument, paying the exact mint price. Protocol fee on that mint is 0.

Factory: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`. See [FACTORY.md](FACTORY.md).

## UI

Site: https://bazaar.gnomi.fun

- **Explore** shows collection cards with floor (lowest listed GNOT) or mint price. A live drop links to `#/m/{slug}`.
- **Launch** is the collection wizard: public sale, or allowlist then public. Royalty 0–10% is set at launch. Secondary protocol is 2% before holder discount.
- **Load items** accepts OpenSea JSON (`name`, `image`, `attributes`) or pipe lines. The chain `validImage` accepts `http://`, `https://`, or `/samples/…`, at most 200 characters. It rejects `ipfs://`. Store IPFS art as `https://gateway.pinata.cloud/ipfs/<cid>`. Leave out `ipfs.io`, `dweb.link`, `w3s.link`, and `nftstorage.link`. At most 20 lines per transaction. Hide until `Reveal` when the drop is hidden.
- The collector mint surface is `#/m/{slug}` and the collection hero.
- Hidden drops mint as Unrevealed. The creator calls `Reveal(id)` on the collection.
- Creator `Mint(name, imageURL)` is a creator mint on that collection, with an empty send.
- **Profile → Created** links the collection and its mint page.
- **Sell** lists an unlisted id the wallet owns.

## Frozen nftv7

`CreateDrop(slug, …)` and `PublicMint(slug)` on one shared nft package are the Pearl nftv7 pad. Slugs there allowed 2–16 characters including a hyphen. That pad is not the website. The live `col` slug is `[a-z][a-z0-9]{1,10}` and `PublicMint` takes no slug.

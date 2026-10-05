# List on Bazaar without using Launch

For creators who already mint on their own Gno realm and want secondary listings on [Bazaar](https://bazaar.gnomi.fun).

Chain is mainnet `gnoland-1`. Quote asset is native `ugnot` (1 GNOT = 1,000,000 ugnot). Wallet is Adena. Adena cannot `addpkg`.

## What Gno allows

Bazaar cannot `TransferFrom` an unknown package at runtime. Explore shows a collection after that collection's realm `Register`s on the live factory and implements `List` / `Buy` on itself. There is no “paste any GRC721 address”.

## Path that works today

1. Copy [`gno.land/r/bazaar/col`](../gno.land/r/bazaar/col/). MsgCall names are in [col-realm.md](col-realm.md). Factory path, fees, and images in this file are the live rules.
2. Before `addpkg`, retarget the factory import to the path in [Factory](#factory-explore), as a named import `factory`. `Buy` must call `factory.ProtocolBps()`, `factory.HolderDiscount`, and `factory.GenesisShareBps()`. Replace `const protocolBps = 50` in this repo's `book.gno`, and replace the payment of that fee to `factory.Address()`, with the split in [Fees on Buy](#fees-on-buy).
3. `addpkg` under your namespace. The last path element is the package name and the slug: `[a-z][a-z0-9]{1,10}` (2–11 characters, no hyphen). Example: `gno.land/r/<your-g1>/mycol` with `package mycol`.
4. Host your own mint page (`PublicMint` / `Mint` on that pkg).
5. `Reserve(slug)` on the factory. `OriginSend` is `LaunchFee()` for a normal account (currently 1000 GNOT, `1000000000ugnot`). Then `Init(name, symbol, cover, maxSupply, mintPriceUgnot, royaltyBps)` on your pkg with an empty send. `Init` panics `col: reserve first` unless `ReservedCreator(slug)` is that same account. `Register` runs inside `Init`. `CancelReserve` returns the ugnot that `Reserve` locked. A fixed supply (`maxSupply > 0`) starts paused until slots exist and you `ResumeMint`. `maxSupply` 0 is an open edition.
6. Cover and item images must pass `validImage`: `http://` or `https://`, or `/samples/…`, at most 200 characters. The chain rejects `ipfs://`. For IPFS art, store `https://gateway.pinata.cloud/ipfs/<cid>`. Leave out `ipfs.io`, `dweb.link`, `w3s.link`, and `nftstorage.link`.
7. Holders connect Adena on Bazaar, open **Sell**, and `List(id, priceUgnot)` with price > 0. Escrow is your realm: `OwnerOf` becomes the collection package. `UpdatePrice` and `Cancel` stay with the seller. `Transfer` / `TransferFrom` while listed panics.
8. Buyers call `Buy(id)` with `OriginSend` equal to the list price. The seller account cannot buy that listing.

## Fees on Buy

Read these getters on the factory before you publish a fee table. Mainnet read on 2026-10-05:

| Getter | Value |
| --- | --- |
| `ProtocolBps()` | 200 (2% of the price). Admin `SetProtocolBps` accepts 0–500. |
| `LaunchFee()` | 1000 GNOT |
| `GenesisShareBps()` | 1100, meaning 11% of the protocol fee |
| `GenesisPkg()` | `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/perk2` |

`Buy` uses `max(0, ProtocolBps − max(HolderDiscount(seller), HolderDiscount(buyer)))`. `HolderDiscount` is the best Bazaar Gens tier that wallet has recorded on the factory. The collection does not set it.

Royalty is `RoyaltyBps` from `Init`, 0–1000 (0–10% of the price), paid to the collection creator. `SetRoyalty` works only while `Minted()` is 0.

The protocol fee splits again: `GenesisShareBps` of it goes to `GenesisSink`, and the remainder goes to `ProtocolSink`. Primary `PublicMint` pays the exact mint price and takes 0 protocol fee. That GNOT goes to the creator.

## What does not work

| Ask | Why |
| --- | --- |
| List a Gnomies NFT or any third-party token whose realm is not this `col` book | Gno has no dynamic `TransferFrom` of a foreign package |
| Pull an ERC-721 from another chain | Different VM |
| Appear on Explore with only a `g1` and no `Register` | Explore reads factory `ListCollections`, then that pkg's `ListOpen` |

## Factory (Explore)

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

`Register` runs from the collection `Init` after `Reserve`. An `addpkg` that never calls this factory can still `List` / `Buy` when Settings on the site points at that pkg path. The default Explore list is this factory.

## Adena

Chain id is `gnoland-1`. Add the collection pkg path as the collectable. The factory path and a GRC721 library path are not the collectable. Listed tokens sit in escrow at the realm address, so `TokensOf` omits them until `Cancel` or `Buy`. qeval names are in [adena-collectables.md](adena-collectables.md).

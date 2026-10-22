# GRC1155 editions for Nomaq

Read on 2026-10-15. Local packages landed on 2026-10-20 under `gno.land/p/bazaar/grc1155/v0`, `gno.land/r/bazaar/efactory`, and `gno.land/r/bazaar/edcol`. `gno test` passes on those three.

An Onyx trial was `addpkg`'d the same day on `onyx-1` only, under the deployer namespace:

| Path | Role |
| --- | --- |
| `gno.land/p/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/grc1155/v0` | edition ledger |
| `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/efactory` | edition factory. `LaunchFee` 0. `ProtocolBps` 200 |
| `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/edcol` | collection Prints / PRINT, royalty 500 bps, realm `g1lrvflprf36q2g2w3cxzssk9v0xy6fs79swj3tl` |

The seed is one edition, id `print`, name Trial Print, cap 20, mint price 1 GNOT. The deployer minted 4 and listed 2 at 2 GNOT. `fee/v1` was already live and was not added again. `bazaarv5` `LaunchFee` stayed `10000000` ugnot. `bazaargens` and `perk2` were not called. Nothing here is on gnoland-1.

The local Onyx dev server reads that realm at `#/editions`. A mainnet bundle does not link to the page.

## ERC-1155, in one page

One contract holds many token ids. Each id has a balance per address, so copies of one artwork share an id. A unique NFT is the same shape with amount 1.

The Ethereum rules that matter here:

- `balanceOf(owner, id)` and `balanceOfBatch`.
- `setApprovalForAll(operator, approved)`. There is no per-id `approve`.
- `safeTransferFrom` / `safeBatchTransferFrom` move an amount. The caller must be the owner or an operator.
- Mint and burn are transfers from or to the zero address.
- If the recipient is a contract, the token calls `onERC1155Received` (or the batch hook) and reverts unless the magic value comes back. That is what “safe” means.
- `uri(id)` is often one template string with `{id}`.
- `TransferSingle` / `TransferBatch` must be emitted, including mint and burn.

## What gno.land actually has

`vm/qfile` on `https://rpc.gno.land` (2026-10-15):

| Path | Result |
| --- | --- |
| `gno.land/p/nt/grc721/v0` | present (the library Adena indexes) |
| `gno.land/p/nt/grc1155` | `InvalidPackageError` |
| `gno.land/p/demo/tokens/grc1155` | `InvalidPackageError` |
| `gno.land/p/demo/grc/grc1155` | `InvalidPackageError` |
| `gno.land/r/demo/foo1155` | `InvalidPackageError` |
| `gno.land/p/akkadia/beta/grc1155` | present |

The old demo package exists in the test5 genesis file in gnolang/gno (`gno.land/p/demo/grc/grc1155`). It is not on gnoland-1. `foo1155` is not on gnoland-1 either.

`p/akkadia/beta/grc1155` is a pure package, not a genesis `p/nt` standard. Its interface is `BalanceOf`, `BalanceOfBatch`, `SetApprovalForAll`, `IsApprovedForAll`, `SafeTransferFrom`, `SafeBatchTransferFrom`. Amounts are `int64`. Token ids are strings. It also has `SafeMint`, `SafeBatchMint`, `Burn`, `BatchBurn`.

Three gaps make it the wrong import for Nomaq:

1. `doSafeTransferAcceptanceCheck` and the batch twin are `return true` with a TODO. The comment says contract recipients are checked. They are not.
2. `emit` in `util.gno` is empty. `TransferSingle` never reaches the chain log. Adena and the indexer cannot see a transfer.
3. `caller` is an ordinary argument. A realm that imports the package can pass any address. Auth has to sit in the realm, on `cur.Previous()`, the way `p/nt/grc721/v0` binds the ledger to the creating realm.

`onbloc/gno-token-resource` is GRC20 (plus native GNOT). It has no GRC1155 row. Adena’s collectable grid keys off `NewToken` / `Transfer` from `p/nt/grc721/v0`, with `OwnerOf(tid string) (address, error)`. A 1155 balance will not show there.

Gno also has no `code size` bit on an address. The Ethereum receiver hook does not port. A realm address and a user address are both `g1` addresses. A later call can only hit a realm whose path the caller already imports.

## What Nomaq does today

One collection is one realm. It imports `p/nt/grc721/v0`, mints unique ids, and `List` moves that id onto the realm address until `Cancel` or `Buy`. `bazaarv5` only `Register`s realms written that way. It cannot `TransferFrom` a foreign GRC721 or a foreign GRC1155. `perk2` weight is per minted Bazaar Gens id (25–150). An unminted id panics. A listed id has weight 0.

An edition of 1,000 copies does not fit that book. Minting 1,000 GRC721 ids copies the art and the perk slot 1,000 times. A balance of 1,000 on one id does not.

## Three directions

**A. New edition realm, own ledger.** Recommended.

Add `gno.land/p/bazaar/grc1155/v0` in this repo and a new collection realm that stores the ledger. Do not import `p/akkadia/beta/grc1155`. One token id is one edition. `List` escrows an amount onto the realm address, same custody idea as today’s `List`, with a quantity. `Buy` can fill part of that amount. Metadata is per id (`data:application/json`), images stay on `https://gateway.pinata.cloud/ipfs/<cid>`.

The realm checks the caller. The library does not trust a caller argument. Missing permission, a short balance, a zero amount, or an unknown id panics. `int64` amounts use `math/overflow` and panic. Events go out through the chain event API, with names of our own. Adena will not index them until Onbloc does.

Register editions on a new factory path. Leave `bazaarv5` and Bazaar Gens on GRC721. `perk2` stays unique-id weight. An edition does not join that pool unless a later vote says so.

Nomaq’s own pages are the gallery. Profile reads `BalanceOf` from the edition realm. Adena’s NFT grid stays empty for these ids.

**B. Keep editions as many GRC721.**

Same art, many token ids, current `col` and Adena grid. No new standard. Cost is one id per copy, and each id is a separate `perk2` weight if it is Bazaar Gens. Fine for dozens of copies. Poor for a print run.

**C. Import the Akkadia package.**

The acceptance check is a stub, transfers emit nothing, and `caller` is spoofable at the library boundary. Skip it.

## Onyx trial, not mainnet

The gallery slice is the local `#/editions` page. It reads `Name`, `Editions`, `OpenListings`, `BalanceOf`, and `efactory.ListEditions`, then signs `Mint`, `List`, `Cancel`, `Buy`, and `Transfer` with Adena. Events are `EditionTransfer`, so Adena’s collectable grid still stays empty. There is no receiver hook. A secondary fee split is proven in `gno test` for the unit-test numbers (price 1_000_000, protocol 20_000, royalty 50_000, seller 930_000), and the Onyx listing itself has not been bought. `bazaarv5`, `bazaargens`, and `perk2` were not edited.

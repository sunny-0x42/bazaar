# How a project launches or lists on Bazaar

Gno cannot `TransferFrom` an unknown GRC721 at runtime. Listing is not “paste a contract address”.

Chain is mainnet `gnoland-1`. Site: https://bazaar.gnomi.fun. New collections register on `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`.

## Path A — Launch a Bazaar collection

1. Copy [`gno.land/r/bazaar/col`](../gno.land/r/bazaar/col/) and apply the retarget in [listing-external.md](listing-external.md). The committed `book.gno` still hardcodes 50 bps.
2. `addpkg` under your namespace. Adena cannot `addpkg`. Slug is the last path element: `[a-z][a-z0-9]{1,10}`.
3. `Reserve(slug)` on `bazaarv5` with `LaunchFee()` (1000 GNOT for a normal account). Then `Init` on the collection with an empty send. `Register` runs inside `Init`.
4. Collectors `PublicMint` paying the exact mint price. Primary protocol fee is 0.
5. Holders `List(id, priceUgnot)`. Buyers `Buy(id)`. The protocol fee is `bazaarv5` `ProtocolBps()` (200) minus holder discount. Royalty is 0–10%. Eleven percent of the protocol fee goes to `perk2`.

## Path B — List an item you already own here

If `OwnerOf` is your account and the item is not listed: `List`. UI: Sell.

## Path C — NFT from another realm

A foreign GRC721 cannot be pulled in. See [listing-external.md](listing-external.md).

## Eligibility

- Slug unique, `[a-z][a-z0-9]{1,10}` (2–11 characters, no hyphen).
- List price > 0. The seller cannot buy their own listing.
- `TransferFrom` while listed panics.

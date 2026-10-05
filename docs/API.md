# Bazaar API

Default product: one collection realm registered on **bazaarv5**. Hub `GetModule("nft")` is not used on the production UI.

Live factory: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

Site: https://bazaar.gnomi.fun

Collection reads: `ListOpen`, `ItemLine`, `Name`, `Symbol`, `OwnerOf("1")` as `(address, error)`, `TokenURI("1")`, `TokensOf`. Writes: `List`, `Buy`, `Cancel`, `Transfer`, `PublicMint`, `Mint`.

`Buy` fee, read from the factory on 2026-10-05: `ProtocolBps()` is 200, minus the higher `HolderDiscount` of seller or buyer, floored at 0. Royalty is `RoyaltyBps` of the price, to the creator. Of the protocol fee, 11% (`GenesisShareBps()` 1100) goes to `perk2`. The rest goes to `ProtocolSink()`. The seller receives `price − protocol − royalty`.

## UI flow

1. Connect Adena on mainnet (`gnoland-1`).
2. Launch: `addpkg` a retargeted `col`, `Reserve` on bazaarv5, `Init` with an empty send. Collectors `PublicMint`.
3. Sell calls `List` (escrow). Buy sends the exact list price.
4. The seller may `Cancel` while the id is listed.

Hub `SetModule` and the GRC20 `market` book are legacy. See [STANDARDS.md](STANDARDS.md).

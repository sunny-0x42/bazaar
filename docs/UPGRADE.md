# Upgrades

A package already on gno.land cannot be overwritten. The next factory is a new path. The live registry is `bazaarv5`.

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

Live behavior: `Reserve` then `Init` with an empty send, `CancelReserve` returns the locked ugnot, `Withdraw` leaves open reserves, `ProtocolBps()` 200, holder discount, and 11% of the protocol fee to `perk2`.

These stay on chain and are not the registry for a new collection: `bazaarv1`, `bazaarv2`, `bazaarv3`, `bazaarv4`, `…/factory`, and Pearl nftv7 / factoryv3.

The public UI is https://bazaar.gnomi.fun. It reads bazaarv5 and still merges rows from bazaarv2, bazaarv1, and `factory`. There is no collection Pool tab.

Copy `col` and retarget it before `addpkg`. See [listing-external.md](listing-external.md). `tools/mainnet-launch-col.ps1` still points at an older factory. Human yes before any mainnet `addpkg`.

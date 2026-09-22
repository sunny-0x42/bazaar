# List on Bazaar without using Launch

For creators who **already mint elsewhere** (own Gno realm) but want **secondary listings** on [Bazaar](https://bazaar-gno.vercel.app).

## What Gno allows

Bazaar cannot `TransferFrom` an **unknown** package at runtime. Explore only shows collections whose **own realm** implements list/buy (the `col` book). There is no “import any GRC721 address” like an EVM marketplace pulling an arbitrary ERC-721.

So you do **not** point Bazaar at a random NFT contract. You deploy a **Bazaar-compatible collection realm** (or wait for a future push-listing standard).

## Path that works today

1. Copy `gno.land/r/bazaar/col` (GRC721 + `List` / `Buy` / `TokenURI`).
2. `addpkg` under **your** namespace, last path element = package name, e.g. `gno.land/r/<your-g1>/mycol`.
3. Call `Init` (name, symbol, cover, maxSupply, mintPrice, royaltyBps). Pay factory `LaunchFee` **or** `Reserve` on factoryv3 then Init with empty send if you want the collection on Explore.
4. Holders (or you) connect Adena on Bazaar → **Sell** → `List` at a GNOT price. Escrow is **your** realm.
5. Buyers pay exact ugnot on `Buy`. 50 bps protocol + your royalty (0–10%).

You never have to use the Bazaar Launch wizard if you `addpkg` + `Init` yourself.

## What does not work

| Ask | Why |
| --- | --- |
| List a Gnomies / third-party NFT that is not a Bazaar `col` | Gno has no dynamic `TransferFrom` of a foreign pkg |
| Pull ERC-721 from another chain | Different VM |
| Appear on Explore with only a `g1` and no `List`/`Buy` on that pkg | Explore reads factory `ListCollections` + that pkg’s `ListOpen` |

## Factory (optional Explore)

To show on Bazaar Explore, register with:

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/factoryv3`

`Register` is called **from the collection realm** during `Init` after the launch fee is credited or reserved. Independent `addpkg` without factory still allows list/buy on that pkg if the UI is pointed at the pkg path (Settings), but the default Explore is factory-fed.

## Adena

See [adena-collectables.md](adena-collectables.md). Holders add **your** pkg path as a collectable. Listed tokens are in escrow (realm owner), not in the wallet gallery.

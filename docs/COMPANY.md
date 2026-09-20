# Bazaar — company facts

Do not invent numbers. If a fact is not here or on-chain, look it up.

- Company: **Bazaar** (agents `bazaar-*`)
- Repo: `C:\Users\Hi\gno-bazaar`
- Product: **NFT marketplace + launchpad**. Drops: `CreateDrop` / `PublicMint` (primary, 0 protocol fee). Secondary: `List` / `Buy` / `Cancel` (50 bps). GRC20 `market` is legacy.
- NFT realm: `gno.land/r/bazaar/nft` — one id, one image URL, one GNOT price. Pearl has no `grc721`; Bazaar ships its own items (not Gnomies).
- Protocol fee: 50 bps of the ugnot price (`p/bazaar/fee/v1`)
- Chain: Pearl (`pearl-1`) for any later testnet deploy
- Wallet: Adena
- Units: `ugnot` on-chain; UI GNOT = 1_000_000 ugnot
- Not: DEX (Zdex / GnoSwap), launchpad (gnomi.fun), vault, NFT collection (Gnomies), money market (Lend)
- Pearl 2026-09-19: `p/demo/tokens/grc20` and `r/demo/defi/grc20reg` exist; **no** `p/demo/tokens/grc721`
- Isolation: never edit occupied-company repos

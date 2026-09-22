# Bazaar

Fixed-price **NFT marketplace and collection launchpad** on [gno.land](https://gno.land). Launch a drop, mint in GNOT, then list and buy on the secondary book.

This is not a DEX, not gnomi.fun, and not the Gnomies collection.

**Pearl testnet.** Coins have no market value. Nothing here is investment advice.

## Product

| | |
| --- | --- |
| Primary mint | 0% protocol fee — GNOT goes to the creator |
| Create collection | Platform fee (`LaunchFee`, default 1000 GNOT; admin can change) |
| Secondary buy / sweep / offer | **50 bps** (0.50%) of the GNOT price |
| Wallet | [Adena](https://adena.app) |
| Chain | Pearl (`pearl-1`) |
| Units | 1 GNOT = 1,000,000 `ugnot` |

Live site: https://bazaar-gno.vercel.app

Pearl factory (one collection = one realm):

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/factoryv3`

Faucet: https://pearl.testnets.gno.land/faucet

- [Guide](https://bazaar-gno.vercel.app/#/guide)
- [List without Launch](docs/listing-external.md)
- [Collection realm sample (own mint site)](docs/col-realm.md)
- [Adena collectables](docs/adena-collectables.md)

## Layout

| Path | Role |
| --- | --- |
| `gno.land/p/bazaar/fee/v1` | Overflow-safe protocol fee |
| `gno.land/r/bazaar` | Hub (`SetModule` upgrades) |
| `gno.land/r/bazaar/nft` | Legacy slug book (nftv7 on Pearl) |
| `gno.land/r/bazaar/factory` | Collection registry |
| `gno.land/r/bazaar/col` | Collection realm template |
| `web/` | English Vite UI |

## Local UI

```bash
cd web
npm install
npm run dev
```

Open http://127.0.0.1:5176

```bash
cd web
npm test
npm run build
```

Realm tests (needs [gno](https://github.com/gnolang/gno)):

```bash
gno test ./gno.land/p/bazaar/fee/v1/
gno test ./gno.land/r/bazaar/nft/
```

## Deploy on Vercel

1. Push this repo to GitHub.
2. [Import](https://vercel.com/new) the repo in Vercel. Project name: **bazaar**.
3. Root Directory: leave as repo root (this `vercel.json` builds `web/`).
4. Framework: Other / Vite. Build command and output are already set.
5. Deploy. The app uses hash routes (`#/explore`), so no extra SPA rewrite is required.

No secrets are required for a public read/trade UI. Adena signs in the browser.

## Networks

- Local: `gno test` / `gnodev`
- Public testnet: **Pearl**
- Mainnet is out of scope for this UI

## License

MIT. See [LICENSE](LICENSE).

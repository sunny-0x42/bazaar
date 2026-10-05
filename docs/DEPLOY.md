# Deploy

## Production (mainnet)

UI: https://bazaar.gnomi.fun on Netlify. Chain `gnoland-1`. New collections register on factory **bazaarv5**.

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

A new collection is a copy of `gno.land/r/bazaar/col` after the retarget in [listing-external.md](listing-external.md). Then `Reserve` (`LaunchFee()` is 1000 GNOT for a normal account) and `Init` with an empty send. Adena cannot `addpkg`.

`tools/mainnet-launch-col.ps1` still targets an older factory path. Do not run it for a new collection.

Do not `addpkg` over `bazaarv5`, `perk2`, `perk`, or an existing collection package. Packages on gno.land cannot be overwritten in place.

The public site is built from `web/` and published as the Netlify site `bazaar-gnomi`. https://bazaar-gno.vercel.app is an older host.

[mainnet-deploy.md](mainnet-deploy.md) is an older operator note. It still names factories before bazaarv5. Use this file and [FACTORY.md](FACTORY.md) for the live path.

## Local

`.\start-gnodev.ps1` then `cd web; npm run dev`. Nested workspace `dev/ws`. Dedicated gnodev home `%AppData%\Roaming\gno-bazaar`.

## Pearl

Pearl nftv7 and factoryv3 stay on Pearl. The public UI does not switch to Pearl.

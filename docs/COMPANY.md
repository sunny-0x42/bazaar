# Bazaar — company facts

Do not invent numbers. If a fact is not here or on-chain, look it up.

- Company: **Bazaar** (agents `bazaar-*`)
- Repo: `C:\Users\Hi\gno-bazaar`. Public protocol: https://github.com/sunny-0x42/bazaar
- Product: NFT marketplace and launchpad on gno.land mainnet (`gnoland-1`)
- Site: https://bazaar.gnomi.fun
- Factory: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`
- Genesis share: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/perk2` (11% of the protocol fee)
- Create fee: `LaunchFee()` **1000 GNOT** (`SetLaunchFee`). Secondary protocol: **200 bps** before `HolderDiscount` (`SetProtocolBps`, cap 500). Primary mint: 0 protocol.
- Template: `gno.land/r/bazaar/col`. The committed sample still has the 50 bps book. Live collections use genesis `p/nt/grc721`, `OwnerOf(tid string) (address, error)`, and List/Buy escrow.
- Wallet: Adena on mainnet
- Units: `ugnot` on chain. UI GNOT = 1,000,000 ugnot
- Separate products: Zdex (AMM), gnomi.fun (bonding curve), Gnomies, Lend
- Isolation: never edit those repos from a Bazaar task
- Pearl nftv7 / factoryv3 stay on Pearl and are not this site

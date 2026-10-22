# Bazaar Gens (deploy later)

Do **not** addpkg until the founder says yes. Whitelist storage is **off-chain**.

## Whitelist (UI live, file list)

- Collection supply: **1111** Bazaar Gens NFTs (Common 666, Uncommon 222, Rare 111, Epic 66, Legendary 33, Mythic 13).
- Page: `#/genesis` — 333 whitelist slots, FCFS.
- Opens **28 September 2026, 00:00 UTC** (unix `1790553600`). UI shows UTC only.
- Submit: typed X handle (`@` or x.com URL, 1–32 `[A-Za-z0-9_]`) plus connected Adena `g1` (read-only). Wallet is not typed. No realm `Register`.
- Local Vite writes `web/.data/whitelist.json` via `POST /local/wlist` (gitignored).
- Admin Studio → **Whitelist**: table plus Download CSV / JSON.
- `gno.land/r/bazaar/wlist` source stays in the repo and is **not** used by the UI.

## Collection perk (source, not deployed)

- Realm: `gno.land/r/bazaar/genesis` — `MaxSupply()` = **1111**. Per-rarity caps: 666 / 222 / 111 / 66 / 33 / 13. `Mint` panics `genesis: sold out` at 1111 or `genesis: rarity full` when that rarity is used up.
- Holders get a **protocol discount on every Bazaar `Buy`** (new `col` copies only).
- **Every rarity** has a `FeeDiscount` (Common included). Discounts **do not stack** on a Buy: `HolderDiscount` = **highest** `FeeDiscount` in that wallet.
- Defaults (bps, cap 150): common 25, uncommon 50, rare 75, epic 100, legendary 125, mythic 150. Protocol after: 1.75% → 0.50%.
- Buyer still pays the listed price; reduced protocol stays with the seller.
- **Every Bazaar Gens NFT** also shares an **11% pool** of protocol GNOT from secondary Buys after `FeeDiscount`. New `col` does not import the Bazaar Gens realm. Factory `AttachGenesis` on Bazaar Gens `Init` (deploy wallet) or admin `SetGenesis(pkg)`. Until attached, discount = 0 and 100% protocol goes to `ProtocolSink`. After attach, `col.Buy` sends 11% to `GenesisSink`. `ShareWeight` is for later Claim.

Deploy order: new factory Init → collections from this `col` (work without Bazaar Gens) → Bazaar Gens addpkg later (`Init` auto-attaches). Live bazaarv2 stays.

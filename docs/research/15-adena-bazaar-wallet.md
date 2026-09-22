# Adena × Bazaar: showing collection NFTs in the wallet

Adena (Onbloc) is the Gno browser wallet. Docs: NFTs / Manage Collectables / Send NFT. Token logos today come from `onbloc/gno-token-resource` (**GRC20**, not GRC721). FAQ still lists GRC-721 as upcoming; the wallet README already claims View & Transfer NFTs. Cooperation does **not** require copying Adena GPL — Bazaar publishes a qeval/MsgCall surface; Adena (or any wallet) calls it.

## What a wallet must do (same as ERC-721 gallery)

1. Know the **collection** (pkg path + derived `g1`).
2. List **token ids** the user owns.
3. Fetch **metadata** (`tokenURI` → JSON `name` / `image` / `attributes`).
4. Optionally **transfer** (`TransferFrom`).

Bazaar factoryv3 collections (`…/bazaar/c/{slug}`, e.g. reef) are one realm = one collection. That is the unit Adena should treat as one collectable, like one ERC-721 contract.

## What Bazaar already exposes (reef-class `col`)

| Wallet need | Bazaar qeval / MsgCall today | ERC-721 analogue |
|---|---|---|
| Collection name | `GrcName()` | `name()` |
| Symbol | `GrcSymbol()` | `symbol()` |
| Balance | `GrcBalanceOf("g1…")` int64 | `balanceOf(address)` |
| Owner | `GrcOwnerOf(id)` / `OwnerOf(id)` | `ownerOf(uint256)` |
| Ids owned | `TokensOf(addr)` csv | `tokenOfOwnerByIndex` |
| Metadata | `TokenURI(id)` JSON `data:application/json,…` (mist/reef) | `tokenURI` |
| Transfer | `TransferFrom(from,to,id)` if **not listed** | `transferFrom` |
| Registry | factoryv2/v3 `ListCollections()` | factory `getCollections` |

Adena **DoContract** already signs Bazaar `MsgCall` (Connect / Init / PublicMint). Display is the missing half: **qeval**, not a new signer.

## Gaps (why Add collectable may still be empty)

1. **Names:** wallet likely looks for `Name()` / `Symbol()` / `BalanceOf` / `OwnerOf` / `TokenURI`. We export `GrcName` / `GrcBalanceOf` (string args). Aliases `Name()` `Symbol()` `BalanceOf(addr)` `OwnerOf` matching GRC721 demo would cut adapter work.
2. **Discovery:** Adena will not scan every `…/c/{slug}`. Need a **registry** (`ListCollections`) or user paste of pkg path (Manage Collectables).
3. **Listed items:** escrow owner = **realm**, so `TokensOf(user)` omits listed NFTs. Wallet shows 0 while Bazaar Profile shows “listed”. Spec must say: listed = not in wallet gallery, or expose `TokensOfListed`.
4. **Images:** JSON `image` is often `/samples/…` (relative). Wallets need `https://bazaar-gno.vercel.app/samples/…` or `ipfs://`.
5. **Foam** TokenURI is still a bare image URL; **mist/reef** are JSON. Wallet should accept both.
6. **Events:** GRC721 emits `Transfer`; indexer (GnoScan / Adena backend) can subscribe. No Adena indexer for Bazaar pkgs today.
7. **gno-token-resource** is GRC20-only. A GRC721 list (pkg path, name, symbol, logo) would be the Onbloc-shaped catalog.

## Cooperation paths (ranked)

### A — Spec + aliases (shipped on `col` template)

`Name()` / `Symbol()` / `BalanceOf(addr)` alias `GrcName` / `GrcSymbol` / `GrcBalanceOf`. `TokenURI` JSON `image` is `https://bazaar-gno.vercel.app` + relative `/samples/…`. Live **reef/mist/foam** were addpkg’d before this; next `pearl-new-col` gets aliases. Copy pkg into Adena Manage Collectables.

### B — Registry Adena reads

Adena (or a small indexer) polls `factoryv3.ListCollections()` (+ v2) → for each `pkg`, `TokensOf(user)` + `TokenURI(id)`. Auto-gallery without paste. **M.** Needs Adena (or GnoScan) to hardcode/allow the factory pkg.

### C — Wallet_watchAsset analogue

Bazaar UI after mint: `window.adena.AddCollectable({ pkg_path, chain_id: "pearl-1" })` if Adena ships that RPC. Until then, copy path + instructions. **S on Bazaar, blocked on Adena.**

### D — Token list PR

PR to `onbloc/gno-token-resource` **if** they add a GRC721 schema. Same channel GRC20 logos use. **S–M**, Onbloc process.

### E — Do not

Ask Adena to import `p/nt/grc721` only — Bazaar tokens live in **collection realms**, not the lib. Asking them to parse nftv7 slugs as many collections fights the factory model.

## Recommend for a first Adena talk

Bring **one live pkg** (`…/c/reef` or mist), the qeval table above, a `TokenURI(1)` JSON sample, and factory `ListCollections`. Ask them to: (1) Add collectable by pkg path, (2) qeval `TokensOf` + `TokenURI`, (3) Send via `TransferFrom` if unlisted. Bazaar side first: aliases + absolute image URLs in JSON.

# Factory: own realm + unique g1 per collection (2026-09-22)

Notes only. Not investment advice. Not a Pearl addpkg. Not a tweet.

Question: how Bazaar launchpad gives each collection its **own realm/package** and a **unique g1**, with creator-set royalty, given Gno cannot `MsgAddPackage` from inside a realm.

## Verdict — one ship path

**Operator `addpkg` of the frozen `col` template to `…/bazaar/c/{slug}`, then creator Adena `Init` (royalty 0–10% in that call; `SetRoyalty` only while `minted==0`).**

That is the only way, on current Gno, to get a real package path, a unique `g1`, importable crossing functions, and Adena “Add collectable” on the collection itself.

- **Not** nftv7 slug-in-one-realm (live book; no per-collection address).
- **Not** `realm.Sub(subpath)` (unique g1 for coins/identity; not a package).
- **Not** factory-emitted `MsgAddPackage` (impossible).
- **Not** creator Adena `/vm.m_addpkg` into the Bazaar namespace (namespace is the deployer `g1`; Bazaar UI only sends `/vm.m_call`).

Pearl factory is already this path. Local factory/col already implement it. Next product work is **Init existing instances + UI pointing at factory**, not a new primitive.

## Facts verified

### Realm address = `chain.PackageAddress(pkgPath)`

[gno-packages](https://docs.gno.land/resources/gno-packages/): a package path is unique on chain; **a realm’s address is derived from that path** via [`chain.PackageAddress`](https://docs.gno.land/resources/gno-stdlibs#packageaddress). Different path → different `g1`. Same path always hashes to the same `g1`.

[Working with realms](https://docs.gno.land/resources/realms/): a realm is identified by its package path and is addressable as `g1…`. Realms send/receive coins at that address.

gnolang/gno `docs/resources/gno-interrealm.md`: `chain.PackageAddress("gno.land/r/name123/realm")` is bech32 from hash(path). Interrealm `cur.Address()` is that derived address.

Live check (gnomcp `pearl`, 2026-09-22): factory `Address()` = `g1qhmldlt8l2kd29lxrgn27var992nnmygv2f04n` = `PackageAddress("gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/factory")`. Local factory stores `pkgPath` and returns `chain.PackageAddress(pkgPath)` (`gno.land/r/bazaar/factory/factory.gno`). Collection `self = cur.Address()` at `Init`. Factory `CollectionAddr(slug)` is `PackageAddress(c.pkg)` (local tree; not on Pearl factory yet).

### Last path element = package name `[a-z][a-z0-9_]+` (no hyphen)

[gno-packages](https://docs.gno.land/resources/gno-packages/): **package name in source must match the last path element.** Names are `[a-z][a-z0-9_]+` (letter first, ≥2 chars). Hyphens allowed in *intermediate* segments, **not** the last element. Path max 256 chars.

Bazaar slug is tighter than Gno: `[a-z][a-z0-9]{1,10}` (2–11 chars, **no underscore, no hyphen**) so it also fits GRC721 `MaxSymbolLen=11`. `tools/pearl-new-col.ps1` and `col.validPkgName` enforce this. `package col` is rewritten to `package {slug}` on copy.

### Cannot `MsgAddPackage` from a realm

Tx entry points are SDK messages ([interrealm](https://docs.gno.land/resources/gno-interrealm-v2), skill `interrealm.md`): `MsgCall`, `MsgRun`, `MsgAddPackage`. A realm body can **cross-call** another realm. It cannot construct or broadcast another tx type. `chain` stdlib has `PackageAddress` / `Emit` / coins — **no** `AddPackage`.

`MsgAddPackage` runs the new package’s `init()` with `PreviousRealm()` = deployer EOA and `CurrentRealm()` = the new realm. After that, only `MsgCall` into crossing functions.

So a factory `Launch(slug)` **cannot** spawn `…/c/{slug}`. Someone with namespace rights must `addpkg` first. Then `Init` is a `MsgCall`.

### Adena `DoContract` in Bazaar is `MsgCall`

Adena protocol *can* send `/vm.m_addpkg` ([Adena DoContract](https://docs.adena.app/integrations/transactions/sign-and-send-a-transaction)). Bazaar does not. `web/src/lib/wallets.ts` builds only `{ type: "/vm.m_call", value: { pkg_path, func, args, send } }`.

Even if the UI grew an addpkg flow: Pearl namespace `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/…` is authorized for that `g1` only ([users-and-teams](https://docs.gno.land/resources/users-and-teams), [sys/names](https://docs.gno.land/resources/users-and-teams)). Creators cannot `addpkg` into Bazaar’s path. Operator gnokey (`tools/pearl-new-col.ps1`) must.

### Pearl live (gnomcp `pearl`, 2026-09-22)

| Path | Role | State |
| --- | --- | --- |
| `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/factory` | registry + launch fee | live. `LaunchFee()` = `10000000` (10 GNOT). `Admin()` = deployer `g1n4pl5…`. `ListCollections()` empty. Outline has `Register` / `NoteMinted` / `CollectionOf` — **no** `CollectionAddr` / `RoyaltyOf` / `NoteRoyalty` (older than local). |
| `…/bazaar/c/wave` | template instance (`package wave`) | addpkg’d. `Render("")` = “Call Init first.” Crossing surface matches local `col` minus `SetRoyalty`. |
| `…/bazaar/nftv7` | live **book** | slug-in-one-realm. `LaunchCollection` / `CreateDrop` = `MsgCall` on nftv7. Each drop is a GRC721 `Token` + AVL row **inside nftv7**. One g1 for every collection. Adena collectable = nftv7 path. |
| `…/bazaar/nft` … `nftv6` | frozen | ignore for new launches. |

Tools: `tools/pearl-addpkg-factory.ps1` (factory), `tools/pearl-new-col.ps1 -Slug <slug>` then Adena `Init` on `…/bazaar/c/{slug}`. Local: `tools/local-new-col.ps1` / UI `POST /local/new-col`.

### `col.Init` already takes royalty 0–10%

```
Init(cur, name, symbol, cover, maxSupply, mintPriceUgnot, royalty)
```

`royalty` 0–`maxRoyaltyBps` (1000 = 10%). Repeat `Init` panics (`col: already initialized`). `Buy` (`col/book.gno`): `ProtocolFee(price, 50)` → factory; `ProtocolFee(price, royaltyBps)` → creator; rest → seller. Primary `PublicMint`: 0 protocol, 100% mint price to creator. Fail-closed: `IsUserCall`, exact ugnot, extra denoms panic.

Local tree also has `SetRoyalty(cur, bps)`: creator, `minted==0`, same cap, `factory.NoteRoyalty`. Tests: happy + wrong caller + not `IsUserCall` + invalid bps + after mint. Pearl `wave` / factory outlines **do not** export `SetRoyalty` / `NoteRoyalty` yet.

## Contrast: Sub-identity vs addpkg real package

`realm.Sub(subpath)` exists in **gnolang/gno master** (uverse; release notes: “sub-realm identities via realm.Sub”, #5890). It is **not** documented on [docs.gno.land stdlibs `realm`](https://docs.gno.land/resources/gno-stdlibs) (no `Sub` method listed).

What Sub is (gnolang/gno `gnovm/pkg/gnolang/uverse.go` + `gnovm/stdlibs/chain/address.gno`):

- Mints an identity token whose synthesized pkgpath is `host#subpath`.
- `#` is reserved in real package paths (`ValidateMemPackageAny`), so no addpkg can collide.
- Address = `chain.PackageAddress(host + "#" + subpath)` = `chain.DerivePkgSubAddr(host, subpath)`. Unique g1. Other realms can compute it without calling the host.
- Subpath rules: `/`-separated segments `[a-z0-9]([a-z0-9_.-]*[a-z0-9])?`. Empty / `..` / nested `#` panic. Synthesized path ≤ 256 bytes.
- `SplitPkgSubPath` splits on `#`. Local GRC721 copies this as `splitPkgSubPath` because Pearl/local `gno develop` historically lacked the stdlib export (`docs/research/13-grc721-pearl.md`).

What Sub is **not**:

| Need | `realm.Sub` | addpkg `…/c/{slug}` |
| --- | --- | --- |
| Own package / `package {slug}` | no | yes |
| Own persistent storage | no (host storage) | yes (PkgID = collection realm) |
| Unique g1 (coins) | yes (`host#slug`) | yes (`PackageAddress(path)`) |
| `MsgCall` target / Adena collectable | host only | collection pkg |
| Other realms `import` the collection | **no** — `#` is not a package | yes (`import "…/c/wave"`) |
| Factory does not import instances | n/a | already true (`docs/FACTORY.md`) |
| Creator action | still `MsgCall` on host | `MsgCall Init` after operator addpkg |
| Who deploys code | host already deployed | operator `addpkg` per slug |

Sub is enough for **a coin pocket or GRC721 `RealmSubTeller` actor** inside one host. It is **not** enough for creator utilities that import the collection, for Adena “Add collectable” on a collection path, or for “this drop is its own realm.” nftv7 is already that product shape (slug in one realm, shared g1). Shipping Sub on nftv7 would not deliver own-realm.

GRC721 `RealmSubTeller` in this repo does **not** use `cur.Sub`. It does `chain.PackageAddress(addr.String() + "/" + slug)` (`accountSlugAddr`) — a different derivation, not `host#subpath`. Do not mix the two.

**Decide: Sub is not the Bazaar collection identity. Own realm = real addpkg.**

## Why nftv7 cannot be the own-realm pad

`LaunchCollection` / `CreateDrop` on nftv7 is one `MsgCall`. Cheap. Adena works today. Collections share:

- nftv7 package path
- nftv7 g1 (escrow, fees, GRC721 home)
- nftv7 storage / upgrade fate

Adena collectable = nftv7, not the drop. Foreign realms cannot import `…/nftv7` as “the kelp collection.” That is the in-realm factory. Keep nftv7 as the **live secondary book** until collections on `…/c/{slug}` hold listings. Do not pretend nftv7 slugs have their own address.

## Ship path (the only one)

```
operator:  addpkg  gno.land/r/<deployer>/bazaar/c/{slug}
           (copy col template; package {slug}; rewrite factory/grc721/fee imports)
creator:   Adena MsgCall  {slug}.Init(name, symbol, cover, maxSupply, mintPrice, royaltyBps)
           OriginSend == factory.LaunchFee()   extra denoms panic
collection: takeLaunchFee → factory.Address()
            factory.CreditLaunchFee + Register
            self = cur.Address() = PackageAddress(this pkg)
            royaltyBps locked from Init (optional SetRoyalty while minted==0)
collectors: MsgCall PublicMint / List / Buy on the collection pkg
Adena Add collectable: the collection pkg path, not factory, not nftv7
```

Local: gnodev extra-root + `local-new-col.ps1` (or UI helper) then same `Init`. Factory **does not** import `c/{slug}` — future paths are unknown; registry is string pkg + `PackageAddress`.

UI (`App.tsx` `launchWizard`) already `call("Init", [name, slug, cover, maxSupply, price, royaltyBps], launchFee, collectionRealmPath(slug))`. Pearl copy in `Launch.tsx` still says “nftv7 until factory is addpkg’d” — **stale**; factory and `c/wave` are on chain. Product gap is Init + catalog, not a new VM feature.

Do **not** wait for in-realm clone, creator-namespace addpkg, or Sub-as-collection.

## Royalty — pick

**Init is the launch lock. `SetRoyalty` is a pre-mint correction only.**

| | Lock only at Init | SetRoyalty until first mint |
| --- | --- | --- |
| Wizard | already sends bps in `Init` | extra Adena call |
| After mint | frozen (no setter) | frozen (`minted != 0` panic) |
| Wrong caller / `IsUserRun` | `Init` once, then gone | extra tests — **already in** `col_test.gno` |
| Pearl `wave` | `Init` has `royalty` | **no** `SetRoyalty` on chain |
| nftv7 analogue | n/a | `SetDropSale` before first mint |

Ship: wizard **always** passes 0–1000 bps in `Init`. Do not add a studio step that calls `SetRoyalty`. Keep the setter in `col` for pre-mint mistake-fix (creator, `minted==0`, same cap, `NoteRoyalty`). After any mint (creator `Mint` or `PublicMint`), royalty is frozen. No post-mint `SetRoyalty`. No slider on `List`/`Buy`.

Pearl instances addpkg’d from the older template have Init royalty only until a new template is addpkg’d (human yes, not this note).

Buy split stays: protocol 50 bps (`p/bazaar/fee/v1`) to factory, `royaltyBps` to creator, rest to seller. `proto+royal > price` panics.

## Invariants kept

- No realm emits `MsgAddPackage`. New collection code = operator addpkg of `col`.
- Collection g1 = `chain.PackageAddress(pkgPath)` of `…/bazaar/c/{slug}`. Unique per slug. Escrow and mint proceeds sit on **that** address, not nftv7.
- Slug = last path element = `package` name = `[a-z][a-z0-9]{1,10}`.
- Repeat `Init` panics. Repeat addpkg of the same path fails at the VM (path taken).
- `Register` panics if slug taken or pkg already registered. Creator = `Previous.Previous` EOA (`IsUserCall`).
- Launch fee: exact ugnot, extra denoms panic, credited then registered (pending slot, no silent skip).
- Primary: exact `mintPrice`, 0 protocol, GNOT to creator.
- Secondary: 50 bps protocol + royalty 0–10% to creator; fail-closed.
- Royalty after `minted>0` cannot change (local `SetRoyalty`; Pearl wave has no setter).
- Factory does not import collection packages.
- Money paths `panic`, not `error`. `requireUser` = `cur.Previous().IsUserCall()`.

## Assumptions not proven

- Pearl VM `realm.Sub` / `chain.SplitPkgSubPath` / `DerivePkgSubAddr` — not in docs.gno.land stdlibs; not qeval’d (stdlib is not a realm). Decision does not depend on it.
- Namespace enforcement on Pearl: assumed on (address namespace = deployer). Not re-queried `r/sys/names.IsEnabled()` this note.
- `c/wave` addpkg vs local `col` byte-identity — outline matches Init/Buy/PublicMint; Pearl factory missing `CollectionAddr`/`NoteRoyalty`.
- Adena “Add collectable” against a per-collection pkg path — product intent (`docs/FACTORY.md`); not retested this note.
- Operator addpkg gas/deposit per collection at current Pearl storage price.
- Creator utilities that `import` a collection: none shipped; path is what makes that possible later.
- Did not broadcast. Did not run `gno test` (tree already has factory/col tests including `CollectionAddr` + `SetRoyalty`).
- Did not change UI copy (Launch.tsx still mentions nftv7 factory).

## Do not

- Do not Pearl addpkg from this note.
- Do not treat `realm.Sub` as a collection realm.
- Do not `MsgCall` Launch on nftv7 and call it own-address.
- Do not build Adena `/vm.m_addpkg` of `col` as the creator studio (namespace + UX).
- Do not homemade hash for collection addresses; use `PackageAddress(pkgPath)`.
- Do not post-mint royalty. Do not royalty slider on the book.
- Do not tweet.

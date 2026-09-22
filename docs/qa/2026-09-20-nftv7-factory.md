# QA nftv7 factory launchpad — 2026-09-20

Owner: bazaar-qa (Dew). Không code fix. Không deploy Pearl. Không Pearl write.

---

## Commands

| Command | Cwd | Exit | Result |
| --- | --- | --- | --- |
| `C:\Users\Hi\tools\gno.exe test ./gno.land/r/bazaar/nft` | repo | 0 | `ok .\gno.land\r\bazaar\nft 1.46s` |
| `npm test` | `web/` | 0 | 3 files, **110 tests** PASS |

---

## Stack checks

| Check | Verdict | Evidence |
| --- | --- | --- |
| 1. `gno test ./gno.land/r/bazaar/nft` | **PASS** | `ok … 1.46s` |
| 2. web vitest | **PASS** | `110 passed (110)` — `format.test.ts` 86, `chart.test.ts` 16, `indexer.test.ts` 8 |
| 3. gnomcp `pearl` qeval `nftv7` | **PASS** | see table below |
| 4. `web/src/lib/chain.ts` `DEFAULT_NFT` | **PASS** | `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv7` |
| 5. Explore Featured split | **PASS** | launchpads = `Featured()`; volume cards = `pickFeatured(..., { requireVolume: true })` |

### Pearl qeval `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv7`

| Expr | Result |
| --- | --- |
| `LaunchFee()` | `(10000000 int64)` = **10 GNOT** |
| `Featured()` | `("ember\ntide\nkelp\ndrift" string)` — expected launchpad slugs |
| `Admin()` | `("g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt" string)` |
| `NextID()` | `(30 int)` |
| `DropLine("ember")` | `ember\|Ember Bay\|/samples/stones-01.png\|0\|1000000\|8\|0\|g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt\|false\|true\|Open mint on Pearl. Eight left.` |
| `GrcName()` | `("Bazaar" string)` |
| `GrcSymbol()` | `("bazaar" string)` |

`loadNft()` still remaps nft / nftv2–nftv6 → `DEFAULT_NFT` nftv7.

---

## Featured split (not a bug)

`App.tsx` qeval `Featured()` → `parseFeaturedLines` → `featuredSlugs`.

`Explore.tsx`:

- **Featured launchpads** — order of `featuredSlugs` (chain admin list). Row hidden if empty.
- **Featured collections** — `pickFeatured(collections, markets, 4, { exclude: featuredSlugs, requireVolume: true })`. Volume cards do **not** use `Featured()`.

Vitest: `pickFeatured(..., { requireVolume: true })` keeps only rows with `vol > 0`; exclude set drops those slugs.

---

## Browse / Sell / Create / Mine / Connect (source)

Không Puppeteer pass này. Hash + empty-state + Notices:

| Route | Source | Verdict |
| --- | --- | --- |
| Browse `#/explore` | `tabHash("explore")`, `Explore` | **PASS source** |
| Sell `#/sell` | `Sell.tsx` empty Connect Adena / No unlisted items | **PASS source** |
| Create `#/launch` | `tabHash("create")` → `#/launch` | **PASS source** |
| Mine `#/profile` | `Profile.tsx` empty Connect Adena | **PASS source** |
| Connect | Header: Adena → Connect; no Adena → `https://adena.app/` Install Adena | **PASS source** |
| wrong-network | `Notices`: “Adena is on {chainId}. Switch to {wantChainId}…”. `call()` throws `Switch Adena to …` | **PASS source** |
| empty list | Sell / Profile `EmptyState`. Explore uses catalog + chain | **PASS source** |

---

## Leftover (không fail stack)

### BUG-F1 — P3 Launch copy / fallback 1000 GNOT vs live 10 GNOT

**Where:** `Launch.tsx` banner, `Footer.tsx`, `App.tsx` `useState(1_000_000_000)` + catch fallback. Realm source `defaultLaunchFee = 1_000_000_000`. Live `LaunchFee()` = `10000000`.

`takeLaunchFee()` requires **exact** `OriginSend` == `launchFee`. Wizard step 5 uses `launchFeeUgnot` (correct **after** qeval). Banner/Footer stay “default 1000 GNOT”.

**Repro**

1. Pearl UI, Settings NFT path nftv7 (default).
2. Open `#/launch` Studio step 5 **before** `LaunchFee()` returns, or read banner/footer after load.
3. Banner: “Create fee … (default 1000 GNOT)”. Footer same. Step 5 after qeval: **10 GNOT**.
4. If Adena send uses fallback `1000000000ugnot` while chain wants `10000000` → panic `nft: launch fee`.

**Expected:** copy + fallback match live `LaunchFee()` (10 GNOT) or wait for qeval before enabling Launch.  
**Actual:** hardcoded 1000 GNOT default; live admin fee is 10 GNOT.

Không sửa pass này.

---

## Assumptions not proven

- Không `gnodev`. Không Puppeteer viewport. Không Adena session.
- Không gọi `CreateDrop` / `SetFeatured` trên Pearl.
- `NextID() = 30` không đối chiếu từng token.
- Vitest không mount `Explore.tsx`; split chứng minh bằng source + `pickFeatured` unit test.

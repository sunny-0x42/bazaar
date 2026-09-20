# QA Pearl Buy — 2026-09-19

Owner: bazaar-qa (Dew). Source + `gno test` + vitest + `tsc` + Pearl `gno_eval` / `abci_query`. Không browser/Adena session. Không code fix. Không deploy. Không sửa gnomemepad.

Câu hỏi: user Buy trên Pearl bằng Adena **khác** seller `g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt` vẫn fail (trước đó `UnauthorizedError`, cũng từng self-buy).

---

## Commands

| Command | Cwd | Exit | Result |
| --- | --- | --- | --- |
| `gno test ./gno.land/p/bazaar/fee/v1/` | repo | 0 | `ok … 0.67s` |
| `gno test ./gno.land/r/bazaar/` | repo | 0 | `ok … 0.71s` |
| `gno test ./gno.land/r/bazaar/market/` | repo | 0 | `ok … 0.84s` |
| `gno test ./gno.land/r/bazaar/nft/` | repo | 0 | `ok … 0.95s` (Buy happy + wrong payment + self-buy + EOA only + buy twice) |
| `cd web; npm test` | `web/` | 0 | 3 files, **80** tests PASS (`format.test.ts` 56, `chart.test.ts` 16, `indexer.test.ts` 8) |
| `cd web; npx tsc --noEmit` | `web/` | 0 | stdout trống |
| `npm test` từ repo root | repo | 1 | ENOENT `package.json` — phải `cd web` |

Không failure realm/web để quote. `gno_history` Pearl indexer timeout (`indexer.pearl.testnets.gno.land`) — không có tx hash từ indexer.

---

## Pearl live (không bịa)

Realm: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nft`  
Profile `pearl` + RPC `https://rpc.pearl.testnets.gno.land:443` `vm/qeval`.

| Query | Kết quả |
| --- | --- |
| `gno_packages` prefix `…/g1n4pl5…/bazaar` | **có** `…/bazaar/nft`. **Không** có hub `…/bazaar` (GetModule → `invalid package path`) |
| `gno_packages` `gno.land/p/g1n4pl5…/bazaar` | **có** `…/bazaar/fee/v1` |
| On-chain `Buy` | `func Buy(cur realm, id int)` — khớp `book.gno` local |
| `gnomod.toml` on-chain | `module = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nft"`, creator `g1n4pl5…`, height 537349 |
| `NextID()` | `(9 int)` |
| `ListOpen()` lúc đầu session | 9 dòng, **mọi seller** = `g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt`, owner listed = realm `g1jw856kkqqtymftr67pgscyjuxtjda6swkyp9l0` |
| `Activity()` | **`buy\|1\|stones\|g1dp3huvrq0yk7mmh2g6adtp2j7d44vuze95ef8y\|1000000\|Ember Core`** rồi mint/list 1–9 |
| `ItemLine(1)` / `Listed(1)` / `OwnerOf(1)` | unlisted, `false`, owner **`g1dp3hu…`** |
| `TokensOf("g1dp3hu…")` | `"1"` |
| `gno_account` buyer `g1dp3hu…` | exists, **sequence 1**, `2680000ugnot`, account_number 8022 |
| `gno_account` seller `g1n4pl5…` | exists, sequence 30, `208237300ugnot` |
| `ListOpen()` sau buy | **8** listing (id 2–9). `PriceOf(2) = 2000000` |
| `Render()` | `# Bazaar NFT` + 8 dòng open |

RPC `abci_query` `vm/qeval` cùng `ListOpen()` — `ResponseBase.Error` = null, Data base64 decode ra typed string bắt đầu `("2|Tide Core|g1jw856…|g1n4pl5…|2000000|true|…`.

**Buy đã chạy thành công trên Pearl** với caller khác seller. Sequence buyer = 1 → tx đầu của địa chỉ đó (rất khớp một `Buy`).

---

## `Buy(cur, id int)` vs Adena args string

MsgCall args **luôn** là `[]string`. VM parse `"2"` → `int`. `cur realm` là crossing — **không** đưa vào `args`.

UI: `call("Buy", [row.id], \`${row.price}ugnot\`)` → `args: ["2"]`, `send: "2000000ugnot"`.

`doContractCall` map `(args \|\| []).map(String)` — cùng gnomemepad.

**OK.** Không phải nguyên nhân. Evidence: `Buy` id `1` đã settle (`Activity` + `OwnerOf(1)`).

gnomcp `gno_call` schema cũng ghi: mọi arg stringify (số, address, bool).

---

## UI `onBuy` / pkg path / `isOwnListing`

```ts
void call("Buy", [row.id], `${row.price}ugnot`);
```

- `row.price` từ `ListOpen` là **ugnot** (`1000000` = 1 GNOT). Send `"1000000ugnot"` khớp `Activity` buy #1.
- `pkgPath`: `loadNft()` default `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nft`. Hub `GetModule("nft")` fail (hub chưa addpkg) → `resolveNftPath` **fallback đúng** path đó. Không trỏ `gno.land/r/bazaar/nft`.
- `isOwnListing`: `seller.toLowerCase() === wallet.toLowerCase()`. Live seller **chỉ** `g1n4pl5…`. Wallet khác → `false` → không chặn Buy.

False positive `isOwnListing` **không** xảy ra nếu Adena `GetAccount().address` thật sự khác seller. `owned` trên card so `owner \|\| seller`; item listed thì `owner` = realm `g1jw856…` (không phải user). Card/drawer own-listing dùng **seller** → Cancel, không Buy.

Nếu React `account.address` vẫn là seller (chưa Connect lại) → UI **cố ý** `setErr("This is your listing…")` — đó là self-buy guard, không phải false positive.

---

## Adena `DoContract` vs gnomemepad (`C:\Users\Hi\gnomemepad\web\ui\src\lib\adena.js`)

Chỉ đọc. Không sửa gnomemepad.

Cùng shape (đây là shape gnomi.fun / comment bazaar “Do not wrap in `tx` or add max_deposit”):

```js
{
  messages: [{
    type: "/vm.m_call",
    value: { caller, send, pkg_path, func, args: args.map(String) },
  }],
  gasFee,      // Pearl: number 2_000_000
  gasWanted,   // 50_000_000
  memo,
}
```

| | Bazaar `wallets.ts` | gnomemepad `doContractCalls` |
| --- | --- | --- |
| `type` / `pkg_path` / `args.map(String)` | giống | giống |
| `gasFee` Pearl | **number** `2_000_000` | **number** (local mới `"Nu gnot"` string) |
| `AddEstablish` trước DoContract | chỉ retry khi “connection has not been established” | **luôn** `ensureEstablished` |
| `AddNetwork` Pearl | **không** (comment: custom `pearl-1` shadow built-in → UnauthorizedError) | **có** `AddNetwork({ chainId, chainName, rpcUrl })` |
| Switch fail Pearl | **throw** (bắt user chọn built-in Pearl) | remote: soft-continue nếu Switch flaky |
| `caller` trong message | `GetAccount().address` (so với React caller) | caller app truyền vào |
| `memo` | `"bazaar"` | `"gnomi"` |

Hai file **cố ý ngược nhau** trên Pearl `AddNetwork`. Cả hai comment đều đổ `UnauthorizedError` cho RPC/network sai. Payload Buy (func/args/send) **không** lệch gnomemepad.

`UnauthorizedError` là CheckTx (chữ ký / chain-id / account_number / RPC), **trước** VM `Buy`. Không phải `nft: self buy` / `nft: wrong payment` / package missing.

---

## Surfaces (source, không Adena session)

| Surface | Kết quả |
| --- | --- |
| Browse / Explore | Pearl live: `ListOpen` 8 row → **For sale** thật (không catalog). `chainNote` realm-missing không apply. |
| Sell | Disconnect → Connect Adena. Connected + 0 unlisted → Launch. Form `disabled={blocked \|\| busy \|\| !canList}`. |
| Create / Launch | Drops + Create drop. Mint/Create `blocked \|\| busy`. |
| Mine / Portfolio | Disconnect vs empty tách copy. Listed → Cancel; unlisted → Sell. |
| Connect | `window.adena` → Connect Adena. Không → `<a href="https://adena.app/">Install Adena</a>`. |
| wrong-network | Banner `Switch to {wantChainId}…`. `call()` guard trong `try`. Drawer Buy disable. **Card Buy không disable** (còn từ BUG-BUY-2). |
| empty list | Sell/Portfolio có empty. Explore `items.length === 0` vẫn fallback catalog For sale (BUG-BUY-1) — **không** phải Pearl hôm nay (book không rỗng). |
| BottomNav | Explore / Launch / Sell / Portfolio. |

---

## Nguyên nhân xếp hạng (likely → less)

### 1. Adena CheckTx `UnauthorizedError` — mạng Pearl / RPC / sign doc (P1, money-path UX)

**Where:** Adena + `web/src/lib/wallets.ts` `ensureAdenaNetwork` / `DoContract`, không phải realm.

CheckTx reject chữ ký khi Adena sign bằng chain-id / account_number / sequence lấy từ RPC **khác** node nhận tx. Classic: custom `pearl-1` shadow built-in, hoặc built-in Pearl RPC stale.

Bazaar **cấm** `AddNetwork` cho Pearl; gnomemepad **re-add** `pearl-1` + `https://rpc.pearl.testnets.gno.land:443`. User từng fail `UnauthorizedError` **trước** khi đổi wallet — cùng class lỗi, không phụ thuộc seller vs buyer.

Đổi Adena account **không** tự sửa RPC. Nếu vẫn custom/stale Pearl, buyer mới vẫn UnauthorizedError.

**Repro**

1. Header **Pearl**. Adena: custom `pearl-1` (RPC lạ) **hoặc** built-in Pearl RPC ≠ `https://rpc.pearl.testnets.gno.land:443`.
2. Connect Adena = địa chỉ **khác** `g1n4pl5…` (ví dụ funded `g1dp3hu…`).
3. Explore → For sale → Buy (Tide Core #2, send `2000000ugnot`).
4. Ký Adena.

**Expected:** CheckTx OK, VM `Buy`, `OwnerOf(id)` = buyer.  
**Actual (class lỗi cũ):** Adena/node `UnauthorizedError`; UI `explainAdenaError` bảo switch Pearl / disconnect / reconnect. Tx **không** vào `Buy` (không `nft: self buy`).

Mitigation phía user (không deploy): Adena → Change Network → Pearl **built-in**; xóa custom `pearl-1`; disconnect site; Connect lại; retry Buy trên id **2–9** (đừng Buy #1).

### 2. Retry Buy #1 sau khi đã bán / UI stale (P2)

On-chain **đã** `buy|1|…|g1dp3hu…|1000000|Ember Core`. `Listed(1)=false`. `Buy(1)` lần nữa → `panic("nft: not listed")` (sau CheckTx OK).

Nếu Adena timeout / UI `.err` dù tx đã vào (sequence buyer = 1), user tưởng fail rồi bấm Buy Ember Core lần nữa.

**Repro:** For sale vẫn hiện #1 (chưa `refresh`) → Buy.  
**Expected:** card biến mất sau settle; retry copy “not listed”.  
**Actual:** có thể panic VM hoặc card sample/stale.

Khớp buyer `g1dp3hu…` sequence 1 + `TokensOf=1`. Nếu đó là wallet “khác” của user: **Buy đã thành công**; “vẫn fail” có thể là overlay Adena, không phải realm revert.

### 3. Vẫn ký bằng seller dù UI “ví khác” (P2) — self-buy / pubkey mismatch

Self-buy realm: `caller == it.seller` → `panic("nft: self buy")`. Test `TestSelfBuyPanics` PASS. UI: `isOwnListing` + copy “Connect a different Adena account”.

Xảy ra khi:

- Connect lần đầu = seller, đổi account trong Adena **không** Connect lại → React vẫn `g1n4pl5…` → UI chặn, **không** gửi tx.
- Adena GetAccount = buyer nhưng key ký vẫn seller → CheckTx UnauthorizedError (khác self-buy).

**Không** giải thích fail nếu `GetAccount` và chữ ký cùng một g1 ≠ seller. Live đã chứng minh path đó: `g1dp3hu…` mua #1.

### 4. Adena version `gasFee` number vs `"2000000ugnot"` (P3)

gnomemepad: local dùng coins string; Pearl dùng **number** — bazaar giống Pearl. Live Buy #1 chứng minh **một** client đã sign đúng. Chỉ residual nếu Adena build của user muốn string trên Pearl (sign doc lệch → UnauthorizedError). Không chứng được không có session Adena.

### 5. Thiếu ugnot cho listing đắt (P3, **không** phải UnauthorizedError)

Buyer còn `2680000ugnot`. #2 Tide Core = `2000000` OK. #3 Night Core = `3500000` → bank/insufficient, không UnauthorizedError, không self-buy.

---

## Không phải nguyên nhân

| Claim | Vì sao loại |
| --- | --- |
| **Realm missing trên Pearl** | `gno_packages` + `qeval` + `Render` + `ListOpen` + `Buy` #1 đã settle. `fee/v1` user path có. |
| Adena args string vs `id int` | MsgCall luôn string; live `Buy` id 1. |
| `send` sai đơn vị (GNOT vs ugnot) | Price line = ugnot; buy #1 amount `1000000`. |
| Sai `pkg_path` | Default NFT = path live. Hub missing chỉ làm GetModule fail, fallback đúng. |
| `isOwnListing` false positive với ví khác seller | Seller book = `g1n4pl5…`. So khớp case-insensitive. Buyer `g1dp3hu…` đã mua. |
| Wrap `tx` / `max_deposit` | Bazaar không wrap — comment + gnomemepad cùng shape. |
| `nft: self buy` khi caller ≠ seller | Realm so `caller == it.seller`. Wallet khác → không panic này. |
| Empty book / sample For sale (BUG-BUY-1) | Book hiện 8 listing live. |

---

## BUG-PEARL-BUY-1 — `UnauthorizedError` là Adena network, realm Buy đã live

**Severity:** P1 (user money-path; realm không thiếu)  
**Where:** Adena Pearl RPC / `ensureAdenaNetwork` (không `AddNetwork` Pearl) vs gnomemepad (có re-add)

File dưới “Nguyên nhân #1”. Không one-line UI trong bazaar web: payload `/vm.m_call` đã khớp gnomemepad. Đổi `AddNetwork` là policy, không phải typo một dòng.

---

## BUG-PEARL-BUY-2 — Ember Core #1 đã bán; retry `Buy(1)` không còn listed

**Severity:** P2  
**Where:** on-chain state vs UI refresh

**Repro:** qeval `Listed(1)` → false. UI Buy #1 → `nft: not listed`.

**Expected:** For sale không còn #1 sau `refresh`.  
**Actual:** nếu Adena/UI báo fail dù `Activity` đã `buy|1`, user retry đúng listing đã bán.

---

## BUG-BUY-2 (còn) — Card Buy không `disabled={blocked \|\| busy}`

Drawer disable; card không. Không giải thích UnauthorizedError khi network đúng. Own-listing trên card **đã** đổi Cancel (`ListingCard` `mine`).

---

## Coverage

`nft_test.gno`: happy Buy, wrong payment, self-buy, not user call, buy twice. Vitest: `isOwnListing`, `parseItems` (đúng `id\|name\|owner\|seller\|price\|listed\|image\|collection\|rarity`). Không vitest `DoContract` payload / Adena.

---

## Không làm

- Không deploy / addpkg.
- Không implement (không có one-line UI bug gây UnauthorizedError).
- Không xóa test.
- Không Adena session (không bắt được screenshot fail của user).
- Không sửa gnomemepad.

## Invariants giữ

- Money-path realm fail-closed: wrong payment / self-buy / not listed / EOA only → panic.
- Buyer send = listing `price` ugnot; protocol 50 bps từ price (`TestMintListBuy` fee 5000).
- MsgCall args string; `cur` crossing không nằm trong `args`.
- Pearl NFT + fee **có** on-chain; hub `…/bazaar` **chưa**.

## Assumptions chưa chứng

- `g1dp3hu…` có phải Adena “ví khác” của user không — chỉ biết sequence 1 + own token 1.
- Adena `GetAccount().chainId` / RPC built-in Pearl trên máy user.
- Indexer Pearl (timeout) — không quote tx hash `Buy`.
- `gasFee` number vs string trên đúng build Adena của user.

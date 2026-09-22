# Audit: GRC721 trên `gno.land/r/bazaar/nft` (Pearl nftv6)

Notes only. Không phải investment advice. Không PoC. Không deploy.

## Verdict

**FAIL / no-go** cho addpkg nftv6 trên toolchain hiện tại.

Money path (`List` / `Buy` / `Cancel` / `Transfer` / `mintTo` / pool NFT) đã gọi `PrivateLedger.Mint` / `TransferFrom` in-realm, **không** dùng `CallerTeller`. Ownership fail-closed trên giấy. Package copy `p/bazaar/grc721/v0` **không compile**: `chain.SplitPkgSubPath` không có trong `gno version develop` (`GNOROOT=C:\Users\Hi\tools\gno`). `gno test ./gno.land/r/bazaar/nft/` dừng ở preprocess.

## Provenance

Local repo `C:\Users\Hi\gno-bazaar` (2026-09-20). **Không** đọc Pearl nftv6 — path chưa addpkg. Pearl live vẫn là homemade AVL `nftv5`. Chain-id không verify. GRC721 unit tests không chạy được (`uassert` kéo `gno.land/p/onbloc/diff`).

## Priority checklist

| Check | Result |
| --- | --- |
| `IsUser()` vs `IsUserCall()` | **PASS** — `requireUser` dùng `Previous().IsUserCall()` |
| OriginSend amount | **PASS** exact ugnot; **FAIL** extra denoms trên `Buy`/`Sweep`/`Offer`/`DepositPool` |
| TransferFrom spender = market realm | **PASS** — Buy/Cancel/pool-out spender = `self` |
| Double-fill | **PASS** — `fillBuy` unlists; Sweep unique ids |
| Cancel-after-buy | **PASS** — `listed=false` rồi `Cancel` panic |
| Fee int64 overflow | **PASS** — `fee.ProtocolFee`; Gno `+` panic |
| Admin fee drain | **PASS** — `WithdrawFees` admin-only (by design) |
| Render injection | **PASS** (Low residual) — `ItemLine` trong code fence; name/image cấm `\|` newline |
| CallerTeller across realms | **PASS** — realm không mint/export teller |
| PrivateLedger in-realm | **PASS** |
| Listed escrow owner=realm vs GRC721 `OwnerOf` | **PASS** cùng tx; dual cache không assert |

---

## Findings

### Critical

#### C1 — `chain.SplitPkgSubPath` không tồn tại → nftv6 không preprocess

**Location**: `gno.land/p/bazaar/grc721/v0/tellers.gno:136`, `token.gno:45`

**Class**: operational compile-break (không phải Class 1–4)

**Evidence**: `guardHome` và `NewToken` gọi `chain.SplitPkgSubPath`. Local stdlib không declare. `gno test ./gno.land/r/bazaar/nft/` → `name SplitPkgSubPath not declared`.

**Why blocking**: addpkg/gnodev cùng toolchain sẽ fail trước khi `Init`.

**Considered objection**: Pearl VM có thể mới hơn local `gno develop`. Không chứng minh được. Audit covers toolchain đã chạy.

**Fix / no-go**: **No-go** đến khi (a) xác nhận Pearl stdlib có symbol, hoặc (b) thay bằng helper split `#` (NFT không `realm.Sub` — `rlm.PkgPath() == origRealm` đủ). Không ship copy master GRC721 nguyên xi.

### High

Không có High còn lại sau FP filter. Dual-ledger cache xuống Medium.

### Medium

#### M1 — Dual ownership: `OwnerOf` đọc AVL cache, không đọc GRC721

**Location**: `nft.gno:632-634` vs `GrcOwnerOf` `nft.gno:676-687`

```
func OwnerOf(id int) address {
	return mustItem(id).owner
}
```

Mọi money path hiện ghi cả hai (`grcTransfer` rồi `it.owner=…`). Lỗi GRC721 `panic("nft: transfer")` — fail-closed, không theft hôm nay. UI/`TokensOf`/`Reveal` tin cache. Path mới quên một bên → desync (listed trên book, ledger vẫn user, hoặc ngược lại).

**Fix**: `OwnerOf` ủy quyền `col.token.OwnerOf`, hoặc `panic` nếu cache ≠ ledger sau mỗi move. Test lockstep đã có mint/list/buy (`nft_test.gno:1514+`); thiếu Cancel / AcceptOffer / pool.

#### M2 — Extra denoms lock trên secondary money path

**Location**: `book.gno:147-149` (`Buy`), `178-181` (`Sweep`); `offers.gno:25`; `pool.gno:23`

`PublicMint` / `takeLaunchFee` panic `extra denoms` (`book.gno:22-23`, `50-51`). `Buy` chỉ `AmountOf("ugnot")`. Denom lạ vào realm balance, `WithdrawFees` chỉ đẩy `fees` ugnot.

**Class**: `security.md` § operational (OriginSend envelope)

**Fix**: `len(sent) > 1 { panic("nft: extra denoms") }` trên mọi path đọc `OriginSend`.

#### M3 — Slug 2–16 vs GRC721 `MaxSymbolLen=11`

**Location**: `nft.gno:1188-1194` `validSlug`; `attachToken` `nft.gno:889-891`; `grc721/v0/types.gno:100`

`attachToken` dùng `col.slug` làm symbol. Slug 12–16 qua `validSlug` rồi panic `"nft: symbol"`. `CreateDrop` đã `takeLaunchFee` nhưng panic revert cả tx — không mất fee. `TestGrc721LongSymbol` cover.

**Fix**: `validSlug` max 11, hoặc symbol = `tokenSeq` (`c`+id) độc lập slug.

### Low

#### L1 — `Buy` không có test `IsUserRun` riêng

`requireUser` (`nft.gno:844-845`) chặn `IsUserRun` cho mọi entry. `TestListNotUserCall` (`nft_test.gno:1593-1596`) cover List. `TestBuyNotUserCall` chỉ `NewCodeRealm`. BAR muốn abuse `IsUserRun` trên payment path.

#### L2 — Render echo `ItemLine` (name/image user)

**Location**: `book.gno:330-341`

`path` bỏ qua. Output trong ```` ``` ````. `validName`/`validImage` cấm newline, `|`, `<>\"'`. Residual markdown trong URL https. Không raw HTML.

### Info / GREEN

- `grcTransfer` / `grcMint` gọi `*PrivateLedger` trực tiếp (`nft.gno:915-927`). Spender Buy/Cancel/pool-out = `self` (`book.gno:222`, `261`; `pool.gno:117`). List/Transfer/pool-in spender = owner. Không `CallerTeller`.
- `collection.ledger` unexported; không return `*Token` / `*PrivateLedger` / Teller.
- `attachToken` check `cur.IsCurrent()` trước `NewToken` (`nft.gno:885-896`).
- `fillBuy` unlists sau `grcTransfer`; Sweep unique ids; self-buy panic.
- `fee.ProtocolFee` không overflow `price*bps`.
- `WithdrawFees` admin-only. `TransferAdmin` có.
- GRC721 `CallerTeller` gắn `*PrivateLedger` + `guardHome` — đúng footgun docs. Realm này không dùng. Library thiếu test foreign `CallerTeller`.
- Extensions enumerable/metadata/royalty **không** gắn. `*Ledger.SetTokenURI` unauthenticated nếu sau này leak pointer.

## Open questions

- Pearl VM có `chain.SplitPkgSubPath` không? (không đọc được stdlib on-chain từ đây)
- `gno test` GRC721 v0: `uassert` import `gno.land/p/onbloc/diff` — không có trong workspace
- Không chạy gnodev / không broadcast

## Invariants kept (nếu compile)

- Mint/list/buy/cancel/transfer/pool NFT: GRC721 + AVL cùng tx; lỗi ledger panic
- Payment: `IsUserCall` + exact ugnot trên `Buy`/`PublicMint`
- Escrow listed: GRC721 owner = realm address
- Không confused-deputy `CallerTeller` sang realm khác

## Assumptions not proven

- Pearl nftv6 chưa tồn tại
- Toolchain local = Pearl VM
- Không có path ownership thứ 8 ngoài mint/list/buy/cancel/transfer/accept/pool in/out
- Gno integer overflow panic (không wrap)

## Cross-references

`gno-audit` → `audit.md`, `security.md`, `interrealm.md`, `render.md`, `bar.md`

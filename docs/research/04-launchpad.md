# Launchpad — primary mint vs secondary book (2026-09-19)

Notes only. Không phải investment advice. Không hứa volume. Không đề xuất bonding-curve pad, AMM, vault, hay collection bên ngoài Bazaar.

Mục tiêu: khóa **fee split** cho drop v1 theo `docs/LAUNCH.md`. Primary `PublicMint` **không** lấy 50 bps (toàn bộ mint price về creator). Secondary `List` / `Buy` **giữ** 50 bps. Note này không edit realm. Không live param change.

## Constraint (không bịa)

Từ `docs/LAUNCH.md`, `docs/NFT.md`, `docs/COMPANY.md`, `docs/research/03-nft-defi.md`, `p/bazaar/fee/v1`:

| Fact | Value |
| --- | --- |
| Sản phẩm | Unique-item book `gno.land/r/bazaar/nft`. Một id, một GNOT price. |
| Launchpad v1 | **Fixed-price collection drop**. Không bonding curve. Không Dutch trong v1. |
| Quote | Native `ugnot`. UI **GNOT** (`1 GNOT = 1_000_000 ugnot`). Không USD. |
| Secondary fee | Protocol **50 bps** of the GNOT price trên `Buy`. Math: `p/bazaar/fee/v1`. Buyer pays `price`. Seller nhận `price − fee`. |
| Primary fee | **None.** `PublicMint`: `OriginSend` == `mintPrice`; toàn bộ ugnot về creator. |
| Min price (book) | `List`: `priceUgnot > 0` → **1 ugnot**. UI discourages dust. |
| Min price (drop) | `mintPrice >= 0` ugnot. Free mint (`0`) là feature, không phải dust listing. |
| Drop cap | `maxSupply` 1–3000. `CreateCollection` không public mint (`maxSupply=0`). |
| Slug | 2–16 `[a-z0-9-]`. Creator = caller của `CreateDrop`. |
| Samples | 3 drop, mỗi drop `maxSupply` 6; mintPrice **0.5 / 0.8 / 1.0 GNOT**. Seed list 3 item/drop cho Explore; 3 slot còn lại cho `PublicMint`. |
| Royalty | **Không.** 0 bps primary ≠ creator royalty trên secondary. |
| `protocolBps` | Const `50`. Không `SetBps`. Đổi bps = live param → **không** làm trừ khi human yes. |

`CreateDrop` / `PublicMint` nằm ở spec `docs/LAUNCH.md`. Realm hiện tại (`nft.gno`) vẫn `CreateCollection` + `Mint` / `MintIn` (free, về caller) + `List` / `Buy`. Note không pretends bytecode đã ship drop.

Không phải: gnomi pad, AMM, vault harvest, Gnomies.

## Ba hướng fee cho drop (chọn 1)

Trước khi lock 0 bps primary:

1. **50 bps trên cả `PublicMint` và `Buy`.** Một công thức, một package. Creator nhận `mintPrice − fee`. Trông “công bằng” nhưng biến protocol thành co-seller của drop. Free mint (`mintPrice=0`) thì fee=0; paid mint thì protocol ăn 0.50% ngay lúc supply ra đời. Hai money path cùng `ProtocolFee` — dễ đọc nhầm primary là listing.
2. **bps riêng cho drop** (`mintBps` ≠ `protocolBps`). Slider / const thứ hai. Đó là live fee policy thứ hai. `ProtocolBps()` không còn “một chỗ đọc”. Reject — cùng lý do research 03 reject royalty slider.
3. **0 bps primary, 50 bps secondary.** `PublicMint` đẩy nguyên `OriginSend` cho creator. `Buy` giữ `fee.ProtocolFee(price, 50)`. **Chọn hướng này** — khớp `docs/LAUNCH.md`.

Không cân nhắc: protocol ăn mint rồi hoàn, fee bằng item, fee bằng USD, bonding-curve take.

## Primary vs secondary — hai money path

```
CreateDrop(slug, …, maxSupply, mintPriceUgnot)
        │
        ▼
PublicMint(slug)          ← primary. minted < maxSupply.
  OriginSend == mintPrice
  ugnot ──100%──► creator
  item  ──owner──► minter
        │
        ▼  (minter, hoặc ai nhận Transfer)
List(id, priceUgnot)      ← vào book. escrow owner = realm.
        │
        ▼
Buy(id)                   ← secondary.
  OriginSend == price
  ProtocolFee(price, 50) ──► fees (admin WithdrawFees)
  price − fee ───────────► seller
  item ──────────────────► buyer
```

| | Primary `PublicMint` | Secondary `Buy` |
| --- | --- | --- |
| Hàng | Slot trong drop (`minted < maxSupply`) | Item đã mint, đang listed |
| Giá | `mintPrice` cố định lúc `CreateDrop` | `priceUgnot` lúc `List` |
| `OriginSend` | Đúng `mintPrice` (0 được) | Đúng `price` (≥ 1 ugnot) |
| Ai nhận GNOT | **Creator** 100% | Seller `price − fee` |
| Protocol | **0.** Không gọi `ProtocolFee` | 50 bps, `p/bazaar/fee/v1` |
| Owner sau tx | Minter | Buyer |
| Fail-closed | Sai send, hết supply, không phải user call | Sai send, self-buy, không listed |

`CreateCollection` giữ: không public mint. Collection không-drop không có `mintPrice` / `maxSupply` để `PublicMint`.

`Mint` / `MintIn` (EOA mint về chính mình, không `OriginSend`) **không** thay `PublicMint`. Đó là admin / owner mint, không phải drop checkout.

## Vì sao tách 0 / 50

### 1. Protocol thu phí **book**, không thu phí **sinh hàng**

Bazaar v1/v2 bán settlement: escrow ownership, exact `OriginSend`, fail-closed `Buy`. 50 bps là giá của **match** trên book.

`PublicMint` không match hai trader. Không `SellerOf`. Không listing row. Realm mint id mới, lấy ugnot từ minter, đẩy cho creator. Đó là creator sale. Cắt 50 bps lúc đó = protocol đứng vào chỗ creator mà không làm job book.

### 2. Một const, một chỗ gọi `ProtocolFee`

`protocolBps = 50` chỉ sống trên `Buy` (đã có `book.gno`). Primary **không** import fee math. Không `mintBps`. Không nhánh `if drop { bps=0 }`.

Thêm `ProtocolFee` vào `PublicMint` sẽ:

- Tạo money path thứ hai: `mintPrice − fee` → creator, `fee` → `fees`. Sai `mintPrice=0`, sai overflow, sai creator = zero — phải fail-closed lần nữa.
- Làm `ProtocolBps()` nói dối nếu UI ghi “fee 0.50%” trên nút Mint.
- Trông như có thể `SetMintBps` sau này. Live param. Không.

`fee/v1` overflow-safe **vẫn** chỉ cho secondary. Primary là `SendCoins` nguyên `OriginSend` (hoặc no-op khi 0). Không nhân `price * bps`.

### 3. 0 bps primary không phải royalty

Research 03 đã **reject** royalty: money path `price − protocol − royalty`, “creator” sau `Transfer`, slider trên List.

| | Primary 0 bps | Royalty |
| --- | --- | --- |
| Khi nào | Một lần, lúc `PublicMint` | Mọi `Buy` sau này |
| Ai nhận | Creator của drop | Minter / registry / seller? |
| Bám item | Không. Item ra book thì 50 bps như mọi listing | Bám id mãi |
| Param | Không. Không gọi fee | bps thứ hai |

Mint xong, minter `List` → `Buy` vẫn 50 bps, seller (cũ là minter) nhận `price − fee`. Creator **không** ăn thêm. Đúng “seller rest”. Không lách royalty bằng tên “launch fee”.

### 4. Free mint là first-class; dust listing thì không

`mintPrice >= 0`. Drop 0 ugnot: `OriginSend == 0`, không coin, owner = minter, `fees` không đổi.

`List` vẫn `priceUgnot > 0`. Listing 1 ugnot: `ProtocolFee(1, 50) == 0` (floor; fee=0 khi `price < 200` ugnot). Đó là dust **book**, UI cảnh báo — không phải lý do thuế primary.

Trộn 50 bps vào primary sẽ biến free vs paid drop thành hai chính sách fee, trong khi const vẫn 50. Tách path thì free mint không đụng fee package.

### 5. Khớp marketplace, không khớp pad

OpenSea / Magic Eden: marketplace fee trên **sale** (item đã tồn tại, đang list). Mint proceeds trên drop contract về creator. Bazaar **không** copy 1% / 2% của họ. Bazaar giữ 50 bps trên `Buy`. Chỉ mượn **ranh giới**: primary ≠ secondary.

Pad kiểu bonding curve thu fee trên mọi buy-along-curve vì curve **là** market. Bazaar drop **không** phải curve. Giá mint cố định. Hết `maxSupply` thì hết. Secondary mới là market.

## Sample mint prices: 0.5 / 0.8 / 1.0 GNOT

`docs/LAUNCH.md`: mỗi sample drop `maxSupply` 6; mintPrice **0.5 / 0.8 / 1.0 GNOT**. Seed vẫn mint+list **3** item/drop cho secondary Explore; **3** slot còn `PublicMint`.

Đề xuất map theo thứ tự `docs/SAMPLES.md` / `SeedSamples` hiện tại (chưa gán trong LAUNCH.md — assumption):

| Slug | Name | mintPrice | ugnot |
| --- | --- | ---: | ---: |
| `stones` | Signal Stones | 0.5 GNOT | 500_000 |
| `lamps` | Harbor Lamps | 0.8 GNOT | 800_000 |
| `relics` | Paper Relics | 1.0 GNOT | 1_000_000 |

Cùng một mức giá, **primary vs secondary** khác người nhận:

| mint / list (ugnot) | GNOT | Primary → creator | Secondary fee 50 bps | Secondary → seller |
| ---: | ---: | ---: | ---: | ---: |
| 500_000 | 0.5 | **500_000** | 2_500 | 497_500 |
| 800_000 | 0.8 | **800_000** | 4_000 | 796_000 |
| 1_000_000 | 1.0 | **1_000_000** | 5_000 | 995_000 |

Fee 1 GNOT đã có test `ProtocolFee(1_000_000, 50) == 5000`. 0.5 / 0.8 cùng công thức `(price * 50) / 10000` floor, không round-up.

Vòng đời một sample slot:

1. `PublicMint("stones")` gửi 500_000 ugnot → creator. `ProtocolFees()` không tăng. Owner = minter. Tên `{collection} #{n}`. Image `/samples/{slug}-0{n}.png` nếu path valid, else cover.
2. Minter `List` 1 GNOT. Escrow.
3. `Buy`: buyer gửi 1_000_000; protocol +5_000; seller +995_000.

UI Launch: hiện mint price GNOT, **không** dòng “protocol 0.50%” trên nút Public Mint. UI Sell / Buy drawer: giữ bảng fee v1 (You pay / Protocol 0.50% / Seller receives).

Preview catalog: `mintPrice` (ugnot) trên collection card; `listPrice` trên item đã seed-list — giá hiện được khi chưa Pearl.

UI vẫn discourage dust trên **List**, không trên mint 0.5 GNOT (nửa GNOT không phải dust; `ProtocolFee(500_000, 50) == 2500` nếu ai đó list đúng mint price trên secondary).

## v1 drop shape (nhắc lại spec)

`CreateDrop(cur, slug, name, cover, maxSupply, mintPriceUgnot)`

- EOA. slug 2–16 `[a-z0-9-]`. `maxSupply` 1–3000. `mintPrice >= 0`.
- creator = caller. `minted` starts 0.
- Repeat cùng slug → revert (no silent overwrite).

`PublicMint(cur, slug)`

- `IsUserCall` + `OriginSend` == `mintPrice` (0 allowed).
- `minted < maxSupply`.
- Item name `{collection} #{n}`. Owner = minter.
- ugnot → creator. Không `ProtocolFee`.

`DropLine(slug)` = `slug|name|cover|count|mintPrice|maxSupply|minted|creator`

`ListCollections` thêm `mintPrice|maxSupply|minted` (collection không-drop: mintPrice=0, maxSupply=0, minted=0 — không `PublicMint`).

Seed: 3 listed / drop trên secondary book; 3 còn lại cho Launch. Không hứa 3 slot đó sẽ mint hết.

## Next (sau v1 — không ship trong drop đầu)

Ba hướng **park**. Không nhét vào `CreateDrop` v1. Không live param để “bật sau”.

### 1. Allowlist mint — later

`PublicMint` chỉ address trong set. v1 = public, ai `OriginSend` đúng giá cũng mint.

Later nếu làm: `avl` địa chỉ per drop, `panic` nếu caller không có. **Không** Merkle / hash homemade (bar: không primitive crypto mới). Không signature allowlist kiểu lazy mint.

v1 không: Merkle root field, CSV upload on-chain, “phase 1 allowlist / phase 2 public”.

### 2. End time — later

`PublicMint` panic sau `endTime`. v1 = mint đến `maxSupply` hoặc hết người mint. Không clock window.

Later nếu làm: một timestamp, fail-closed sau hạn. Cần clock on-chain thống nhất; mint giữa block boundary phải idempotent. Không “extend 24h” admin button (trông như live param).

v1 không: start/end, pause, reveal time.

### 3. Dutch — later, và không phải book v1

Dutch = `price(t)` giảm theo thời gian đến floor. Đó là **curve**, không phải fixed-price drop.

Bazaar v1: `mintPrice` một số, không hàm. Secondary cũng một `priceUgnot`. Dutch trên primary sẽ:

- Phá “quote một chiều” (research 03): buyer không biết `OriginSend` trước khi ký nếu UI lệch clock.
- Trông như pad. Dễ nhầm bonding curve.
- Cần test abuse: mint đúng tick, send sai nấc, time spoof.

Park hẳn. Nếu human muốn Dutch: realm / module mới, không mutate `PublicMint` đang chạy. Không `SetMintPrice` theo block.

v1 cũng không: English auction, offer, sweep, bonding curve.

## Invariants (kỳ vọng khi code drop — chưa pretends đã ship)

- Primary: `OriginSend == mintPrice`; creator nhận **đủ** `mintPrice`; `fees` không đổi; owner = minter; `minted++` ≤ `maxSupply`.
- `mintPrice == 0`: không banker send; vẫn mint nếu còn supply.
- Secondary: không đổi. `Buy` gọi `fee.ProtocolFee(price, 50)`; seller `price − fee`; `protocolBps` const 50.
- `List` min 1 ugnot. `PublicMint` cho phép 0.
- `CreateCollection`: không `PublicMint`. `CreateDrop`: slug mới, không overwrite collection đã có.
- Fail-closed: sai caller (`IsUserRun` / realm spoof), sai send, hết supply, slug lạ → `panic`.
- Không royalty, không USD, không AMM, không bonding curve, không Dutch, không allowlist, không end time.
- Seed: 3 item listed / drop; 3 slot public. Sample mintPrice 0.5 / 0.8 / 1.0 GNOT.

## Assumptions not proven

- `CreateDrop` / `PublicMint` chưa có trong `r/bazaar/nft` lúc viết note. Spec = `docs/LAUNCH.md`.
- Map sample 0.5→stones / 0.8→lamps / 1.0→relics là đề xuất thứ tự, chưa khóa trong LAUNCH.md.
- Banker `SendCoins` nguyên `mintPrice` cho creator đủ cho primary; không cần `fee/v1` trên path này.
- `maxSupply` 3000 đủ int64 headroom (id + count). Không bẻ cap GRC20 Create sang drop.
- Image `/samples/{slug}-0{n}.png` chỉ demo local; drop user-cover URL không pin IPFS.
- User đọc Launch mint price là **trả creator**, Explore list price là **trả seller + 50 bps**. Copy English phải tách hai câu. Banner Pearl vẫn bắt buộc — test GNOT không có market value.
- Adena exact `OriginSend` ugnot giống `Buy`.
- 3 slot PublicMint trên sample không phải cam kết volume.

## Không làm

- Không 50 bps trên `PublicMint`. Không `mintBps`. Không `SetBps` / live param.
- Không royalty, không creator earnings trên `Buy`.
- Không USD, không oracle, không floor/volume chart, không “drop will sell out”.
- Không allowlist, end time, Dutch, auction, offer, sweep **trong v1**.
- Không bonding curve, AMM, vault harvest.
- Không import GRC721. Không wrap collection ngoài Bazaar.
- Không đổi `protocolBps` 50 trên secondary.
- Không edit repo khác. Không code realm / UI trong note này.

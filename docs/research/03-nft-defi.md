# Unique-item book cho Bazaar v2 (2026-09-19)

Notes only. Không phải investment advice. Không hứa volume. Không đề xuất DEX, launchpad, vault, hay collection bên ngoài Bazaar.

Mục tiêu: giải thích vì sao listing **một id, một GNOT price** hợp marketplace hơn lot GRC20 (`amount` + `price` cho một lô fungible), rồi khóa fee / min price / royalty / USD cho v2. Không edit realm trong note này. Không live param change.

## Constraint (không bịa)

Từ `docs/COMPANY.md`, `docs/NFT.md`, `docs/API.md`, `docs/research/00-network.md`, `p/bazaar/fee/v1`:

| Fact | Value |
| --- | --- |
| v1 book | GRC20 factory + escrow lot. `List(symbol, amount, priceUgnot)`. |
| v2 book | Unique-item realm `gno.land/r/bazaar/nft`. `List(id, priceUgnot)`. Một item = một token id. Không fraction. |
| Quote | Native `ugnot`. UI hiện **GNOT** (`1 GNOT = 1_000_000 ugnot`). **Không** USD. |
| Fee | Protocol **50 bps** of the GNOT price. Math: `p/bazaar/fee/v1`. Buyer pays `price`. Seller nhận `price − fee`. |
| Min price | `priceUgnot > 0` → **1 ugnot**. UI discourages dust. |
| Royalty | **Không.** Không slider, không creator earnings path. |
| Pearl | `p/demo/tokens/grc20` có. **Không** `p/demo/tokens/grc721`. Official `grc721` trong gnolang/gno đang quarantined. |
| Hub | `SetModule("nft", "gno.land/r/bazaar/nft")`. UI đọc module này trước. Module `market` GRC20 vẫn deploy được, không phải default Explore. |
| Wallet | Adena. Chain Pearl (`pearl-1`) nếu deploy sau human yes. |
| Không phải | DEX, launchpad, vault, money market, collection Gnomies. |

`protocolBps` trên market v1 là const `50`. v2 giữ nguyên. Đổi bps = live param → **không** làm trừ khi human yes (và yes đó không nằm trong note này).

## Ba hướng listing (chọn 1)

Trước khi lock unique-item:

1. **Giữ GRC20 amount lots làm default Explore.** Factory token, `amount` escrow, một giá cho cả lô. Đúng v1. Không phải marketplace của *vật*.
2. **Dual book ngang hàng.** Explore trộn lot fungible và unique item. Buyer phải đọc hai schema (`amount` vs `id`). Fee vẫn 50 bps nhưng copy dễ lẫn “price per token” với “price of this item”.
3. **Unique-item book là default.** Một id, một price, escrow ownership. Module `market` còn đó cho ai cần OTC GRC20. **Chọn hướng này** — khớp `docs/NFT.md`.

Không cân nhắc bonding curve, AMM, offer book, auction. Đó không phải Bazaar.

## Vì sao một id / một price hợp marketplace hơn lot GRC20

v1 `listing` là `(id, symbol, seller, amount, price, status)`. `Buy(id)` lấy **cả lô**. Không partial fill. Trên giấy đó đã là “một giá cho một hàng”. Trên sản phẩm thì hàng đó là *số lượng token fungible*, không phải *một vật*.

### 1. Quote một chiều

Lot GRC20 có hai số người dùng hay nhân nhầm:

- `amount` = bao nhiêu unit trong escrow
- `priceUgnot` = tổng GNOT cho **cả** lô, không phải unit price

Buyer thấy “100 DEMO · 1 GNOT” có thể đọc thành 1 GNOT / token. Realm không biết unit price. Unique item bỏ `amount`. Còn `(id, priceUgnot)`. Giá trên card **là** giá phải `OriginSend`. Không suy ra unit, không chia, không remainder lot.

### 2. Escrow khớp ownership, không khớp balance

Lot: `List` pull `amount` GRC20 vào realm; `Buy` / `Cancel` push lại. Cần `symbol`, balance, supply headroom (Create đã cap supply vì `int64`). Một seller có thể mở nhiều lot cùng symbol — Explore là đống lô trùng ticker.

Unique item: `List` chuyển **owner của đúng một id** sang realm. `OwnerOf(id)` khi listed = realm. `SellerOf(id)` giữ seller. `Buy` chuyển id cho buyer. Không còn “bao nhiêu unit”. Không list fraction. Repeat `List` trên id đã listed → revert (idempotent / no silent overwrite).

Money path fail-closed gọn hơn: sai owner, đã listed, `OriginSend != price`, self-buy → `panic`. Không có nhánh `amount` overflow trên List.

### 3. Marketplace bán vật, không bán lô OTC

Bazaar v1 là fixed-price **token book**. Hợp OTC GRC20. Không hợp Explore dạng card: không image, không `#id`, identity là `symbol`. Research UX v1 đã **reject** artwork card vì Pearl không có unique item.

v2: `Mint(name, imageURL)` → id. Explore = image card, name, `#id`, price GNOT. Đó là job của marketplace. Lot GRC20 không có media; nhét JPEG lên fungible lot là fake collection.

Một mint / một call. Không field `supply`. Không decimals. Create form v1 (name / symbol / decimals / supply) **không** dùng cho nft module.

### 4. Fee gắn vào GNOT price, không gắn vào amount

`fee.ProtocolFee(price, bps)` lấy **price ugnot**, không lấy token amount, không lấy “value” USD. Lot hay unique item đều đúng **nếu** price = số buyer gửi.

Với lot, seller có thể list `amount=1` giá 1 ugnot hoặc `amount=1e15` giá 1 ugnot — cùng fee floor, khác hẳn hàng. Unique item: một object, một price. 50 bps luôn là 50 bps của đúng số `OriginSend`. Không có “fee per token”.

### 5. Pearl không cho GRC721 stdlib — unique realm là đủ

Không `p/demo/tokens/grc721` trên Pearl. Không import quarantined official `grc721`. Bazaar ship realm riêng. Không wrap collection khác. Không giả GRC20 “NFT” bằng `supply=1` + decimals 0: ticker vẫn fungible, List vẫn có `amount`, người khác có thể Create cùng pattern và nhầm Explore.

`supply=1` GRC20 **không** thay unique item. Owner của 1 unit không phải `OwnerOf(id)`. Transfer hết 1 unit rồi mint thêm nếu factory cho phép. Unique id thì mint một lần, id không tái sử dụng (`NextID` tăng).

## Fee: giữ 50 bps trên GNOT price

Reuse `gno.land/p/bazaar/fee/v1`. Không fork công thức. Không fee bằng item. Không fee bằng GRC20.

Invariant (giống market):

- `Denom = 10000`
- `ProtocolFee(price, 50)` = `(price * 50) / 10000` overflow-safe (`q*bps + r*bps/Denom`)
- Floor integer. Không round-up.
- Buyer `OriginSend` **đúng** `price` ugnot. Fee lấy từ số đó, không cộng thêm.
- Seller: `SellerProceeds = price - fee`
- Protocol: cộng `fees`, admin `WithdrawFees`

Ví dụ đã có test, không bịa:

| price (ugnot) | fee 50 bps | seller |
| --- | ---: | ---: |
| 1_000_000 (1 GNOT) | 5_000 | 995_000 |
| 12_345 | 61 | 12_284 |
| 1 | 0 | 1 |

`ProtocolBps()` read-only. **Không** `SetBps`. **Không** slider trên UI. Đổi 50 → số khác là live param change: cần human yes, không nằm trong v2 nft ship.

UI copy (English, giống v1): Buyer pays X GNOT. Protocol fee 0.50% = Y GNOT. Seller receives Z GNOT. Fee **included in the price** — không “adjust for fees”, không cộng royalty.

## Min price 1 ugnot; UI chống dust

Realm: `priceUgnot > 0`. Min on-chain = **1 ugnot**. Không min 1 GNOT (sẽ khóa listing nhỏ hơn 1 GNOT một cách im lặng so với spec).

Dust là vấn đề **fee floor**, không phải lý do tăng min hay tăng bps:

- `ProtocolFee(n, 50) == 0` khi `n < 200` ugnot (vì `n * 50 / 10000` floor).
- Listing 1 ugnot: protocol thu 0; seller nhận 1; buyer vẫn trả gas Adena bằng ugnot.
- Đó không phải bug của `fee/v1`. Đừng “sửa” bằng live bps hay min price 1 GNOT.

UI (English):

- Sell form: GNOT input; convert sang ugnot; reject `<= 0`.
- Helper khi `priceUgnot < 200`: fee sẽ là 0 ugnot — discourage dust, vẫn cho List nếu `> 0`.
- Không hiện USD “để thấy dust nhỏ”. Testnet GNOT không có market value.

Create GRC20 v1 cap supply để giữ int64 headroom. Unique mint **không** có supply; headroom nằm ở `NextID` / `int` id. Không bẻ cap sang nft.

## Không royalty slider ở v2

v1 đã reject creator earnings (research UX). v2 **không** mở lại.

Royalty (OpenSea / Magic Eden style) sẽ thêm:

- Money path thứ hai: `price - protocol - royalty` — sai caller / sai bps / creator = zero address phải fail-closed.
- “Creator” sau `Transfer`: minter? owner lúc list? registry ngoài? Unique item đổi tay; royalty bám minter thì cần field vĩnh viễn; royalty bám seller thì đó chỉ là protocol fee giả.
- Slider trên form List = **per-listing param**. Trông như live fee policy. Protocol 50 bps phải đọc một chỗ (`ProtocolBps()`). Slider phá “buyer pays price, protocol 50 bps, seller rest”.
- EIP-2981 / royalty registry = primitive mới. Hard rule: không homemade trừ khi user hỏi. User không hỏi.

v2: một fee, một bps, một package. Seller rest. Mint không gắn “earnings”. Collection copy = “Bazaar”, không “creator royalty 5%”.

Nếu sau này human muốn royalty: realm mới + `SetModule`, không mutate bps trên nft đang chạy.

## Không USD

Giống v1. Quote on-chain = ugnot. UI = GNOT. Pearl testnet GNOT không có market value.

Không:

- Fake USD dưới giá card
- Floor USD, volume USD, PnL
- Oracle (không phải sản phẩm Bazaar)
- “worth $x” trên fee preview

Banner testnet vẫn bắt buộc nếu UI trỏ Pearl. Không phải legal cover; chỉ để khỏi đọc GNOT như tiền thật.

## Hub và module

```
SetModule("nft", "gno.land/r/bazaar/nft")
```

UI: `GetModule("nft")` trước. Explore default = unique items. `market` không xóa: GRC20 lot vẫn gọi được nếu module path còn. Upgrade nft = deploy `nftv2` rồi `SetModule("nft", newPath)`. Open listings trên module cũ ở lại đến `Buy` / `Cancel`.

Không `SetModule` trên Pearl cho đến human yes. Note này không phải yes đó.

## Invariants v2 (kỳ vọng khi code — chưa ship trong note)

- Một id, một owner. Listed: owner = realm, `SellerOf` = seller, `PriceOf` > 0, `Listed` true.
- `List`: caller = current owner; chưa listed; `priceUgnot >= 1`.
- `Buy`: EOA; không self-buy; `OriginSend == price` ugnot; item → buyer; protocol `ProtocolFee(price, 50)`; seller `price - fee`.
- `Cancel`: chỉ seller; item về seller; không đụng ugnot protocol.
- `Mint`: EOA; name 1–64, không newline; imageURL rỗng hoặc `http://` / `https://`, max 200, không whitespace; một id mới; không supply.
- Fee math chỉ qua `p/bazaar/fee/v1`. `bps` const 50.
- Fail-closed: `panic`, không `error` trên funds / ownership.
- Không royalty, không USD, không AMM, không bonding curve.

## Assumptions not proven

- Unique-item realm chưa có trong tree (`r/bazaar/nft` chưa ship lúc viết note). Spec = `docs/NFT.md`, không phải bytecode.
- Pearl vẫn không có `p/demo/tokens/grc721` (đúng tại 2026-09-19). Nếu sau này chain thêm GRC721 stdlib, Bazaar **không** tự migrate collection trong note này.
- `ListOpen()` cap 50 đủ cho Explore client-side; chưa indexer.
- User phân biệt GNOT vs USD nhờ banner, không nhờ legal.
- Dust listing (`fee == 0`) chấp nhận được nếu UI cảnh báo; không nâng min on-chain trong v2.
- Adena `OriginSend` exact ugnot giống market v1.

## Không làm

- Không đổi `protocolBps` / không `SetBps` / không live param.
- Không royalty slider, không creator earnings, không EIP-2981.
- Không USD, không oracle, không floor/volume chart.
- Không biến GRC20 lot thành “NFT” bằng `supply = 1`.
- Không import quarantined `grc721`. Không addpkg Pearl trong note này.
- Không bonding curve, AMM, vault harvest, offer, auction, sweep.
- Không edit repo công ty khác. Không wrap collection Gnomies.
- Không code realm / UI trong note này.

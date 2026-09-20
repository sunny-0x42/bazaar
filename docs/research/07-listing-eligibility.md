# Listing eligibility — Gno không list GRC721 lạ (2026-09-19)

Notes only. Không phải investment advice. Không hứa volume. Không wrap collection ngoài Bazaar. Không live param change. Không edit realm trong note này.

Mục tiêu: khóa **ai được list trên Bazaar**, vì sao Gno **không** cho “paste a contract address”, và vì sao product = **`CreateDrop`** (Path A) chứ không phải ingest GRC721 arbitrary. Fee: **50 bps secondary only**. **Không royalty.** Nguồn product: [`docs/LISTING.md`](../LISTING.md). UI copy đề xuất luôn English.

## Constraint (không bịa)

Từ `docs/LISTING.md`, `docs/LAUNCH.md`, `docs/NFT.md`, `docs/COMPANY.md`, `docs/API.md`, `docs/research/03-nft-defi.md`, `docs/research/04-launchpad.md`, `p/bazaar/fee/v1`, realm `gno.land/r/bazaar/nft`:

| Fact | Value |
| --- | --- |
| Testnet | **Pearl / Test16**, `pearl-1`. Không gemstone sau Pearl. |
| Pearl tokens | `gno.land/p/demo/tokens/grc20` có. **Không** `p/demo/tokens/grc721`. |
| Gno import | **Không** dynamic import. Compile-time `import` path. Realm không gọi `TransferFrom` trên package lạ lúc runtime. |
| Product | Unique-item book `gno.land/r/bazaar/nft`. Một id, một GNOT price. Không fraction. |
| Launch | `CreateDrop` + `PublicMint` = **fixed-price** drop. Primary **0** protocol fee. |
| Secondary | `List` / `Buy` / `Cancel`. Protocol **50 bps** of the ugnot price (`p/bazaar/fee/v1`). Seller rest. |
| Quote | Native `ugnot`. UI **GNOT** (`1 GNOT = 1_000_000 ugnot`). Không USD. |
| Min price (book) | `List`: `priceUgnot > 0` → **1 ugnot**. UI discourages dust. |
| Drop cap | `maxSupply` 1–3000. `CreateCollection` không public mint (`maxSupply=0`). |
| Slug | Unique, 2–16 `[a-z0-9-]`. |
| Royalty | **Không.** 0 bps primary ≠ creator earnings trên `Buy`. |
| `protocolBps` | Const `50`. Không `SetBps`. |
| GRC20 Create (legacy) | Supply cap `1e15` trong `r/bazaar/market` để giữ int64 headroom. **Không** bẻ cap đó sang drop. |
| Không phải | DEX, bonding-curve pad, vault harvest, collection ngoài Bazaar. |

Pearl RPC: `https://rpc.pearl.testnets.gno.land:443`. Faucet: `https://pearl.testnets.gno.land/faucet`. Docs: [Gno networks](https://docs.gno.land/resources/gnoland-networks).

## Nguồn đã đọc

| Venue | Loại | Path / URL |
| --- | --- | --- |
| Bazaar | **Product listing paths A/B/C + eligibility** | `docs/LISTING.md` |
| Bazaar | Launch spec (`CreateDrop` / `PublicMint`) | `docs/LAUNCH.md` |
| Bazaar | Unique-item book | `docs/NFT.md` |
| Bazaar | Company: NFT marketplace + launchpad; no GRC721 on Pearl | `docs/COMPANY.md` |
| Bazaar | GRC20 factory **trong** market realm vì không compile-time import token lạ | `docs/API.md` |
| Bazaar | Fee 50 bps / no royalty / min 1 ugnot | `docs/research/03-nft-defi.md` |
| Bazaar | Primary 0 bps, secondary 50 bps | `docs/research/04-launchpad.md` |
| Bazaar | External GRC721 = Later, chỉ nếu Pearl có `grc721` + registry | `docs/UPGRADE.md` #7 |
| Bazaar | Tree: `CreateDrop`, `PublicMint`, `List`, `Buy` | `gno.land/r/bazaar/nft/` |
| Bazaar | Overflow-safe fee | `gno.land/p/bazaar/fee/v1` |
| Gno | Pearl = current testnet | https://docs.gno.land/resources/gnoland-networks |

Không đọc / không cite repo công ty khác. Path C trong `docs/LISTING.md` nêu “NFT from another realm” như **ví dụ loại pull listing** — Bazaar **không** ingest collection đó.

## Ba hướng listing (chọn 1)

Trước khi lock Path A:

1. **OpenSea-style pull.** UI “paste GRC721 path / tokenId”. Realm gọi `TransferFrom` trên collection lạ, escrow, rồi `Buy`. **Không khả thi trên Gno / Pearl** — xem mục dưới. Reject.
2. **Dual book.** Explore trộn item Bazaar với wrapper “foreign NFT”. Buyer đọc hai schema (id trong `r/bazaar/nft` vs id ở realm khác). Fee 50 bps dễ lẫn với royalty / push callback. Reject cho v1 — `docs/UPGRADE.md` #7 để Later.
3. **`CreateDrop` là product.** Item sinh **trong** `gno.land/r/bazaar/nft`. List chỉ khi `OwnerOf(id)` là caller và item chưa listed. **Chọn hướng này** — khớp `docs/LISTING.md` Path A (default) + Path B.

Không cân nhắc bonding curve, AMM, offer book, auction. Đó không phải Bazaar.

## `docs/LISTING.md` — ba path, một default

Spec product (không bịa thêm path):

```
Path A  CreateDrop → PublicMint → (holder) List → Buy     ← default, đây là product
Path B  OwnerOf(id)==you và chưa listed → List            ← item đã sống ở đây
Path C  NFT realm khác                                      ← không pull; push OpenListing = later
```

| Path | Ai mint | Ai list | Lên Explore này |
| --- | --- | --- | --- |
| **A — Launch on our pad** | Collector `PublicMint(slug)` trên `r/bazaar/nft` | Holder `List(id, priceUgnot)` | Có. Secondary book cùng realm. |
| **B — Own here** | Đã `Mint` / `MintIn` / `PublicMint` / `Transfer` **trong** realm này | Owner EOA, chưa listed | Có. UI Sell / Portfolio → Sell. |
| **C — Other realm** | Realm khác | **Không** pull | Không. Cần **push** (`OpenListing`) — later. |

Template standalone trong `docs/LISTING.md` (`gno.land/p/bazaar/dropstd/v1` + copy drop+book) = **cùng luật, namespace khác**. Họ trade trên **realm của họ**. Muốn hiện trên **Explore này** vẫn phải mint qua Path A hoặc Path B. Package `dropstd/v1` **chưa** có trong tree — spec, không pretends đã ship.

`ListingRules()` trong `docs/LISTING.md` = English blurb cho UI. **Chưa** có trong `nft.gno` / `book.gno` lúc viết note. Eligibility **đã** enforce on-chain (`panic`). UI Launch validate slug / maxSupply / mintPrice **client-side** cho form; realm vẫn fail-closed.

## Vì sao Gno không list arbitrary GRC721

Câu đầu `docs/LISTING.md`:

> Gno cannot `TransferFrom` an unknown GRC721 at runtime. Pearl has no `p/demo/tokens/grc721`. So listing is **not** “paste a contract address” like OpenSea.

Bốn ràng buộc, không phải UX preference.

### 1. Không dynamic import → không pull

EVM marketplace: user paste `address` + `tokenId`. Contract gọi `IERC721(addr).safeTransferFrom`. ABI runtime, address là data.

Gno: `import "gno.land/r/…"`. Path **cố định lúc compile**. Realm Bazaar **không** nhận string path rồi gọi `TransferFrom` trên package đó. Không reflection, không `interface{}` thành teller của realm lạ.

Hệ quả: **pull listing** (marketplace kéo NFT vào escrow) chỉ làm được với type **đã import**. Arbitrary GRC721 = arbitrary package = không import được lúc runtime.

Cùng lý do v1 nhét GRC20 **factory vào cùng realm** với book (`docs/API.md`): listing escrow token **không** compile-time import được token lạ. Unique item v2 làm tương tự — ownership sống **trong** `r/bazaar/nft`, không wrap collection ngoài.

### 2. Pearl không có `p/demo/tokens/grc721`

Dù có dynamic import, Pearl genesis **không** ship GRC721 dưới `p/demo/tokens/`. Có `grc20`. Official `grc721` trong gnolang/gno: historical / quarantined / `p/nt/grc721` trên master — **không** phải Pearl demo path. Bazaar **không** vendor quarantined stdlib (`docs/research/02-nft-pivot.md`, `docs/UPGRADE.md` #7).

Không có interface chung trên Pearl thì không có “mọi NFT nói cùng `TransferFrom`”.

### 3. Pull listing cần Approve + TransferFrom trên **đúng** ledger

Giả sử một collection ngoài implement GRC721-like. Để Bazaar `List` kéo item:

- Holder phải `Approve` / `setApprovalForAll` **Bazaar**.
- Bazaar phải gọi `TransferFrom(holder, bazaar, id)` trên **package của họ**.

Bước hai = import compile-time. Không import → không escrow → `Buy` không có hàng. Fail-closed đúng nghĩa: missing permission / missing asset → không “list ảo” rồi panic lúc buy.

Path C trong `docs/LISTING.md` đảo chiều: **push**. Realm kia import Bazaar, gọi `OpenListing`. Bazaar nhận item vì **họ** chủ động chuyển. Đó là upgrade **sau**, không phải v1. `OpenListing` **không** có trong tree.

### 4. “Paste address” kể sai câu chuyện ownership

OpenSea identity = `(contract, tokenId)`. Bazaar identity = `id` trong **một** realm. `OwnerOf(id)` / `SellerOf` / `PriceOf` / escrow `owner = realm` chỉ đúng cho item mint ở đây.

Nhận string path lạ rồi hiện card trên Explore = **fake listing**: Bazaar không giữ owner, không fail-closed `Buy`, không 50 bps trên `OriginSend`. Marketplace không được show hàng nó không settle được.

Path B không phá invariant: “item you already own **here**” — `OwnerOf(id) == you` trên **cùng** realm.

## CreateDrop là product

Không phải workaround cho thiếu GRC721. Là **cách sinh hàng** khớp import + escrow.

```
CreateDrop(slug, name, cover, maxSupply, mintPriceUgnot)
        │  creator = caller (EOA)
        │  slug unique; maxSupply 1–3000; mintPrice >= 0
        ▼
PublicMint(slug)                 ← primary. minted < maxSupply
  OriginSend == mintPrice
  ugnot ──100%──► creator        ← 0 protocol fee
  item  ──owner──► minter        ← id mới trong r/bazaar/nft
        │
        ▼
List(id, priceUgnot)             ← Path A bước 3, hoặc Path B
  owner EOA; chưa listed; price > 0
  owner → realm (escrow)
        │
        ▼
Buy(id)                          ← secondary
  OriginSend == price
  ProtocolFee(price, 50) ──► fees
  price − fee ───────────► seller
  item ──────────────────► buyer
```

| Bề mặt | Job | Không phải |
| --- | --- | --- |
| **Launch** | `CreateDrop` + `PublicMint` | Bonding curve, Dutch, allowlist, paste GRC721 |
| **Explore** | Secondary book (listed items) | Registry collection ngoài |
| **Sell / Portfolio** | Path B: list / cancel item **ở đây** | Wrap token realm khác |

`CreateCollection` giữ: không public mint (`maxSupply=0`). `PublicMint` panic `"nft: not a drop"`. Mint EOA `Mint` / `MintIn` (free, về caller) **không** thay `PublicMint` — không checkout, không mintPrice.

Standalone template (`dropstd/v1`) **không** thay Path A trên Explore này. Cùng luật, khác namespace; hiện trên Bazaar Explore vẫn Path A/B.

## 50 bps secondary only

Khớp `docs/LISTING.md` bước 2–3 Path A và `docs/research/04-launchpad.md`.

| | Primary `PublicMint` | Secondary `Buy` |
| --- | --- | --- |
| Hàng | Slot drop (`minted < maxSupply`) | Item đã mint, đang listed |
| Giá | `mintPrice` lúc `CreateDrop` | `priceUgnot` lúc `List` (≥ 1 ugnot) |
| `OriginSend` | Đúng `mintPrice` (0 được) | Đúng `price` |
| Ai nhận GNOT | **Creator** 100% | Seller `price − fee` |
| Protocol | **0.** Không gọi `ProtocolFee` | **50 bps**, `p/bazaar/fee/v1` |
| Owner sau tx | Minter | Buyer |

Math (overflow-safe, đã test):

- `Denom = 10000`
- `ProtocolFee(price, 50)` = `(price * 50) / 10000` floor (`q*bps + r*bps/Denom`)
- Buyer pays `price`. Seller `SellerProceeds = price − fee`. Protocol cộng `fees`.

Ví dụ 1 GNOT: fee **5_000** ugnot; seller **995_000**. `ProtocolBps()` read-only. **Không** `SetBps`. Đổi 50 = live param → human yes, không nằm trong note này.

Vì sao không 50 bps trên `PublicMint`: protocol bán **settlement trên book**, không bán **sinh hàng**. `PublicMint` không `SellerOf`, không listing. Cắt fee lúc mint = protocol đứng chỗ creator. Một const, một chỗ gọi `ProtocolFee` (`Buy` trong `book.gno`). Primary: `SendCoins` nguyên `OriginSend` (no-op khi 0).

UI: nút Public Mint **không** dòng “protocol 0.50%”. Drawer Buy / form Sell **có** You pay / Protocol 0.50% / Seller receives.

Dust: `ProtocolFee(n, 50) == 0` khi `n < 200` ugnot. `List` vẫn cho 1 ugnot; UI discourage — không nâng min on-chain, không thuế primary để “bù dust”.

## Không royalty

`docs/LISTING.md` không có creator earnings. `docs/research/03-nft-defi.md` **reject** royalty slider. Giữ.

| | Primary 0 bps | Royalty trên `Buy` |
| --- | --- | --- |
| Khi nào | Một lần, `PublicMint` | Mọi secondary sale |
| Ai nhận | Creator của drop | Minter / registry / seller? |
| Bám item | Không. Vào book thì 50 bps như mọi listing | Bám id mãi |
| Param | Không gọi fee | bps thứ hai |

Royalty sẽ thêm money path `price − protocol − royalty`. Sai caller / creator = zero / overflow phải fail-closed lần nữa. “Creator” sau `Transfer` không rõ. Slider trên List = per-listing param — phá “buyer pays price, protocol 50 bps, seller rest”. EIP-2981 / royalty registry = primitive mới; user không hỏi.

0 bps primary **không** phải royalty trá hình. Mint xong, minter `List` → `Buy`: seller (cũ là minter) nhận `price − fee`. Creator drop **không** ăn thêm trừ khi họ vẫn là seller.

Nếu sau này human muốn royalty: realm mới + `SetModule`, không mutate `protocolBps` đang chạy.

## Eligibility (enforced) — map `docs/LISTING.md`

On-chain, fail-closed (`panic`):

| Rule (`docs/LISTING.md`) | Realm |
| --- | --- |
| Slug unique, 2–16 `[a-z0-9-]` | `validSlug` + `collections.Has` → `"nft: collection exists"` |
| maxSupply 1–3000 for drops | `CreateDrop`: `< 1 \|\| > 3000` → `"nft: maxSupply"` |
| List: owner EOA, price > 0 ugnot, not already listed | `requireUser` (`IsUserCall`); `priceUgnot <= 0`; `it.owner != caller`; `it.listed` |
| Buy: exact OriginSend, not self-buy | `sent != it.price`; `caller == it.seller` |

Thêm (cùng invariant, không nới Path C):

- `CreateDrop` / `List` / `Buy` / `PublicMint`: EOA only, `cur.IsCurrent()` (anti-spoof).
- Repeat `List` trên id đã listed → revert (no silent overwrite).
- Repeat cùng slug → revert.
- `PublicMint` hết supply / không phải drop / sai send → panic.
- `mintPrice >= 0` (free mint first-class). `List` không cho 0.

Không có rule “path GRC721 hợp lệ” — không có field đó.

## Tree vs spec (honest)

| Surface | `docs/LISTING.md` | Tree `r/bazaar/nft` (2026-09-19) |
| --- | --- | --- |
| Path A `CreateDrop` / `PublicMint` | Default product | **Có** (`nft.gno` / `book.gno`). UI Launch gọi `CreateDrop`. |
| Path B `List` nếu `OwnerOf` | Sell / Portfolio | **Có.** |
| Path C pull GRC721 | Not supported | **Không** có import / wrap. Đúng spec. |
| Path C push `OpenListing` | Later upgrade | **Chưa** có hàm. |
| `dropstd/v1` standalone | Template | **Chưa** package. |
| `ListingRules()` | English blurb UI | **Chưa.** Eligibility nằm ở `panic` + UI form checks. |
| 50 bps secondary | Path A bước 3 | `protocolBps = 50` trên `Buy` only. `PublicMint` không gọi `fee`. |
| Royalty | (không nêu) | Không field, không bps thứ hai. |

Note này **không** implement `OpenListing`, `ListingRules`, hay `dropstd`. Pearl `addpkg` cần human yes riêng.

## Invariants (giữ)

- Chỉ item mint trong `gno.land/r/bazaar/nft` (hoặc copy addpkg cùng code) mới `List` / `Buy` được trên book này.
- Không pull GRC721 lạ. Không paste package path.
- Primary: `OriginSend == mintPrice`; creator nhận đủ; `fees` không đổi.
- Secondary: `Buy` → `fee.ProtocolFee(price, 50)`; seller `price − fee`; `protocolBps` const 50.
- `List` min 1 ugnot. `PublicMint` cho phép 0.
- Fail-closed trên funds / ownership. Repeat unique slot → revert.
- Không royalty, không USD, không AMM, không bonding curve.
- GRC20 `market` = legacy OTC; không default Explore; supply cap Create không áp cho drop.

## Assumptions not proven

- Pearl vẫn không có `p/demo/tokens/grc721` tại ngày note. Nếu chain sau này genesis / addpkg `grc721` + registry kiểu `grc20reg`, Bazaar **không** tự bật Path C trong note này — cần model push + human yes (`docs/UPGRADE.md` #7).
- `OpenListing` push: realm ngoài phải import Bazaar **và** chịu 50 bps secondary, 0 royalty. Chưa thiết kế signature / escrow cross-realm.
- `dropstd/v1` trong `docs/LISTING.md` là hướng namespace, chưa code. Không pretends Explore ingest realm standalone.
- `ListingRules()` chưa ship; UI Launch copy English đủ tạm. Không giả realm trả markdown rules.
- Cap 50 `ListOpen` đủ Explore client-side.
- User hiểu mint price = trả creator, list price = trả seller + 50 bps. Banner Pearl: test GNOT không có market value — mitigation, không legal cover.
- Adena exact `OriginSend` ugnot giống `Buy` / paid `PublicMint`.
- Sample slots PublicMint **không** cam kết volume / sell-out.

## Không làm

- Không “paste a contract address”. Không pull `TransferFrom` GRC721 lạ.
- Không import / vendor `p/demo/tokens/grc721` (không tồn tại trên Pearl) hay quarantined / `p/nt/grc721`.
- Không wrap collection ngoài Bazaar. Không edit repo công ty khác.
- Không 50 bps trên `PublicMint`. Không `mintBps`. Không `SetBps` / live param.
- Không royalty, không creator earnings trên `Buy`, không EIP-2981.
- Không USD, không oracle, không floor/volume claims, không “drop will sell out”.
- Không bonding curve, AMM, vault harvest, Dutch, auction, offer, sweep.
- Không ship `OpenListing` / `dropstd` / `ListingRules` trong note này.
- Không đổi `protocolBps` 50 trên secondary.
- Không investment language.

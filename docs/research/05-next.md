# Sau launchpad + priced marketplace (2026-09-19)

Notes only. Không phải investment advice. Không hứa volume. Không clone Gnomies. Không bonding curve kiểu gnomi.fun. Không edit realm trong note này.

Mục tiêu: khóa **Now / Next / Later** sau khi Bazaar đã có **Launch** (fixed-price drop) và **Explore** (fixed-price secondary book). Next = **Collection pages** + **Activity feed**. UI copy đề xuất luôn English.

## Constraint (không bịa)

| Fact | Value |
| --- | --- |
| Testnet hiện tại | **Pearl / Test16**, `pearl-1`. Official docs: “the one to use unless you have a reason not to”. **Không** gemstone sau Pearl. Tag sau Pearl là `chain/mainnet` (`gnoland-1`). |
| Pearl tokens | `gno.land/p/demo/tokens/grc20` có. `r/demo/defi/grc20reg` có (`docs/COMPANY.md`). **Không** `p/demo/tokens/grc721`. |
| Gno import | Không dynamic import. Unique item sống **trong** `gno.land/r/bazaar/nft`. Không ingest collection lạ lúc runtime. |
| Escrow | `List(id, priceUgnot)`: owner → realm. `Buy`: `OriginSend` == price ugnot. Fee 50 bps từ price (`p/bazaar/fee/v1`). |
| Launchpad Bazaar | `docs/LAUNCH.md`: `CreateDrop` + `PublicMint` = **fixed-price** collection drop. Primary mint **không** protocol fee. Secondary `List`/`Buy` mới lấy 50 bps. |
| Không phải | DEX (Zdex / GnoSwap). Launchpad curve (gnomi.fun). Collection Gnomies (~3000 piece, repo khác). |
| Wallet | Adena. English UI. Quote **GNOT** (`1 GNOT = 1_000_000 ugnot`). Không fake USD. |

Pearl RPC: `https://rpc.pearl.testnets.gno.land:443`. Faucet: `https://pearl.testnets.gno.land/faucet`. Docs: [Gno networks](https://docs.gno.land/resources/gnoland-networks). Getting started cũng ghi “Pearl is the current testnet” ([Getting started](https://docs.gno.land/builders/getting-started)).

## Now / Next / Later

Bảng ngắn. Mỗi **Next** cần human yes trước Pearl `addpkg`.

| When | Ship | Không ship |
| --- | --- | --- |
| **Now** | Unique-item book: `Mint` / `List` / `Buy` / `Cancel`. Explore = collection cards. Launch = fixed-price `PublicMint` (`docs/LAUNCH.md`). Fee 50 bps trên secondary. Adena + Pearl banner. | Curve, DEX, Gnomies art, USD, offer. |
| **Next** | **Collection page** (cover, slug, listed count, min listed GNOT, tabs **Items** / **Activity**). **Activity feed** từ on-chain recent log (cap, `eval`). `ListItemsByCollection` (listed + unlisted). Padded AVL keys nếu page cần mint-order. | Trait, rarity, 24h volume, bulk list, sweep, royalty slider. |
| **Later** | `tx-indexer` GraphQL cho history đầy đủ / live subscribe. Media allowlist. External GRC721 **chỉ nếu** Pearl sau này deploy `grc721` + registry kiểu `grc20reg`. | Auction, order book, AMM, “next OpenSea”. |

## Tree vs spec (honest)

Spec **Now** = `docs/LAUNCH.md` + `docs/NFT.md` + `docs/UPGRADE.md`. Tree local (2026-09-19) **chưa** khớp hết:

| Surface | Spec | Tree |
| --- | --- | --- |
| Secondary book | `List` / `Buy` / `Cancel`, 1 id = 1 price | Có (`book.gno`). `chain.Emit("List"\|"Buy"\|"Cancel")`. |
| Collection | `CreateCollection(slug, name, cover)`. `ListCollections` / `ListByCollection` | Có. `ListByCollection` chỉ **listed**, cap 50, scan cả tree. |
| Launch | `CreateDrop` / `PublicMint` / `DropLine`. Nav **Launch** | **Chưa** trong `nft.gno`. UI nav vẫn **Mint** / Sell / Portfolio (`Header.tsx`). |
| Collection card | Floor = min listed GNOT, hoặc mint price (`LAUNCH.md`) | Cover + name + item count. Tag Preview. **Không** floor. |
| Collection page | ME/OS-class page | Drill-down: Back + sort + listed grid. Không tab Activity. |
| Activity | `UPGRADE.md` #8: indexer GraphQL, “not required for v2” | Emit có. UI **không** đọc event. `eval` không thấy ABCI logs. |

Note này **không** implement drop. Next giả định Launch + priced book đã là product; gap tree là việc ship, không đổi hướng.

## Nguồn đã đọc

| Venue | Loại | URL |
| --- | --- | --- |
| Gno | Networks: Pearl = current testnet; Staging; Mainnet `gnoland-1`; Sapphire/Topaz archived | https://docs.gno.land/resources/gnoland-networks |
| Gno | Getting started: Pearl is the current testnet | https://docs.gno.land/builders/getting-started |
| Gno | Events: `chain.Emit` → ABCI `/block_results`, không phải `eval` | https://docs.gno.land/resources/gno-stdlibs |
| Gno | Effective Gno: emit sau ownership / transfer | https://docs.gno.land/resources/effective-gno |
| Gno | `tx-indexer` GraphQL = off-chain feed (CPU-heavy reads) | https://docs.gno.land/resources/comparison-of-ways-to-interact-with-gnoland |
| Gno | Running a node: indexer cho query RPC không trả hiệu quả | https://docs.gno.land/builders/running-a-node |
| Gno | tx-indexer repo (GraphQL `/graphql/query`) | https://github.com/gnolang/tx-indexer |
| OpenSea | Collection overview + Items | https://support.opensea.io/en/articles/8867024-how-do-i-update-my-collection-page |
| Magic Eden | Collection page: filters, activity, bulk list, last sale | https://help.magiceden.io/en/articles/8264557-how-to-use-magic-eden-s-collection-page-for-nft-discovery-and-trading |
| Uniswap | Testnet crypto has no market value | https://support.uniswap.org/hc/en-us/articles/14580495154445-Testnets-on-Uniswap |
| Bazaar | Launch spec | `docs/LAUNCH.md` |
| Bazaar | NFT book | `docs/NFT.md` |
| Bazaar | Upgrade list | `docs/UPGRADE.md` |
| Bazaar | UX v1 (Activity = adapt later) | `docs/research/01-marketplace-ux.md` |
| Bazaar | Pivot v2 (collection page Adapt, một Collection “Bazaar”) | `docs/research/02-nft-pivot.md` |
| Bazaar | Fee / no royalty / no USD | `docs/research/03-nft-defi.md` |
| Bazaar | Network | `docs/research/00-network.md` |

## Map fixed-price escrow lên Gno (giữ)

Không đổi money path. Next chỉ **đọc** và **nhóm** state đã có.

```
CreateDrop / MintIn  →  item.owner = minter
List(id, price)      →  owner = realm, SellerOf = seller, PriceOf = price
Buy(id)              →  OriginSend == price ugnot; fee 50 bps; item → buyer
Cancel(id)           →  item về seller
```

Gno không dynamic-import GRC721 lạ. Pearl không có `p/demo/tokens/grc721`. Collection page **không** wrap Gnomies hay contract ngoài. GRC20 `market` / `grc20reg` = legacy OTC, không phải default Explore (`docs/NFT.md`).

`IsUserCall` + exact `OriginSend`. Panic on money paths. Repeat `List` trên id đã listed → revert.

## Next 1 — Collection pages

`02-nft-pivot.md` Adapt collection page thành **một** Explore “Bazaar”. Tree đã có **nhiều** slug (`CreateCollection`, samples `stones` / `lamps` / `relics`). `LAUNCH.md` đã đòi card hiện floor. Next = page đúng việc **nhóm items**, không phải CMS.

### Keep / Adapt / Reject

Keep = copy interaction. Adapt = cùng job, khác surface vì unique-item realm / Adena / Pearl / cap 50. Reject = không làm ở Next.

| Pattern | Source | Verdict | Why |
| --- | --- | --- | --- |
| Cover + name + slug header | OS overview; ME collection page | **Keep** | `CreateCollection` đã store. UI drill-down mới có `h1` + count. |
| Items grid 1:1 artwork | OS Items; ME rich card | **Keep** | Đã có `ListingCard`. Filter **Listed** default (khớp book). Toggle **All** cần `ListItemsByCollection`. |
| Floor = min listed GNOT | ME/OS floor; `LAUNCH.md` | **Adapt** | Số on-chain: `min(PriceOf)` trong listed set. Label English `From {n} GNOT` hoặc `Listed from`. Không USD. Không “floor will pump”. Drop chưa list: hiện mint price. |
| Listed count / minted / maxSupply | `LAUNCH.md` `ListCollections` columns | **Adapt** | `count` hiện = minted. Listed phải đếm từ book hoặc field mới. Drop: `{minted}/{maxSupply}`. |
| Tab **Items** / **Activity** | ME collection page | **Keep** | Activity = Next 2, scoped theo slug. |
| Trait accordion / rarity | ME filters; OS traits | **Reject** | Realm không traits. |
| 24h volume / last sale on card | ME last sale; Blur Volume | **Reject** (Next) | Cần indexer history. Later. |
| Bulk list / Buy floor / sweep | ME bulk; Blur Buy floor | **Reject** | Một `Buy(id)` = một tx. |
| Banner story CMS / verified check | OS overview | **Reject** | Không registry verified trên Pearl. |
| Ingest Gnomies / foreign GRC721 | — | **Reject** | Công ty khác; Pearl không `grc721`. |

### IA đề xuất (Next)

Explore home giữ collection grid. Click slug → **Collection page**, không nhảy thẳng item drawer.

```
[ Pearl testnet banner ………………………………………… faucet ]

[ Bazaar ]  Explore  Launch  Sell  Portfolio  [ g1… · pearl-1 ]

Explore / {slug}
  cover · name · slug
  Listed from {n} GNOT   ·  {listed} listed  ·  {minted} items
  [ Items ] [ Activity ]
```

- **Items**: sort Newest / Price (GNOT). Search name / `#id` / seller `g1…`. Empty listed: `No open listings in this collection.`
- Unlisted item trên All: CTA `List` (owner) — không Buy.
- Drop còn mint slot: secondary CTA `Mint` → Launch/`PublicMint` cùng slug. Không nhét curve.

### Realm đọc thêm (proposal, không code)

`ListByCollection` hôm nay: listed only, cap 50, `itemKey = strconv.Itoa(id)` → `"10"` trước `"2"` (`UPGRADE.md` #2).

Next nếu human yes:

1. `ListItemsByCollection(slug)` — mọi item trong slug, cap 50, listed flag trong `ItemLine`.
2. Pad `itemKey` (mint-order). Upgrade module path, không rewrite key im lặng.
3. Optional: `floorUgnot` / `listedCount` trên `ListCollections` để card không scan client-side. Không bắt buộc nếu UI min-price từ `ListByCollection`.

`TokensOf` scan cả tree (`UPGRADE.md` #3) — hữu ích Portfolio, không chặn collection page.

## Next 2 — Activity feed

`01-marketplace-ux.md`: Activity = **Adapt later** (v1 không WebSocket). `UPGRADE.md` #8: indexer GraphQL `Mint`/`List`/`Buy`, không bắt buộc v2. Sau Launch + priced book, feed là surface còn thiếu: collection page không kể *chuyện* (ai mint, ai list, ai buy).

Realm **đã** emit (`nft.gno` / `book.gno`): `Init`, `CreateCollection`, `Mint`, `Transfer`, `List`, `Buy`, `Cancel`, `TransferAdmin`, `WithdrawFees`.

Gno: `chain.Emit(type, key, value, …)` ghi vào ABCI results của block. Off-chain đọc `/block_results` hoặc **tx-indexer** GraphQL. `eval` / `qrender` **không** trả event log. ([stdlibs Events](https://docs.gno.land/resources/gno-stdlibs), [Effective Gno](https://docs.gno.land/resources/effective-gno), [tx-indexer](https://github.com/gnolang/tx-indexer).)

UI Bazaar hiện chỉ `eval` (`ListOpen`, `ListCollections`, `ListByCollection`). Pearl indexer **không** giả định có public endpoint cho Bazaar.

### Hai hướng (chọn 1 cho Next)

1. **On-chain recent log (chọn hướng này cho Next).** Ring/AVL cap 50 (cùng cap `ListOpen`). Mỗi `Mint`/`List`/`Buy`/`Cancel`/`PublicMint` append một dòng. `ListActivity()` / `ListActivityByCollection(slug)` cho `eval`. Trùng event ABCI — không homemade hash; chỉ copy string đã emit. Fail-closed: append **sau** money path thành công, không đổi fee math.
2. **tx-indexer GraphQL (Later).** Đúng Effective Gno / comparison docs cho “home feed”. Cần service + Pearl remote. Không block Collection page.

Không WebSocket trong Vite v1. Poll `eval` sau tx / interval chậm. Empty: `No activity yet.`

### Hàng Activity (English)

| Event | Copy |
| --- | --- |
| `Mint` / `PublicMint` | `Minted {name} #{id}` |
| `List` | `Listed #{id} for {n} GNOT` |
| `Buy` | `Sold #{id} for {n} GNOT` |
| `Cancel` | `Listing cancelled #{id}` |

Giá luôn GNOT. Không USD, không PnL, không 24h volume. `WithdrawFees` / `TransferAdmin` không lên feed công khai.

## Later (không làm ngay)

- Full history / live subscribe qua tx-indexer. Hosted indexer cho Pearl chưa có trong `docs/research/00-network.md`.
- External GRC721: chỉ khi Pearl genesis (hoặc addpkg chính thức) có `grc721` **và** registry giống `grc20reg`. Không vendor `examples/quarantined/` hay `p/nt/grc721` vào Bazaar. Không giả gemstone testnet.
- Media: IPFS/https allowlist (`UPGRADE.md` #4). On-chain vẫn URL, không blob.
- Royalty / offers / auction / sweep: reject đến khi có model viết + yes (`UPGRADE.md` #5–6, `03-nft-defi.md`).

## English UI copy (delta)

Giọng functional. Nouns: Collection, Item, Activity, Launch, Explore, Mint, List, Buy, Cancel.

| Surface | Copy |
| --- | --- |
| Nav | Explore · Launch · Sell · Portfolio |
| Collection card price | `From {n} GNOT` (listed min) hoặc mint price nếu chưa list |
| Collection empty listed | `No open listings in this collection.` |
| Tab | Items · Activity |
| Activity empty | `No activity yet.` |
| Activity sold | `Sold #{id} for {n} GNOT` |
| Banner | **Keep** `Pearl testnet — test GNOT has no market value.` |

Không “floor will pump.” Không “next OpenSea.” Không curve / bonding / DEX.

## Assumptions not proven

- Pearl vẫn là testnet hiện tại tại ngày note; docs không liệt kê gemstone sau Pearl.
- `CreateDrop` / `PublicMint` sẽ ship trước (hoặc cùng) Collection page; nếu Launch trễ, page vẫn chạy trên `CreateCollection` + secondary book.
- Cap 50 đủ cho Items + Activity client-side. Chưa phân trang indexer.
- On-chain activity ring không làm nổ gas `Buy` đáng kể; chưa đo. Nếu đo xấu → lùi feed sang Later (indexer) thay vì nhét vào money path.
- Adena `chainId === "pearl-1"` ổn định (cùng giả định note 01).
- User hiểu min listed GNOT ≠ valuation. Banner + “From {n} GNOT” là mitigation, không phải legal cover.
- Gnomies không vào Explore trừ khi owner **tự** mint URL của họ — Bazaar không ingest.

## Không làm

- Không clone artwork / supply 3000 của Gnomies. Không edit `C:\Users\Hi\gnomies-nft`.
- Không bonding curve, mint tax curve, hay launchpad kiểu gnomi.fun. Launch Bazaar = fixed `mintPrice` ugnot.
- Không DEX, AMM, vault, offer, auction, sweep, cart.
- Không royalty slider, không USD, không oracle.
- Không import `p/demo/tokens/grc721` (không tồn tại trên Pearl).
- Không giả public Pearl tx-indexer.
- Không investment language, volume claims.
- Không implement realm / UI trong note này. Pearl `addpkg` cần human yes riêng.

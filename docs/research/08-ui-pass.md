# UI pass — OpenSea / Magic Eden / Tensor / Blur, adapted for Bazaar (2026-09-19)

Notes only. Không phải investment advice. Không hứa volume. Không clone DEX (Zdex / GnoSwap) hay launchpad curve (gnomi.fun). Không edit realm / `wallets.ts` DoContract trong note này.

Mục tiêu: lấy **interaction pattern** từ bốn venue NFT, gán **Keep / Adapt / Reject** theo unique-item book trên Pearl. Visual language Bazaar **không** copy OpenSea navy-blue hay Blur terminal. UI copy luôn English.

Keep (tóm tắt, chi tiết dưới): Adena `DoContract`, Pearl pkg path, Buy / List / Cancel, English, no fake USD, rarity chip nếu realm đã có `RarityOf` — **không** trait accordion.

## Constraint (không bịa)

Từ `docs/COMPANY.md`, `docs/NFT.md`, `docs/LAUNCH.md`, `docs/copy/ui-en.md`, `docs/research/00-network.md`, tree `web/src` (2026-09-19):

| Fact | Value |
| --- | --- |
| Product | Unique-item book `gno.land/r/bazaar/nft`. Một id, một image URL, một GNOT price. GRC20 `market` = legacy, không default Explore. |
| Pearl tokens | `p/demo/tokens/grc20` có. `r/demo/defi/grc20reg` có. **Không** `p/demo/tokens/grc721`. |
| Gno import | Không dynamic import. Không paste contract lạ. Collection sống **trong** realm. |
| Book | `List(id, priceUgnot)` / `Buy` / `Cancel`. Không offer, auction, order book, AMM, sweep, cart. |
| Launch | `CreateDrop` + `PublicMint` = **fixed-price** drop. Primary **0** protocol fee. Secondary 50 bps. |
| Fee | Protocol **50 bps** of GNOT price (`p/bazaar/fee/v1`). Buyer pays `price`. Seller nhận `price − fee`. Không royalty. |
| Quote | Native `ugnot`. UI **GNOT** (`1 GNOT = 1_000_000 ugnot`). Không USD, không `Ξ`. |
| Wallet | **Adena** (`window.adena`). Một nút Connect / Install. |
| Chain | **Pearl / Test16**, `pearl-1`. Official docs: “the one to use unless you have a reason not to”. **Không** gemstone sau Pearl. Tag sau Pearl là `chain/mainnet` (`gnoland-1`). |
| Language | English UI nouns: Explore, Launch, Sell, Portfolio, Collection, Item, Activity, Chart, Buy, List, Cancel. |
| Tree UI | Dark canvas `#0b0d12`, accent `#2ee6c5`, sticky Header + `backdrop-filter`, search pill, ListingCard 1:1 art, Collection tabs Items / Chart / Activity. |

Pearl RPC: `https://rpc.pearl.testnets.gno.land:443`. Faucet: `https://pearl.testnets.gno.land/faucet`. Docs: [Gno networks](https://docs.gno.land/resources/gnoland-networks).

## Nguồn đã đọc

| Venue | Loại | URL |
| --- | --- | --- |
| Gno | Networks: Pearl = current testnet; Staging; Mainnet `gnoland-1`; Sapphire/Topaz archived | https://docs.gno.land/resources/gnoland-networks |
| OpenSea | Help: sell / list (Profile, item page, collection page; List for sale; Reserve; Adjust for fees; Set price to floor; duration 15 min–6 months; Platform fees) | https://support.opensea.io/en/articles/8867002-how-do-i-sell-an-nft |
| OpenSea | Help: fees (1% NFT sale **included** in displayed price; May 2026; creator earnings separate; 10% Studio mint) | https://support.opensea.io/en/articles/8867091-what-fees-do-i-pay-on-opensea |
| OpenSea | Help: collection overview (banner, Overview vs Items, story CMS, FAQ) | https://support.opensea.io/en/articles/8867024-how-do-i-update-my-collection-page |
| OpenSea | DESIGN.md reconstruction (grid `minmax(~220px)`, 72px top-nav, search pill, asset-card, Buy now / Make offer 44px, `tnum` prices, 2px hover lift) | https://www.webdesignhot.com/design.md/opensea/ (source https://opensea.io, updated 2026-05-05) — **third-party**, không phải design system official |
| Magic Eden | Help: collection page (trait filters, analytics Floor / last sale / highest offer, real-time activity, bulk list, rich NFT card + last sale) | https://help.magiceden.io/en/articles/8264557-how-to-use-magic-eden-s-collection-page-for-nft-discovery-and-trading |
| Magic Eden | Help: item details (Owner, Token ID / mint address, traits + %, royalties) | https://help.magiceden.us/en/articles/6531562-how-to-view-nft-details-and-metadata-on-magic-eden |
| Magic Eden | Help: fees (0% to list; 2% on sale SOL/EVM/BTC; royalties optional) | https://help.magiceden.io/en/articles/5858632-what-fees-will-i-pay-to-list-or-sell-nfts-on-magic-eden |
| Magic Eden | Help: sweep by trait (slider + max price + auto-replace) | https://help.magiceden.io/en/articles/8351553-how-to-sweep-nfts-by-trait-filters-on-magic-eden |
| Tensor | Docs: Sell Now vs List; hover **SELL**; confirmation = **amount you'll receive**; bulk slider; bonding-curve List | https://docs.tensor.trade/trade/get-started-with-tensors-amm/sell-or-list |
| Tensor | Docs: bonding curves / AMM (reject) | https://docs.tensor.trade/provide-liquidity/advanced-concepts/bonding-curves |
| Blur | Live home: Connect Wallet, trending table Floor Price / 1D Volume / Owners / Supply | https://blur.io/ |
| Blur | Live collection: Floor / Top Bid / Volume; item table Rarity / Buy Now / Last Sale / Top Bid; **buy floor** / **Optimize sweep**; activity | https://blur.io/collection/banners-nft (probe 2026-09-19) |
| Uniswap | Testnet crypto **has no real-world value** | https://support.uniswap.org/hc/en-us/articles/14580495154445-Testnets-on-Uniswap |
| Adena | Detect `window.adena`; else https://adena.app/ | https://docs.adena.app/integrations/detect-wallet |
| Bazaar | Unique-item spec | `docs/NFT.md` |
| Bazaar | Launch spec | `docs/LAUNCH.md` |
| Bazaar | UX v1 (GRC20; artwork Reject — **superseded** cho unique item) | `docs/research/01-marketplace-ux.md` |
| Bazaar | Collection page / Activity Next | `docs/research/05-next.md` |
| Bazaar | English copy | `docs/copy/ui-en.md` |

Keep = copy interaction. Adapt = cùng job, khác surface vì unique-item realm / Adena / Pearl / 50 bps / cap 50. Reject = không làm ở pass này.

## Verdict table

### Global chrome

| Pattern | Source | Verdict | Why |
| --- | --- | --- | --- |
| Sticky Header, search first, nav text, wallet chip | OS `top-nav` 72px + search pill “Search collections, items, or accounts”; Blur “Connect Wallet” top-right | **Keep** | Tree đã sticky + `backdrop-filter`. Search placeholder `Search collections, name, #id…`. Wallet = truncated `g1` + network. |
| Search pill | OS `input-search` | **Adapt** | Query **collection slug / name / `#id` / seller `g1…`**. Không account registry, không chain filter, không trait. |
| Live network pill | Blur chain-aware chrome; Uniswap testnet banner | **Keep** | Pearl (green) vs Local (amber). Banner: `Pearl testnet — test GNOT has no market value.` Link faucet. |
| Wallet chip: truncated address, click-to-copy | OS `0x1234…abcd` + blockie | **Adapt** | `g1abcd…wxyz`. Hiện `pearl-1`. `chainId !== pearl-1` → error, không fake connected. Không blockie NFT. |
| Multi-wallet picker (MetaMask, Phantom, WalletConnect) | OS, ME, Blur | **Reject** | Một nút: **Connect Adena** hoặc **Install Adena**. |
| Collector vs Pro mode | OpenSea OS2; Blur collector/trader toggle | **Reject** | Một IA. Density thấp hơn Blur table. |
| Dark-only canvas | OS DESIGN.md `#04111d`; Blur near-black | **Adapt** | Giữ Bazaar `#0b0d12` + accent `#2ee6c5`. **Không** copy OS `#2081e2` hay Blur terminal. |
| Glassmorphism / neon / crypto-bro emoji | OS DESIGN.md explicitly rejects; Blur leans terminal | **Reject** | Header blur hiện tại đủ. Không rocket, không “floor will pump.” |
| 44px tap targets + `:focus-visible` ring | OS DESIGN.md `button-buy-now` 44px; a11y 3px brand ring | **Keep** | Tree đã `:focus-visible` accent. Giữ 44px trên mobile CTA. |
| Empty: one sentence + two CTAs | OS “No items match… Clear filters”; ME collection empty | **Keep** | Explore missing realm ≠ empty book. Empty: Create/List hoặc Launch/List. |

### Explore + cards

| Pattern | Source | Verdict | Why |
| --- | --- | --- | --- |
| Explore = collection row + For sale item grid | OS collection-card + asset-card grid `auto-fill minmax(~220px)`; ME Discover | **Keep** | Unique item có image. `01-marketplace-ux.md` Reject artwork **chỉ** cho GRC20 lot. v2 Keep 1:1 art. |
| Asset card: art flush 1:1, name, price tabular | OS `asset-card`; ME “rich NFT card” | **Keep** | `ListingCard` + `ItemArt`. Price `tnum` + suffix **GNOT**. Hover: lift nhẹ (OS 2px), không gallery zoom 1.04 (OS: lift >2px đọc như gallery). |
| Overlay **Buy** on hover (desktop); always visible mobile | Tensor hover **SELL**; OS card CTA | **Adapt** | Tree đã `Buy` luôn trên card. Desktop có thể fade overlay; mobile không ẩn. Click card → drawer, không 1-click miss fee. |
| Rarity chip on image / card | OS `badge-rare`; Blur Rarity column; ME ranking | **Adapt** | Realm `RarityOf` = Common / Uncommon / Rare / Epic / Legendary (`docs/NFT.md`). Chip OK. **Không** MoonRank / HowRareIs / trait %. |
| Floor / 24h volume / last sale on card | OS DESIGN.md “Floor / Last / Volume”; ME last sale; Blur 1D Volume | **Reject** | Một listing = một GNOT price. 24h volume cần indexer history. Card chỉ GNOT list price. Collection card: **From {n} GNOT** (min listed) hoặc mint price — không chữ “floor will pump.” |
| Buy now + Make offer dual CTA | OS `button-buy-now` + `button-make-offer` | **Adapt** | Chỉ **Buy**. Offer / bid không có trên realm. |
| Cart | OS cart | **Reject** | Một `Buy(id)` = một tx. |
| Sweep floor / Optimize sweep / bulk buy | Blur “buy floor”, “Optimize sweep”; ME trait sweep slider | **Reject** | Không aggregator, không multi-id. |
| Verified checkmark | OS verified-blue | **Reject** | Không registry verified trên Pearl. |
| USD under the price / fiat on-ramp | OS DESIGN.md “USD equivalents” | **Reject** | “No fake USD.” Test GNOT không có market value. |

### Collection page

| Pattern | Source | Verdict | Why |
| --- | --- | --- | --- |
| Cover banner + name + slug | OS Overview banner; ME collection header | **Keep** | `CreateCollection` / `CreateDrop` store cover. Tree `collection-hero`. |
| Stats: Floor / listed / minted | ME Floor price + analytics; Blur Floor / Owners / Supply; `LAUNCH.md` | **Adapt** | Label English `From {n} GNOT`. Listed count nếu có; drop: `{minted}/{maxSupply}` + mint price. Không 1D Change %, không Top Bid. |
| Tabs **Items** / **Activity** | ME collection page; OS Items vs Overview | **Keep** | Tree thêm **Chart** — xem row dưới. |
| Chart / floor history | Blur 1D/1W/1M chart; ME enhanced analytics | **Adapt** | Tab Chart chỉ GNOT points từ indexer / listed prices. Empty: `No prices yet.` Không USD axis, không volume overlay. Preview catalog phải tagged Sample. |
| Activity stream | ME “real-time activity”; Blur activity table Item / Price / Seller / Buyer | **Adapt** | Cap 50 on-chain + indexer projection (`06-indexer.md`). Copy: `Listed #{id} for {n} GNOT` / `Sold #{id} for {n} GNOT`. Không WebSocket. |
| Trait accordion / visual trait filter | ME trait pane; OS `side-filter-panel` Status / Price / Traits | **Reject** | Realm không traits. Search name / `#id` đủ. |
| Bulk list trên collection (Sell mode) | OS collection page Sell mode + `+` multi-select; ME bulk list | **Reject** | Một `List(id)` = một Adena call. |
| Overview CMS (FAQ, team, roadmap, Discord) | OS Studio Overview | **Reject** | Không CMS. Cover + name + slug. |
| Ingest foreign GRC721 / Gnomies | OS paste contract | **Reject** | Pearl không `grc721`. Công ty khác. |

### Item detail

| Pattern | Source | Verdict | Why |
| --- | --- | --- | --- |
| Two-col: art \| facts + CTA | OS asset detail 6/6; ME Item Details | **Keep** | Drawer/modal: art, name, `#id`, rarity, owner/seller `g1`, pay, **Buy**. |
| Owner / Token ID | ME Details (Owner, Token ID / mint address) | **Adapt** | `#id` + `Owner` + `Seller` (listed: owner = realm, seller = EOA). Không contract address ngoài. |
| Traits + % | ME Attributes; OS trait-pill click-to-filter | **Reject** | Chỉ rarity string. Không accordion. |
| Fee included in displayed price | OS: 1% “included in the price displayed to buyers” | **Keep** | Copy: `You pay ({0.50%} included)`. Buyer send = listing `price` ugnot. |
| Net proceeds before sign | OS “Adjust for fees”; Tensor “The price shown in the confirmation modal is the amount you'll receive” | **Keep** | Seller: Buyer pays X / Protocol Y / You receive X−Y. **Không** toggle “Adjust for fees” (fee không optional). |
| Make offer / Accept offer | OS item page Sell mode | **Reject** | Không offer path. |
| Price history sparkline | Blur last sale; ME last secondary purchase | **Adapt** | Optional GNOT chart trong drawer nếu indexer có points. Không PnL. |

### Sell / List / Launch / Portfolio

| Pattern | Source | Verdict | Why |
| --- | --- | --- | --- |
| List from Profile / item / collection | OS three entry points | **Adapt** | Sell form + Portfolio row **Sell** + drawer **Sell** nếu owned unlisted. Cùng `List(id, price)`. |
| Fee breakdown + net | OS Platform fees; Tensor confirm proceeds; ME 2% from sale | **Keep** | Live: `Buyer pays {X} GNOT. Protocol fee {Y} GNOT. You receive {Z} GNOT.` |
| Listing duration 15 min–6 months | OS Listing duration | **Reject** | Listing sống đến `sold` hoặc `Cancel`. |
| Reserve / private listing | OS Reserve (wallet / ENS) | **Reject** | `Buy` = bất kỳ EOA gửi đúng `price`. |
| Set price to floor / trait floor | OS “Set price to floor” | **Reject** | Không floor setter. User gõ GNOT. |
| Creator earnings slider | OS; ME optional royalties Full/Half/None | **Reject** | Chỉ protocol 50 bps. Không royalty path. |
| Sell Now into collection bid | Tensor **SELL NOW** / collection-wide bid | **Reject** | Không bid book. Instant-sell không tồn tại. |
| Bulk list / bonding-curve delta | Tensor List slider + “increase by”; ME AMM pools | **Reject** | Không AMM, không curve, không gnomi.fun. |
| Lazy mint / gasless signature list | OS Studio / Seaport order | **Reject** | `List` = on-chain escrow. Adena signs realm call. |
| Create collection + media drop page | OS Studio; ME Launchpad | **Adapt** | Launch = `CreateDrop` form (slug, name, cover URL, maxSupply, mint price GNOT) + drop cards + mint bar. Primary 0 fee. Không Studio CMS. |
| Portfolio = owned + listed + PnL + bids | OS Profile; Blur analytics; ME My Items + Instant sell | **Adapt** | Sections **Listed** / **Unlisted**. Cancel / Sell. Không USD PnL, không Instant sell, không offers received. |

## Pages (IA)

Một app. Header sticky. Banner testnet trên cùng. Nav English.

```
[ Pearl testnet banner ………………………………………… faucet ]

[ Bazaar ]  Search…   Explore  Launch  Sell  Portfolio   [ Pearl|Local ] [ g1abcd…wxyz ]
```

| Page | Job | Upgrade (nếu chưa khớp tree) |
| --- | --- | --- |
| Explore | Collection cards (From n GNOT / mint) + For sale item grid | Hero one line, không volume. Search/sort. Empty vs realm-missing tách. |
| Collection | Cover, name, slug, From n GNOT, listed/minted | Tabs **Items** / **Activity** / **Chart** (Chart = GNOT only). Sort Price / Name / Id. |
| Item detail | Two-col drawer: art \| name, rarity, owner/seller, pay, Buy | Fee **included**. Seller net. Escape đóng. |
| Launch | Drop cards + mint bar; Create drop form | How to list = quiet aside, không nhét curve. |
| Sell | Single panel, live fee, primary **List** | Không duration / reserve / royalty. |
| Portfolio | Listed / Unlisted | Cancel returns item. Unlisted → Sell. |
| Settings | Network, pkg paths, faucet — grouped, mono paths | Gear; không trong BottomNav. |

Do not change `wallets.ts` DoContract shape.

## Visual (Tensor density + OpenSea clarity, không copy chrome)

- Sticky glass Header (`backdrop-filter`), search first, nav text pills, wallet chip (dot + truncated `g1`).
- Live Pearl pill (green) vs Local (amber).
- Cards: 1:1 art, hover **lift ~2px** (không zoom 1.04), rarity chip, price row GNOT tabular.
- Overlay Buy optional desktop; luôn visible mobile.
- 44px targets, `:focus-visible` accent ring.
- Empty: one sentence + two CTAs.

Không: Blur collection table làm default Explore. Không OS `#2081e2`. Không USD caption dưới giá.

## English UI nouns (delta)

Giọng OS “marketplace-functional”: Buy, List, Cancel — không hype.

| Surface | Copy |
| --- | --- |
| Nav | Explore · Launch · Sell · Portfolio |
| Search | Search collections, name, #id… |
| Collection price | `From {n} GNOT` |
| Drop price | `Mint {n} GNOT` |
| Tabs | Items · Activity · Chart |
| Card CTA | Buy / Your listing · Cancel / Sell |
| Pay | You pay ({0.50%} included) |
| Fee (Sell) | Buyer pays {X} GNOT. Protocol fee {Y} GNOT. You receive {Z} GNOT. |
| Activity sold | Sold #{id} for {n} GNOT |
| Banner | Pearl testnet — test GNOT has no market value. |
| Connect | Connect Adena / Install Adena |

Không “next OpenSea.” Không “floor will pump.” Không Make offer / Sweep / Instant sell.

## Tree vs pass (honest)

Đã có (2026-09-19): sticky Header + search, Collection page + Items/Chart/Activity, ListingCard art + rarity + Buy, drawer fee “included”, Launch drops, Portfolio listed/unlisted, Pearl banner, Adena Connect/Install, `tnum` GNOT.

Còn lệch (QA / copy, không ship trong note):

1. Nav mất 721–900px (`docs/qa/2026-09-19-ui.md` BUG-UI-1) — BottomNav chỉ ≤720px.
2. Drawer từng thiếu seller net (BUG-UI-2) — kiểm tra copy “included” + You receive item.
3. Copy lệch `docs/copy/ui-en.md` (hero, empty, wrong-network named).
4. Chart / Activity phụ thuộc indexer; Pearl realm chưa `addpkg` → preview catalog phải tagged Sample, không giả live volume.
5. Hover overlay Buy chưa bắt buộc — card CTA luôn hiện là đủ Keep.

## Assumptions not proven

- Official docs vẫn gọi Pearl là testnet hiện tại; không gemstone sau Pearl tại ngày note.
- Adena `chainId === "pearl-1"` ổn định sau `SwitchNetwork`.
- `RarityOf` là string trên item, không phải trait set — chip không thành filter.
- Cap 50 `ListOpen` / Activity đủ client-side. Chart không bị đọc thành valuation.
- User hiểu `From {n} GNOT` ≠ USD floor. Banner là mitigation, không phải legal cover.
- DESIGN.md OpenSea là reconstruction 2026-05-05; interaction lấy từ Help Center official khi lệch.

## Không làm

- Không copy Blur/Tensor terminal, sweep, Top Bid, bonding curve.
- Không USD, không royalty slider, không offer, không cart, không duration.
- Không MetaMask / WalletConnect.
- Không ingest GRC721 / Gnomies / `p/demo/tokens/grc721` (không tồn tại trên Pearl).
- Không đổi `DoContract` shape.
- Không implement realm / UI / deploy trong note này.
- Không investment language, volume claims.

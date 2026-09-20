# Marketplace UX for Bazaar v1 (2026-09-19)

Notes only. Không phải investment advice. Không đề xuất DEX (Zdex / GnoSwap) hay launchpad (gnomi.fun).

Mục tiêu: lấy pattern UI từ marketplace 2024–2026 mà Bazaar **có thể** dùng trên gno.land, rồi gán keep / adapt / reject theo constraint v1. UI copy đề xuất luôn English.

## Constraint v1 (không bịa)

Từ `docs/COMPANY.md`, `docs/API.md`, `docs/research/00-network.md`:

| Fact | Value |
| --- | --- |
| Asset | GRC20 factory token, fixed-price listing. **Không** NFT. Pearl **không** có `p/demo/tokens/grc721`. |
| Payment | Native `ugnot` on-chain. UI hiện **GNOT** (`1 GNOT = 1_000_000 ugnot`). **Không** fake USD. |
| Book | `List` / `Buy` / `Cancel`. Không order book, không AMM, không offer, không auction. |
| Fee | Protocol **50 bps** of the GNOT price. Buyer pays `price`. Seller nhận `price − fee`. Không creator royalty. |
| Wallet | **Adena** (`window.adena`). Không MetaMask / WalletConnect. |
| Chain | **Pearl / Test16**, `pearl-1`. Official docs vẫn gọi Pearl là testnet hiện tại (không gemstone sau Pearl). |
| Language | English UI. |

Pearl: `https://rpc.pearl.testnets.gno.land:443`, faucet `https://pearl.testnets.gno.land/faucet`. Docs: [Gno networks](https://docs.gno.land/resources/gnoland-networks).

## Nguồn đã đọc

| Venue | Loại | URL |
| --- | --- | --- |
| OpenSea | Help: fees (1% NFT sale, included in displayed price; May 2026) | https://support.opensea.io/en/articles/8867091-what-fees-do-i-pay-on-opensea |
| OpenSea | Help: sell / list modal (Adjust for fees, Platform fees, duration, floor) | https://support.opensea.io/en/articles/8867002-how-do-i-sell-an-nft |
| OpenSea | DESIGN.md (grid, 72px top-nav, search pill, asset-card, Buy now / Make offer, list modal) | https://www.webdesignhot.com/design.md/opensea/ (source https://opensea.io, updated 2026-05-05) |
| Magic Eden | Help: collection page (filters, activity, bulk list, NFT card + last sale) | https://help.magiceden.io/en/articles/8264557-how-to-use-magic-eden-s-collection-page-for-nft-discovery-and-trading |
| Magic Eden | Help: fees (0% to list; 2% on sale; royalties optional) | https://help.magiceden.io/en/articles/5858632-what-fees-will-i-pay-to-list-or-sell-nfts-on-magic-eden |
| Tensor | Docs: Sell Now vs List, confirmation shows **amount you'll receive** | https://docs.tensor.trade/trade/get-started-with-tensors-amm/sell-or-list |
| Tensor | Docs: bonding curves / AMM (reject for v1) | https://docs.tensor.trade/provide-liquidity/advanced-concepts/bonding-curves |
| Blur | Live: Connect Wallet, collection table (Floor / Top Bid / Volume), Buy floor / Optimize sweep | https://blur.io/ and https://blur.io/collection/world-of-women-nft |
| Uniswap | Testnet = test crypto **has no real-world value** | https://support.uniswap.org/hc/en-us/articles/14580495154445-Testnets-on-Uniswap |
| Adena | Detect `window.adena`; else open https://adena.app/ | https://docs.adena.app/integrations/detect-wallet |
| Gno | Adena is the recommended third-party wallet | https://docs.gno.land/users/third-party-wallets/ |

## Verdict table

Keep = copy the interaction. Adapt = same job, khác surface vì GRC20 / Adena / Pearl. Reject = không làm ở v1.

| Pattern | Source | Verdict | Why |
| --- | --- | --- | --- |
| Explore grid `auto-fill minmax(~220–260px)` | OpenSea DESIGN.md; Magic Eden collection cards | **Keep** | Book v1 là list of listings, không phải 10k JPEG. Grid scan được. |
| Search + sort above the grid | OpenSea search pill “Search collections, items, or accounts”; ME Discover by volume/floor | **Adapt** | Search **symbol / listing id / seller `g1…`**. Sort: Newest, Price (GNOT) low→high, Amount. Không trait, không rarity, không chain filter. |
| Asset card với artwork 1:1 | OpenSea `asset-card`; ME “rich NFT card” | **Reject** | Không NFT image trên Pearl v1. Card trống sẽ trông như broken marketplace. |
| Token mark (letter / ticker disk) thay artwork | Uniswap token list / Explore (analog, không copy DEX) | **Adapt** | Disk 48–64px: 2–8 char `symbol`. Đó là identity của listing. |
| Floor / 24h volume / rarity / last sale on card | OS, ME, Blur table | **Reject** | Một listing = một amount @ một GNOT price. Không floor collection, không last-sale indexer. |
| Buy now + Make offer dual CTA | OpenSea signature checkout | **Adapt** | Chỉ **Buy**. Offer / bid / auction không có trên realm. |
| Sweep floor / bulk buy | Blur “Buy floor”, “Optimize sweep”; Tensor bulk | **Reject** | Mỗi `Buy(id)` là một escrow row. Không aggregator, không multi-id. |
| Collection bids / order book / AMM / bonding curve | Tensor Sell Now, TensorSwap; Blur Top Bid | **Reject** | Không order book, không AMM. Instant-sell-into-bid không tồn tại. |
| List modal: price + **fee breakdown** + net proceeds | OS “Adjust for fees” + Platform fees; Tensor “amount you'll receive”; ME listing review | **Keep** | Bắt buộc. 50 bps cố định. Buyer pays X GNOT; protocol Y; seller gets X−Y. |
| Listing duration / expiry (15 min–6 months) | OpenSea list form | **Reject** | Listing sống đến `sold` hoặc `Cancel`. Không expiry field trên API. |
| Reserve / private listing | OpenSea Reserve | **Reject** | `Buy` là bất kỳ EOA nào gửi đúng `price` ugnot. |
| Creator earnings / royalties slider | OS, ME | **Reject** | Chỉ protocol 50 bps. Không royalty path. |
| Lazy mint / gasless off-chain signature | OS Studio; OS/Blur list-as-signature | **Reject** | `List` là on-chain escrow pull. Adena signs a realm call, không Seaport order. |
| Create collection + drop page + media | OS Studio; ME Launchpad | **Reject** | Create = GRC20 factory form (name, symbol, decimals, supply). Không drop, không media. |
| Portfolio = owned NFTs + P&amp;L + bids | OS Pro Listings/Offers; Blur portfolio analytics; ME My Items | **Adapt** | **My listings** = `ListOpen()` filtered by connected `g1`. Cancel. Không P&amp;L USD, không unlisted inventory gallery (chưa có indexer). |
| Collector mode vs Pro mode | OpenSea OS2 | **Reject** | Một IA. Density thấp hơn Blur. |
| Sticky top-nav + Connect Wallet chip | OS 72px nav; Blur “Connect Wallet” top-right | **Keep** | Brand left, IA tabs, wallet right. Sticky. |
| Wallet chip: truncated address, click-to-copy | OS `0x1234…abcd` + blockie | **Adapt** | `g1abcd…wxyz` (6+4 như `shortAddr` hiện tại). Hiện `pearl-1`. Nếu `chainId !== pearl-1` → error, không fake connected. |
| Multi-wallet picker (MetaMask, Phantom, WalletConnect) | OS, ME, Blur | **Reject** | Một nút: **Connect Adena** hoặc **Install Adena**. `window.adena` hoặc `https://adena.app/`. |
| Fiat on-ramp / USD under the price | OS DESIGN.md “USD equivalents”; OS card-buy ETH | **Reject** | “No fake USD.” Chỉ GNOT. Testnet GNOT không có market value. |
| Testnet banner + faucet | Uniswap: test crypto has no real-world value | **Keep** | Pearl banner luôn visible. Link faucet. |
| Activity feed (sales/listings live) | ME activity; Blur activity table | **Adapt later** | v1: empty / error copy từ `eval`. Không WebSocket feed. |
| Verified checkmark | OS verified-blue | **Reject** | Không registry “verified collection” trên Pearl cho Bazaar. |
| Cart | OS cart | **Reject** | Một listing, một tx. |

## Recommended IA

Một app, bốn tab. Header sticky. Banner testnet trên cùng.

```
[ Pearl testnet banner ………………………………………… faucet ]

[ Bazaar  gno.land ]   Explore   List   Create   My listings   [ g1abcd…wxyz · pearl-1 ]
```

| Route | Job | Primary CTA |
| --- | --- | --- |
| **Explore** | Grid of `open` listings. Search + sort. Click card → detail. | `Buy` |
| **List** | Form: Symbol, Amount, Price (GNOT). Live fee preview. | `List` |
| **Create** | Form: Name, Symbol, Decimals, Supply. Mint to caller. | `Create token` |
| **My listings** | Seller’s open rows. | `Cancel` |

Không tab Stats, Drops, Launch, Swap, Portfolio-value.

### 1. Explore grid + search/sort

Giữ layout OpenSea/ME: toolbar rồi card grid.

- Search: symbol (case-insensitive), listing id, seller prefix.
- Sort: `Newest` (id desc), `Price: low to high`, `Amount: high to low`.
- Empty: `No open listings yet. Create a token, then list.`
- Chain fail: `Could not read listings from this package path.` (đã có trong UI).

Không: trait accordion, status = auction, chain chips, “Buy now / Make offer” filter.

### 2. Listing card (không artwork)

Thay 1:1 JPEG bằng **token mark**:

```
┌─────────────────────────┐
│  [DEM]   DEMO      open │
│  100 tokens             │
│  1.000000 GNOT          │
│  g1abcd…wxyz            │
│  [ Buy ]                │
└─────────────────────────┘
```

- Mark = 2–4 leading chars of `symbol`, same accent as brand.
- Price: tabular numbers, suffix `GNOT` (không `Ξ`, không `$`).
- Status pill: `open` only on Explore. `sold` / `cancelled` không hiện ở grid công khai.
- Disabled Buy nếu chưa connect hoặc wrong network.

### 3. Detail panel + fee breakdown

Click card → panel (drawer hoặc page). OpenSea/Tensor dạy: hiện **net** trước khi ký.

Buyer sees:

| Line | Copy |
| --- | --- |
| You pay | `{price} GNOT` |
| Protocol fee (0.50%) | included in the price; `{fee} GNOT` to protocol |
| Seller receives | `{price − fee} GNOT` |
| You receive | `{amount} {symbol}` |

Seller (own listing) sees cùng bảng + `Cancel`.

Không: “Adjust for fees” toggle (fee không optional). Không gas-in-USD. Gno gas là `ugnot` gasFee — có thể note `Adena will also charge network gas in GNOT` một dòng muted, không bịa số.

### 4. Create / List = forms rõ

Không modal NFT phức tạp. Hai form hẹp (~480px) như UI hiện tại.

**Create token**

- Name, Symbol (2–8 A–Z0–9, unique), Decimals, Supply.
- Helper: `Supply is minted to you.`
- CTA: `Create token` → Adena `Create`.

**List tokens**

- Symbol (datalist from `ListSymbols()`), Amount, Price (GNOT).
- Helper: `Listing pulls tokens from your wallet into escrow. No separate approve step for factory tokens.`
- Live: `Buyer pays X GNOT. Protocol fee Y GNOT. You receive Z GNOT.`
- CTA: `List` → Adena `List`.

Reject duration, reserve, royalty, “set to floor”.

### 5. Portfolio = My listings

Không gallery NFT. Một grid/table các row `seller === connected`.

- Empty logged-out: `Connect Adena to see your listings.`
- Empty logged-in: `You have no open listings.`
- Row: mark, symbol, amount, price GNOT, status, `Cancel`.

Không: unlisted balances, PnL, offers received, “instant sell”.

### 6. Testnet banner

Giữ pattern Uniswap (test crypto has no real-world value) + product truth:

> Pearl testnet — GNOT here has no market value. This is a fixed-price book, not a DEX. Get test GNOT from the faucet.

Banner luôn hiện. Link `https://pearl.testnets.gno.land/faucet`. Không ẩn sau settings.

Wrong network (Adena `chainId !== pearl-1`):

> Adena is on {chainId}. Switch to pearl-1.

### 7. Sticky nav + wallet chip

- Sticky header. Tabs: Explore / List / Create / My listings.
- Disconnected + Adena installed: `Connect Adena`.
- Disconnected + no `window.adena`: `Install Adena` → `https://adena.app/`.
- Connected: chip `g1abcd…wxyz` + small `pearl-1`. Optional muted GNOT balance from Adena `coins` (parse `ugnot`, show GNOT — không USD).
- Không avatar NFT. Không network dropdown 20 chain.

## English UI copy (đề xuất)

Giữ giọng OpenSea “marketplace-functional”, không hype.

| Surface | Copy |
| --- | --- |
| Hero | Buy and sell GRC20 at a clear GNOT price. |
| Hero sub | Create a token, list an amount, and let a buyer pay native GNOT into escrow. The protocol keeps 0.50% of the GNOT. Cancel anytime before it sells. |
| Banner | Pearl testnet — GNOT here has no market value. This is a fixed-price book, not a DEX. |
| Nav | Explore · List · Create · My listings |
| Connect | Connect Adena / Install Adena |
| Card CTA | Buy |
| List CTA | List |
| Create CTA | Create token |
| Cancel | Cancel |
| Fee (list form) | Buyer pays {X} GNOT. Protocol fee {Y} GNOT. You receive {Z} GNOT. |
| Detail pay | You pay {X} GNOT |
| Detail fee | Protocol fee 0.50% · {Y} GNOT |
| Detail seller | Seller receives {Z} GNOT |
| Empty explore | No open listings yet. Create a token, then list. |
| Empty mine | You have no open listings. |

## Gap so với `web/src/App.tsx` hiện tại

UI local đã có banner, 4 tab, card không artwork, fee 1 dòng trên form List, Adena connect, wrong-net. Research này **không** đòi rewrite visual language (paper `#f6f3ee` ổn; không bắt dark-terminal OpenSea/Blur).

Nên bổ sung khi ship UI (không làm trong note này):

1. Sticky header + wallet chip hiện `pearl-1`.
2. Search/sort trên Explore.
3. Token mark trên card.
4. Detail panel (fee table) trước Buy — card hiện Buy 1-click, dễ miss 50 bps.
5. Banner có link faucet (faucet đang ở footer).
6. Copy “Install Adena” khi `!window.adena` — đã có.

## Assumptions not proven

- Adena trên Pearl expose `chainId === "pearl-1"` ổn định sau `SwitchNetwork` (code hiện throw nếu empty).
- `ListOpen()` scale đủ cho grid client-side; chưa có indexer phân trang.
- User hiểu GNOT ≠ USD; banner là mitigation, không phải legal cover.
- Factory token không có metadata image trên-chain — mark từ `symbol` là đúng v1.

## Không làm

- Không copy Blur/Tensor terminal.
- Không USD, không chart, không sweep, không offer.
- Không MetaMask.
- Không NFT, không GRC721 path.
- Không edit realm trong note này.

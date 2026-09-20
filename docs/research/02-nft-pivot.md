# NFT pivot — Bazaar v2 (2026-09-19)

Notes only. Không phải investment advice. Không đề xuất DEX (Zdex / GnoSwap) hay launchpad (gnomi.fun). Không clone art của Gnomies. Không ship realm code trong note này.

Mục tiêu: giải thích **vì sao UI v1 trông như token OTC book**, map item model OpenSea / Magic Eden lên unique item trên Gno, rồi recommend **Bazaar v2 = NFT book** theo `docs/NFT.md`. UI copy đề xuất luôn English.

## Constraint (không bịa)

| Fact | Value |
| --- | --- |
| Testnet hiện tại | **Pearl / Test16**, `pearl-1`. Official docs vẫn gọi Pearl là testnet “the one to use unless you have a reason not to”. Không gemstone sau Pearl. Tag sau Pearl là `chain/mainnet` (`gnoland-1`), không phải faucet testnet. |
| Pearl tokens | `gno.land/p/demo/tokens/` có **GRC20 thôi**. **Không** `p/demo/tokens/grc721`. |
| Official GRC721 | Historical `p/demo/grc/grc721` không phải Pearl genesis. `examples/quarantined/` **không** ship lên testnet/mainnet genesis. Master monorepo có `p/nt/grc721` (kèm enumerable / metadata / royalty) và mainnet genesis liệt kê `p/nt/grc721/v0` — **không** có trên Pearl dưới path demo. Bazaar **không** import GRC721 cho v2. |
| Gno import | Không dynamic import. v1 nhét factory GRC20 **vào cùng realm** với book vì listing phải escrow token không compile-time import được. |
| Gnomies | Công ty **khác** (collection ~3000 piece). Không edit `C:\Users\Hi\gnomies-nft`. Không clone artwork. |
| v1 product | GRC20 factory + amount listings. Đó là lý do UI nhìn như OTC book, không phải OpenSea. |
| v2 product | Unique-item realm `gno.land/r/bazaar/nft` theo `docs/NFT.md`. Hub `SetModule("nft", …)`. Market GRC20 vẫn deploy được, **không** còn default Explore. |
| Payment | Native `ugnot`. UI **GNOT** (`1 GNOT = 1_000_000 ugnot`). Không fake USD. |
| Fee | Protocol **50 bps** of the GNOT price (`p/bazaar/fee/v1`). Buyer pays `price`. Seller nhận `price − fee`. Không creator royalty. |
| Book | `Mint` / `List` / `Buy` / `Cancel`. Một item = một `id`. Listing 1:1 — không fraction. |
| Wallet | **Adena**. English UI. |

Pearl RPC: `https://rpc.pearl.testnets.gno.land:443`. Faucet: `https://pearl.testnets.gno.land/faucet`. Docs: [Gno networks](https://docs.gno.land/resources/gnoland-networks).

## Nguồn đã đọc

| Venue | Loại | URL |
| --- | --- | --- |
| Gno | Networks: Pearl = current testnet; Staging; Mainnet `gnoland-1`; Sapphire/Topaz archived | https://docs.gno.land/resources/gnoland-networks |
| Gno | `examples/README.md`: `quarantined/` không ship genesis, chưa audit / chưa modernize interrealm | https://github.com/gnolang/gno/blob/master/examples/README.md |
| Gno | `p/nt` README: token standards `grc20` / `grc721`; `grc1155` + `grc777` still quarantined | https://github.com/gnolang/gno/blob/master/examples/gno.land/p/nt/README.md |
| Gno | Master tree `p/nt/grc721` (không phải Pearl `p/demo/tokens/grc721`) | https://github.com/gnolang/gno/tree/master/examples/gno.land/p/nt/grc721 |
| OpenSea | Help: sell / list (item page, collection page, List for sale, duration, floor, Reserve, Adjust for fees) | https://support.opensea.io/en/articles/8867002-how-do-i-sell-an-nft |
| OpenSea | Help: create NFT (Studio media + name + supply; supply=1 → unique; ERC-1155 copies) | https://support.opensea.io/en/articles/8867023-how-do-i-create-an-nft |
| OpenSea | Help: collection overview page (banner, items tab, story blocks) | https://support.opensea.io/en/articles/8867024-how-do-i-update-my-collection-page |
| OpenSea | Help: fees (1% NFT sale, included in displayed price; creator earnings separate) | https://support.opensea.io/en/articles/8867091-what-fees-do-i-pay-on-opensea |
| OpenSea | Learn: list from Profile → item → List for sale; Fixed Price | https://opensea.io/learn/nft/how-to-sell-nfts |
| OpenSea | SDK: NFT keyed by collection + `tokenId` / identifier | https://github.com/ProjectOpenSea/opensea-js/blob/main/developerDocs/getting-started.md |
| Magic Eden | Help: collection page (filters, activity, bulk list, rich NFT card + last sale) | https://help.magiceden.io/en/articles/8264557-how-to-use-magic-eden-s-collection-page-for-nft-discovery-and-trading |
| Magic Eden | Help: item details — EVM **Token ID** + contract; Solana mint address; traits | https://help.magiceden.us/en/articles/6531562-how-to-view-nft-details-and-metadata-on-magic-eden |
| Uniswap | Testnet crypto has no real-world value | https://support.uniswap.org/hc/en-us/articles/14580495154445-Testnets-on-Uniswap |
| Adena | Detect `window.adena` | https://docs.adena.app/integrations/detect-wallet |
| Bazaar | v2 spec | `docs/NFT.md` |
| Bazaar | v1 UX (artwork **Reject** vì GRC20) | `docs/research/01-marketplace-ux.md` |
| Bazaar | v1 API: `Create(name, symbol, decimals, supply)` + `List(symbol, amount, priceUgnot)` | `docs/API.md` |

## Vì sao v1 trông như token OTC book

Không phải visual bug. **Asset model là fungible.** Realm và UI cùng kể một câu: “tạo ticker, list một **amount**, mua cả lô bằng GNOT.”

### Realm v1

`gno.land/r/bazaar/market` = factory + escrow trong **một** package (Gno không dynamic-import token lạ):

| Call | Shape | Hệ quả UX |
| --- | --- | --- |
| `Create(name, symbol, decimals, supply)` | GRC20. Symbol 2–8 A–Z0–9, unique. Supply mint về caller. | Form **Create token**. Field Decimals / Supply. |
| `List(symbol, amount, priceUgnot)` | Pull `amount` token vào escrow. Một listing = một **lô**. | Form **List tokens**. Field Amount. Card hiện `{n} tokens`. |
| `Buy(id)` / `Cancel(id)` | `id` là **listing row**, không phải token id. | Explore = order book các lô, không phải gallery item. |

GRC20 trên Pearl không có `image` / `tokenURI`. `docs/research/01-marketplace-ux.md` **Reject** artwork 1:1 vì card trống sẽ trông như broken marketplace — thay bằng **TokenMark** (disk chữ ticker).

### UI v1 (đúng với book)

| Surface | Hiện tại | Tín hiệu “token OTC” |
| --- | --- | --- |
| Title / hero | `Bazaar — GRC20 marketplace`. “Buy and sell GRC20 at a fixed GNOT price.” | Sản phẩm tự nhận là token book. |
| Create | Name, Symbol, Decimals, Supply. CTA **Create**. | Uniswap-style factory, không Studio mint. |
| Sell | Symbol + Amount + Price (GNOT). “Listing pulls tokens … into escrow.” | OTC lot size. |
| Explore card | `TokenMark` + `symbol` + `{amount} tokens` + price GNOT + seller. Sort Price / Amount / Symbol. Search “symbol, seller…”. | Không JPEG. Identity = ticker. |
| StatsRow | Open listings · **Tokens** · Protocol fee 0.50% | Đếm symbol, không đếm items. |
| Portfolio | Open listings only. Cancel returns escrowed **tokens**. | Không owned-item gallery. |

Người dùng OpenSea/ME nhìn grid này sẽ đọc là **sàn token**, không phải item marketplace — và họ đúng.

## Item model OpenSea / Magic Eden

Cả hai venue xoay quanh **một object unique**, không phải lô fungible.

```
Collection  ──has many──►  Item
   slug / contract              tokenId (EVM) | mint address (Solana)
   banner, name                 name, media/artwork, owner
                                listing (1 item, 1 price) | offers
```

| Field | OpenSea | Magic Eden | Ý nghĩa |
| --- | --- | --- | --- |
| Collection | Contract / Studio collection. Overview page + Items tab. Không chuyển NFT sang collection khác sau khi mint. | Collection page: filters, activity, bulk list, rich card. | Nhóm items. Floor / volume / traits sống ở tầng này. |
| Item identity | `collection_slug` + `identifier` (`tokenId`). SDK `getNFT(tokenAddress, tokenId)`. | EVM: **Contract address** + **Token ID**. Solana: mint / token address. | Unique. Không “100 tokens of DEMO”. |
| Artwork | Media upload (JPG/PNG/GIF/SVG/MP4). “This is the artwork for your NFT.” | Rich NFT card + Item Details media. | Identity visual. |
| Name | Item name on Media & Metadata. | Item name trên card / details. | Human label, không phải ticker 2–8. |
| Supply | Studio Create = ERC-1155. `supply = 1` → unique; `> 1` → copies. Drop = ERC-721. | SFT riêng (quantity). Default NFT = 1. | Unique vs semi-fungible. |
| Owner | Item page / profile. Listed item vẫn “yours” off-chain cho đến fulfill (Seaport). | Owner trên Details. | Ai ký List / Transfer. |
| List | Profile / item page / collection page → **List for sale**. Duration 15 min–6 months. Reserve. Set to floor. Adjust for fees. | Collection page bulk list; item **List** tab. | Fixed price là happy path; offer là path thứ hai. |
| Buy | Buy now (+ Make offer). Cart, sweep = product khác. | Buy tab; cart optional. | Checkout 1 item. |
| Traits / rarity / last sale | Metadata CSV; trait floor. | Attributes + %; last sale on card; rarity toggle (SOL). | Collection analytics — cần indexer. |

OpenSea list form còn: creator earnings, listing duration, floor difference, platform fee 1% (included in displayed price). Magic Eden: 0% to list, 2% on sale, royalties optional. **Không** map 1:1 sang Bazaar 50 bps cố định.

## Map lên Gno unique item (`docs/NFT.md`)

Pearl không có GRC721 để import. Gno không dynamic-import collection lạ. v2 **không** chờ `p/nt/grc721` lên Pearl. Spec: Bazaar tự mint unique item trong realm `gno.land/r/bazaar/nft`.

| OS / ME | Gno v2 | Ghi chú |
| --- | --- | --- |
| Collection contract | **Một** realm. Copy: Collection (**Bazaar**). | Không multi-collection, không slug registry, không Gnomies. |
| `tokenId` | `id` `int` từ `Mint` (`NextID()`). | Listing **là** item: `List(id, price)` 1:1. Không listing-row riêng như v1. |
| Name | `Mint(…, name, imageURL)` — name 1–64, no newlines. | Không Symbol 2–8. |
| Artwork / tokenURI | `imageURL` rỗng hoặc `http://` / `https://`, max 200, no whitespace. | URL string on-chain. Không upload file, không IPFS pin trong realm. |
| Owner | `OwnerOf(id)`. Khi listed: owner = **realm** (escrow). `SellerOf` giữ seller. | On-chain escrow, không Seaport signature. |
| List | `List(id, priceUgnot)` — caller = owner, chưa listed, `price > 0`. | Không amount. Không fraction. |
| Buy | `Buy(id)` — `OriginSend` == price ugnot. Item → buyer. | Exact send. Fee 50 bps từ price. |
| Cancel | `Cancel(id)` — seller. Item về seller. | Listing sống đến sold hoặc Cancel. Không duration. |
| Item page | Drawer: name, `#id`, image, price, fee table, **Buy**. `ItemLine` = `id\|name\|owner\|seller\|price\|listed\|image`. | |
| Collection page | **Explore** = open items của Bazaar (`ListOpen()`, cap 50). | Không trait filter, không floor. |
| Portfolio | `TokensOf(owner)` + listed flag. Owned **và** listed. Cancel nếu listed. | Khác v1 (chỉ open listings). |
| Mint form | **Mint item**: Name + Image URL. One mint per call. **Không** decimals / supply. | Supply luôn 1. |

Hub: `SetModule("nft", "gno.land/r/bazaar/nft")`. UI đọc module này trước. `market` GRC20 không phải default Explore.

## Verdict table

Keep = copy interaction. Adapt = cùng job, khác surface vì unique item / Adena / Pearl / `docs/NFT.md`. Reject = không làm ở v2.

### Bốn surface bắt buộc (artwork, tokenId, collection page, mint form)

| Pattern | Source | Verdict | Why |
| --- | --- | --- | --- |
| **Artwork** 1:1 trên card | OpenSea asset-card / Studio media; ME “rich NFT card” | **Keep** | v1 Reject vì GRC20 không có image. v2 `ImageOf(id)` / `imageURL` là identity. Card: `<img>` hoặc placeholder mark nếu URL rỗng / load fail. Không TokenMark ticker. Không Gnomies art. |
| **tokenId** trên card + details | OS identifier; ME EVM **Token ID** | **Keep** | Hiện `#id`. Search theo id. `List`/`Buy`/`Cancel` lấy id này — không còn listing-row id tách khỏi item. Không giả ERC-721 `uint256` từ contract lạ. |
| **Collection page** | OS overview + Items; ME collection page (filters, activity, bulk, last sale) | **Adapt** | Một Collection tên **Bazaar**. Explore **là** collection page: grid items đang listed. Reject: banner story CMS, trait accordion, floor, 24h volume, rarity, last sale, bulk list, “items tab vs overview”. |
| **Mint form** | OS Studio: media + name + **supply** (ERC-1155 copies); Drop = community mint | **Adapt** | Form **Mint item**: Name + Image URL. CTA `Mint`. Helper: `Mints one item to you.` Reject: Decimals, Supply, Symbol unique, file upload, traits CSV, Drop / allowlist / pre-reveal, lazy mint. |

### Pattern khác (lật so với `01-marketplace-ux.md`)

| Pattern | v1 | v2 | Why |
| --- | --- | --- | --- |
| Explore grid `minmax(~220–260px)` | Keep | **Keep** | Vẫn list of listings — giờ mỗi card là 1 item. |
| Token mark (ticker disk) | Adapt (thay artwork) | **Reject** | Có artwork. Disk ticker kể sai câu chuyện. Placeholder chỉ khi **không** có URL. |
| Card line `{amount} tokens` | Keep (vì amount) | **Reject** | Không amount. Thay bằng name + `#id`. |
| Sort Amount / Symbol | Adapt | **Reject** Amount/Symbol. **Adapt** sort: Newest (`id` desc), Price (GNOT) low→high. Search: name / `#id` / seller `g1…`. | |
| StatsRow “Tokens” | Keep | **Adapt** | Đổi label **Items** (open listed), không đếm GRC20 symbols. |
| Buy now + Make offer | Adapt → chỉ Buy | **Keep** chỉ **Buy** | Realm không offer / bid / auction. |
| Sweep / cart / bulk | Reject | **Reject** | Một `Buy(id)` = một tx. ME cart / Blur sweep không có. |
| List modal: fee + net proceeds | Keep | **Keep** | 50 bps cố định. Buyer pays X; protocol Y; seller gets X−Y. OS “Adjust for fees” toggle = reject (fee không optional). |
| Listing duration / Reserve / set to floor | Reject | **Reject** | Không expiry, không private listing, không floor collection. |
| Creator earnings / royalty slider | Reject | **Reject** | Chỉ protocol 50 bps. OS/ME royalty không có path. |
| Lazy mint / off-chain signature | Reject | **Reject** | `Mint` và `List` là realm calls. Adena ký `MsgCall`, không Seaport. |
| Portfolio = owned + listed | Adapt (My listings only) | **Adapt** | `TokensOf` + listed. Gallery unlisted **có** (khác v1). Vẫn không P&L USD, không bids. |
| Sticky nav + Connect Adena + Pearl banner | Keep | **Keep** | Test GNOT has no market value. Faucet link. |
| Fiat / USD under price | Reject | **Reject** | “No fake USD.” |
| Verified checkmark / multi-wallet / Stats tab | Reject | **Reject** | Không registry verified. Một nút Adena. |
| “Next OpenSea” copy | Reject | **Reject** | Functional marketplace copy. Không hype. |

## Recommended IA (v2)

Một app, bốn tab. Header sticky. Banner testnet trên cùng. Default module = `nft`.

```
[ Pearl testnet banner ………………………………………… faucet ]

[ Bazaar  gno.land ]   Explore   Create   Sell   Portfolio   [ g1abcd…wxyz · pearl-1 ]
```

| Route | Job | Primary CTA |
| --- | --- | --- |
| **Explore** | Grid of listed **Items**. Image, name, `#id`, price GNOT. Click → drawer. | `Buy` |
| **Create** | **Mint item**: Name, Image URL. | `Mint` |
| **Sell** | Pick owned **unlisted** id, set GNOT price, fee math. | `List` |
| **Portfolio** | Owned + listed. Cancel nếu listed. | `Cancel` |

Không tab Stats, Drops, Launch, Swap. Không “Create token”.

### 1. Explore = Collection (Bazaar)

- Card 1:1 artwork (hoặc placeholder).
- Name, `#id`, `{price} GNOT`, seller `g1…`.
- Empty: `No open listings. Mint an item, then list it.`
- Copy: **Item**, Collection (Bazaar) — không “tokens listed”, không “Create a GRC20”.

### 2. Drawer (item page tối thiểu)

Buyer:

| Line | Copy |
| --- | --- |
| You pay | `{price} GNOT` |
| Protocol fee (0.50%) | included; `{fee} GNOT` to protocol |
| Seller receives | `{price − fee} GNOT` |
| You receive | `{name} #{id}` |

Không Make offer. Không trait table. Không last sale.

### 3. Mint item (không factory)

```
Name          [ 1–64 chars ]
Image URL     [ https://…  ]   optional; http/https only
[ Mint ]
```

- Helper: `Mints one item to you. There is no supply or decimals field.`
- Reject Symbol / Decimals / Supply.

### 4. Sell

- Select owned unlisted `#id` (từ `TokensOf` + `Listed == false`).
- Price (GNOT). Live fee line giống v1.
- Helper: `Listing moves the item into escrow. One item, one price.`
- Không Amount.

### 5. Portfolio

- Grid: artwork + name + `#id` + listed pill.
- Listed → `Cancel`. Unlisted → hint `List` (deep-link Sell với id).
- Empty logged-out: `Connect Adena to see your items.`
- Empty logged-in: `You have no items yet. Mint one.`

## English UI copy (delta so với `docs/copy/ui-en.md`)

`ui-en.md` hiện là GRC20 marketplace. v2 cần source-of-truth mới (không sửa file copy trong note này):

| Key | v1 | v2 đề xuất |
| --- | --- | --- |
| `title` | Bazaar — GRC20 marketplace | Bazaar — fixed-price items |
| `meta.description` | List and buy GRC20 tokens at a fixed GNOT price. | List and buy unique items at a fixed GNOT price. |
| `hero.title` | Buy and sell GRC20 at a fixed GNOT price. | Buy and sell items at a fixed GNOT price. |
| `hero.lead` | Create a token, list an amount, or buy from escrow. | Mint an item, list it, or buy from escrow. Cancel anytime before it sells. |
| `explore.empty` | No open listings. Create a token, then list it. | No open listings. Mint an item, then list it. |
| `create.title` | Create a GRC20 | Mint item |
| `create.lead` | Supply is minted to you. Symbol must be unique… | One item per mint. Name and optional image URL. No decimals or supply. |
| `create.name` | Name | Name |
| `create.image` | — | Image URL |
| `sell.title` | List tokens | List item |
| `sell.lead` | Listing moves tokens from your wallet into escrow. | Listing moves the item into escrow. |
| `card.amount` | Amount | — (drop) |
| `card.id` | — | #{id} |
| `nav.create` | Create | Create |
| Banner | Pearl testnet — test GNOT has no market value. | **Keep** |

Giọng: Item, Collection (Bazaar), Mint, List, Buy, Cancel. Không “tokens listed”. Không “next OpenSea”. Không floor / volume claims.

## Gap so với UI hiện tại

`web/src` đang wire `GetModule("market")`, `Create(name,symbol,decimals,supply)`, `List(symbol,amount,price)`, `TokenMark`, `{amount} tokens`. Pivot v2 là **module + form + card**, không phải skin.

Khi ship (không làm trong note):

1. Hub default `GetModule("nft")`. Fallback market chỉ khi operator paste path.
2. Card: image / placeholder, name, `#id`. Bỏ TokenMark + Amount sort.
3. Create: Name + Image URL. Bỏ Decimals / Supply / Symbol.
4. Sell: owned unlisted ids, không amount.
5. Portfolio: `TokensOf` + listed, không chỉ `ListOpen` filter seller.
6. Copy keys như bảng trên. Banner Pearl **giữ**.

## Assumptions not proven

- `imageURL` http(s) đủ cho v2; hotlink có thể chết / mixed-content. Không có on-chain bytes. Placeholder là mitigation, không phải CDN.
- `ListOpen()` cap 50 đủ cho grid client-side; chưa có indexer phân trang / last sale.
- Adena trên Pearl `chainId === "pearl-1"` ổn định (đã giả định ở note 01).
- User hiểu unique item ≠ GRC20 lot; đổi copy + artwork là mitigation, không phải legal cover.
- Mainnet `p/nt/grc721/v0` **không** un-block Pearl. Product v2 không đợi gemstone testnet — docs hiện **không** liệt kê gemstone sau Pearl.
- Gnomies collection không xuất hiện trong Bazaar Explore trừ khi owner **tự** mint URL của họ — Bazaar không ingest collection đó.

## Không làm

- Không import `p/demo/tokens/grc721` (không tồn tại trên Pearl).
- Không vendor `examples/quarantined/` hay `p/nt/grc721` vào Bazaar v2.
- Không edit `C:\Users\Hi\gnomies-nft`. Không copy 3000-piece art.
- Không DEX, launchpad, offer, auction, royalty, USD, sweep, duration, floor.
- Không investment language, volume claims, “floor will pump.”
- Không implement realm trong note này — spec nằm ở `docs/NFT.md`.

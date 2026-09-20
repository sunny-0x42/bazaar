# QA UI broken — layout / CSS

Owner: bazaar-qa (Dew). Hunt CSS/layout. Không deploy. Không sửa `wallets.ts`. Không xóa test.

Vitest `environment: node` — không render `App` / drawer / tabs. Coverage = source + unit helper. Browser/Adena live: chưa chạy.

---

## Commands

| Command | Cwd | Exit | Result |
| --- | --- | --- | --- |
| `npm test` | `web/` | 0 | 3 files, **86 tests** PASS (`format` 62, `chart` 16, `indexer` 8) |
| `npx tsc --noEmit` | `web/` | 0 | stdout trống |

`npm test` / `npx tsc` từ **repo root** fail (`ENOENT package.json` / `tsc` không phải compiler). Phải `cd web`.

Realm `gno test` không chạy trong pass này (scope `web` UI).

---

## CSS one-liners đã apply (`web/src/styles.css` only)

| Fix | Where |
| --- | --- |
| `label` form styles scoped → `.panel label` (+ `.transfer-field input`) — hết cascade đè Header search / network pill / toolbar | `1088:1104:web/src/styles.css` |
| `.item-detail { overflow: auto }` — dialog scroll được tới Buy | `664:web/src/styles.css` |
| `.item-detail-art { min-height: 280px }` — art không collapse 0px | `680:685:web/src/styles.css` |
| grid `minmax(min(220px, 100%), 1fr)` — không 0-column khi viewport hẹp | `410:418:web/src/styles.css` |
| `.header-inner { flex-wrap: wrap }` — hết `nowrap` đẩy Connect ra ngoài | `89:98:web/src/styles.css` |
| `.wordmark { display: none }` ≤720px | `1213:web/src/styles.css` |
| `.toolbar { flex-wrap: wrap }` — bỏ `nowrap` + `overflow-x` ẩn Min/Max | `377:383:web/src/styles.css` |

Những bug dưới là **còn lại** (cần JS hoặc design, không one-line CSS an toàn).

---

## P1 — Hash routing đánh tabs / che search

**Where:** `web/src/App.tsx:218-268`, `web/src/components/Header.tsx:59-63`

`writeHash` chỉ chạy khi mở collection (`#/c/{slug}`) hoặc item (`#/i/{id}`). Launch / Sell / Portfolio / Settings gọi `onTab` = `setTab` — **không clear hash, không clear `collectionSlug` / `openItemId`**.

`apply()` trên `hashchange` + `popstate`:

```ts
if (route.slug) { setTab("explore"); setCollectionSlug(route.slug); setOpenItemId(""); return; }
if (route.itemId) { setTab("explore"); setOpenItemId(route.itemId); return; }
```

Search `onFocus` / `onChange` gọi `onTab("explore")` — **không** `onExploreHome()`.

**Repro A — drawer đội lên che search**

1. `cd web; npm run dev` → http://127.0.0.1:5176
2. Explore → click card (hash `#/i/N`, `item-detail` mở).
3. Click Launch (desk-nav hoặc BottomNav). Drawer unmount vì `tab !== "explore"`. Hash vẫn `#/i/N`, `openItemId` vẫn set.
4. Click ô Search.

**Expected:** Explore home, search gõ được, không modal.  
**Actual:** Explore mount lại với `itemId` → drawer `z-index: 40` phủ search/header. Overlay `drawer-root` `inset: 0` nuốt click BottomNav (`z-index: 25`).

**Repro B — kẹt collection**

1. Mở collection (`#/c/stones`).
2. Click Sell.
3. Click Search.

**Expected:** Explore home, query filter For sale + Collections.  
**Actual:** `tab=explore` nhưng `slug` còn → `CollectionPage`, search chỉ filter items trong collection.

**Repro C — refresh**

1. Collection hoặc item đang mở → Sell.
2. Reload.

**Expected:** Stay Sell, hoặc hash phản ánh tab.  
**Actual:** `apply()` force Explore + collection/item.

Không CSS-fix. Cần `onTab` non-explore clear hash/`openItemId`, và search dùng `onExploreHome` (hoặc close drawer) — JS, không làm trong pass này.

---

## P2 — Collection banner 160px đẩy Items dưới fold

**Where:** `web/src/styles.css:843-852`, `1206:1209:web/src/styles.css`, `web/src/components/CollectionPage.tsx:96-99`

`.collection-banner` + `.item-art` lock **160px**. Mobile ≤720 lặp lại 160px. Trên phone ~667px:

ribbon + header wrap (logo row + search) + Back + **160 banner** + title/stats + `col-tabs` + toolbar ≈ 560px+ trước grid Items.

**Repro**

1. Viewport 360×640.
2. Explore → collection (sample catalog OK).
3. Tab Items.

**Expected:** 1 hàng card nhìn thấy không scroll (hoặc banner ~96px).  
**Actual:** banner 160px + chrome đẩy grid dưới fold.

`.collection-hero-cover` CSS chết — page dùng `collection-banner`.

---

## P2 — Toolbar filter: count `margin-right: auto` + `flex-shrink: 0`

**Where:** `web/src/styles.css:377-385`, `web/src/components/ItemToolbar.tsx:31-84`

Sau khi bỏ `nowrap`/`overflow-x`, wrap đã bật. Vẫn:

- `.toolbar > * { flex-shrink: 0 }`
- `.toolbar-count { margin-right: auto }`

≥5 control (All, Min 88px, Max 88px, Price, ↑) + count. Hàng 2 wrap lệch phải vì `margin-right: auto` trên count.

**Repro:** Collection → Items, width 400px. Hàng filter thứ hai không align trái với count.

---

## P2 — Header / BottomNav ở 721–1080px

**Where:** `web/src/styles.css:1199-1203`, `web/src/components/BottomNav.tsx:9-14`, `web/src/components/Header.tsx:19-24`

`@media (max-width: 1080px)` ẩn `.desk-nav` **và** bật `.bottom-nav`. Gap 721–900 (BUG-UI-1 cũ) **đã đóng**.

Còn:

- Tablet 900–1080: BottomNav kiểu phone trên màn rộng; desk-nav biến mất sớm.
- `site-footer` chỉ `margin-bottom: 96px` tại 1080 + 720. `main { padding-bottom: 16px }` **chỉ** ≤720. 721–1080 dựa vào footer spacer — page ngắn (Sell empty) footer dính trên BottomNav, OK; đừng bỏ `margin-bottom` 1080.

**Repro:** width **1000px**. Explore/Launch/Sell/Portfolio chỉ ở BottomNav, không ở header.

---

## P2 — Footer `height: 48px` vs BottomNav

**Where:** `web/src/styles.css:315-320`, `1162:1175:web/src/styles.css`, `web/src/App.tsx:461-469`

`.site-footer { height: 48px }` desktop, không `overflow: hidden`. `.footer-pkg` ellipsis. ≤1080 `margin-bottom: 96px` — **không overlap** BottomNav nếu spacer còn.

**Repro fail (nếu regress):** width 390px, scroll hết Launch form. BottomNav (`z-index: 25`) đè `Create drop` nếu ai xóa `margin-bottom: 96px` mà không thêm `main` padding.

`drawer-root` `z-index: 40` > BottomNav: khi item mở, không tap được tabs (cùng P1).

---

## P2 — `item-detail` 2-col + `height: 100%` art

**Where:** `web/src/styles.css:657-690`, `786:787:web/src/styles.css`, `web/src/components/ListingDrawer.tsx:61-69`

`overflow: auto` đã apply. Residual:

- Desktop: `grid-template-columns: 1fr 1fr` + `.item-art { height: 100% }` + `aspect-ratio: 1/1`. Grid `min-height: auto` mặc định — hàng theo art ~50% width. Trên laptop thấp, user phải scroll dialog (không còn clip cứng).
- ≤720: 1 cột. Art 1:1 full width (~328px) + copy + sticky CTA. `max-height: calc(100% - 32px)` — CTA sticky trong body (`overflow: auto` trên `.item-detail-body`) **nếu** grid child chịu shrink. `.item-detail-art` `min-height: 280px` chặn collapse; trên 360px-wide art vẫn ~328px > 280.

**Repro:** `#/i/1` (sample), viewport 360×640. Scroll dialog tới **Buy** / **Connect Adena to buy**. Nếu CTA không tới được = regress `overflow` / `min-height`.

`.drawer` (`643:656:web/src/styles.css`) **chết** — markup là `item-detail`, không `drawer`. Duplicate stack cũ, dễ conflict nếu ai gắn lại class `drawer`.

---

## P3 — Missing class `.page`

**Where:** `Launch.tsx:94`, `Sell.tsx:46`, `Portfolio.tsx:34`, `Settings.tsx:31` — `className="page"`. **Không có** `.page` trong `styles.css`.

Không vỡ layout (wrapper vô style). Dead className.

---

## P3 — Duplicate / leftover CSS

| Rule | Line | Note |
| --- | --- | --- |
| `.drawer` + `.drawer-head` + `.drawer-toolbar` | `643:804:web/src/styles.css` | Không mount. ListingDrawer = `item-detail` |
| `.collection-hero-cover` | `843:852:web/src/styles.css` | Page dùng `collection-banner` |
| `.pearl-badge` grouped với `.status-pill` | `171:web/src/styles.css` | Header dùng `status-pill net-select` |
| `is-live` | `Header.tsx:81` | Không có `.status-pill.is-live` — default accent = Pearl, OK |
| `.listing-card:hover … scale(1.04)` | `492:498:web/src/styles.css` | Spec `08-ui-pass.md`: lift 2px, **reject** zoom 1.04 |

---

## P3 — Live ticker overflow

**Where:** `web/src/styles.css:936-955`, `web/src/components/Explore.tsx:256-283`

`recent-ticker` `flex-wrap: nowrap; overflow-x: auto`. Chip thứ 3 cắt cạnh — carousel, không grid collapse. Activity list (collection tab) vẫn `.activity-row`; ≤720 `grid-template-columns: 1fr auto` + `.activity-kind { grid-column: 1 / -1 }` — kind lên hàng riêng, OK cho list, đừng gắn lại class `activity-row` cho ticker.

---

## Surface check (source, không browser)

| Check | Kết quả |
| --- | --- |
| Explore / Browse | Pass source. Realm-missing → sample + `Open Settings`. Empty thật → `No collections` |
| Sell | Pass. Disconnect / no unlisted = `EmptyState`. Fee aside Buyer / Protocol / You receive |
| Create / Launch | Pass. Drop cards + Create drop `.panel` |
| Mine / Portfolio | Pass. Listed / Unlisted. Transfer field scoped cùng panel inputs |
| Connect | Pass. `hasAdena()` → Connect Adena; không → Install Adena `adena.app` |
| wrong-network | Pass source. `Notices` `Adena is on {chainId}. Switch to {wantChainId} to buy or sell.` + `blocked` disable Buy/List |
| empty list | Pass. `isRealmUnavailable` ≠ empty book |
| Listing drawer | Wiring OK. Hash leftover = P1. Overflow clip = mitigated `overflow: auto` |
| BottomNav | 4 item Explore/Launch/Sell/Portfolio. Hiện ≤1080px. Settings = gear |
| English / no fake USD | Pass `web/src` (GNOT only) |
| Nav gap 721–900 | **Đóng** nhờ breakpoint 1080 chung desk-nav/BottomNav |

---

## Không làm

- Không deploy / Pearl addpkg.
- Không sửa `wallets.ts`.
- Không implement hash-tab sync (P1, JS).
- Không xóa test để green.
- Không browser/Adena session — wrong-network live chưa chứng.

## Invariants giữ (UI)

- Buyer send = listing `price` ugnot; protocol 50 bps lấy từ price.
- Empty book ≠ package missing.
- Money-path `call()` trong `try/catch` → `.err`.

## Assumptions chưa chứng

- `overflow: auto` trên `.item-detail` đủ để Buy visible trên iOS Safari (sticky CTA + grid 1-col).
- `flex-wrap: wrap` header không đẩy search xuống dưới fold trên 1081px khi connected (bal-chip + addr-chip).
- Adena `chainId` sau `SwitchNetwork` đúng `pearl-1`.
- Vitest 86 green **không** cover P1 hash (không render `App`).

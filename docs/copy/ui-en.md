# Bazaar UI copy (en)

Source of truth for public English strings. Short. Fixed-price unique-item marketplace on gno.land — not a DEX, not a token factory.

Do not add investment language, volume claims, or “floor will pump.”

---

## Brand

| Key | Copy |
| --- | --- |
| `brand` | Bazaar |
| `brand.chain` | gno.land |
| `title` | Bazaar — NFT marketplace on gno.land |
| `meta.description` | List and buy unique items at a fixed GNOT price on gno.land Pearl testnet. |

---

## Nav

| Key | Copy |
| --- | --- |
| `nav.explore` | Explore |
| `nav.launch` | Launch |
| `launch.collection` | Collection |
| `launch.unique` | Mint 1/1 |
| `launch.collection.cta` | Launch collection |
| `launch.unique.cta` | Mint 1/1 |
| `launch.mintEdition` | Mint edition |
| `nav.sell` | Sell |
| `nav.portfolio` | Profile |
| `nav.settings` | Settings |
| `nav.admin` | Admin |
| `nav.guide` | Guide |
| `guide.listExternal` | List without launching here |

## Footer

| Key | Copy |
| --- | --- |
| `footer.blurb` | NFT launchpad and secondary book on gno.land. Unique items, fixed GNOT prices, Adena wallet. |
| `footer.not` | Not a DEX. Not a token pad. Not the Gnomies collection. |
| `footer.primary` | Primary mint: 0 bps — all GNOT to creator |
| `footer.secondary` | Secondary buy: 50 bps of the GNOT price |

---

## Testnet

Always visible.

| Key | Copy |
| --- | --- |
| `banner.testnet` | Pearl testnet — test GNOT has no market value. |
| `banner.local` | Local gnodev — Init the NFT realm, then Seed sample collections to buy and sell. |
| `banner.pearl.undeployed` | Pearl testnet — this NFT realm is not deployed yet. Switch to Local to trade. |

---

## Wallet

| Key | Copy |
| --- | --- |
| `wallet.connect` | Connect Adena |
| `wallet.install` | Install Adena |
| `wallet.wrongNetwork` | Adena is on the wrong network. Switch to Pearl (`pearl-1`). |
| `wallet.wrongNetwork.named` | Adena is on {chainId}. Switch to {wantChainId} to buy or sell. |
| `wallet.connected` | Wallet connected. |
| `wallet.needConnect` | Connect Adena first. |

---

## Explore

| Key | Copy |
| --- | --- |
| `explore.title` | Explore |
| `explore.lead` | Live collections. Each has its own realm. Mint in GNOT. |
| `explore.featuredLaunchpads` | Featured launchpads |
| `explore.featuredCollections` | Featured collections |
| `admin.featured` | Featured launchpads |
| `explore.collections` | Collections |
| `explore.empty.title` | No collections |
| `explore.empty` | Create a drop, then list items at a fixed GNOT price. |
| `explore.empty.cta` | Launch |
| `explore.empty.search.title` | No matches |
| `explore.empty.search` | Nothing matches that search. |
| `explore.empty.search.cta` | Clear search |
| `explore.realmMissing` | Realm not on Pearl yet. Showing sample collections. |
| `explore.readError` | Could not read listings. |

Collection page (Explore).

| Key | Copy |
| --- | --- |
| `collection.empty.title` | No items |
| `collection.empty` | This collection has no items yet. |
| `collection.empty.search.title` | No matches |
| `collection.empty.search` | Nothing matches that search. |
| `collection.activity.empty.title` | No activity yet |
| `collection.activity.empty` | Mints, lists, and sales in this collection will show up here. |

---

## Launch

| Key | Copy |
| --- | --- |
| `launch.title` | Launch |
| `launch.lead` | Fixed-price collection drops. Mint pays the drop price in GNOT. |
| `launch.realm` | Each collection is its own realm. Pearl: ask Bazaar to addpkg, then Initialize collection. Local: `/local/new-col` then Initialize collection. |
| `launch.lead.preview` | Sample drops — preview. Mint pays the drop price in GNOT. |
| `launch.empty` | No drops yet. Create one below. |
| `launch.create` | Create drop |
| `launch.mint` | Mint |
| `launch.soldOut` | Sold out |

---

## Sell

| Key | Copy |
| --- | --- |
| `sell.title` | Sell |
| `sell.lead` | List an owned unlisted item. Listing escrows it in the realm. |
| `sell.item` | Item |
| `sell.price` | Price (GNOT) |
| `sell.empty.disconnected.title` | Connect Adena |
| `sell.empty.disconnected` | Connect a wallet to list an item you own. |
| `sell.empty.title` | No unlisted items |
| `sell.empty` | Mint from a drop first, then set a GNOT price here. |
| `sell.empty.cta` | Launch |

---

## Portfolio

| Key | Copy |
| --- | --- |
| `portfolio.title` | Portfolio |
| `portfolio.lead` | Items you own and listings you opened. Cancel returns a listed item to you. |
| `portfolio.empty.disconnected.title` | Connect Adena |
| `portfolio.empty.disconnected` | Connect a wallet to see items you own on this collection. |
| `portfolio.empty.title` | No items yet |
| `portfolio.empty` | Mint from a drop, or wait for a purchase to settle. |
| `portfolio.empty.cta.launch` | Launch |
| `portfolio.empty.cta.list` | List |
| `portfolio.unlisted` | Unlisted |

---

## Settings

| Key | Copy |
| --- | --- |
| `settings.title` | Settings |
| `settings.lead` | After Pearl addpkg, paste the deployed hub and NFT paths. Local gnodev keeps the defaults. |
| `settings.factory` | Factory package path |
| `settings.factory.hint` | Optional. Live Launch uses nftv7. Leave empty unless testing per-realm collections locally (gno.land/r/bazaar/factory). |
| `settings.empty.title` | No NFT path |
| `settings.empty` | Paste the hub and NFT paths after Pearl addpkg. |
| `settings.empty.disconnected.title` | Connect Adena |
| `settings.empty.disconnected` | Connect Adena to seed sample collections. |
| `settings.seed` | Seed sample collections |
| `settings.seed.connect` | Connect Adena to seed |
| `settings.seed.lead` | On local gnodev after Init, seed three sample collections so Explore is a live book. |

---

## Admin

Header link only when the connected address equals `Admin()`. Not in BottomNav. Direct `#/admin` otherwise shows denied, no controls.

| Key | Copy |
| --- | --- |
| `admin.title` | Admin |
| `admin.lead` | Pick launchpad drops for Explore. Up to 8, in the order you tick. |
| `admin.featured` | Featured launches |
| `admin.save` | Save featured |
| `admin.empty` | No launchpad drops on this book yet. |
| `admin.denied.title` | Not admin |
| `admin.denied` | This page is only for the realm admin. |

---

## Buy / Cancel / Your listing

| Key | Copy |
| --- | --- |
| `btn.buy` | Buy |
| `btn.buy.connect` | Connect Adena to buy |
| `btn.cancel` | Cancel |
| `btn.cancel.listing` | Cancel listing |
| `btn.list` | List |
| `listing.yours` | Your listing |
| `listing.yours.cta` | Your listing · Cancel |
| `listing.yours.body` | You listed this item. A different wallet must buy it. |
| `listing.yours.err` | This is your listing. Connect a different Adena account to buy, or Cancel. |

---

## Listing card

| Key | Copy |
| --- | --- |
| `card.price` | Price |
| `card.id` | #{id} |
| `card.seller` | Seller |
| `card.owner` | Owner |
| `card.notListed` | Not listed |
| `card.sample` | Sample |
| `card.priceValue` | {price} GNOT |

---

## Fee

| Key | Copy |
| --- | --- |
| `fee.line` | 0.50% protocol fee |
| `fee.included` | You pay ({fee} included) |
| `fee.split` | Buyer pays {price} GNOT. Protocol fee {fee} GNOT. You receive {net} GNOT. |
| `fee.buyerPays` | Buyer pays |
| `fee.protocol` | Protocol ({label}) |
| `fee.youReceive` | You receive |

---

## Status

| Key | Copy |
| --- | --- |
| `status.busy` | Waiting for {action}… Sign in Adena if a prompt is open. |
| `status.submitted` | Submitted. |
| `status.submitted.hash` | Submitted {hash}… |

---

## Errors

| Key | Copy |
| --- | --- |
| `err.wrongNetwork` | Switch Adena to Pearl (`pearl-1`). |
| `err.needNft` | Set a valid NFT package path in Settings. |
| `err.generic` | Something went wrong. Try again. |
| `err.selfBuy` | This is your listing. Connect a different Adena account to buy, or Cancel. |

---

## Footer (paths)

Keep small; operators only.

| Key | Copy |
| --- | --- |
| `paths.title` | Package paths |
| `paths.hub` | Hub |
| `paths.nft` | NFT |
| `paths.rpc` | RPC |
| `paths.faucet` | Faucet |

---

## Voice

- Actions: list, buy, cancel. One sentence each.
- Name the asset: item. Name the group: collection or drop. Name the unit: GNOT.
- Disclose Pearl. Test GNOT has no market value.
- Do not say DEX, swap, pool, or “next OpenSea.”
- Drop is a Launch collection, not a slogan.

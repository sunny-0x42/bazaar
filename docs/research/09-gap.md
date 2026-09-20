# Gap vs OpenSea / Magic Eden / Tensor (Gno-safe)

| Feature | Them | Bazaar now | This cut |
| --- | --- | --- | --- |
| Buy now | yes | yes | keep |
| Offers / auction / sweep | yes | no | later (escrow book) |
| Update listing price | yes | no | **UpdatePrice** |
| Transfer unlisted | yes | no | **Transfer** |
| Pause drop / change mint price | yes | no | **SetMintPrice, PauseMint** |
| Collection description | yes | no | **SetBio** |
| Filters rarity + price | yes | search only | **UI filters** |
| Wallet balance in header | yes | no | **coins chip** |
| Item deep link | yes | modal only | **hash #/i/{id}** |
| Global activity | yes | collection only | **Explore tape** |
| Royalty | optional | no | later |
| External GRC721 ingest | yes | impossible pull | later push |
| USD | yes | never | reject |

Adena DoContract payload must not change.

## DeFi

`UpdatePrice` chỉ đổi `priceUgnot` trên listing đang escrow. Không `List` lại, không `OriginSend`, không gọi `ProtocolFee` — không phải sale mới; seller và owner (realm) giữ nguyên.
`Transfer` chỉ cho item unlisted (`Listed=false`, owner EOA). Không money path: protocol fee = 0. Item listed thì owner = realm nên Transfer fail-closed; `Cancel` trước rồi mới chuyển.
`PauseMint` / `SetMintPrice` là quyền creator trên primary drop (`PublicMint`). Không đụng escrow book: listing đã `List` vẫn `Buy` được.
Pause không rug listing: không rút item khỏi realm, không `Cancel` hộ seller, không `WithdrawFees`, không đổi 50 bps. Seller vẫn nhận `price − fee`.
Fee math chỉ trên `Buy` (`p/bazaar/fee/v1`). `UpdatePrice` giữ min 1 ugnot như `List`; UI discourages dust. Không investment advice, không hứa volume.

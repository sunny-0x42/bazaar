package col

import (
	"chain"
	"chain/banker"
	"chain/runtime/unsafe"
	"strconv"

	"gno.land/p/bazaar/fee/v1"
	"gno.land/r/bazaar/factory"
)

func List(cur realm, id int, priceUgnot int64) {
	caller := requireUser(cur)
	if priceUgnot <= 0 {
		panic("col: price")
	}
	it := mustItem(id)
	if it.listed {
		panic("col: listed")
	}
	if it.owner != caller {
		panic("col: not owner")
	}
	grcTransfer(caller, caller, self, id)
	it.listed = true
	it.seller = caller
	it.price = priceUgnot
	it.owner = self
	items.Set(itemKey(id), it)
	chain.Emit("List", "id", strconv.Itoa(id), "seller", caller.String(), "price", strconv.FormatInt(priceUgnot, 10))
}

func UpdatePrice(cur realm, id int, priceUgnot int64) {
	caller := requireUser(cur)
	if priceUgnot <= 0 {
		panic("col: price")
	}
	it := mustItem(id)
	if !it.listed {
		panic("col: not listed")
	}
	if it.seller != caller {
		panic("col: not seller")
	}
	it.price = priceUgnot
	items.Set(itemKey(id), it)
	chain.Emit("List", "id", strconv.Itoa(id), "seller", caller.String(), "price", strconv.FormatInt(priceUgnot, 10))
}

func Cancel(cur realm, id int) {
	caller := requireUser(cur)
	it := mustItem(id)
	if !it.listed {
		panic("col: not listed")
	}
	if caller != it.seller {
		panic("col: not seller")
	}
	grcTransfer(self, self, it.seller, id)
	it.listed = false
	it.owner = it.seller
	it.seller = address("")
	it.price = 0
	items.Set(itemKey(id), it)
	chain.Emit("Cancel", "id", strconv.Itoa(id))
}

func Buy(cur realm, id int) {
	caller := requireUser(cur)
	it := mustItem(id)
	if !it.listed {
		panic("col: not listed")
	}
	if caller == it.seller {
		panic("col: self buy")
	}
	takeExact(it.price)
	sellerAmt, royal, sinkAmt, share := tradeSplit(it.price, it.seller, caller)
	payTrade(cur, it.seller, sellerAmt, royal, sinkAmt, share)
	grcTransfer(self, self, caller, id)
	it.listed = false
	it.owner = caller
	it.seller = address("")
	it.price = 0
	items.Set(itemKey(id), it)
	chain.Emit("Buy", "id", strconv.Itoa(id), "buyer", caller.String(), "fee", strconv.FormatInt(sinkAmt+share, 10))
}

func tradeSplit(price int64, seller, buyer address) (sellerAmt, royal, sinkAmt, share int64) {
	if price <= 0 {
		panic("col: price")
	}
	proto := fee.ProtocolFee(price, tradeProtocolBps(seller, buyer))
	if royaltyBps > 0 {
		royal = fee.ProtocolFee(price, int64(royaltyBps))
	}
	if proto+royal > price {
		panic("col: fee")
	}
	sellerAmt = price - proto - royal
	if proto > 0 {
		if !factory.ProtocolSink().IsValid() {
			panic("col: sink")
		}
		share = fee.ProtocolFee(proto, factory.GenesisShareBps())
	}
	sinkAmt = proto - share
	if share > 0 && !factory.GenesisSink().IsValid() {
		panic("col: genesis")
	}
	return
}

func payTrade(cur realm, seller address, sellerAmt, royal, sinkAmt, share int64) {
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	if sellerAmt > 0 {
		bk.SendCoins(self, seller, chain.Coins{{Denom: nativeDenom, Amount: sellerAmt}})
	}
	if royal > 0 {
		bk.SendCoins(self, creator, chain.Coins{{Denom: nativeDenom, Amount: royal}})
	}
	if sinkAmt > 0 {
		bk.SendCoins(self, factory.ProtocolSink(), chain.Coins{{Denom: nativeDenom, Amount: sinkAmt}})
	}
	if share > 0 {
		bk.SendCoins(self, factory.GenesisSink(), chain.Coins{{Denom: nativeDenom, Amount: share}})
	}
}

func takeOneUgnotPositive() int64 {
	sent := unsafe.OriginSend()
	if len(sent) != 1 || sent[0].Denom != nativeDenom || sent[0].Amount <= 0 {
		panic("col: wrong payment")
	}
	return sent[0].Amount
}

func Transfer(cur realm, to address, id int) {
	caller := requireUser(cur)
	if !to.IsValid() {
		panic("col: invalid address")
	}
	if to == caller || to == self {
		panic("col: invalid address")
	}
	it := mustItem(id)
	if it.listed {
		panic("col: listed")
	}
	if it.owner != caller {
		panic("col: not owner")
	}
	grcTransfer(caller, caller, to, id)
	it.owner = to
	items.Set(itemKey(id), it)
	chain.Emit("Transfer", "id", strconv.Itoa(id), "to", to.String())
}

func ProtocolBps() int64 {
	return factory.ProtocolBps()
}

func tradeProtocolBps(seller, buyer address) int64 {
	bps := ProtocolBps()
	d := factory.HolderDiscount(seller.String())
	if bd := factory.HolderDiscount(buyer.String()); bd > d {
		d = bd
	}
	if d > bps {
		return 0
	}
	return bps - d
}

func grcTransfer(spender, from, to address, id int) {
	err := ledger.TransferFrom(spender, from, to, itemTid(id))
	if err != nil {
		panic("col: transfer")
	}
}

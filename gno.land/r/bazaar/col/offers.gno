package col

import (
	"chain"
	"chain/banker"
	"strconv"

	"gno.land/p/nt/avl/v0"
)

type offerRec struct {
	bidder address
	amount int64
}

var offers avl.Tree

func offerKey(id int, bidder address) string {
	return strconv.Itoa(id) + ":" + bidder.String()
}

func Offer(cur realm, id int) {
	caller := requireUser(cur)
	it := mustItem(id)
	sent := takeOneUgnotPositive()
	if caller == it.owner || (it.listed && caller == it.seller) {
		panic("col: self offer")
	}
	key := offerKey(id, caller)
	prev := offers.Get(key)
	if prev != nil {
		old := prev.(*offerRec)
		bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
		bk.SendCoins(self, caller, chain.Coins{{Denom: nativeDenom, Amount: old.amount}})
	}
	offers.Set(key, &offerRec{bidder: caller, amount: sent})
	chain.Emit("Offer", "id", strconv.Itoa(id), "bidder", caller.String(), "amount", strconv.FormatInt(sent, 10))
}

func CancelOffer(cur realm, id int) {
	caller := requireUser(cur)
	key := offerKey(id, caller)
	v := offers.Get(key)
	if v == nil {
		panic("col: no offer")
	}
	rec := v.(*offerRec)
	offers.Remove(key)
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	bk.SendCoins(self, caller, chain.Coins{{Denom: nativeDenom, Amount: rec.amount}})
	chain.Emit("CancelOffer", "id", strconv.Itoa(id), "bidder", caller.String())
}

func AcceptOffer(cur realm, id int, bidder address) {
	caller := requireUser(cur)
	if !bidder.IsValid() || bidder == caller {
		panic("col: self offer")
	}
	it := mustItem(id)
	var from address
	if it.listed {
		if caller != it.seller {
			panic("col: not seller")
		}
		from = self
	} else {
		if caller != it.owner {
			panic("col: not owner")
		}
		from = caller
	}
	key := offerKey(id, bidder)
	v := offers.Get(key)
	if v == nil {
		panic("col: no offer")
	}
	rec := v.(*offerRec)
	amt := rec.amount
	offers.Remove(key)
	sellerAmt, royal, sinkAmt, share := tradeSplit(amt, caller, bidder)
	payTrade(cur, caller, sellerAmt, royal, sinkAmt, share)
	grcTransfer(from, from, bidder, id)
	it.listed = false
	it.owner = bidder
	it.seller = address("")
	it.price = 0
	items.Set(itemKey(id), it)
	chain.Emit(
		"AcceptOffer",
		"id", strconv.Itoa(id),
		"bidder", bidder.String(),
		"amount", strconv.FormatInt(amt, 10),
		"fee", strconv.FormatInt(sinkAmt+share, 10),
	)
}

func InstantSell(cur realm, id int) {
	bidder, ok := topBidder(id)
	if !ok {
		panic("col: no offer")
	}
	AcceptOffer(cur, id, bidder)
}

func topBidder(id int) (address, bool) {
	prefix := strconv.Itoa(id) + ":"
	found := false
	var best address
	bestAmt := int64(0)
	offers.Iterate("", "", func(key string, value any) bool {
		if len(key) < len(prefix) || key[:len(prefix)] != prefix {
			return false
		}
		rec := value.(*offerRec)
		if !found || rec.amount > bestAmt {
			found = true
			best = rec.bidder
			bestAmt = rec.amount
		}
		return false
	})
	return best, found
}

func ListOffers() string {
	requireInit()
	out := ""
	offers.Iterate("", "", func(key string, value any) bool {
		rec := value.(*offerRec)
		colon := -1
		for i := 0; i < len(key); i++ {
			if key[i] == ':' {
				colon = i
				break
			}
		}
		if colon <= 0 {
			return false
		}
		id, err := strconv.Atoi(key[:colon])
		if err != nil {
			return false
		}
		it := mustItem(id)
		if out != "" {
			out += "\n"
		}
		out += strconv.Itoa(id) + "|" + rec.bidder.String() + "|" + strconv.FormatInt(rec.amount, 10) + "|" + it.name
		return false
	})
	return out
}

package col

import (
	"chain"
	"chain/banker"
	"strconv"
	"strings"
	"testing"

	"gno.land/p/bazaar/fee/v1"
	"gno.land/p/nt/testutils/v0"
	"gno.land/r/bazaar/factory"
)

func fundOffer(cur realm, bidder address, amt int64) {
	testing.SetRealm(testing.NewUserRealm(bidder))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: amt}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: amt}})
}

func TestOfferAcceptFees(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	seller := testutils.TestAddress("carol")
	buyer := testutils.TestAddress("dave")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	factory.SetProtocolBps(cross(cur), 200)
	id := Mint(cross(cur), "Sword", "")
	// Init's admin is also ProtocolSink. Accept must pay a seller who is not that sink.
	Transfer(cross(cur), seller, id)
	const price int64 = 10_000_000
	fundOffer(cur, buyer, price)
	Offer(cross(cur), id)
	if !strings.Contains(ListOffers(), buyer.String()) {
		t.Fatalf("list %q", ListOffers())
	}
	testing.SetRealm(testing.NewUserRealm(seller))
	bps := tradeProtocolBps(seller, buyer)
	proto := fee.ProtocolFee(price, bps)
	share := fee.ProtocolFee(proto, factory.GenesisShareBps())
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	sink := factory.ProtocolSink()
	if sink == seller || sink == buyer {
		t.Fatalf("sink overlaps trader")
	}
	sinkBefore := bk.GetCoins(sink).AmountOf("ugnot")
	sellerBefore := bk.GetCoins(seller).AmountOf("ugnot")
	genBefore := int64(0)
	gsink := factory.GenesisSink()
	if gsink.IsValid() {
		if gsink == seller || gsink == buyer {
			t.Fatalf("genesis overlaps trader")
		}
		genBefore = bk.GetCoins(gsink).AmountOf("ugnot")
	}
	testing.SetOriginSend(nil)
	AcceptOffer(cross(cur), id, buyer)
	if mustOwner(strconv.Itoa(id)) != buyer {
		t.Fatalf("owner")
	}
	if bk.GetCoins(seller).AmountOf("ugnot")-sellerBefore != price-proto {
		t.Fatalf("seller %d", bk.GetCoins(seller).AmountOf("ugnot")-sellerBefore)
	}
	if bk.GetCoins(sink).AmountOf("ugnot") != sinkBefore+(proto-share) {
		t.Fatalf("sink %d", bk.GetCoins(sink).AmountOf("ugnot"))
	}
	if gsink.IsValid() && bk.GetCoins(gsink).AmountOf("ugnot") != genBefore+share {
		t.Fatalf("genesis %d", bk.GetCoins(gsink).AmountOf("ugnot"))
	}
	if bk.GetCoins(self).AmountOf("ugnot") != 0 {
		t.Fatalf("realm holds %d", bk.GetCoins(self).AmountOf("ugnot"))
	}
	if ListOffers() != "" {
		t.Fatalf("offer remains %q", ListOffers())
	}
	if Listed(id) {
		t.Fatalf("still listed")
	}
}

func TestOfferNotUser(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { Offer(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
	if ListOffers() != "" {
		t.Fatalf("stored %q", ListOffers())
	}
}

func TestOfferWrongPayment(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "atom", Amount: 1}})
	got := revive(func() { Offer(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected wrong payment")
	}
	testing.SetOriginSend(nil)
	got = revive(func() { Offer(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected missing payment")
	}
	if ListOffers() != "" {
		t.Fatalf("stored %q", ListOffers())
	}
}

func TestOfferSelf(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { Offer(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected self offer")
	}
	if mustOwner(strconv.Itoa(id)) != alice {
		t.Fatalf("owner moved")
	}
}

func TestAcceptNotOwner(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	carol := testutils.TestAddress("carol")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	fundOffer(cur, bob, 1_000_000)
	Offer(cross(cur), id)
	testing.SetRealm(testing.NewUserRealm(carol))
	testing.SetOriginSend(nil)
	got := revive(func() { AcceptOffer(cross(cur), id, bob) })
	if got == nil {
		t.Fatalf("expected not owner")
	}
	if mustOwner(strconv.Itoa(id)) != alice {
		t.Fatalf("owner moved")
	}
	if !strings.Contains(ListOffers(), bob.String()) {
		t.Fatalf("offer dropped")
	}
}

func TestAcceptNotUser(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	fundOffer(cur, bob, 1_000_000)
	Offer(cross(cur), id)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { AcceptOffer(cross(cur), id, bob) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
	if mustOwner(strconv.Itoa(id)) != alice {
		t.Fatalf("owner moved")
	}
}

func TestCancelOfferRefunds(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	carol := testutils.TestAddress("carol")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	fundOffer(cur, bob, 1_000_000)
	Offer(cross(cur), id)
	testing.SetRealm(testing.NewUserRealm(carol))
	testing.SetOriginSend(nil)
	got := revive(func() { CancelOffer(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected no offer for carol")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	CancelOffer(cross(cur), id)
	if ListOffers() != "" {
		t.Fatalf("remains %q", ListOffers())
	}
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	if bk.GetCoins(bob).AmountOf("ugnot") != 1_000_000 {
		t.Fatalf("refund %d", bk.GetCoins(bob).AmountOf("ugnot"))
	}
	if bk.GetCoins(self).AmountOf("ugnot") != 0 {
		t.Fatalf("realm still holds %d", bk.GetCoins(self).AmountOf("ugnot"))
	}
	got = revive(func() { CancelOffer(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected second cancel to revert")
	}
}

func TestOfferReplaceRefunds(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	fundOffer(cur, bob, 1_000_000)
	Offer(cross(cur), id)
	fundOffer(cur, bob, 2_000_000)
	Offer(cross(cur), id)
	if !strings.Contains(ListOffers(), "2000000") {
		t.Fatalf("replaced %q", ListOffers())
	}
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	if bk.GetCoins(bob).AmountOf("ugnot") != 1_000_000 {
		t.Fatalf("old escrow %d", bk.GetCoins(bob).AmountOf("ugnot"))
	}
	if bk.GetCoins(self).AmountOf("ugnot") != 2_000_000 {
		t.Fatalf("escrow %d", bk.GetCoins(self).AmountOf("ugnot"))
	}
}

func TestAcceptListedAndInstant(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 5_000_000)
	fundOffer(cur, bob, 1_000_000)
	Offer(cross(cur), id)
	testing.SetRealm(testing.NewUserRealm(alice))
	testing.SetOriginSend(nil)
	InstantSell(cross(cur), id)
	if mustOwner(strconv.Itoa(id)) != bob {
		t.Fatalf("owner")
	}
	if Listed(id) {
		t.Fatalf("still listed")
	}
	if PriceOf(id) != 0 {
		t.Fatalf("price")
	}
}

func TestBuyLeavesOffer(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	carol := testutils.TestAddress("carol")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 1_000_000)
	fundOffer(cur, carol, 2_000_000)
	Offer(cross(cur), id)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Buy(cross(cur), id)
	if mustOwner(strconv.Itoa(id)) != bob {
		t.Fatalf("buyer")
	}
	if !strings.Contains(ListOffers(), carol.String()) {
		t.Fatalf("buy cleared offer %q", ListOffers())
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(nil)
	AcceptOffer(cross(cur), id, carol)
	if mustOwner(strconv.Itoa(id)) != carol {
		t.Fatalf("accept after buy")
	}
	if ListOffers() != "" {
		t.Fatalf("offer remains %q", ListOffers())
	}
}

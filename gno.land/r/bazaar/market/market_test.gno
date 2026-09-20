package market

import (
	"chain"
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/seqid/v0"
	"gno.land/p/nt/testutils/v0"
)

func resetAll() {
	tokens = avl.Tree{}
	listings = avl.Tree{}
	nextTok = seqid.ID(0)
	nextID = seqid.ID(0)
	inited = false
	var zero address
	admin = zero
	self = zero
	fees = 0
}

func TestCreateListBuy(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	Create(cross(cur), "Demo", "DEMO", 6, 1_000_000)
	id := List(cross(cur), "DEMO", 100, 1_000_000)
	if BalanceOf("DEMO", alice) != 999_900 {
		t.Fatalf("alice after list %d", BalanceOf("DEMO", alice))
	}
	if BalanceOf("DEMO", self) != 100 {
		t.Fatalf("escrow %d", BalanceOf("DEMO", self))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Buy(cross(cur), id)
	if BalanceOf("DEMO", bob) != 100 {
		t.Fatalf("bob tokens %d", BalanceOf("DEMO", bob))
	}
	got := GetListing(id)
	if got[len(got)-4:] != "sold" && !contains(got, "|sold") {
		t.Fatalf("status %q", got)
	}
	if ProtocolFees() != 5000 {
		t.Fatalf("fees %d", ProtocolFees())
	}
}

func TestListNotUserCall(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	Create(cross(cur), "Demo", "DEMO", 6, 100)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { List(cross(cur), "DEMO", 10, 1) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestBuyWrongPayment(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	Create(cross(cur), "Demo", "DEMO", 6, 100)
	id := List(cross(cur), "DEMO", 10, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	got := revive(func() { Buy(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected wrong payment")
	}
}

func TestCancelNotSeller(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	Create(cross(cur), "Demo", "DEMO", 6, 100)
	id := List(cross(cur), "DEMO", 10, 50)
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { Cancel(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected not seller")
	}
}

func TestSelfBuyPanics(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	Create(cross(cur), "Demo", "DEMO", 6, 100)
	id := List(cross(cur), "DEMO", 10, 1_000_000)
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { Buy(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected self buy abort")
	}
}

func TestBuyTwicePanics(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	Create(cross(cur), "Demo", "DEMO", 6, 100)
	id := List(cross(cur), "DEMO", 10, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	Buy(cross(cur), id)
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { Buy(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected not open")
	}
}

func TestCancelAfterBuyPanics(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	Create(cross(cur), "Demo", "DEMO", 6, 100)
	id := List(cross(cur), "DEMO", 10, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Buy(cross(cur), id)
	testing.SetRealm(testing.NewUserRealm(alice))
	got := revive(func() { Cancel(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected cancel after buy abort")
	}
}

func TestCancelReturnsTokens(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	Create(cross(cur), "Demo", "DEMO", 6, 100)
	id := List(cross(cur), "DEMO", 40, 50)
	Cancel(cross(cur), id)
	if BalanceOf("DEMO", alice) != 100 {
		t.Fatalf("returned %d", BalanceOf("DEMO", alice))
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 || stringIndex(s, sub) >= 0)
}

func stringIndex(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

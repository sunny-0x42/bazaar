package perk

import (
	"chain"
	"chain/banker"
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
	"gno.land/r/bazaar/col"
	"gno.land/r/bazaar/factory"
)

func resetPerk() {
	wallets = avl.Tree{}
	tokenWho = avl.Tree{}
	tokenBps = avl.Tree{}
	totalWeight = 0
	acc = 0
	accounted = 0
	var zero address
	self = zero
}

func perkAdmin() address {
	return testutils.TestAddress("perk-admin")
}

func pot() address {
	return chain.PackageAddress(pkgPath)
}

// ensure expects the test function to have already SetRealm to perkAdmin.
// SetRealm only rewrites cur on the frame that calls it.
func ensure(cur realm) {
	resetPerk()
	if revive(func() { factory.Init(cross(cur)) }) == nil {
		factory.SetLaunchFee(cross(cur), 0)
	}
	factory.SetGenesis(cross(cur), pkgPath)
	if revive(func() { col.MaxSupply() }) != nil {
		factory.SetLaunchFee(cross(cur), 0)
		revive(func() { factory.Reserve(cross(cur), "col") })
		col.Init(cross(cur), "Perk Drop", "perkdrop", "https://example.com/c.png", 40, 0, 0)
	}
}

func mintTo(cur realm) int {
	return col.PublicMint(cross(cur))
}

func coins(cur realm, who address) int64 {
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	return bk.GetCoins(who).AmountOf("ugnot")
}

func TestSyncAndClaim(cur realm, t *testing.T) {
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(perkAdmin()))
	ensure(cur)
	if col.Minted() != 0 {
		t.Fatalf("fresh minted %d", col.Minted())
	}
	bob := testutils.TestAddress("perk-bob")
	alice := testutils.TestAddress("perk-alice")
	carol := testutils.TestAddress("perk-carol")
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(perkAdmin()))
	col.AddDropItems(cross(cur), "Myth|https://example.com/m.png|Mythic|Fee discount:150 bps")
	col.SetHidden(cross(cur), true)
	col.ResumeMint(cross(cur))
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { Sync(cross(cur), 1) }) == nil {
		t.Fatalf("expected unminted slot")
	}
	if col.Minted() != 0 || TotalWeight() != 0 {
		t.Fatalf("unminted entered the pool")
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	id := mintTo(cur)
	if id != 1 {
		t.Fatalf("id %d", id)
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	Sync(cross(cur), id)
	if ShareWeight(bob.String()) != 0 || factory.HolderDiscount(bob.String()) != 0 {
		t.Fatalf("sealed weight %d discount %d", ShareWeight(bob.String()), factory.HolderDiscount(bob.String()))
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(perkAdmin()))
	col.RevealCollection(cross(cur))
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(carol))
	Sync(cross(cur), id)
	if ShareWeight(bob.String()) != 150 || FeeDiscount(bob.String()) != 150 {
		t.Fatalf("mythic weight %d fee %d", ShareWeight(bob.String()), FeeDiscount(bob.String()))
	}
	if factory.HolderDiscount(bob.String()) != 150 {
		t.Fatalf("factory discount %d", factory.HolderDiscount(bob.String()))
	}
	if TotalWeight() != 150 {
		t.Fatalf("total %d", TotalWeight())
	}

	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(perkAdmin()))
	col.AddDropItems(cross(cur), "Common|https://example.com/c.png|Common|Fee discount:25 bps")
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(alice))
	commonID := mintTo(cur)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(alice))
	Sync(cross(cur), commonID)
	if ShareWeight(alice.String()) != 25 || factory.HolderDiscount(alice.String()) != 25 {
		t.Fatalf("common %d", ShareWeight(alice.String()))
	}
	if TotalWeight() != 175 {
		t.Fatalf("total %d", TotalWeight())
	}

	testing.IssueCoins(pot(), chain.Coins{{Denom: "ugnot", Amount: 100}})
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	Claim(cross(cur))
	if coins(cur, bob) != 85 {
		t.Fatalf("bob claim %d", coins(cur, bob))
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(alice))
	Claim(cross(cur))
	if coins(cur, alice) != 14 {
		t.Fatalf("alice claim %d", coins(cur, alice))
	}
	if coins(cur, pot()) != 1 {
		t.Fatalf("dust %d", coins(cur, pot()))
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { Claim(cross(cur)) }) == nil {
		t.Fatalf("expected second claim to revert")
	}
	if coins(cur, bob) != 85 {
		t.Fatalf("bob after revert %d", coins(cur, bob))
	}

	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	col.Transfer(cross(cur), carol, id)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(alice))
	Sync(cross(cur), id)
	if ShareWeight(bob.String()) != 0 || factory.HolderDiscount(bob.String()) != 0 {
		t.Fatalf("bob kept mythic")
	}
	if ShareWeight(carol.String()) != 150 || factory.HolderDiscount(carol.String()) != 150 {
		t.Fatalf("carol %d", ShareWeight(carol.String()))
	}
	if ShareWeight(alice.String()) != 25 {
		t.Fatalf("alice moved")
	}

	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(carol))
	col.List(cross(cur), id, 1_000_000)
	Sync(cross(cur), id)
	if ShareWeight(carol.String()) != 0 || factory.HolderDiscount(carol.String()) != 0 {
		t.Fatalf("listed still counted")
	}
	if TotalWeight() != 25 {
		t.Fatalf("listed total %d", TotalWeight())
	}
	col.Cancel(cross(cur), id)
	Sync(cross(cur), id)
	if ShareWeight(carol.String()) != 150 || factory.HolderDiscount(carol.String()) != 150 {
		t.Fatalf("cancel %d", ShareWeight(carol.String()))
	}
	Sync(cross(cur), id)
	if ShareWeight(carol.String()) != 150 || TotalWeight() != 175 {
		t.Fatalf("repeat sync changed weight")
	}
}

func TestSyncRejects(cur realm, t *testing.T) {
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(perkAdmin()))
	ensure(cur)
	bob := testutils.TestAddress("perk-reject-bob")
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { Sync(cross(cur), 0) }) == nil {
		t.Fatalf("expected bad id")
	}
	if revive(func() { Sync(cross(cur), 999) }) == nil {
		t.Fatalf("expected unminted id")
	}
	if revive(func() { SyncSpan(cross(cur), 1, 21) }) == nil {
		t.Fatalf("expected span")
	}
	if revive(func() { SyncSpan(cross(cur), 5, 4) }) == nil {
		t.Fatalf("expected span order")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { Sync(cross(cur), 1) }) == nil {
		t.Fatalf("expected code realm blocked")
	}
	if revive(func() { Claim(cross(cur)) }) == nil {
		t.Fatalf("expected code realm claim blocked")
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	if revive(func() { Claim(cross(cur)) }) == nil {
		t.Fatalf("expected extra payment")
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { Claim(cross(cur)) }) == nil {
		t.Fatalf("expected nothing")
	}
	if TotalWeight() != 0 {
		t.Fatalf("reject changed weight %d", TotalWeight())
	}
}

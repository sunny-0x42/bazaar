package perk2

import (
	"chain"
	"chain/banker"
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
	"gno.land/r/bazaar/col"
	"gno.land/r/bazaar/factory"
)

func resetPerk2() {
	wallets = avl.Tree{}
	tokenWho = avl.Tree{}
	tokenBps = avl.Tree{}
	totalWeight = 0
	accounted = 0
	epochs = 0
	var zero address
	self = zero
	admin = zero
}

func perkAdmin() address {
	return testutils.TestAddress("perk2-admin")
}

func pot() address {
	return chain.PackageAddress(pkgPath)
}

func mustPanic(t *testing.T, name string, fn func()) {
	if revive(fn) == nil {
		t.Fatalf("%s: expected panic", name)
	}
}

func panicText(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	if e, ok := v.(error); ok {
		return e.Error()
	}
	return "unknown panic"
}

// ensure expects SetRealm(perkAdmin) on the calling frame.
func ensure(cur realm, t *testing.T) {
	resetPerk2()
	msg := panicText(revive(func() { factory.Init(cross(cur)) }))
	if msg == "" {
		factory.SetLaunchFee(cross(cur), 0)
	} else if msg != "factory: already initialized" {
		t.Fatalf("factory init: %s", msg)
	}
	factory.SetGenesis(cross(cur), pkgPath)
	if revive(func() { col.MaxSupply() }) != nil {
		factory.SetLaunchFee(cross(cur), 0)
		revive(func() { factory.Reserve(cross(cur), "col") })
		col.Init(cross(cur), "Perk Drop", "perkdrop", "https://example.com/c.png", 40, 0, 0)
	}
	Init(cross(cur))
}

func mintTo(cur realm) int {
	return col.PublicMint(cross(cur))
}

func coins(cur realm, who address) int64 {
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	return bk.GetCoins(who).AmountOf("ugnot")
}

func issue(n int64) {
	testing.IssueCoins(pot(), chain.Coins{{Denom: "ugnot", Amount: n}})
}

func TestEpochSplit(cur realm, t *testing.T) {
	admin := perkAdmin()
	bob := testutils.TestAddress("perk2-bob")
	alice := testutils.TestAddress("perk2-alice")
	carol := testutils.TestAddress("perk2-carol")
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	ensure(cur, t)
	if col.Minted() != 0 {
		t.Fatalf("fresh minted %d", col.Minted())
	}
	if Admin() != admin.String() || Address() != pot() {
		t.Fatalf("init admin %s", Admin())
	}
	if Render("") == "" {
		t.Fatalf("empty render")
	}

	issue(40)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	Settle(cross(cur))
	if Epochs() != 0 || Accounted() != 0 || Unsettled() != 40 {
		t.Fatalf("zero weight locked epochs %d accounted %d unsettled %d", Epochs(), Accounted(), Unsettled())
	}

	issue(60)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	col.AddDropItems(cross(cur), "Myth|https://example.com/m.png|Mythic|Fee discount:150 bps")
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	col.SetHidden(cross(cur), true)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	col.ResumeMint(cross(cur))
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	mustPanic(t, "unminted", func() { Sync(cross(cur), 1) })
	if TotalWeight() != 0 {
		t.Fatalf("unminted entered")
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	id := mintTo(cur)
	if id != 1 {
		t.Fatalf("id %d", id)
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(carol))
	Sync(cross(cur), id)
	if ShareWeight(bob.String()) != 0 || factory.HolderDiscount(bob.String()) != 0 {
		t.Fatalf("sealed weight")
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	col.RevealCollection(cross(cur))
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(carol))
	Sync(cross(cur), id)
	if ShareWeight(bob.String()) != 150 || FeeDiscount(bob.String()) != 150 {
		t.Fatalf("mythic %d", ShareWeight(bob.String()))
	}
	if factory.HolderDiscount(bob.String()) != 150 || TotalWeight() != 150 {
		t.Fatalf("factory mythic")
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	mustPanic(t, "claim before settle", func() { Claim(cross(cur)) })
	if Claimable(bob.String()) != 0 || Epochs() != 0 || Unsettled() != 100 {
		t.Fatalf("first syncer took the backlog")
	}

	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	col.AddDropItems(cross(cur), "Common|https://example.com/c.png|Common|Fee discount:25 bps")
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(alice))
	commonID := mintTo(cur)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(alice))
	Sync(cross(cur), commonID)
	if ShareWeight(alice.String()) != 25 || factory.HolderDiscount(alice.String()) != 25 || TotalWeight() != 175 {
		t.Fatalf("common total %d", TotalWeight())
	}
	issue(75)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	mustPanic(t, "non-admin settle", func() { Settle(cross(cur)) })
	if Epochs() != 0 {
		t.Fatalf("non-admin settled")
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	Settle(cross(cur))
	if Epochs() != 1 || Accounted() != 175 || Unsettled() != 0 {
		t.Fatalf("settle epochs %d accounted %d unsettled %d", Epochs(), Accounted(), Unsettled())
	}
	if Claimable(bob.String()) != 150 || Claimable(alice.String()) != 25 || Claimable(carol.String()) != 0 {
		t.Fatalf("shares bob %d alice %d", Claimable(bob.String()), Claimable(alice.String()))
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
		t.Fatalf("carol weight")
	}
	if Claimable(bob.String()) != 150 || Claimable(carol.String()) != 0 {
		t.Fatalf("seller accrued moved")
	}
	bobBefore := coins(cur, bob)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	Claim(cross(cur))
	if coins(cur, bob)-bobBefore != 150 || Claimable(bob.String()) != 0 {
		t.Fatalf("bob claim %d", coins(cur, bob)-bobBefore)
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	mustPanic(t, "second claim", func() { Claim(cross(cur)) })

	issue(175)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	mustPanic(t, "claim does not settle", func() { Claim(cross(cur)) })
	if Unsettled() != 175 || Epochs() != 1 || Claimable(bob.String()) != 0 {
		t.Fatalf("claim distributed")
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	Settle(cross(cur))
	if Epochs() != 2 || Claimable(carol.String()) != 150 || Claimable(alice.String()) != 50 || Claimable(bob.String()) != 0 {
		t.Fatalf("epoch2 carol %d alice %d bob %d", Claimable(carol.String()), Claimable(alice.String()), Claimable(bob.String()))
	}
	carolBefore := coins(cur, carol)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(carol))
	Claim(cross(cur))
	if coins(cur, carol)-carolBefore != 150 {
		t.Fatalf("carol claim %d", coins(cur, carol)-carolBefore)
	}

	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(carol))
	col.List(cross(cur), id, 1_000_000)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	Sync(cross(cur), id)
	if ShareWeight(carol.String()) != 0 || factory.HolderDiscount(carol.String()) != 0 || TotalWeight() != 25 {
		t.Fatalf("listed total %d", TotalWeight())
	}
	issue(25)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	Settle(cross(cur))
	if Epochs() != 3 || Claimable(alice.String()) != 75 || Claimable(carol.String()) != 0 || Unsettled() != 0 {
		t.Fatalf("listed settle alice %d", Claimable(alice.String()))
	}
	aliceBefore := coins(cur, alice)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(alice))
	Claim(cross(cur))
	if coins(cur, alice)-aliceBefore != 75 || Claimable(alice.String()) != 0 {
		t.Fatalf("alice claim %d", coins(cur, alice)-aliceBefore)
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(alice))
	mustPanic(t, "alice second", func() { Claim(cross(cur)) })

	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(carol))
	col.Cancel(cross(cur), id)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(carol))
	Sync(cross(cur), id)
	if ShareWeight(carol.String()) != 150 || TotalWeight() != 175 {
		t.Fatalf("cancel %d", ShareWeight(carol.String()))
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(carol))
	Sync(cross(cur), id)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	Settle(cross(cur))
	if Epochs() != 3 || Claimable(carol.String()) != 0 || Unsettled() != 0 {
		t.Fatalf("empty settle moved")
	}

	issue(174)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	Settle(cross(cur))
	if Epochs() != 4 || Claimable(carol.String()) != 149 || Claimable(alice.String()) != 24 || Unsettled() != 1 || Accounted() != 173 {
		t.Fatalf("dust carol %d alice %d unsettled %d accounted %d", Claimable(carol.String()), Claimable(alice.String()), Unsettled(), Accounted())
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	Settle(cross(cur))
	if Epochs() != 4 || Unsettled() != 1 || Claimable(carol.String()) != 149 {
		t.Fatalf("dust settle paid")
	}
}

func TestSyncRejects(cur realm, t *testing.T) {
	admin := perkAdmin()
	bob := testutils.TestAddress("perk2-reject-bob")
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	ensure(cur, t)
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	mustPanic(t, "id", func() { Sync(cross(cur), 0) })
	mustPanic(t, "unminted", func() { Sync(cross(cur), 999) })
	mustPanic(t, "span", func() { SyncSpan(cross(cur), 1, 21) })
	mustPanic(t, "span order", func() { SyncSpan(cross(cur), 5, 4) })
	mustPanic(t, "nothing", func() { Claim(cross(cur)) })
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	testing.SetRealm(testing.NewUserRealm(bob))
	mustPanic(t, "extra claim", func() { Claim(cross(cur)) })
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	testing.SetRealm(testing.NewUserRealm(admin))
	mustPanic(t, "extra settle", func() { Settle(cross(cur)) })
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	testing.SetRealm(testing.NewUserRealm(bob))
	mustPanic(t, "extra sync", func() { Sync(cross(cur), 1) })
	if TotalWeight() != 0 || Epochs() != 0 || Accounted() != 0 {
		t.Fatalf("reject mutated")
	}

	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	mustPanic(t, "code sync", func() { Sync(cross(cur), 1) })
	mustPanic(t, "code claim", func() { Claim(cross(cur)) })
	mustPanic(t, "code settle", func() { Settle(cross(cur)) })
	mustPanic(t, "code init", func() { Init(cross(cur)) })
	if Admin() != admin.String() {
		t.Fatalf("admin changed")
	}

	resetPerk2()
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	testing.SetRealm(testing.NewUserRealm(admin))
	mustPanic(t, "extra init", func() { Init(cross(cur)) })
	if Admin() != "" || Unsettled() != 0 {
		t.Fatalf("paid init stuck")
	}
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(bob))
	mustPanic(t, "sync before init", func() { Sync(cross(cur), 1) })
	mustPanic(t, "claim before init", func() { Claim(cross(cur)) })
	mustPanic(t, "settle before init", func() { Settle(cross(cur)) })
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	Init(cross(cur))
	testing.SetOriginSend(chain.Coins{})
	testing.SetRealm(testing.NewUserRealm(admin))
	mustPanic(t, "second init", func() { Init(cross(cur)) })
	if Admin() != admin.String() || TotalWeight() != 0 {
		t.Fatalf("second init")
	}
}

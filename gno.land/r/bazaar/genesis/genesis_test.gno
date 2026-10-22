package genesis

import (
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
	"gno.land/r/bazaar/factory"
)

func boot(cur realm) {
	inited = false
	nextID = 0
	creator = address("")
	tokenSeq = 0
	items = avl.Tree{}
	token = nil
	ledger = nil
	mintedCommon = 0
	mintedUncommon = 0
	mintedRare = 0
	mintedEpic = 0
	mintedLegend = 0
	mintedMythic = 0
	revive(func() { factory.Init(cross(cur)) })
	factory.SetDiscountPusher(cross(cur), "gno.land/r/bazaar/gpush")
	factory.SetGenesis(cross(cur), "gno.land/r/bazaar/genesis")
	Init(cross(cur), "Genesis", "GENESIS")
}

func TestHolderDiscount(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	if HolderDiscount(alice.String()) != 0 {
		t.Fatalf("empty")
	}
	Mint(cross(cur), "Common", "", "common", -1)
	if HolderDiscount(alice.String()) != 25 {
		t.Fatalf("common")
	}
	if ShareWeight(alice.String()) != 25 {
		t.Fatalf("common share")
	}
	Mint(cross(cur), "Legend", "", "legendary", -1)
	if HolderDiscount(alice.String()) != 125 {
		t.Fatalf("legendary got %d", HolderDiscount(alice.String()))
	}
	if ShareWeight(alice.String()) != 150 {
		t.Fatalf("share %d", ShareWeight(alice.String()))
	}
	Mint(cross(cur), "Myth", "", "mythic", -1)
	if HolderDiscount(alice.String()) != 150 {
		t.Fatalf("mythic got %d", HolderDiscount(alice.String()))
	}
	if ShareWeight(alice.String()) != 300 {
		t.Fatalf("three nfts")
	}
	if HolderDiscount(bob.String()) != 0 {
		t.Fatalf("bob")
	}
	TransferFrom(cross(cur), alice.String(), bob.String(), "3")
	if HolderDiscount(alice.String()) != 125 {
		t.Fatalf("after send %d", HolderDiscount(alice.String()))
	}
	if ShareWeight(alice.String()) != 150 {
		t.Fatalf("alice share after send")
	}
	if HolderDiscount(bob.String()) != 150 {
		t.Fatalf("bob mythic %d", HolderDiscount(bob.String()))
	}
	if ShareWeight(bob.String()) != 150 {
		t.Fatalf("bob share")
	}
}

func TestShareBps(cur realm, t *testing.T) {
	if ShareBps() != 1100 {
		t.Fatalf("share %d", ShareBps())
	}
}

func TestMintOverrideAndCap(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	Mint(cross(cur), "Custom", "", "common", 80)
	if DiscountOf("1") != 80 || HolderDiscount(alice.String()) != 80 {
		t.Fatalf("override")
	}
	got := revive(func() { Mint(cross(cur), "TooMuch", "", "common", 151) })
	if got == nil {
		t.Fatalf("expected cap")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	got = revive(func() { Mint(cross(cur), "X", "", "rare", -1) })
	if got == nil {
		t.Fatalf("expected not creator")
	}
}

func TestMaxSupply1111(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	if MaxSupply() != 1111 {
		t.Fatalf("cap %d", MaxSupply())
	}
	if TotalSupply() != 0 {
		t.Fatalf("empty")
	}
	Mint(cross(cur), "One", "", "common", -1)
	if TotalSupply() != 1 {
		t.Fatalf("minted")
	}
	nextID = maxSupply
	got := revive(func() { Mint(cross(cur), "Full", "", "common", -1) })
	if got == nil {
		t.Fatalf("expected sold out")
	}
}

func TestRaritySupply(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	sum := SupplyOf("common") + SupplyOf("uncommon") + SupplyOf("rare") + SupplyOf("epic") + SupplyOf("legendary") + SupplyOf("mythic")
	if sum != 1111 || SupplyOf("common") != 666 || SupplyOf("mythic") != 13 {
		t.Fatalf("curve %d", sum)
	}
	mintedCommon = supplyCommon
	got := revive(func() { Mint(cross(cur), "C", "", "common", -1) })
	if got == nil {
		t.Fatalf("expected rarity full")
	}
	Mint(cross(cur), "U", "", "uncommon", -1)
	if MintedOf("uncommon") != 1 || TotalSupply() != 1 {
		t.Fatalf("uncommon still open")
	}
}

func TestAdenaOwnerOf(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	Mint(cross(cur), "G", "", "rare", -1)
	owner, err := OwnerOf("1")
	if err != nil || owner != alice {
		t.Fatalf("owner")
	}
	if TokensOf(alice.String()) != "1" || BalanceOf(alice.String()) != 1 {
		t.Fatalf("tokens")
	}
}

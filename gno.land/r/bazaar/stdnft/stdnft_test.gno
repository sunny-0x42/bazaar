package stdnft

import (
	"strings"
	"testing"

	"gno.land/p/nt/testutils/v0"
)

func reset() {
	token = nil
	ledger = nil
	metaView = nil
	metaLed = nil
	enumView = nil
	tokenSeq = 0
	inited = false
	creator = address("")
}

func boot(cur realm) {
	reset()
	Init(cross(cur), "StdNFT", "STDNFT")
}

func mustOwner(tid string) address {
	owner, err := OwnerOf(tid)
	if err != nil {
		panic(err.Error())
	}
	return owner
}

func TestMintHappy(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	img := "https://bazaar-gno.vercel.app/gnomies.png"
	Mint(cross(cur), "1", "Std Gnomie", img)
	if Name() != "StdNFT" || Symbol() != "STDNFT" {
		t.Fatalf("name/symbol %s %s", Name(), Symbol())
	}
	if TotalSupply() != 1 {
		t.Fatalf("supply %d", TotalSupply())
	}
	if BalanceOf(alice.String()) != 1 {
		t.Fatalf("balance %d", BalanceOf(alice.String()))
	}
	if mustOwner("1") != alice {
		t.Fatalf("owner %s", mustOwner("1").String())
	}
	if TokenOfOwnerByIndex(alice.String(), 0) != "1" {
		t.Fatalf("index %s", TokenOfOwnerByIndex(alice.String(), 0))
	}
	if TokensOf(alice.String()) != "1" {
		t.Fatalf("tokens %s", TokensOf(alice.String()))
	}
	uri := TokenURI("1")
	if !strings.HasPrefix(uri, "data:application/json") {
		t.Fatalf("uri prefix %q", uri)
	}
	if !strings.Contains(uri, "gnomies.png") && !strings.Contains(uri, "gnomies%2Epng") {
		t.Fatalf("uri image %q", uri)
	}
	TransferFrom(cross(cur), alice.String(), bob.String(), "1")
	if mustOwner("1") != bob {
		t.Fatalf("owner after transfer %s", mustOwner("1").String())
	}
	if BalanceOf(alice.String()) != 0 || BalanceOf(bob.String()) != 1 {
		t.Fatalf("balances after transfer")
	}
	if TokensOf(bob.String()) != "1" || TokensOf(alice.String()) != "" {
		t.Fatalf("tokens after transfer alice=%q bob=%q", TokensOf(alice.String()), TokensOf(bob.String()))
	}
}

func TestTransferWrongCaller(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	Mint(cross(cur), "1", "Std Gnomie", "")
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { TransferFrom(cross(cur), alice.String(), bob.String(), "1") })
	if got == nil {
		t.Fatalf("expected not owner")
	}
	if mustOwner("1") != alice {
		t.Fatalf("owner mutated")
	}
}

func TestMintNotUserCall(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { Mint(cross(cur), "1", "Std Gnomie", "") })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
	if TotalSupply() != 0 {
		t.Fatalf("minted by realm")
	}
}

func TestMintDuplicateAndNotCreator(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	Mint(cross(cur), "1", "Std Gnomie", "")
	got := revive(func() { Mint(cross(cur), "1", "Std Gnomie", "") })
	if got == nil {
		t.Fatalf("expected duplicate mint")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	got = revive(func() { Mint(cross(cur), "2", "Other", "") })
	if got == nil {
		t.Fatalf("expected not creator")
	}
	got = revive(func() { Init(cross(cur), "X", "Y") })
	if got == nil {
		t.Fatalf("expected already initialized")
	}
	if TotalSupply() != 1 || mustOwner("1") != alice {
		t.Fatalf("state after abuse")
	}
}

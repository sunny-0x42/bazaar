package edcol

import (
	"chain"
	"chain/banker"
	"strings"
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
	"gno.land/p/bazaar/grc1155/v0"
	"gno.land/r/bazaar/efactory"
)

// wipe runs before SetRealm. cur is still this collection, so the new ledger
// stays bound here and NoteMinted sees a code caller.
func wipe(cur realm) {
	testing.SetOriginSend(nil)
	if !inited {
		return
	}
	editions = avl.Tree{}
	listings = avl.Tree{}
	copies = 0
	royalty = 0
	ledger = grc1155.New(0, cur)
	efactory.NoteMinted(cross(cur), 0)
}

// open runs in the test function, after SetRealm, so cross(cur) is the user.
func open(cur realm) {
	if revive(func() { efactory.Init(cross(cur)) }) == nil {
		efactory.SetLaunchFee(cross(cur), 0)
	}
	if !inited {
		efactory.Reserve(cross(cur), "edcol")
		Init(cross(cur), "Prints", "PRINT", "https://example.com/cover.png", 0)
	}
}

func TestListPartialBuy(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	wipe(cur)
	testing.SetRealm(testing.NewUserRealm(alice))
	open(cur)
	bob := testutils.TestAddress("bob")
	eve := testutils.TestAddress("eve")
	efactory.SetProtocolSink(cross(cur), eve)
	royalty = 500
	Create(cross(cur), "red", "Red Print", "https://example.com/red.png", 10, 0)
	Mint(cross(cur), "red", alice, 4)
	if BalanceOf(alice.String(), "red") != 4 || Supply("red") != 4 {
		t.Fatalf("mint bal %d supply %d", BalanceOf(alice.String(), "red"), Supply("red"))
	}
	uri := TokenURI("red")
	if !strings.HasPrefix(uri, "data:application/json") || !strings.Contains(uri, "Red") {
		t.Fatalf("uri %s", uri)
	}
	List(cross(cur), "red", 4, 1_000_000)
	if !strings.Contains(Editions(), "red|Red Print|") {
		t.Fatalf("editions %q", Editions())
	}
	if !strings.Contains(OpenListings(), alice.String()+"|red|4|1000000") {
		t.Fatalf("open %q", OpenListings())
	}
	if BalanceOf(alice.String(), "red") != 0 || BalanceOf(self.String(), "red") != 4 {
		t.Fatalf("escrow alice %d realm %d", BalanceOf(alice.String(), "red"), BalanceOf(self.String(), "red"))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Buy(cross(cur), alice, "red", 1)
	if BalanceOf(bob.String(), "red") != 1 || Listing(alice.String(), "red") != "3|1000000" {
		t.Fatalf("partial bob %d listing %q", BalanceOf(bob.String(), "red"), Listing(alice.String(), "red"))
	}
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	if bk.GetCoins(eve).AmountOf("ugnot") != 20_000 {
		t.Fatalf("sink %d", bk.GetCoins(eve).AmountOf("ugnot"))
	}
	if !strings.Contains(efactory.ListEditions(), "edcol|Prints|") {
		t.Fatalf("factory %q", efactory.ListEditions())
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	Cancel(cross(cur), "red")
	if Listing(alice.String(), "red") != "" || BalanceOf(alice.String(), "red") != 3 {
		t.Fatalf("cancel bal %d listing %q", BalanceOf(alice.String(), "red"), Listing(alice.String(), "red"))
	}
}

func TestBuyRejectsAbuse(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	wipe(cur)
	testing.SetRealm(testing.NewUserRealm(alice))
	open(cur)
	bob := testutils.TestAddress("bob")
	Create(cross(cur), "red", "Red Print", "https://example.com/red.png", 10, 0)
	Mint(cross(cur), "red", alice, 2)
	List(cross(cur), "red", 2, 1_000_000)
	if revive(func() { Buy(cross(cur), alice, "red", 1) }) == nil {
		t.Fatal("self buy")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	if revive(func() { Buy(cross(cur), alice, "red", 1) }) == nil {
		t.Fatal("short payment")
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	if revive(func() { Buy(cross(cur), alice, "red", 3) }) == nil {
		t.Fatal("over listing")
	}
	if Listing(alice.String(), "red") != "2|1000000" || BalanceOf(alice.String(), "red") != 0 {
		t.Fatalf("listing changed %q", Listing(alice.String(), "red"))
	}
}

func TestListAndMintRejects(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	wipe(cur)
	testing.SetRealm(testing.NewUserRealm(alice))
	open(cur)
	bob := testutils.TestAddress("bob")
	Create(cross(cur), "red", "Red Print", "https://example.com/red.png", 2, 0)
	Mint(cross(cur), "red", alice, 1)
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { List(cross(cur), "red", 1, 1) }) == nil {
		t.Fatal("bob list")
	}
	if revive(func() { Create(cross(cur), "blue", "Blue", "https://example.com/b.png", 1, 0) }) == nil {
		t.Fatal("bob create")
	}
	if revive(func() { Mint(cross(cur), "red", bob, 1) }) == nil {
		t.Fatal("public mint while price is 0")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { Mint(cross(cur), "red", alice, 2) }) == nil {
		t.Fatal("over max")
	}
	if revive(func() { List(cross(cur), "red", 0, 1) }) == nil {
		t.Fatal("zero list")
	}
	if BalanceOf(alice.String(), "red") != 1 || Supply("red") != 1 {
		t.Fatalf("supply changed bal %d supply %d", BalanceOf(alice.String(), "red"), Supply("red"))
	}
}

func TestTransferAndPublicMint(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	wipe(cur)
	testing.SetRealm(testing.NewUserRealm(alice))
	open(cur)
	bob := testutils.TestAddress("bob")
	Create(cross(cur), "red", "Red Print", "https://example.com/red.png", 5, 1_000)
	Mint(cross(cur), "red", alice, 1)
	if revive(func() { Transfer(cross(cur), bob, "red", 2) }) == nil {
		t.Fatal("short transfer")
	}
	Transfer(cross(cur), bob, "red", 1)
	if BalanceOf(bob.String(), "red") != 1 || BalanceOf(alice.String(), "red") != 0 {
		t.Fatalf("transfer alice %d bob %d", BalanceOf(alice.String(), "red"), BalanceOf(bob.String(), "red"))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 2_000}})
	before := banker.NewBanker(banker.BankerTypeRealmSend, cur).GetCoins(alice).AmountOf("ugnot")
	Mint(cross(cur), "red", bob, 2)
	after := banker.NewBanker(banker.BankerTypeRealmSend, cur).GetCoins(alice).AmountOf("ugnot")
	if after-before != 2_000 || BalanceOf(bob.String(), "red") != 3 || Supply("red") != 3 {
		t.Fatalf("public mint pay %d bal %d supply %d", after-before, BalanceOf(bob.String(), "red"), Supply("red"))
	}
}

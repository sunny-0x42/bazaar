package factory

import (
	"chain"
	"strings"
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
)

func resetAll() {
	bySlug = avl.Tree{}
	byPkg = avl.Tree{}
	pending = avl.Tree{}
	reserved = avl.Tree{}
	inited = false
	launchFee = 0
	seenBank = 0
	var zero address
	admin = zero
	self = zero
}

func TestInit(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	if Admin() != alice.String() {
		t.Fatalf("admin %q", Admin())
	}
	if LaunchFee() != defaultLaunchFee {
		t.Fatalf("launch fee %d", LaunchFee())
	}
	if Address() == alice {
		t.Fatalf("factory address")
	}
	if ListCollections() != "" {
		t.Fatalf("empty list")
	}
	got := revive(func() { Init(cross(cur)) })
	if got == nil {
		t.Fatalf("expected already initialized")
	}
}

func TestInitNotUserCall(cur realm, t *testing.T) {
	resetAll()
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { Init(cross(cur)) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestSetLaunchFee(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	SetLaunchFee(cross(cur), 0)
	if LaunchFee() != 0 {
		t.Fatalf("fee %d", LaunchFee())
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { SetLaunchFee(cross(cur), 1) })
	if got == nil {
		t.Fatalf("expected not admin")
	}
}

func TestRegisterHappy(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	SetLaunchFee(cross(cur), 0)
	pkg := "gno.land/r/bazaar/c/demo"
	pending.Set(pkg, true)
	register(pkg, alice, "Demo", "demo", "/samples/demo.png", 10, 1_000_000, 250)
	if CollectionOf("demo") != pkg {
		t.Fatalf("CollectionOf %q", CollectionOf("demo"))
	}
	line := ListCollections()
	addr := chain.PackageAddress(pkg).String()
	want := "demo|Demo|/samples/demo.png|" + pkg + "|1000000|10|0|" + alice.String() + "|" + addr + "|250"
	if line != want {
		t.Fatalf("ListCollections %q want %q", line, want)
	}
	if CollectionAddr("demo") != addr {
		t.Fatalf("CollectionAddr %q want %q", CollectionAddr("demo"), addr)
	}
	if RoyaltyOf("demo") != 250 {
		t.Fatalf("RoyaltyOf %d", RoyaltyOf("demo"))
	}
}

func TestRegisterFromCollectionRealm(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	SetLaunchFee(cross(cur), 0)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/bazaar/c/demo"))
	CreditLaunchFee(cross(cur))
	got := revive(func() { Register(cross(cur), "Demo", "demo", "", 0, 0, 0) })
	if got == nil {
		t.Fatalf("expected EOA creator: NewCodeRealm Previous is not the launching EOA")
	}
}

func TestRegisterNotRealm(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	SetLaunchFee(cross(cur), 0)
	got := revive(func() { Register(cross(cur), "Demo", "demo", "", 0, 0, 0) })
	if got == nil {
		t.Fatalf("expected collection realm")
	}
}

func testPut(cur realm, pkg string, creator address, name, symbol, cover string, maxSupply int, mintPrice, royaltyBps int64) {
	register(pkg, creator, name, symbol, cover, maxSupply, mintPrice, royaltyBps)
}

func TestRegisterDuplicate(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	pkg := "gno.land/r/bazaar/c/demo"
	testPut(cross(cur), pkg, alice, "Demo", "demo", "", 0, 0, 0)
	got := revive(func() { testPut(cross(cur), pkg, alice, "Demo", "demo", "", 0, 0, 0) })
	if got == nil {
		t.Fatalf("expected pkg already registered")
	}
	got = revive(func() { testPut(cross(cur), "gno.land/r/other/demo", alice, "Other", "demo", "", 0, 0, 0) })
	if got == nil {
		t.Fatalf("expected slug taken")
	}
}

func TestCreditLaunchFeeBank(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	SetLaunchFee(cross(cur), 100)
	testing.IssueCoins(Address(), chain.Coins{{Denom: "ugnot", Amount: 100}})
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/bazaar/c/demo"))
	CreditLaunchFee(cross(cur))
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/bazaar/c/other"))
	got := revive(func() { CreditLaunchFee(cross(cur)) })
	if got == nil {
		t.Fatalf("expected launch fee on zero delta")
	}
}

func TestCreditLaunchFeeNotRealm(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	SetLaunchFee(cross(cur), 0)
	got := revive(func() { CreditLaunchFee(cross(cur)) })
	if got == nil {
		t.Fatalf("expected collection realm")
	}
}

func TestNoteMinted(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	pkg := "gno.land/r/bazaar/c/demo"
	register(pkg, alice, "Demo", "demo", "", 0, 0, 0)
	testing.SetRealm(testing.NewCodeRealm(pkg))
	NoteMinted(cross(cur), 3)
	if !strings.Contains(ListCollections(), "|3|") {
		t.Fatalf("minted %q", ListCollections())
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	got := revive(func() { NoteMinted(cross(cur), 1) })
	if got == nil {
		t.Fatalf("expected collection realm")
	}
}

func TestNoteRoyalty(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	pkg := "gno.land/r/bazaar/c/demo"
	register(pkg, alice, "Demo", "demo", "", 0, 0, 0)
	if RoyaltyOf("demo") != 0 {
		t.Fatalf("RoyaltyOf after Init %d", RoyaltyOf("demo"))
	}
	testing.SetRealm(testing.NewCodeRealm(pkg))
	NoteRoyalty(cross(cur), 250)
	if RoyaltyOf("demo") != 250 {
		t.Fatalf("RoyaltyOf %d", RoyaltyOf("demo"))
	}
	if !strings.HasSuffix(ListCollections(), "|250") {
		t.Fatalf("list royalty %q", ListCollections())
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	got := revive(func() { NoteRoyalty(cross(cur), 1) })
	if got == nil {
		t.Fatalf("expected collection realm")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got = revive(func() { NoteRoyalty(cross(cur), 1) })
	if got == nil {
		t.Fatalf("expected unknown collection")
	}
	testing.SetRealm(testing.NewCodeRealm(pkg))
	got = revive(func() { NoteRoyalty(cross(cur), -1) })
	if got == nil {
		t.Fatalf("expected royalty")
	}
	got = revive(func() { NoteRoyalty(cross(cur), 1001) })
	if got == nil {
		t.Fatalf("expected royalty over max")
	}
}

func testCollectionOf(cur realm, slug string) string {
	return CollectionOf(slug)
}

func TestCollectionOfUnknown(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	got := revive(func() { testCollectionOf(cross(cur), "nope") })
	if got == nil {
		t.Fatalf("expected unknown")
	}
}

func TestRegisterInvalidSlug(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	if revive(func() { testPut(cross(cur), "gno.land/r/bazaar/c/a-b", alice, "X", "ab", "", 0, 0, 0) }) == nil {
		t.Fatalf("expected hyphen slug")
	}
	if revive(func() { testPut(cross(cur), "gno.land/r/bazaar/c/1abc", alice, "X", "ab", "", 0, 0, 0) }) == nil {
		t.Fatalf("expected leading digit")
	}
	if revive(func() { testPut(cross(cur), "gno.land/r/bazaar/c/abcdefghijkl", alice, "X", "ab", "", 0, 0, 0) }) == nil {
		t.Fatalf("expected slug over 11")
	}
	testPut(cross(cur), "gno.land/r/bazaar/c/abcdefghijk", alice, "X", "ab", "", 0, 0, 0)
	if CollectionOf("abcdefghijk") != "gno.land/r/bazaar/c/abcdefghijk" {
		t.Fatalf("11-char slug")
	}
}

func TestReserve(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	SetLaunchFee(cross(cur), 1_000_000)
	testing.IssueCoins(Address(), chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Reserve(cross(cur), "foam")
	if ReservedCreator("foam") != alice.String() {
		t.Fatalf("reserved %q", ReservedCreator("foam"))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(bob, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	if revive(func() { Reserve(cross(cur), "foam") }) == nil {
		t.Fatalf("expected slug taken")
	}
	if revive(func() { CancelReserve(cross(cur), "foam") }) == nil {
		t.Fatalf("expected not reserver")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	CancelReserve(cross(cur), "foam")
	if ReservedCreator("foam") != "" {
		t.Fatalf("cleared")
	}
}

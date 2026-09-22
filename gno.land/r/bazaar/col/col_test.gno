package col

import (
	"chain"
	"strings"
	"testing"

	"gno.land/p/bazaar/grc721/v0"
	"gno.land/p/bazaar/grc721/metadata/v0"
	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
	"gno.land/r/bazaar/factory"
)

func resetItems(cur realm) {
	items = avl.Tree{}
	dropSlots = avl.Tree{}
	tokenSeq = 0
	nextID = 0
	minted = 0
	loaded = 0
	paused = false
	mintPrice = 0
	royaltyBps = 0
	maxSupply = 0
	token, ledger = grc721.NewToken(colName, colSymbol, tokenSeq.Next(), cur)
	metaView, metaLed = metadata.NewMetadata(ledger)
	factory.NoteMinted(cross(cur), 0)
	factory.NoteRoyalty(cross(cur), 0)
}

func boot(cur realm) {
	if revive(func() { factory.Init(cross(cur)) }) == nil {
		factory.SetLaunchFee(cross(cur), 0)
	}
	if !inited {
		Init(cross(cur), "Demo", "demo", "/samples/demo.png", 0, 0, 0)
		return
	}
	resetItems(cross(cur))
}

func TestMintListBuy(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "https://example.com/sword.png")
	if id != 1 {
		t.Fatalf("id %d", id)
	}
	if OwnerOf(id) != alice {
		t.Fatalf("owner after mint")
	}
	if NextID() != 1 {
		t.Fatalf("NextID %d", NextID())
	}
	if GrcOwnerOf(id) != alice.String() {
		t.Fatalf("grc owner %q", GrcOwnerOf(id))
	}
	if Name() != GrcName() || Symbol() != GrcSymbol() {
		t.Fatalf("wallet aliases")
	}
	if BalanceOf(alice.String()) != 1 {
		t.Fatalf("BalanceOf %d", BalanceOf(alice.String()))
	}
	uri := TokenURI(id)
	if !strings.HasPrefix(uri, "data:application/json") {
		t.Fatalf("TokenURI prefix %q", uri)
	}
	if !strings.Contains(uri, "Sword") {
		t.Fatalf("TokenURI json %q", uri)
	}
	if !strings.Contains(uri, "sword.png") {
		t.Fatalf("TokenURI image %q", uri)
	}
	List(cross(cur), id, 1_000_000)
	if revive(func() { TransferFrom(cross(cur), alice.String(), bob.String(), id) }) == nil {
		t.Fatalf("expected listed transfer blocked")
	}
	if OwnerOf(id) != self {
		t.Fatalf("listed owner should be realm")
	}
	if GrcOwnerOf(id) != self.String() {
		t.Fatalf("grc listed owner %q", GrcOwnerOf(id))
	}
	if !Listed(id) {
		t.Fatalf("listed")
	}
	if PriceOf(id) != 1_000_000 {
		t.Fatalf("price")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Buy(cross(cur), id)
	if OwnerOf(id) != bob {
		t.Fatalf("owner after buy")
	}
	if GrcOwnerOf(id) != bob.String() {
		t.Fatalf("grc owner after buy %q", GrcOwnerOf(id))
	}
	if Listed(id) {
		t.Fatalf("still listed")
	}
	if PriceOf(id) != 0 {
		t.Fatalf("price after buy")
	}
	line := ItemLine(id)
	if !strings.Contains(line, "Sword") || !strings.Contains(line, bob.String()) {
		t.Fatalf("ItemLine %q", line)
	}
	pkg := factory.CollectionOf(slug)
	if !strings.HasSuffix(pkg, "/"+slug) {
		t.Fatalf("factory CollectionOf %q slug %q", pkg, slug)
	}
	if !strings.Contains(factory.ListCollections(), slug+"|Demo|") {
		t.Fatalf("factory list %q", factory.ListCollections())
	}
}

func TestTransferWrongCaller(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { Transfer(cross(cur), bob, id) })
	if got == nil {
		t.Fatalf("expected not owner")
	}
}

func TestListNotUserCall(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { List(cross(cur), id, 1_000_000) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
	if Listed(id) {
		t.Fatalf("listed by non-user")
	}
}

func TestPublicMintWrongPayment(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	mintPrice = 1_000_000
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	got := revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected wrong payment")
	}
}

func TestPublicMintHappy(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	mintPrice = 1_000_000
	maxSupply = 5
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id := PublicMint(cross(cur))
	if id != 1 {
		t.Fatalf("id %d", id)
	}
	if OwnerOf(id) != bob {
		t.Fatalf("owner")
	}
	if Minted() != 1 {
		t.Fatalf("minted %d", Minted())
	}
}

func TestPublicMintNotUserCall(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestMintNotCreator(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { Mint(cross(cur), "Sword", "") })
	if got == nil {
		t.Fatalf("expected not creator")
	}
}

func TestCancelReturnsItem(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 50)
	Cancel(cross(cur), id)
	if OwnerOf(id) != alice {
		t.Fatalf("returned owner")
	}
	if Listed(id) {
		t.Fatalf("still listed")
	}
}

func TestBuyWrongPayment(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	got := revive(func() { Buy(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected wrong payment")
	}
}

func TestTransferListed(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 50)
	got := revive(func() { Transfer(cross(cur), bob, id) })
	if got == nil {
		t.Fatalf("expected listed")
	}
}

func TestPauseStopsMint(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	PauseMint(cross(cur))
	got := revive(func() { Mint(cross(cur), "Sword", "") })
	if got == nil {
		t.Fatalf("expected paused")
	}
	ResumeMint(cross(cur))
	id := Mint(cross(cur), "Sword", "")
	if id != 1 {
		t.Fatalf("id %d", id)
	}
}

func TestInitNotUserCall(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { factory.Init(cross(cur)) }) == nil {
		factory.SetLaunchFee(cross(cur), 0)
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { Init(cross(cur), "Demo", "demo", "", 0, 0, 0) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestLongSymbol(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { factory.Init(cross(cur)) }) == nil {
		factory.SetLaunchFee(cross(cur), 0)
	}
	got := revive(func() { Init(cross(cur), "Demo", "abcdefghijkl", "", 0, 0, 0) })
	if got == nil {
		t.Fatalf("expected symbol")
	}
}

func TestInitAfterFactory(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	if !validPkgName(slug) {
		t.Fatalf("pkg name %q", slug)
	}
	if len(colSymbol) > grc721.MaxSymbolLen {
		t.Fatalf("symbol %q", colSymbol)
	}
	pkg := factory.CollectionOf(slug)
	if lastElem(pkg) != slug {
		t.Fatalf("factory CollectionOf %q slug %q", pkg, slug)
	}
}

func TestAddDropItemsPublicMint(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	maxSupply = 3
	mintPrice = 1_000_000
	AddDropItems(cross(cur), "Dusk Fox|/samples/foxes-01.png|Rare|Background:Dusk;Fur:Ember\nNight Fox|/samples/foxes-03.png|Epic|Background:Night;Fur:Blue")
	if LoadedOf() != 2 {
		t.Fatalf("loaded %d", LoadedOf())
	}
	if !strings.Contains(ListDropSlots(), "0|Dusk Fox|/samples/foxes-01.png|Rare|Background:Dusk;Fur:Ember") {
		t.Fatalf("slots %q", ListDropSlots())
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	id := PublicMint(cross(cur))
	if NameOf(id) != "Dusk Fox" {
		t.Fatalf("name %q", NameOf(id))
	}
	if ImageOf(id) != "/samples/foxes-01.png" {
		t.Fatalf("image %q", ImageOf(id))
	}
	if RarityOf(id) != "Rare" {
		t.Fatalf("rarity %q", RarityOf(id))
	}
	if TraitsOf(id) != "Background:Dusk;Fur:Ember" {
		t.Fatalf("traits %q", TraitsOf(id))
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id2 := PublicMint(cross(cur))
	if NameOf(id2) != "Night Fox" {
		t.Fatalf("second %q", NameOf(id2))
	}
	if ImageOf(id2) != "/samples/foxes-03.png" {
		t.Fatalf("second image %q", ImageOf(id2))
	}
	if revive(func() { PublicMint(cross(cur)) }) == nil {
		t.Fatalf("expected no slot")
	}
}

func TestSetRoyalty(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	if factory.RoyaltyOf(slug) != 0 {
		t.Fatalf("RoyaltyOf after Init %d", factory.RoyaltyOf(slug))
	}
	pkg := factory.CollectionOf(slug)
	if factory.CollectionAddr(slug) != chain.PackageAddress(pkg).String() {
		t.Fatalf("CollectionAddr %q want %q", factory.CollectionAddr(slug), chain.PackageAddress(pkg).String())
	}
	SetRoyalty(cross(cur), 250)
	if RoyaltyBps() != 250 {
		t.Fatalf("RoyaltyBps %d", RoyaltyBps())
	}
	if factory.RoyaltyOf(slug) != 250 {
		t.Fatalf("factory RoyaltyOf %d", factory.RoyaltyOf(slug))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { SetRoyalty(cross(cur), 100) })
	if got == nil {
		t.Fatalf("expected not creator")
	}
	if RoyaltyBps() != 250 {
		t.Fatalf("bob mutated royalty")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	Mint(cross(cur), "Sword", "")
	got = revive(func() { SetRoyalty(cross(cur), 100) })
	if got == nil {
		t.Fatalf("expected minted")
	}
	if RoyaltyBps() != 250 {
		t.Fatalf("mint mutated royalty")
	}
}

func TestSetRoyaltyNotUserCall(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { SetRoyalty(cross(cur), 100) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestSetRoyaltyInvalid(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	if revive(func() { SetRoyalty(cross(cur), -1) }) == nil {
		t.Fatalf("expected royalty")
	}
	if revive(func() { SetRoyalty(cross(cur), 1001) }) == nil {
		t.Fatalf("expected royalty over max")
	}
}

func TestAddDropItemsAbuse(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	maxSupply = 2
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { AddDropItems(cross(cur), "A|/samples/foxes-01.png|Rare|Fur:Red") }) == nil {
		t.Fatalf("expected not creator")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { AddDropItems(cross(cur), "") }) == nil {
		t.Fatalf("expected empty")
	}
	AddDropItems(cross(cur), "A|/samples/foxes-01.png|Rare|Fur:Red\nB|/samples/foxes-02.png|Epic|Fur:Blue")
	if revive(func() { AddDropItems(cross(cur), "C|/samples/foxes-03.png|Rare|Fur:Grey") }) == nil {
		t.Fatalf("expected over supply")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { AddDropItems(cross(cur), "A|/samples/foxes-01.png||") }) == nil {
		t.Fatalf("expected EOA")
	}
}

func TestWalletAliasesAbsImage(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Dock", "/samples/docks-01.png")
	if Name() != "Demo" {
		t.Fatalf("Name %q", Name())
	}
	if BalanceOf(alice.String()) != 1 {
		t.Fatalf("BalanceOf")
	}
	uri := TokenURI(id)
	if !strings.Contains(uri, "bazaar-gno.vercel.app") {
		t.Fatalf("abs image %q", uri)
	}
	if !strings.Contains(uri, "docks-01.png") {
		t.Fatalf("image name %q", uri)
	}
}

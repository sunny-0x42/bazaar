package col

import (
	"chain"
	"chain/banker"
	"strconv"
	"strings"
	"testing"
	"time"

	"gno.land/p/nt/grc721/metadata/v0"
	"gno.land/p/nt/grc721/v0"
	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
	"gno.land/r/bazaar/factory"
	"gno.land/r/bazaar/genesis"
)

func mustOwner(tid string) address {
	owner, err := OwnerOf(tid)
	if err != nil {
		panic(err.Error())
	}
	return owner
}

func resetItems(cur realm) {
	items = avl.Tree{}
	dropSlots = avl.Tree{}
	allowlist = avl.Tree{}
	mintedBy = avl.Tree{}
	tokenSeq = 0
	nextID = 0
	minted = 0
	loaded = 0
	allowN = 0
	mintCap = 0
	wlMintCap = 0
	pubMintCap = 0
	wlPrice = 0
	wlSupply = 0
	wlStart = 0
	wlEnd = 0
	publicStart = 0
	publicEnd = 0
	publicForced = false
	paused = false
	hidden = false
	prereveal = ""
	offers = avl.Tree{}
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
		factory.Reserve(cross(cur), "col")
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
	if mustOwner(strconv.Itoa(id)) != alice {
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
	uri := TokenURI(strconv.Itoa(id))
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
	if revive(func() { TransferFrom(cross(cur), alice.String(), bob.String(), strconv.Itoa(id)) }) == nil {
		t.Fatalf("expected listed transfer blocked")
	}
	if mustOwner(strconv.Itoa(id)) != self {
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
	if mustOwner(strconv.Itoa(id)) != bob {
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

func TestBuyProtocolSinkAndGenesisShare(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	eve := testutils.TestAddress("eve")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	factory.SetProtocolBps(cross(cur), 200)
	factory.SetProtocolSink(cross(cur), eve)
	factory.SetDiscountPusher(cross(cur), "gno.land/r/bazaar/gpush")
	factory.SetGenesis(cross(cur), "gno.land/r/bazaar/genesis")
	revive(func() { genesis.Init(cross(cur), "Genesis", "GENESIS") })
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 10_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 10_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 10_000_000}})
	Buy(cross(cur), id)
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	if bk.GetCoins(eve).AmountOf("ugnot") != 178_000 {
		t.Fatalf("sink %d", bk.GetCoins(eve).AmountOf("ugnot"))
	}
	if bk.GetCoins(factory.GenesisSink()).AmountOf("ugnot") != 22_000 {
		t.Fatalf("genesis share %d", bk.GetCoins(factory.GenesisSink()).AmountOf("ugnot"))
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
	maxSupply = 0
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id := PublicMint(cross(cur))
	if id != 1 {
		t.Fatalf("id %d", id)
	}
	if mustOwner(strconv.Itoa(id)) != bob {
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
	if mustOwner(strconv.Itoa(id)) != alice {
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
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	PauseMint(cross(cur))
	id := Mint(cross(cur), "Sword", "")
	if id != 1 {
		t.Fatalf("creator mint while paused")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected paused")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	ResumeMint(cross(cur))
	testing.SetRealm(testing.NewUserRealm(bob))
	id2 := PublicMint(cross(cur))
	if id2 != 2 {
		t.Fatalf("id %d", id2)
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

func TestAddDropItemsMythic(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	maxSupply = 1
	mintPrice = 0
	AddDropItems(cross(cur), "Bazaar Genesis #0001|/samples/foxes-01.png|Mythic|Fee discount:150 bps;Share weight:150")
	if LoadedOf() != 1 {
		t.Fatalf("loaded %d", LoadedOf())
	}
	if !strings.Contains(ListDropSlots(), "|Mythic|") {
		t.Fatalf("slots %q", ListDropSlots())
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	id := PublicMint(cross(cur))
	if RarityOf(id) != "Mythic" {
		t.Fatalf("rarity %q", RarityOf(id))
	}
	if TraitsOf(id) != "Fee discount:150 bps;Share weight:150" {
		t.Fatalf("traits %q", TraitsOf(id))
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
	if revive(func() { AddDropItems(cross(cur), "A|/samples/foxes-01.png|Ultra|Fur:Red") }) == nil {
		t.Fatalf("expected rarity")
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
	uri := TokenURI(strconv.Itoa(id))
	if !strings.Contains(uri, "bazaar-gno.vercel.app") {
		t.Fatalf("abs image %q", uri)
	}
	if !strings.Contains(uri, "docks-01.png") {
		t.Fatalf("image name %q", uri)
	}
}

func TestAdenaWalletSurface(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Std Gnomie", "https://bazaar-gno.vercel.app/gnomies.png")
	tid := strconv.Itoa(id)
	if mustOwner("1") != alice {
		t.Fatalf("OwnerOf string %s", mustOwner("1").String())
	}
	flags := ""
	owner0, err0 := OwnerOf("1")
	if err0 == nil && owner0.String() == alice.String() {
		flags += "1"
	} else {
		flags += "0"
	}
	if flags != "1" {
		t.Fatalf("adena IIFE flags %q", flags)
	}
	if TokenOfOwnerByIndex(alice.String(), 0) != "1" {
		t.Fatalf("index %s", TokenOfOwnerByIndex(alice.String(), 0))
	}
	if TokenByIndex(0) != "1" {
		t.Fatalf("byIndex %s", TokenByIndex(0))
	}
	if TokensOf(alice.String()) != "1" {
		t.Fatalf("tokens %s", TokensOf(alice.String()))
	}
	if !strings.HasPrefix(TokenURI("1"), "data:application/json") {
		t.Fatalf("TokenURI %q", TokenURI("1"))
	}
	List(cross(cur), id, 1_000_000)
	if TokensOf(alice.String()) != "" || BalanceOf(alice.String()) != 0 {
		t.Fatalf("listed still in wallet")
	}
	if mustOwner(tid) != self {
		t.Fatalf("listed owner %s", mustOwner(tid).String())
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Buy(cross(cur), id)
	owner, err := OwnerOf("1")
	if err != nil {
		t.Fatalf("OwnerOf err %v", err)
	}
	if owner != bob {
		t.Fatalf("buyer owner %s", owner.String())
	}
	if TokensOf(bob.String()) != "1" || TokenOfOwnerByIndex(bob.String(), 0) != "1" {
		t.Fatalf("buyer wallet ids")
	}
}

func TestSetProtocolBps(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	if ProtocolBps() != 200 {
		t.Fatalf("default %d", ProtocolBps())
	}
	factory.SetProtocolBps(cross(cur), 50)
	if ProtocolBps() != 50 {
		t.Fatalf("set %d", ProtocolBps())
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { factory.SetProtocolBps(cross(cur), 100) })
	if got == nil {
		t.Fatalf("expected not admin")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got = revive(func() { factory.SetProtocolBps(cross(cur), 100) })
	if got == nil {
		t.Fatalf("expected EOA")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	got = revive(func() { factory.SetProtocolBps(cross(cur), -1) })
	if got == nil {
		t.Fatalf("expected bps")
	}
	got = revive(func() { factory.SetProtocolBps(cross(cur), 501) })
	if got == nil {
		t.Fatalf("expected cap")
	}
	if ProtocolBps() != 50 {
		t.Fatalf("mutated %d", ProtocolBps())
	}
}

func TestGenesisHolderCutsProtocol(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	factory.SetProtocolBps(cross(cur), 200)
	factory.SetDiscountPusher(cross(cur), "gno.land/r/bazaar/gpush")
	factory.SetGenesis(cross(cur), "gno.land/r/bazaar/genesis")
	revive(func() { genesis.Init(cross(cur), "Genesis", "GENESIS") })
	if tradeProtocolBps(alice, bob) != 200 {
		t.Fatalf("no genesis %d", tradeProtocolBps(alice, bob))
	}
	genesis.Mint(cross(cur), "Legend", "", "legendary", -1)
	if tradeProtocolBps(alice, bob) != 75 {
		t.Fatalf("seller legendary %d", tradeProtocolBps(alice, bob))
	}
	genesis.Mint(cross(cur), "Myth", "", "mythic", -1)
	testing.SetRealm(testing.NewUserRealm(alice))
	genesis.TransferFrom(cross(cur), alice.String(), bob.String(), "2")
	if tradeProtocolBps(alice, bob) != 50 {
		t.Fatalf("buyer mythic wins %d", tradeProtocolBps(alice, bob))
	}
}

func TestPauseUntilLoaded(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	maxSupply = 3
	paused = true
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected paused")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	got = revive(func() { ResumeMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected no slot")
	}
	AddDropItems(cross(cur), "Dusk Fox|/samples/foxes-01.png|Rare|Background:Dusk")
	ResumeMint(cross(cur))
	testing.SetRealm(testing.NewUserRealm(bob))
	id := PublicMint(cross(cur))
	if NameOf(id) != "Dusk Fox" {
		t.Fatalf("name %q", NameOf(id))
	}
}

func TestAllowlistPublicMint(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	eve := testutils.TestAddress("eve")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	got := revive(func() { AddAllowlist(cross(cur), "not-an-address") })
	if got == nil {
		t.Fatalf("expected address")
	}
	AddAllowlist(cross(cur), bob.String())
	if !OnAllowlist(bob.String()) || AllowN() != 1 {
		t.Fatalf("allow")
	}
	testing.SetRealm(testing.NewUserRealm(eve))
	got = revive(func() { AddAllowlist(cross(cur), eve.String()) })
	if got == nil {
		t.Fatalf("expected not creator")
	}
	got = revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected not allowed")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got = revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected EOA")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	id := PublicMint(cross(cur))
	if mustOwner(strconv.Itoa(id)) != bob {
		t.Fatalf("owner")
	}
}

func TestHiddenReveal(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	got := revive(func() { SetHidden(cross(cur), true) })
	if got == nil {
		t.Fatalf("expected no slots")
	}
	AddDropItems(cross(cur), "Dusk Fox|/samples/foxes-01.png|Rare|Background:Dusk")
	SetHidden(cross(cur), true)
	if ListDropSlots() != "" || !Hidden() {
		t.Fatalf("hidden slots")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	got = revive(func() { SetHidden(cross(cur), false) })
	if got == nil {
		t.Fatalf("expected not creator")
	}
	id := PublicMint(cross(cur))
	if NameOf(id) != "Unrevealed" || ImageOf(id) != "/samples/demo.png" {
		t.Fatalf("hidden name %q %q", NameOf(id), ImageOf(id))
	}
	if strings.Contains(ItemLine(id), "foxes") || strings.Contains(ItemLine(id), "Rare") {
		t.Fatalf("leaked %q", ItemLine(id))
	}
	got = revive(func() { Reveal(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected sealed")
	}
	got = revive(func() { RevealCollection(cross(cur)) })
	if got == nil {
		t.Fatalf("expected not creator")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	got = revive(func() { SetHidden(cross(cur), false) })
	if got == nil {
		t.Fatalf("expected reveal func")
	}
	RevealCollection(cross(cur))
	if NameOf(id) != "Dusk Fox" || RarityOf(id) != "Rare" || ImageOf(id) != "/samples/foxes-01.png" {
		t.Fatalf("revealed %q %q %q", NameOf(id), RarityOf(id), ImageOf(id))
	}
	got = revive(func() { RevealCollection(cross(cur)) })
	if got == nil {
		t.Fatalf("expected already revealed")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	got = revive(func() { Reveal(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected not owner")
	}
}

func TestPrerevealImage(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	AddDropItems(cross(cur), "Dusk Fox|/samples/foxes-01.png|Rare|Background:Dusk")
	SetPrereveal(cross(cur), "/samples/pre.png")
	if Prereveal() != "/samples/pre.png" {
		t.Fatalf("prereveal")
	}
	SetHidden(cross(cur), true)
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { SetPrereveal(cross(cur), "/samples/other.png") })
	if got == nil {
		t.Fatalf("expected not creator")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got = revive(func() { RevealCollection(cross(cur)) })
	if got == nil {
		t.Fatalf("expected eoa")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	got = revive(func() { SetPrereveal(cross(cur), "not a url") })
	if got == nil {
		t.Fatalf("expected image")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	id := PublicMint(cross(cur))
	if ImageOf(id) != "/samples/pre.png" || strings.Contains(ItemLine(id), "foxes") {
		t.Fatalf("placeholder %q", ItemLine(id))
	}
	uri := TokenURI(strconv.Itoa(id))
	if strings.Contains(uri, "foxes") || strings.Contains(uri, "Rare") || strings.Contains(uri, "Common") {
		t.Fatalf("sealed uri %s", uri)
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	SetPrereveal(cross(cur), "/samples/next.png")
	if ImageOf(id) != "/samples/next.png" {
		t.Fatalf("repaint %q", ImageOf(id))
	}
	RevealCollection(cross(cur))
	if ImageOf(id) != "/samples/foxes-01.png" || !strings.Contains(TokenURI(strconv.Itoa(id)), "foxes-01") {
		t.Fatalf("opened %q", ImageOf(id))
	}
	got = revive(func() { SetPrereveal(cross(cur), "/samples/late.png") })
	if got == nil {
		t.Fatalf("expected revealed")
	}
}

func TestWlThenPublic(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	eve := testutils.TestAddress("eve")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	mintPrice = 2_000_000
	SetDropSale(cross(cur), 1_000_000, 1)
	AddAllowlist(cross(cur), bob.String())
	testing.SetRealm(testing.NewUserRealm(eve))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 4_000_000}})
	got := revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected not allowed")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id := PublicMint(cross(cur))
	if id != 1 {
		t.Fatalf("wl id %d", id)
	}
	if DropSaleOf() == "" || !strings.Contains(DropSaleOf(), "public") {
		t.Fatalf("phase %q", DropSaleOf())
	}
	testing.SetRealm(testing.NewUserRealm(eve))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got = revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected public price")
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	id2 := PublicMint(cross(cur))
	if id2 != 2 {
		t.Fatalf("public id %d", id2)
	}
}

func TestMintCapAndStartPublic(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	eve := testutils.TestAddress("eve")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	mintPrice = 1_000_000
	SetDropSale(cross(cur), 1_000_000, 10)
	SetMintCap(cross(cur), 1)
	AddAllowlist(cross(cur), bob.String())
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 3_000_000}})
	PublicMint(cross(cur))
	got := revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected mint cap")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	StartPublic(cross(cur))
	testing.SetRealm(testing.NewUserRealm(eve))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id := PublicMint(cross(cur))
	if id != 2 {
		t.Fatalf("public after start %d", id)
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	got = revive(func() { StartPublic(cross(cur)) })
	if got == nil {
		t.Fatalf("expected not creator")
	}
}

func TestPhaseMintCap(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	eve := testutils.TestAddress("eve")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	mintPrice = 2_000_000
	SetDropSale(cross(cur), 1_000_000, 10)
	SetPhaseMintCap(cross(cur), 1, 2)
	if PhaseMintCapOf() != "1|2" {
		t.Fatalf("caps %s", PhaseMintCapOf())
	}
	AddAllowlist(cross(cur), bob.String())
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 20_000_000}})

	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { SetPhaseMintCap(cross(cur), 1, 2) })
	if got == nil {
		t.Fatalf("expected not creator")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got = revive(func() { SetPhaseMintCap(cross(cur), 1, 2) })
	if got == nil {
		t.Fatalf("expected eoa")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	got = revive(func() { SetPhaseMintCap(cross(cur), -1, 1) })
	if got == nil {
		t.Fatalf("expected negative cap")
	}

	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id := PublicMint(cross(cur))
	if id != 1 {
		t.Fatalf("wl id %d", id)
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got = revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected wl mint cap")
	}

	testing.SetRealm(testing.NewUserRealm(alice))
	StartPublic(cross(cur))
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	id = PublicMint(cross(cur))
	if id != 2 {
		t.Fatalf("public id %d", id)
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	id = PublicMint(cross(cur))
	if id != 3 {
		t.Fatalf("public id %d", id)
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	got = revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected public mint cap")
	}

	testing.SetRealm(testing.NewUserRealm(eve))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	id = PublicMint(cross(cur))
	if id != 4 {
		t.Fatalf("other wallet %d", id)
	}
}

func TestPhaseCapRespectsLifetime(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	mintPrice = 1_000_000
	SetPhaseMintCap(cross(cur), 0, 2)
	SetMintCap(cross(cur), 1)
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 4_000_000}})
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id := PublicMint(cross(cur))
	if id != 1 {
		t.Fatalf("id %d", id)
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected lifetime mint cap")
	}
}

func TestMintSchedule(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	eve := testutils.TestAddress("eve")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	mintPrice = 2_000_000
	now := time.Now().Unix()
	got := revive(func() { SetMintSchedule(cross(cur), now+100, 0, now+50, 0) })
	if got == nil {
		t.Fatalf("expected publicStart after wlStart")
	}
	got = revive(func() { SetMintSchedule(cross(cur), now+100, 0, 0, 0) })
	if got == nil {
		t.Fatalf("expected both bounds")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	got = revive(func() { SetMintSchedule(cross(cur), now-10, 0, now+100, 0) })
	if got == nil {
		t.Fatalf("expected not creator")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got = revive(func() { SetMintSchedule(cross(cur), now-10, 0, now+100, 0) })
	if got == nil {
		t.Fatalf("expected eoa")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	SetDropSale(cross(cur), 1_000_000, 1)
	SetMintSchedule(cross(cur), now+500, 0, now+900, 0)
	AddAllowlist(cross(cur), bob.String())
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 6_000_000}})
	got = revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected not open")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	SetMintSchedule(cross(cur), now-30, 0, now+900, 0)
	testing.SetRealm(testing.NewUserRealm(eve))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got = revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected not allowed")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id := PublicMint(cross(cur))
	if id != 1 || mintPhase(time.Now().Unix()) != "closed" {
		t.Fatalf("wl done phase %s id %d", mintPhase(time.Now().Unix()), id)
	}
	testing.SetRealm(testing.NewUserRealm(eve))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	got = revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected wait for publicStart")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	got = revive(func() { SetMintSchedule(cross(cur), now-30, 0, now-1, 0) })
	if got == nil {
		t.Fatalf("expected locked after mint")
	}
}

func TestMintSchedulePublicOpen(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	eve := testutils.TestAddress("eve")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	mintPrice = 2_000_000
	now := time.Now().Unix()
	SetDropSale(cross(cur), 1_000_000, 10)
	SetMintSchedule(cross(cur), now-60, 0, now-10, 0)
	testing.SetRealm(testing.NewUserRealm(eve))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 4_000_000}})
	got := revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected public price")
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	id := PublicMint(cross(cur))
	if id != 1 || !strings.Contains(DropSaleOf(), "public") {
		t.Fatalf("public %q id %d", DropSaleOf(), id)
	}
}

func TestStartPublicOpensClock(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	eve := testutils.TestAddress("eve")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	mintPrice = 1_000_000
	now := time.Now().Unix()
	SetDropSale(cross(cur), 1_000_000, 5)
	SetMintSchedule(cross(cur), now+400, 0, now+800, 0)
	AddAllowlist(cross(cur), testutils.TestAddress("bob").String())
	StartPublic(cross(cur))
	if publicStart > time.Now().Unix() {
		t.Fatalf("clock still future")
	}
	testing.SetRealm(testing.NewUserRealm(eve))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	id := PublicMint(cross(cur))
	if id != 1 {
		t.Fatalf("early public %d", id)
	}
}

func TestMintWindowEnds(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	eve := testutils.TestAddress("eve")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	mintPrice = 2_000_000
	now := time.Now().Unix()
	got := revive(func() { SetMintSchedule(cross(cur), now-100, now-50, now-40, now-60) })
	if got == nil {
		t.Fatalf("expected publicEnd after publicStart")
	}
	got = revive(func() { SetMintSchedule(cross(cur), now-100, now-120, now+10, 0) })
	if got == nil {
		t.Fatalf("expected wlEnd after wlStart")
	}
	got = revive(func() { SetMintSchedule(cross(cur), now-100, now+50, now+10, now+80) })
	if got == nil {
		t.Fatalf("expected no overlap")
	}
	got = revive(func() { SetMintSchedule(cross(cur), -1, 0, now+10, 0) })
	if got == nil {
		t.Fatalf("expected negative")
	}
	SetDropSale(cross(cur), 1_000_000, 10)
	SetMintSchedule(cross(cur), now-100, now-10, now+100, now+200)
	if MintScheduleOf() != strconv.FormatInt(now-100, 10)+"|"+strconv.FormatInt(now-10, 10)+"|"+strconv.FormatInt(now+100, 10)+"|"+strconv.FormatInt(now+200, 10) {
		t.Fatalf("schedule %s", MintScheduleOf())
	}
	AddAllowlist(cross(cur), bob.String())
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 10_000_000}})
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got = revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected closed after wlEnd")
	}
	if mintPhase(now-50) != "whitelist" {
		t.Fatalf("inside wl %s", mintPhase(now-50))
	}
	if mintPhase(now+150) != "public" {
		t.Fatalf("inside public %s", mintPhase(now+150))
	}
	if mintPhase(now+200) != "closed" {
		t.Fatalf("after publicEnd %s", mintPhase(now+200))
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	SetMintSchedule(cross(cur), now-100, now+50, now+80, now+200)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id := PublicMint(cross(cur))
	if id != 1 {
		t.Fatalf("wl id %d", id)
	}
	testing.SetRealm(testing.NewUserRealm(eve))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	got = revive(func() { PublicMint(cross(cur)) })
	if got == nil {
		t.Fatalf("expected not allowed in whitelist")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	StartPublic(cross(cur))
	if mintPhase(time.Now().Unix()) != "public" {
		t.Fatalf("forced %s", mintPhase(time.Now().Unix()))
	}
	if mintPhase(now+200) != "closed" {
		t.Fatalf("forced still ends %s", mintPhase(now+200))
	}
	testing.SetRealm(testing.NewUserRealm(eve))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	id = PublicMint(cross(cur))
	if id != 2 {
		t.Fatalf("public id %d", id)
	}
}

package nft

import (
	"chain"
	"strings"
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
)

func resetAll() {
	items = avl.Tree{}
	collections = avl.Tree{}
	acts = avl.Tree{}
	offers = avl.Tree{}
	pools = avl.Tree{}
	lpPos = avl.Tree{}
	nftPos = avl.Tree{}
	dropSlots = avl.Tree{}
	allowlist = avl.Tree{}
	mintedBy = avl.Tree{}
	userProfiles = avl.Tree{}
	actSeq = 0
	nextID = 0
	inited = false
	seeded = false
	var zero address
	admin = zero
	self = zero
	fees = 0
	launchFee = 0
}

func boot(cur realm) {
	Init(cross(cur))
	SetLaunchFee(cross(cur), 0)
}

func lineCount(s string) int {
	if s == "" {
		return 0
	}
	return strings.Count(s, "\n") + 1
}

func TestMintListBuy(cur realm, t *testing.T) {
	resetAll()
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
	List(cross(cur), id, 1_000_000)
	if OwnerOf(id) != self {
		t.Fatalf("listed owner should be realm")
	}
	if !Listed(id) {
		t.Fatalf("listed")
	}
	if SellerOf(id) != alice {
		t.Fatalf("seller")
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
	if Listed(id) {
		t.Fatalf("still listed")
	}
	if PriceOf(id) != 0 {
		t.Fatalf("price after buy")
	}
	var zero address
	if SellerOf(id) != zero {
		t.Fatalf("seller after buy")
	}
	if ProtocolFees() != 5000 {
		t.Fatalf("fees %d", ProtocolFees())
	}
	if TokensOf(bob) != "1" {
		t.Fatalf("TokensOf bob %q", TokensOf(bob))
	}
	if TokensOf(alice) != "" {
		t.Fatalf("TokensOf alice %q", TokensOf(alice))
	}
	line := ItemLine(id)
	want := "1|Sword|" + bob.String() + "||0|false|https://example.com/sword.png|bazaar|Common||true|-1"
	if line != want {
		t.Fatalf("ItemLine %q want %q", line, want)
	}
	if CollectionOf(id) != "bazaar" {
		t.Fatalf("collection %q", CollectionOf(id))
	}
	tape := SalesTape("")
	if !strings.Contains(tape, "buy|1|1000000|Sword") {
		t.Fatalf("SalesTape %q", tape)
	}
}

func TestListNotOwner(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { List(cross(cur), id, 100) })
	if got == nil {
		t.Fatalf("expected not owner")
	}
}

func TestBuyWrongPayment(cur realm, t *testing.T) {
	resetAll()
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

func TestSelfBuyPanics(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 1_000_000)
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { Buy(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected self buy abort")
	}
}

func TestCancelNotSeller(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 50)
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { Cancel(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected not seller")
	}
}

func TestBuyNotUserCall(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 1_000_000)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { Buy(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestCancelReturnsItem(cur realm, t *testing.T) {
	resetAll()
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
	got := Activity()
	if !strings.HasPrefix(got, "cancel|1|bazaar|"+alice.String()+"|0|Sword") {
		t.Fatalf("cancel activity %q", got)
	}
}

func TestTransfer(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	Transfer(cross(cur), bob, id)
	if OwnerOf(id) != bob {
		t.Fatalf("owner after transfer")
	}
	if Listed(id) {
		t.Fatalf("listed after transfer")
	}
	if TokensOf(bob) != "1" {
		t.Fatalf("TokensOf bob %q", TokensOf(bob))
	}
	if TokensOf(alice) != "" {
		t.Fatalf("TokensOf alice %q", TokensOf(alice))
	}
	got := Activity()
	if !strings.HasPrefix(got, "transfer|1|bazaar|"+alice.String()+"|0|Sword") {
		t.Fatalf("transfer activity %q", got)
	}
}

func TestTransferNotOwner(cur realm, t *testing.T) {
	resetAll()
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

func TestTransferListed(cur realm, t *testing.T) {
	resetAll()
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

func TestUpdatePrice(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 1_000_000)
	UpdatePrice(cross(cur), id, 2_000_000)
	if PriceOf(id) != 2_000_000 {
		t.Fatalf("price %d", PriceOf(id))
	}
	if !Listed(id) {
		t.Fatalf("unlisted")
	}
	if OwnerOf(id) != self {
		t.Fatalf("escrow")
	}
	if SellerOf(id) != alice {
		t.Fatalf("seller")
	}
	tape := SalesTape("")
	if !strings.HasPrefix(tape, "list|1|2000000|Sword") {
		t.Fatalf("SalesTape %q", tape)
	}
}

func TestUpdatePriceNotSeller(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { UpdatePrice(cross(cur), id, 2_000_000) })
	if got == nil {
		t.Fatalf("expected not seller")
	}
}

func TestTransferNotUserCall(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { Transfer(cross(cur), bob, id) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestUpdatePriceNotListed(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	got := revive(func() { UpdatePrice(cross(cur), id, 2_000_000) })
	if got == nil {
		t.Fatalf("expected not listed")
	}
}

func TestUpdatePriceNotUserCall(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 1_000_000)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { UpdatePrice(cross(cur), id, 2_000_000) })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestMintValidation(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	if revive(func() { Mint(cross(cur), "", "") }) == nil {
		t.Fatalf("empty name")
	}
	if revive(func() { Mint(cross(cur), "a\nb", "") }) == nil {
		t.Fatalf("newline name")
	}
	if revive(func() { Mint(cross(cur), "ok", "ftp://x") }) == nil {
		t.Fatalf("bad scheme")
	}
	if revive(func() { Mint(cross(cur), "ok", "https://x y") }) == nil {
		t.Fatalf("space in url")
	}
	if revive(func() { Mint(cross(cur), "ok", "/samples/") }) == nil {
		t.Fatalf("empty sample path")
	}
	id := Mint(cross(cur), "ok", "/samples/stones-01.png")
	if ImageOf(id) != "/samples/stones-01.png" {
		t.Fatalf("sample image")
	}
}

func TestBuyTwicePanics(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	Buy(cross(cur), id)
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { Buy(cross(cur), id) })
	if got == nil {
		t.Fatalf("expected not listed")
	}
}

func TestWithdrawFees(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Buy(cross(cur), id)
	got := revive(func() { WithdrawFees(cross(cur)) })
	if got == nil {
		t.Fatalf("expected not admin")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	WithdrawFees(cross(cur))
	if ProtocolFees() != 0 {
		t.Fatalf("fees after withdraw %d", ProtocolFees())
	}
}

func TestSeedSamples(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	SeedSamples(cross(cur))
	if NextID() != 21 {
		t.Fatalf("NextID %d", NextID())
	}
	if lineCount(ListOpen()) != 21 {
		t.Fatalf("listed %q", ListOpen())
	}
	cols := ListCollections()
	if !strings.Contains(cols, "stones|Signal Stones|/samples/stones-01.png|3|500000|6|3|"+alice.String()+"|false|") {
		t.Fatalf("stones %q", cols)
	}
	if !strings.Contains(cols, "lamps|Harbor Lamps|/samples/lamps-01.png|3|800000|6|3|"+alice.String()+"|false|") {
		t.Fatalf("lamps %q", cols)
	}
	if !strings.Contains(cols, "relics|Paper Relics|/samples/relics-01.png|3|1000000|6|3|"+alice.String()+"|false|") {
		t.Fatalf("relics %q", cols)
	}
	if !strings.Contains(cols, "foxes|Gloam Foxes|/samples/foxes-01.png|4|400000|8|4|"+alice.String()+"|false|") {
		t.Fatalf("foxes %q", cols)
	}
	if !strings.Contains(cols, "docks|Dock Lads|/samples/docks-01.png|4|1200000|8|4|"+alice.String()+"|false|") {
		t.Fatalf("docks %q", cols)
	}
	if !strings.Contains(cols, "clay|Clay Shores|/samples/clay-01.png|4|600000|8|4|"+alice.String()+"|false|") {
		t.Fatalf("clay %q", cols)
	}
	if DropLine("stones") != "stones|Signal Stones|/samples/stones-01.png|3|500000|6|3|"+alice.String()+"|false|true|" {
		t.Fatalf("DropLine %q", DropLine("stones"))
	}
	if lineCount(ListByCollection("stones")) != 3 {
		t.Fatalf("stones listed %q", ListByCollection("stones"))
	}
	if CollectionOf(1) != "stones" {
		t.Fatalf("item 1 collection %q", CollectionOf(1))
	}
	if Socials("stones") != "https://gno.land|@_gnoland|https://discord.gg/gnoland" {
		t.Fatalf("socials %q", Socials("stones"))
	}
	line := ItemLine(1)
	want := "1|Ember Core|" + self.String() + "|" + alice.String() + "|1000000|true|/samples/stones-01.png|stones|Legendary||true|-1"
	if line != want {
		t.Fatalf("ItemLine %q want %q", line, want)
	}
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 500_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 500_000}})
	pid := PublicMint(cross(cur), "stones")
	if pid != 22 {
		t.Fatalf("public mint id %d", pid)
	}
	if OwnerOf(pid) != bob {
		t.Fatalf("public mint owner")
	}
	if DropLine("stones") != "stones|Signal Stones|/samples/stones-01.png|4|500000|6|4|"+alice.String()+"|false|true|" {
		t.Fatalf("after public mint %q", DropLine("stones"))
	}
}

func TestSeedSamplesTwice(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	SeedSamples(cross(cur))
	got := revive(func() { SeedSamples(cross(cur)) })
	if got == nil {
		t.Fatalf("expected already seeded")
	}
}

func TestCreateCollectionDuplicate(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	got := revive(func() { CreateCollection(cross(cur), "bazaar", "Bazaar", "") })
	if got == nil {
		t.Fatalf("expected bazaar exists")
	}
	CreateCollection(cross(cur), "stones", "Signal Stones", "/samples/stones-01.png")
	got = revive(func() { CreateCollection(cross(cur), "stones", "Signal Stones", "/samples/stones-01.png") })
	if got == nil {
		t.Fatalf("expected duplicate slug")
	}
}

func TestMintInUnknown(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	got := revive(func() { MintIn(cross(cur), "nope", "Ghost", "") })
	if got == nil {
		t.Fatalf("expected unknown collection")
	}
}

func TestMintInNotCreator(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { MintIn(cross(cur), "gems", "Ghost", "") })
	if got == nil {
		t.Fatalf("expected not creator")
	}
}

func TestLaunchCollection(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	LaunchCollection(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", "Harbor lights.", "https://gno.land", "@_gnoland", "https://discord.gg/gnoland", 6, 800_000)
	if Socials("gems") != "https://gno.land|@_gnoland|https://discord.gg/gnoland" {
		t.Fatalf("socials %q", Socials("gems"))
	}
	if !strings.Contains(DropLine("gems"), "Harbor lights.") {
		t.Fatalf("bio %q", DropLine("gems"))
	}
	if revive(func() {
		LaunchCollection(cross(cur), "gems", "Harbor Gems", "", "", "", "", "", 6, 1)
	}) == nil {
		t.Fatalf("expected duplicate")
	}
}

func TestSeedSamplesNotAdmin(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { SeedSamples(cross(cur)) })
	if got == nil {
		t.Fatalf("expected not admin")
	}
}

func TestPublicMint(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id := PublicMint(cross(cur), "gems")
	if OwnerOf(id) != bob {
		t.Fatalf("owner after public mint")
	}
	if NameOf(id) != "Harbor Gems #1" {
		t.Fatalf("name %q", NameOf(id))
	}
	if ImageOf(id) != "/samples/gems-01.png" {
		t.Fatalf("image %q", ImageOf(id))
	}
	if ProtocolFees() != 0 {
		t.Fatalf("primary mint took protocol fee %d", ProtocolFees())
	}
	if DropLine("gems") != "gems|Harbor Gems|/samples/stones-01.png|1|1000000|2|1|"+alice.String()+"|false|true|" {
		t.Fatalf("DropLine %q", DropLine("gems"))
	}
}

func TestPublicMintWrongPayment(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	got := revive(func() { PublicMint(cross(cur), "gems") })
	if got == nil {
		t.Fatalf("expected wrong payment")
	}
}

func TestPublicMintSoldOut(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 1, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	PublicMint(cross(cur), "gems")
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { PublicMint(cross(cur), "gems") })
	if got == nil {
		t.Fatalf("expected sold out")
	}
}

func TestPublicMintNotADrop(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateCollection(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png")
	got := revive(func() { PublicMint(cross(cur), "gems") })
	if got == nil {
		t.Fatalf("expected not a drop")
	}
}

func TestPauseMint(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 1_000_000)
	PauseMint(cross(cur), "gems")
	if DropLine("gems") != "gems|Harbor Gems|/samples/stones-01.png|0|1000000|2|0|"+alice.String()+"|true|true|" {
		t.Fatalf("paused line %q", DropLine("gems"))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { PublicMint(cross(cur), "gems") })
	if got == nil {
		t.Fatalf("expected paused")
	}
}

func TestSetBio(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateCollection(cross(cur), "stones", "Signal Stones", "/samples/stones-01.png")
	SetBio(cross(cur), "stones", "Harbor cores")
	SetCover(cross(cur), "stones", "/samples/stones-02.png")
	SetMintPrice(cross(cur), "stones", 250_000)
	want := "stones|Signal Stones|/samples/stones-02.png|0|250000|0|0|" + alice.String() + "|false|false|Harbor cores"
	if DropLine("stones") != want {
		t.Fatalf("bio line %q", DropLine("stones"))
	}
	if revive(func() { SetBio(cross(cur), "stones", "a|b") }) == nil {
		t.Fatalf("pipe in bio")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { PauseMint(cross(cur), "stones") }) == nil {
		t.Fatalf("expected not creator")
	}
}

func TestPublicMintNotUserCall(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 1_000_000)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	got := revive(func() { PublicMint(cross(cur), "gems") })
	if got == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestCreateDropDuplicate(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 1_000_000)
	got := revive(func() { CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 1_000_000) })
	if got == nil {
		t.Fatalf("expected duplicate slug")
	}
	got = revive(func() { CreateDrop(cross(cur), "bad", "X", "/samples/stones-01.png", -1, 1) })
	if got == nil {
		t.Fatalf("expected maxSupply")
	}
}

func TestOpenEditionMint(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "open", "Open Gems", "/samples/stones-01.png", 0, 0)
	if DropLine("open") != "open|Open Gems|/samples/stones-01.png|0|0|0|0|"+alice.String()+"|false|true|" {
		t.Fatalf("open line %q", DropLine("open"))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(nil)
	id1 := PublicMint(cross(cur), "open")
	id2 := PublicMint(cross(cur), "open")
	if id1 == id2 {
		t.Fatalf("expected two mints")
	}
	if DropLine("open") != "open|Open Gems|/samples/stones-01.png|2|0|0|2|"+alice.String()+"|false|true|" {
		t.Fatalf("after open mints %q", DropLine("open"))
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	if revive(func() { PublicMint(cross(cur), "open") }) == nil {
		t.Fatalf("expected wrong payment")
	}
}

func TestSalesTapeMintListBuy(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "https://example.com/sword.png")
	if SalesTape("") != "" {
		t.Fatalf("mint is not a sale %q", SalesTape(""))
	}
	List(cross(cur), id, 1_000_000)
	wantList := "list|1|1000000|Sword"
	if SalesTape("") != wantList {
		t.Fatalf("after list %q", SalesTape(""))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Buy(cross(cur), id)
	want := "buy|1|1000000|Sword\n" + wantList
	got := SalesTape("")
	if got != want {
		t.Fatalf("SalesTape %q want %q", got, want)
	}
	if !strings.Contains(got, "buy|1|1000000|Sword") {
		t.Fatalf("buy line %q", got)
	}
	if ItemTape(id) != want {
		t.Fatalf("ItemTape %q", ItemTape(id))
	}
	if SalesTape("bazaar") != want {
		t.Fatalf("slug %q", SalesTape("bazaar"))
	}
	if SalesTape("nope") != "" {
		t.Fatalf("unknown slug %q", SalesTape("nope"))
	}
	if ItemTape(99) != "" {
		t.Fatalf("unknown id %q", ItemTape(99))
	}
}

func TestSalesTapeExcludesPrimary(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	id := PublicMint(cross(cur), "gems")
	if SalesTape("") != "" {
		t.Fatalf("primary drop/mint on tape %q", SalesTape(""))
	}
	if ItemTape(id) != "" {
		t.Fatalf("public mint item tape %q", ItemTape(id))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	List(cross(cur), id, 2_000_000)
	if SalesTape("gems") != "list|1|2000000|Harbor Gems #1" {
		t.Fatalf("list after public mint %q", SalesTape("gems"))
	}
	Cancel(cross(cur), id)
	if SalesTape("") != "list|1|2000000|Harbor Gems #1" {
		t.Fatalf("cancel kept list %q", SalesTape(""))
	}
}

func TestOfferAccept(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "https://example.com/s.png")
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	Offer(cross(cur), id)
	if CollectionTopOffer("bazaar") != 2_000_000 {
		t.Fatalf("top %d", CollectionTopOffer("bazaar"))
	}
	if !strings.Contains(ListOffers("bazaar"), "1|"+bob.String()+"|2000000|Sword") {
		t.Fatalf("list %q", ListOffers("bazaar"))
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	AcceptOffer(cross(cur), id, bob)
	if OwnerOf(id) != bob {
		t.Fatalf("owner")
	}
}

func TestInstantSell(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	carol := testutils.TestAddress("carol")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Offer(cross(cur), id)
	testing.SetRealm(testing.NewUserRealm(carol))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 3_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 3_000_000}})
	Offer(cross(cur), id)
	testing.SetRealm(testing.NewUserRealm(alice))
	InstantSell(cross(cur), id)
	if OwnerOf(id) != carol {
		t.Fatalf("owner %s", OwnerOf(id).String())
	}
}

func TestInstantSellAbuse(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	if revive(func() { InstantSell(cross(cur), id) }) == nil {
		t.Fatalf("expected no offer")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Offer(cross(cur), id)
	if revive(func() { InstantSell(cross(cur), id) }) == nil {
		t.Fatalf("expected not owner")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { InstantSell(cross(cur), id) }) == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestSweep(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	a := Mint(cross(cur), "A", "")
	b := Mint(cross(cur), "B", "")
	c := Mint(cross(cur), "C", "")
	List(cross(cur), a, 1_000_000)
	List(cross(cur), b, 2_000_000)
	List(cross(cur), c, 3_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 3_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 3_000_000}})
	Sweep(cross(cur), "1,2")
	if OwnerOf(a) != bob || OwnerOf(b) != bob {
		t.Fatalf("owners")
	}
	if Listed(c) != true {
		t.Fatalf("left c")
	}
	if Listed(a) || Listed(b) {
		t.Fatalf("still listed")
	}
}

func TestSweepAbuse(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "A", "")
	List(cross(cur), id, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	if revive(func() { Sweep(cross(cur), "1") }) == nil {
		t.Fatalf("expected wrong payment")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	if revive(func() { Sweep(cross(cur), "1") }) == nil {
		t.Fatalf("expected self buy")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	if revive(func() { Sweep(cross(cur), "") }) == nil {
		t.Fatalf("expected empty")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	if revive(func() { Sweep(cross(cur), "1") }) == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestOfferAbuse(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	if revive(func() { Offer(cross(cur), id) }) == nil {
		t.Fatalf("expected self offer")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{})
	if revive(func() { Offer(cross(cur), id) }) == nil {
		t.Fatalf("expected zero offer")
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Offer(cross(cur), id)
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { AcceptOffer(cross(cur), id, alice) }) == nil {
		t.Fatalf("expected missing offer")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { CancelOffer(cross(cur), id) }) == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestDepositWithdrawPool(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 4_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 4_000_000}})
	DepositPool(cross(cur), "bazaar")
	if PoolOf("bazaar") != "4000000|4000000|0" {
		t.Fatalf("pool %q", PoolOf("bazaar"))
	}
	if MyPoolShares("bazaar", alice.String()) != 4_000_000 {
		t.Fatalf("shares")
	}
	WithdrawPool(cross(cur), "bazaar", 2_000_000)
	if PoolOf("bazaar") != "2000000|2000000|0" {
		t.Fatalf("after %q", PoolOf("bazaar"))
	}
}

func TestPoolAbuse(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	testing.SetOriginSend(chain.Coins{})
	if revive(func() { DepositPool(cross(cur), "bazaar") }) == nil {
		t.Fatalf("expected zero deposit")
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	DepositPool(cross(cur), "bazaar")
	if revive(func() { WithdrawPool(cross(cur), "bazaar", 2_000_000) }) == nil {
		t.Fatalf("expected over-withdraw")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { WithdrawPool(cross(cur), "bazaar", 1) }) == nil {
		t.Fatalf("expected wrong caller")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	if revive(func() { DepositPool(cross(cur), "bazaar") }) == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestDepositWithdrawNftPool(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	DepositNftPool(cross(cur), id)
	if OwnerOf(id) != self {
		t.Fatalf("pool owner")
	}
	if PoolOf("bazaar") != "0|0|1" {
		t.Fatalf("pool %q", PoolOf("bazaar"))
	}
	if ListPoolNfts("bazaar") != "1|Sword|"+alice.String() {
		t.Fatalf("list %q", ListPoolNfts("bazaar"))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { WithdrawNftPool(cross(cur), id) }) == nil {
		t.Fatalf("expected not depositor")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	WithdrawNftPool(cross(cur), id)
	if OwnerOf(id) != alice {
		t.Fatalf("returned")
	}
	if PoolOf("bazaar") != "0|0|0" {
		t.Fatalf("empty %q", PoolOf("bazaar"))
	}
}

func TestNftPoolAbuse(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "")
	List(cross(cur), id, 1_000_000)
	if revive(func() { DepositNftPool(cross(cur), id) }) == nil {
		t.Fatalf("expected listed")
	}
	Cancel(cross(cur), id)
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { DepositNftPool(cross(cur), id) }) == nil {
		t.Fatalf("expected not owner")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	DepositNftPool(cross(cur), id)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { WithdrawNftPool(cross(cur), id) }) == nil {
		t.Fatalf("expected EOA only")
	}
}

func TestListingRules(t *testing.T) {
	got := ListingRules()
	if !strings.Contains(got, "Path A") || !strings.Contains(got, "CreateDrop") || !strings.Contains(got, "PublicMint") {
		t.Fatalf("path a %q", got)
	}
	if !strings.Contains(got, "Path B") || !strings.Contains(got, "List") {
		t.Fatalf("path b %q", got)
	}
	if !strings.Contains(got, "Path C") || !strings.Contains(got, "GRC721") {
		t.Fatalf("path c %q", got)
	}
}

func TestActivityMintListBuy(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	id := Mint(cross(cur), "Sword", "https://example.com/sword.png")
	List(cross(cur), id, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Buy(cross(cur), id)
	got := Activity()
	want := "buy|1|bazaar|" + bob.String() + "|1000000|Sword\n" +
		"list|1|bazaar|" + alice.String() + "|1000000|Sword\n" +
		"mint|1|bazaar|" + alice.String() + "|0|Sword"
	if got != want {
		t.Fatalf("Activity %q want %q", got, want)
	}
}

func TestActivityByCollection(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateCollection(cross(cur), "stones", "Signal Stones", "/samples/stones-01.png")
	Mint(cross(cur), "Sword", "")
	MintIn(cross(cur), "stones", "Ember Core", "/samples/stones-01.png")
	got := ActivityByCollection("stones")
	want := "mint|2|stones|" + alice.String() + "|0|Ember Core"
	if got != want {
		t.Fatalf("stones %q want %q", got, want)
	}
	if strings.Contains(got, "|bazaar|") {
		t.Fatalf("leaked bazaar %q", got)
	}
	if ActivityByCollection("nope") != "" {
		t.Fatalf("unknown slug")
	}
}

func TestListItemsByCollection(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateCollection(cross(cur), "stones", "Signal Stones", "/samples/stones-01.png")
	listed := MintIn(cross(cur), "stones", "Ember Core", "/samples/stones-01.png")
	List(cross(cur), listed, 1_000_000)
	unlisted := MintIn(cross(cur), "stones", "Tide Core", "/samples/stones-02.png")
	Mint(cross(cur), "Sword", "")
	got := ListItemsByCollection("stones")
	if lineCount(got) != 2 {
		t.Fatalf("count %q", got)
	}
	if !strings.Contains(got, ItemLine(listed)) {
		t.Fatalf("listed %q", got)
	}
	if !strings.Contains(got, ItemLine(unlisted)) {
		t.Fatalf("unlisted %q", got)
	}
	if strings.Contains(got, "|bazaar") {
		t.Fatalf("other collection %q", got)
	}
	if Listed(unlisted) {
		t.Fatalf("unlisted marked listed")
	}
	if ListByCollection("stones") != ItemLine(listed) {
		t.Fatalf("open only %q", ListByCollection("stones"))
	}
}

func TestActivityDropPublicMint(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	PublicMint(cross(cur), "gems")
	got := Activity()
	want := "publicmint|1|gems|" + bob.String() + "|1000000|Harbor Gems #1\n" +
		"mint|1|gems|" + bob.String() + "|0|Harbor Gems #1\n" +
		"drop|0|gems|" + alice.String() + "|1000000|Harbor Gems"
	if got != want {
		t.Fatalf("Activity %q want %q", got, want)
	}
}

func TestAddDropItemsPublicMint(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 3, 1_000_000)
	AddDropItems(cross(cur), "gems", "Dusk Fox|/samples/foxes-01.png|Rare|Background:Dusk;Fur:Ember\nNight Fox|/samples/foxes-03.png|Epic|Background:Night;Fur:Blue")
	if LoadedOf("gems") != 2 {
		t.Fatalf("loaded %d", LoadedOf("gems"))
	}
	if !strings.Contains(ListDropSlots("gems"), "0|Dusk Fox|/samples/foxes-01.png|Rare|Background:Dusk;Fur:Ember") {
		t.Fatalf("slots %q", ListDropSlots("gems"))
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	id := PublicMint(cross(cur), "gems")
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
	id2 := PublicMint(cross(cur), "gems")
	if NameOf(id2) != "Night Fox" {
		t.Fatalf("second %q", NameOf(id2))
	}
	if revive(func() { PublicMint(cross(cur), "gems") }) == nil {
		t.Fatalf("expected no slot")
	}
}

func TestAddDropItemsAbuse(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 0)
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { AddDropItems(cross(cur), "gems", "A|/samples/foxes-01.png|Rare|Fur:Red") }) == nil {
		t.Fatalf("expected not creator")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { AddDropItems(cross(cur), "gems", "") }) == nil {
		t.Fatalf("expected empty")
	}
	AddDropItems(cross(cur), "gems", "A|/samples/foxes-01.png|Rare|Fur:Red\nB|/samples/foxes-02.png|Epic|Fur:Blue")
	if revive(func() { AddDropItems(cross(cur), "gems", "C|/samples/foxes-03.png|Rare|Fur:Grey") }) == nil {
		t.Fatalf("expected over supply")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { AddDropItems(cross(cur), "gems", "A|/samples/foxes-01.png||") }) == nil {
		t.Fatalf("expected EOA")
	}
}

func TestAllowlistMint(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	carol := testutils.TestAddress("carol")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 3, 0)
	AddAllowlist(cross(cur), "gems", bob.String())
	if AllowCount("gems") != 1 {
		t.Fatalf("allow %d", AllowCount("gems"))
	}
	if !OnAllowlist("gems", bob.String()) {
		t.Fatalf("bob")
	}
	SetMintCap(cross(cur), "gems", 1)
	testing.SetRealm(testing.NewUserRealm(carol))
	if revive(func() { PublicMint(cross(cur), "gems") }) == nil {
		t.Fatalf("expected not allowed")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	id := PublicMint(cross(cur), "gems")
	if id < 1 {
		t.Fatalf("id")
	}
	if revive(func() { PublicMint(cross(cur), "gems") }) == nil {
		t.Fatalf("expected mint cap")
	}
}

func TestRoyaltyBuy(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 0)
	SetDropSale(cross(cur), "gems", 500, 0, 0)
	if RoyaltyOf("gems") != 500 {
		t.Fatalf("royalty %d", RoyaltyOf("gems"))
	}
	id := MintIn(cross(cur), "gems", "Gem", "/samples/stones-01.png")
	List(cross(cur), id, 1_000_000)
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	Buy(cross(cur), id)
	if ProtocolFees() != 5000 {
		t.Fatalf("proto %d", ProtocolFees())
	}
}

func TestWhitelistThenPublic(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	carol := testutils.TestAddress("carol")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 3, 2_000_000)
	SetDropSale(cross(cur), "gems", 0, 1_000_000, 1)
	AddAllowlist(cross(cur), "gems", bob.String())
	if DropSaleOf("gems") != "0|1000000|1|whitelist|2000000" {
		t.Fatalf("sale %q", DropSaleOf("gems"))
	}
	testing.SetRealm(testing.NewUserRealm(carol))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	if revive(func() { PublicMint(cross(cur), "gems") }) == nil {
		t.Fatalf("expected not allowed")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	if revive(func() { PublicMint(cross(cur), "gems") }) == nil {
		t.Fatalf("expected wl price")
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 4_000_000}})
	PublicMint(cross(cur), "gems")
	if DropSaleOf("gems") != "0|1000000|1|public|2000000" {
		t.Fatalf("after wl %q", DropSaleOf("gems"))
	}
	testing.SetRealm(testing.NewUserRealm(carol))
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 2_000_000}})
	PublicMint(cross(cur), "gems")
}

func TestLaunchDropAbuse(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "G", "/samples/stones-01.png", 2, 1_000_000)
	if revive(func() { SetDropSale(cross(cur), "gems", 1001, 0, 0) }) == nil {
		t.Fatalf("expected royalty")
	}
	SetDropSale(cross(cur), "gems", 0, 500_000, 1)
	AddAllowlist(cross(cur), "gems", bob.String())
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { StartPublic(cross(cur), "gems") }) == nil {
		t.Fatalf("expected not creator")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	StartPublic(cross(cur), "gems")
	if DropSaleOf("gems") != "0|500000|0|public|1000000" {
		t.Fatalf("start public %q", DropSaleOf("gems"))
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { SetDropSale(cross(cur), "gems", 0, 0, 0) }) == nil {
		t.Fatalf("expected EOA")
	}
}

func TestAllowlistAbuse(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 0)
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { AddAllowlist(cross(cur), "gems", bob.String()) }) == nil {
		t.Fatalf("expected not creator")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { AddAllowlist(cross(cur), "gems", "") }) == nil {
		t.Fatalf("expected empty")
	}
	if revive(func() { AddAllowlist(cross(cur), "gems", "not-an-address") }) == nil {
		t.Fatalf("expected address")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { SetMintCap(cross(cur), "gems", 1) }) == nil {
		t.Fatalf("expected EOA")
	}
}

func TestHiddenReveal(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 0)
	AddDropItems(cross(cur), "gems", "Dusk Fox|/samples/foxes-01.png|Rare|Background:Dusk;Fur:Ember")
	SetHidden(cross(cur), "gems", true)
	if ListDropSlots("gems") != "" {
		t.Fatalf("leaked %q", ListDropSlots("gems"))
	}
	if !HiddenOf("gems") {
		t.Fatalf("hidden")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	id := PublicMint(cross(cur), "gems")
	if NameOf(id) != "Unrevealed" {
		t.Fatalf("name %q", NameOf(id))
	}
	if TraitsOf(id) != "" {
		t.Fatalf("traits leaked")
	}
	if Revealed(id) {
		t.Fatalf("revealed")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { Reveal(cross(cur), id) }) == nil {
		t.Fatalf("expected not owner")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	Reveal(cross(cur), id)
	if NameOf(id) != "Dusk Fox" {
		t.Fatalf("after %q", NameOf(id))
	}
	if RarityOf(id) != "Rare" {
		t.Fatalf("rarity")
	}
	if TraitsOf(id) != "Background:Dusk;Fur:Ember" {
		t.Fatalf("traits %q", TraitsOf(id))
	}
	if revive(func() { Reveal(cross(cur), id) }) == nil {
		t.Fatalf("expected already revealed")
	}
}

func TestHiddenAbuse(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 0)
	if revive(func() { SetHidden(cross(cur), "gems", true) }) == nil {
		t.Fatalf("expected no slots")
	}
	id := Mint(cross(cur), "Sword", "")
	if revive(func() { Reveal(cross(cur), id) }) == nil {
		t.Fatalf("expected revealed")
	}
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { Reveal(cross(cur), id) }) == nil {
		t.Fatalf("expected not owner")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { SetHidden(cross(cur), "gems", false) }) == nil {
		t.Fatalf("expected EOA")
	}
}

func TestLaunchFeeCreateDrop(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	if LaunchFee() != 1_000_000_000 {
		t.Fatalf("default fee %d", LaunchFee())
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1_000_000_000}})
	testing.IssueCoins(self, chain.Coins{{Denom: "ugnot", Amount: 1_000_000_000}})
	CreateDrop(cross(cur), "gems", "Harbor Gems", "/samples/stones-01.png", 2, 0)
	if ProtocolFees() != 1_000_000_000 {
		t.Fatalf("fees %d", ProtocolFees())
	}
}

func TestLaunchFeeWrongPay(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	if revive(func() { CreateDrop(cross(cur), "gems", "G", "/samples/stones-01.png", 2, 0) }) == nil {
		t.Fatalf("expected launch fee")
	}
	testing.SetOriginSend(chain.Coins{{Denom: "ugnot", Amount: 1}})
	if revive(func() { CreateDrop(cross(cur), "gems", "G", "/samples/stones-01.png", 2, 0) }) == nil {
		t.Fatalf("expected launch fee")
	}
}

func TestSetLaunchFeeAbuse(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { SetLaunchFee(cross(cur), 0) }) == nil {
		t.Fatalf("expected not admin")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { SetLaunchFee(cross(cur), -1) }) == nil {
		t.Fatalf("expected negative")
	}
	SetLaunchFee(cross(cur), 2_000_000_000)
	if LaunchFee() != 2_000_000_000 {
		t.Fatalf("fee %d", LaunchFee())
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { SetLaunchFee(cross(cur), 0) }) == nil {
		t.Fatalf("expected EOA")
	}
}

func TestSetProfile(cur realm, t *testing.T) {
	resetAll()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	SetProfile(cross(cur), "Harbor", "/samples/stones-01.png", "", "https://gno.land", "@gno", "")
	if ProfileOf(alice.String()) != "Harbor|/samples/stones-01.png||https://gno.land|@gno|" {
		t.Fatalf("profile %q", ProfileOf(alice.String()))
	}
	if revive(func() { SetProfile(cross(cur), "bad|name", "", "", "", "", "") }) == nil {
		t.Fatalf("expected name")
	}
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	if revive(func() { SetProfile(cross(cur), "X", "", "", "", "", "") }) == nil {
		t.Fatalf("expected EOA")
	}
}

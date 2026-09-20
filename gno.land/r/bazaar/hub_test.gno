package bazaar

import (
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
)

func resetHub() {
	admins = avl.Tree{}
	modules = avl.Tree{}
	inited = false
}

func TestHubInitAndModules(cur realm, t *testing.T) {
	resetHub()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	if !IsAdmin(alice.String()) {
		t.Fatalf("alice should be admin")
	}
	SetModule(cross(cur), "market", "gno.land/r/bazaar/market")
	if GetModule("market") != "gno.land/r/bazaar/market" {
		t.Fatalf("GetModule = %q", GetModule("market"))
	}
	SetModule(cross(cur), "nft", "gno.land/r/bazaar/nft")
	if GetModule("nft") != "gno.land/r/bazaar/nft" {
		t.Fatalf("GetModule nft = %q", GetModule("nft"))
	}
	if GetModule("missing") != "" {
		t.Fatalf("missing module")
	}
}

func TestHubInitTwicePanics(cur realm, t *testing.T) {
	resetHub()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	got := revive(func() { Init(cross(cur)) })
	if got == nil {
		t.Fatalf("expected second Init abort")
	}
}

func TestHubSetModuleNotAdmin(cur realm, t *testing.T) {
	resetHub()
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { SetModule(cross(cur), "market", "gno.land/r/bazaar/market") })
	if got == nil {
		t.Fatalf("expected not admin")
	}
}

func TestHubRemoveLastAdminPanics(cur realm, t *testing.T) {
	resetHub()
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	Init(cross(cur))
	got := revive(func() { RemoveAdmin(cross(cur), alice) })
	if got == nil {
		t.Fatalf("expected cannot remove last admin")
	}
}

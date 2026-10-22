package wlist

import (
	"testing"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
)

func boot(cur realm) {
	inited = false
	n = 0
	opensAt = 0
	byAddr = avl.Tree{}
	byPlace = avl.Tree{}
	byHandle = avl.Tree{}
	Init(cross(cur))
	opensAt = 0
}

func TestRegisterHappy(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	Register(cross(cur), "@Alice_gno")
	if Count() != 1 || Place(alice.String()) != 1 || !Registered(alice.String()) {
		t.Fatalf("alice")
	}
	if HandleOf(alice.String()) != "Alice_gno" {
		t.Fatalf("handle %s", HandleOf(alice.String()))
	}
	got := revive(func() { Register(cross(cur), "Alice_gno") })
	if got == nil {
		t.Fatalf("expected already")
	}
}

func TestRegisterHandleRequired(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	got := revive(func() { Register(cross(cur), "") })
	if got == nil {
		t.Fatalf("expected handle")
	}
	got = revive(func() { Register(cross(cur), "bad handle") })
	if got == nil {
		t.Fatalf("expected bad handle")
	}
}

func TestRegisterFullAndNotOpen(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	n = maxSlots
	testing.SetRealm(testing.NewUserRealm(bob))
	got := revive(func() { Register(cross(cur), "bobx") })
	if got == nil {
		t.Fatalf("expected full")
	}
	n = 0
	opensAt = 4000000000
	got = revive(func() { Register(cross(cur), "bobx") })
	if got == nil {
		t.Fatalf("expected not open")
	}
}

func TestRegisterNotUser(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	boot(cur)
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil"))
	got := revive(func() { Register(cross(cur), "evil") })
	if got == nil {
		t.Fatalf("expected EOA")
	}
}

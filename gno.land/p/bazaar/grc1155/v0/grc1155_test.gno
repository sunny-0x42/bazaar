package grc1155

import (
	"testing"

	"gno.land/p/nt/testutils/v0"
)

// A pure-package test frame has an empty pkg path. Cross once so cur is this
// package, which is the same shape a collection realm uses.
func newLedger(cur realm) *Ledger {
	var led *Ledger
	func(cur realm) {
		led = New(0, cur)
	}(cross(cur))
	return led
}

func TestMintAndMove(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	led := newLedger(cur)
	func(cur realm) {
		led.Mint(0, cur, alice, "red", 5)
		if led.Balance(alice, "red") != 5 || led.Supply("red") != 5 {
			t.Fatalf("mint balance %d supply %d", led.Balance(alice, "red"), led.Supply("red"))
		}
		led.Move(0, cur, alice, bob, "red", 2)
		if led.Balance(alice, "red") != 3 || led.Balance(bob, "red") != 2 || led.Supply("red") != 5 {
			t.Fatalf("after move alice %d bob %d", led.Balance(alice, "red"), led.Balance(bob, "red"))
		}
		led.Move(0, cur, alice, bob, "red", 3)
		if led.Balance(alice, "red") != 0 || led.Balance(bob, "red") != 5 {
			t.Fatalf("cleared alice %d bob %d", led.Balance(alice, "red"), led.Balance(bob, "red"))
		}
	}(cross(cur))
}

func TestMintRejectsBadInput(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	led := newLedger(cur)
	if revive(func() {
		func(cur realm) { led.Mint(0, cur, alice, "red", 0) }(cross(cur))
	}) == nil {
		t.Fatal("zero amount")
	}
	if revive(func() {
		func(cur realm) { led.Mint(0, cur, alice, "Red", 1) }(cross(cur))
	}) == nil {
		t.Fatal("bad id")
	}
	if revive(func() {
		func(cur realm) { led.Mint(0, cur, address(""), "red", 1) }(cross(cur))
	}) == nil {
		t.Fatal("empty address")
	}
	if revive(func() {
		func(cur realm) { led.Mint(0, cur.Previous(), alice, "red", 1) }(cross(cur))
	}) == nil {
		t.Fatal("spoofed realm")
	}
	if led.Supply("red") != 0 {
		t.Fatalf("supply changed %d", led.Supply("red"))
	}
}

func TestMoveRejectsAbuse(cur realm, t *testing.T) {
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	led := newLedger(cur)
	func(cur realm) {
		led.Mint(0, cur, alice, "red", 1)
	}(cross(cur))
	if revive(func() {
		func(cur realm) { led.Move(0, cur, alice, bob, "red", 2) }(cross(cur))
	}) == nil {
		t.Fatal("short balance")
	}
	if revive(func() {
		func(cur realm) { led.Move(0, cur, alice, bob, "blue", 1) }(cross(cur))
	}) == nil {
		t.Fatal("unknown id")
	}
	if revive(func() {
		func(cur realm) { led.Move(0, cur, alice, alice, "red", 1) }(cross(cur))
	}) == nil {
		t.Fatal("self move")
	}
	if led.Balance(alice, "red") != 1 || led.Balance(bob, "red") != 0 {
		t.Fatalf("balance changed alice %d bob %d", led.Balance(alice, "red"), led.Balance(bob, "red"))
	}
}

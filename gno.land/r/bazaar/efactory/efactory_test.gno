package efactory

import (
	"testing"

	"gno.land/p/nt/testutils/v0"
)

func boot(cur realm) address {
	alice := testutils.TestAddress("alice")
	testing.SetRealm(testing.NewUserRealm(alice))
	if !inited {
		Init(cross(cur))
		SetLaunchFee(cross(cur), 0)
	}
	return alice
}

func TestInitOnce(cur realm, t *testing.T) {
	alice := boot(cur)
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { Init(cross(cur)) }) == nil {
		t.Fatal("second init")
	}
	if ProtocolBps() != 200 {
		t.Fatalf("bps %d", ProtocolBps())
	}
	if LaunchFee() != 0 {
		t.Fatalf("fee %d", LaunchFee())
	}
}

func TestAdminOnly(cur realm, t *testing.T) {
	alice := boot(cur)
	bob := testutils.TestAddress("bob")
	testing.SetRealm(testing.NewUserRealm(bob))
	if revive(func() { SetLaunchFee(cross(cur), 1) }) == nil {
		t.Fatal("bob fee")
	}
	if revive(func() { SetProtocolBps(cross(cur), 50) }) == nil {
		t.Fatal("bob bps")
	}
	if revive(func() { SetProtocolSink(cross(cur), bob) }) == nil {
		t.Fatal("bob sink")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { SetProtocolBps(cross(cur), 501) }) == nil {
		t.Fatal("bps high")
	}
	if revive(func() { SetProtocolBps(cross(cur), -1) }) == nil {
		t.Fatal("bps neg")
	}
	if ProtocolBps() != 200 {
		t.Fatalf("bps changed %d", ProtocolBps())
	}
}

func TestReserveRules(cur realm, t *testing.T) {
	alice := boot(cur)
	if reserved.Has("ab") {
		reserved.Remove("ab")
	}
	testing.SetRealm(testing.NewUserRealm(alice))
	if revive(func() { Reserve(cross(cur), "A") }) == nil {
		t.Fatal("bad slug")
	}
	Reserve(cross(cur), "ab")
	if revive(func() { Reserve(cross(cur), "ab") }) == nil {
		t.Fatal("taken")
	}
	if revive(func() { Register(cross(cur), "Prints", "PRINT", "", 0) }) == nil {
		t.Fatal("user is not a collection realm")
	}
	reserved.Remove("ab")
}

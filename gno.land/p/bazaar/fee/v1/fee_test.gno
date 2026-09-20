package fee

import "testing"

func TestProtocolFeeFiftyBps(t *testing.T) {
	got := ProtocolFee(1_000_000, 50)
	if got != 5000 {
		t.Fatalf("ProtocolFee(1e6, 50) = %d, want 5000", got)
	}
	if SellerProceeds(1_000_000, 50) != 995_000 {
		t.Fatalf("SellerProceeds")
	}
}

func TestProtocolFeeZero(t *testing.T) {
	if ProtocolFee(0, 50) != 0 {
		t.Fatalf("zero price")
	}
	if ProtocolFee(100, 0) != 0 {
		t.Fatalf("zero bps")
	}
}

func TestProtocolFeeRemainder(t *testing.T) {
	// 12345 * 50 / 10000 = 61 (floor)
	got := ProtocolFee(12345, 50)
	if got != 61 {
		t.Fatalf("got %d want 61", got)
	}
}

func TestProtocolFeeLargePrice(t *testing.T) {
	// 9e15 * 50 would overflow if multiplied first (9e15*50 = 4.5e17 ok actually)
	// 1e17 * 50 = 5e18 still under 9.22e18. Use 2e17: 2e17*50 = 1e19 overflow.
	price := int64(200_000_000_000_000_000) // 2e17
	got := ProtocolFee(price, 50)
	want := int64(1_000_000_000_000_000) // 1e15
	if got != want {
		t.Fatalf("large price fee %d want %d", got, want)
	}
}

func TestProtocolFeePanics(t *testing.T) {
	mustPanic(t, "neg price", func() { ProtocolFee(-1, 50) })
	mustPanic(t, "neg bps", func() { ProtocolFee(1, -1) })
	mustPanic(t, "bps over", func() { ProtocolFee(1, 10001) })
}

func mustPanic(t *testing.T, name string, fn func()) {
	t.Helper()
	defer func() {
		if recover() == nil {
			t.Fatalf("%s: expected panic", name)
		}
	}()
	fn()
}

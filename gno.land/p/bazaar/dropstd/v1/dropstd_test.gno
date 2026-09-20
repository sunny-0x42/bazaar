package dropstd

import (
	"strings"
	"testing"
)

func TestCheckSlugOK(t *testing.T) {
	CheckSlug("ab")
	CheckSlug("a-b")
	CheckSlug("a1")
	CheckSlug("abcdefghijklmnop") // 16
}

func TestCheckSlugPanics(t *testing.T) {
	mustPanic(t, "empty", "dropstd: slug", func() { CheckSlug("") })
	mustPanic(t, "short", "dropstd: slug", func() { CheckSlug("a") })
	mustPanic(t, "long", "dropstd: slug", func() { CheckSlug("abcdefghijklmnopq") })
	mustPanic(t, "upper", "dropstd: slug", func() { CheckSlug("AB") })
	mustPanic(t, "underscore", "dropstd: slug", func() { CheckSlug("a_b") })
	mustPanic(t, "space", "dropstd: slug", func() { CheckSlug("a b") })
}

func TestCheckNameOK(t *testing.T) {
	CheckName("x")
	CheckName(strings.Repeat("a", 64))
	CheckName("Harbor Gems")
}

func TestCheckNamePanics(t *testing.T) {
	mustPanic(t, "empty", "dropstd: name", func() { CheckName("") })
	mustPanic(t, "long", "dropstd: name", func() { CheckName(strings.Repeat("a", 65)) })
	mustPanic(t, "newline", "dropstd: name", func() { CheckName("a\nb") })
	mustPanic(t, "pipe", "dropstd: name", func() { CheckName("a|b") })
}

func TestCheckMaxSupplyOK(t *testing.T) {
	CheckMaxSupply(0)
	CheckMaxSupply(1)
	CheckMaxSupply(10000)
	CheckMaxSupply(MaxSupplyCap)
}

func TestCheckMaxSupplyPanics(t *testing.T) {
	mustPanic(t, "over", "dropstd: maxSupply", func() { CheckMaxSupply(MaxSupplyCap + 1) })
	mustPanic(t, "neg", "dropstd: maxSupply", func() { CheckMaxSupply(-1) })
}

func TestCheckMintPriceOK(t *testing.T) {
	CheckMintPrice(0)
	CheckMintPrice(1)
	CheckMintPrice(1_000_000)
}

func TestCheckMintPricePanics(t *testing.T) {
	mustPanic(t, "neg", "dropstd: mintPrice", func() { CheckMintPrice(-1) })
}

func mustPanic(t *testing.T, name, want string, fn func()) {
	t.Helper()
	defer func() {
		r := recover()
		if r == nil {
			t.Fatalf("%s: expected panic", name)
		}
		got, ok := r.(string)
		if !ok {
			t.Fatalf("%s: panic %v want %q", name, r, want)
		}
		if got != want {
			t.Fatalf("%s: panic %q want %q", name, got, want)
		}
	}()
	fn()
}

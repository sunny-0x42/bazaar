package dropstd

import "strings"

const (
	MaxSupplyCap = 1_000_000
	SlotCap      = 10000
	MinSlugLen   = 2
	MaxSlugLen   = 16
	maxNameLen   = 64
)

func CheckSlug(s string) {
	if len(s) < MinSlugLen || len(s) > MaxSlugLen {
		panic("dropstd: slug")
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		ok := (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-'
		if !ok {
			panic("dropstd: slug")
		}
	}
}

func CheckName(name string) {
	if len(name) < 1 || len(name) > maxNameLen {
		panic("dropstd: name")
	}
	if strings.ContainsAny(name, "\n\r|") {
		panic("dropstd: name")
	}
}

func CheckMaxSupply(n int) {
	if n < 0 || n > MaxSupplyCap {
		panic("dropstd: maxSupply")
	}
}

func CheckMintPrice(price int64) {
	if price < 0 {
		panic("dropstd: mintPrice")
	}
}

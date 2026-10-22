package wlist

import (
	"chain"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"gno.land/p/nt/avl/v0"
)

const (
	maxSlots      = 333
	defaultOpensAt = int64(1790553600) // 2026-09-28 00:00:00 UTC = 07:00 Vietnam
)

var (
	inited  bool
	opensAt int64
	n        int
	byAddr   avl.Tree // addr -> place (1-indexed)
	byPlace  avl.Tree // place string -> addr
	byHandle avl.Tree // addr -> x handle
)

func Init(cur realm) {
	if !cur.IsCurrent() {
		panic("wlist: spoofed realm")
	}
	if !cur.Previous().IsUserCall() {
		panic("wlist: EOA only")
	}
	if inited {
		panic("wlist: already initialized")
	}
	opensAt = defaultOpensAt
	inited = true
	chain.Emit("Init", "opensAt", strconv.FormatInt(opensAt, 10), "cap", strconv.Itoa(maxSlots))
}

func Register(cur realm, handle string) {
	requireInit()
	if !cur.IsCurrent() {
		panic("wlist: spoofed realm")
	}
	if !cur.Previous().IsUserCall() {
		panic("wlist: EOA only")
	}
	if time.Now().Unix() < opensAt {
		panic("wlist: not open")
	}
	x := normalizeHandle(handle)
	if x == "" {
		panic("wlist: handle")
	}
	caller := cur.Previous().Address()
	key := caller.String()
	if byAddr.Has(key) {
		panic("wlist: already")
	}
	if n >= maxSlots {
		panic("wlist: full")
	}
	n++
	byAddr.Set(key, n)
	byPlace.Set(strconv.Itoa(n), key)
	byHandle.Set(key, x)
	chain.Emit("Register", "addr", key, "place", strconv.Itoa(n), "x", x)
}

func Count() int {
	requireInit()
	return n
}

func Cap() int {
	return maxSlots
}

func OpensAt() int64 {
	requireInit()
	return opensAt
}

func Remaining() int {
	requireInit()
	left := maxSlots - n
	if left < 0 {
		return 0
	}
	return left
}

func Registered(addr string) bool {
	requireInit()
	return byAddr.Has(addr)
}

func Place(addr string) int {
	requireInit()
	v := byAddr.Get(addr)
	if v == nil {
		return 0
	}
	return v.(int)
}

func HandleOf(addr string) string {
	requireInit()
	v := byHandle.Get(addr)
	if v == nil {
		return ""
	}
	return v.(string)
}

func normalizeHandle(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "@")
	s = strings.TrimPrefix(s, "https://x.com/")
	s = strings.TrimPrefix(s, "https://twitter.com/")
	if i := strings.IndexByte(s, '?'); i >= 0 {
		s = s[:i]
	}
	if i := strings.IndexByte(s, '/'); i >= 0 {
		s = s[:i]
	}
	if s == "" || utf8.RuneCountInString(s) > 32 {
		return ""
	}
	for _, r := range s {
		ok := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_'
		if !ok {
			return ""
		}
	}
	return s
}

func requireInit() {
	if !inited {
		panic("wlist: call Init first")
	}
}

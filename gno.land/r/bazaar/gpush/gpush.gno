package gpush

import (
	"gno.land/r/bazaar/factory"
)

// Sync writes one wallet's Genesis FeeDiscount into factory.HolderDiscount.
// Called from the Genesis collection on mint/transfer. Previous realm is this pusher.
func Sync(cur realm, owner string, bps int64) {
	if !cur.Previous().IsCode() {
		panic("gpush: collection realm")
	}
	factory.NoteHolderDiscount(cross(cur), owner, bps)
}

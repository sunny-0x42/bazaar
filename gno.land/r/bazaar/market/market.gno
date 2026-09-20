package market

import (
	"chain"
	"chain/banker"
	"chain/runtime/unsafe"
	"strconv"
	"strings"

	"gno.land/p/bazaar/fee/v1"
	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/seqid/v0"
)

const (
	statusOpen      = "open"
	statusSold      = "sold"
	statusCancelled = "cancelled"
	protocolBps     = int64(50)
	nativeDenom     = "ugnot"
)

type listing struct {
	id     string
	symbol string
	seller address
	amount int64
	price  int64
	status string
}

var (
	listings avl.Tree
	nextID   seqid.ID
	inited   bool
	admin    address
	self     address
	fees     int64
)

func Init(cur realm) {
	if inited {
		panic("market: already initialized")
	}
	if !cur.Previous().IsUserCall() {
		panic("market: EOA only")
	}
	admin = cur.Previous().Address()
	self = cur.Address()
	listings = avl.Tree{}
	inited = true
	chain.Emit("Init", "admin", admin.String())
}

func requireInit() {
	if !inited {
		panic("market: call Init first")
	}
}

func List(cur realm, symbol string, amount, priceUgnot int64) string {
	requireInit()
	if !cur.Previous().IsUserCall() {
		panic("market: EOA only")
	}
	if amount <= 0 {
		panic("market: amount")
	}
	if priceUgnot <= 0 {
		panic("market: price")
	}
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	if symbol == "" {
		panic("market: symbol")
	}
	seller := cur.Previous().Address()
	pullFromCaller(cur, symbol, amount)
	id := nextID.Next().String()
	row := &listing{
		id:     id,
		symbol: symbol,
		seller: seller,
		amount: amount,
		price:  priceUgnot,
		status: statusOpen,
	}
	listings.Set(id, row)
	chain.Emit("List", "id", id, "symbol", symbol, "seller", seller.String(), "amount", strconv.FormatInt(amount, 10), "price", strconv.FormatInt(priceUgnot, 10))
	return id
}

func Buy(cur realm, id string) {
	requireInit()
	if !cur.Previous().IsUserCall() {
		panic("market: EOA only")
	}
	row := mustListing(id)
	if row.status != statusOpen {
		panic("market: not open")
	}
	sent := unsafe.OriginSend().AmountOf(nativeDenom)
	if sent != row.price {
		panic("market: wrong payment")
	}
	buyer := cur.Previous().Address()
	if buyer == row.seller {
		panic("market: self buy")
	}
	proto := fee.ProtocolFee(row.price, protocolBps)
	sellerAmt := row.price - proto
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	if sellerAmt > 0 {
		bk.SendCoins(self, row.seller, chain.Coins{{Denom: nativeDenom, Amount: sellerAmt}})
	}
	fees += proto
	row.status = statusSold
	listings.Set(id, row)
	pushFromEscrow(self, buyer, row.symbol, row.amount)
	chain.Emit("Buy", "id", id, "buyer", buyer.String(), "fee", strconv.FormatInt(proto, 10))
}

func Cancel(cur realm, id string) {
	requireInit()
	if !cur.Previous().IsUserCall() {
		panic("market: EOA only")
	}
	row := mustListing(id)
	if row.status != statusOpen {
		panic("market: not open")
	}
	if cur.Previous().Address() != row.seller {
		panic("market: not seller")
	}
	row.status = statusCancelled
	listings.Set(id, row)
	pushFromEscrow(self, row.seller, row.symbol, row.amount)
	chain.Emit("Cancel", "id", id)
}

func TransferAdmin(cur realm, next address) {
	requireInit()
	if !cur.Previous().IsUserCall() {
		panic("market: EOA only")
	}
	if cur.Previous().Address() != admin {
		panic("market: not admin")
	}
	if !next.IsValid() {
		panic("market: invalid address")
	}
	if next == admin {
		panic("market: already admin")
	}
	admin = next
	chain.Emit("TransferAdmin", "addr", next.String())
}

func WithdrawFees(cur realm) {
	requireInit()
	if !cur.Previous().IsUserCall() {
		panic("market: EOA only")
	}
	if cur.Previous().Address() != admin {
		panic("market: not admin")
	}
	if fees <= 0 {
		panic("market: no fees")
	}
	amt := fees
	fees = 0
	bk := banker.NewBanker(banker.BankerTypeRealmSend, cur)
	bk.SendCoins(self, admin, chain.Coins{{Denom: nativeDenom, Amount: amt}})
	chain.Emit("WithdrawFees", "amount", strconv.FormatInt(amt, 10))
}

func GetListing(id string) string {
	return formatListing(mustListing(id))
}

func ListOpen() string {
	out := ""
	n := 0
	listings.Iterate("", "", func(_ string, value any) bool {
		row := value.(*listing)
		if row.status != statusOpen {
			return false
		}
		if n >= 50 {
			return true
		}
		if out != "" {
			out += "\n"
		}
		out += formatListing(row)
		n++
		return false
	})
	return out
}

func ListingCount() int {
	return listings.Size()
}

func ProtocolBps() int64 {
	return protocolBps
}

func ProtocolFees() int64 {
	return fees
}

func Render(path string) string {
	_ = path
	out := "# Bazaar market\n\nCreate a GRC20, list it at a fixed GNOT price, or buy an open listing.\n\n"
	out += "- tokens: " + strconv.Itoa(TokenCount()) + "\n"
	out += "- listings: " + strconv.Itoa(ListingCount()) + "\n"
	out += "- protocol fee: " + strconv.FormatInt(protocolBps, 10) + " bps\n\n"
	open := ListOpen()
	if open == "" {
		out += "_No open listings._\n"
	} else {
		out += "```\n" + open + "\n```\n"
	}
	return out
}

func mustListing(id string) *listing {
	id = strings.TrimSpace(id)
	v := listings.Get(id)
	if v == nil {
		panic("market: unknown listing")
	}
	return v.(*listing)
}

func formatListing(row *listing) string {
	return row.id + "|" + row.symbol + "|" + row.seller.String() + "|" + strconv.FormatInt(row.amount, 10) + "|" + strconv.FormatInt(row.price, 10) + "|" + row.status
}

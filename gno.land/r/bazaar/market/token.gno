package market

import (
	"chain"
	"strconv"
	"strings"

	"gno.land/p/demo/tokens/grc20"
	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/seqid/v0"
)

type rec struct {
	token  *grc20.Token
	ledger *grc20.PrivateLedger
}

var (
	tokens avl.Tree
	nextTok seqid.ID
)

const (
	maxNameLen   = 32
	minSymbolLen = 2
	maxSymbolLen = 8
	maxSupply    = int64(1_000_000_000_000_000)
)

func Create(cur realm, name, symbol string, decimals int, supply int64) {
	if !cur.Previous().IsUserCall() {
		panic("market: EOA only")
	}
	name = strings.TrimSpace(name)
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	if name == "" || len(name) > maxNameLen {
		panic("market: name")
	}
	if !validSymbol(symbol) {
		panic("market: symbol")
	}
	if decimals < 0 || decimals > 6 {
		panic("market: decimals")
	}
	if supply <= 0 || supply > maxSupply {
		panic("market: supply")
	}
	if tokens.Has(symbol) {
		panic("market: symbol taken")
	}
	tok, led := grc20.NewToken(name, symbol, decimals, nextTok.Next(), cur)
	creator := cur.Previous().Address()
	if err := led.Mint(creator, supply); err != nil {
		panic("market: mint: " + err.Error())
	}
	tokens.Set(symbol, &rec{token: tok, ledger: led})
	chain.Emit("Create", "symbol", symbol, "creator", creator.String(), "supply", strconv.FormatInt(supply, 10))
}

func Transfer(cur realm, symbol string, to address, amount int64) {
	r := mustTok(symbol)
	if err := r.token.CallerTeller().Transfer(0, cur, to, amount); err != nil {
		panic("market: transfer: " + err.Error())
	}
}

func Approve(cur realm, symbol string, spender address, amount int64) {
	r := mustTok(symbol)
	if err := r.token.CallerTeller().Approve(0, cur, spender, amount); err != nil {
		panic("market: approve: " + err.Error())
	}
}

func TransferFrom(cur realm, symbol string, from, to address, amount int64) {
	r := mustTok(symbol)
	if err := r.token.CallerTeller().TransferFrom(0, cur, from, to, amount); err != nil {
		panic("market: transferFrom: " + err.Error())
	}
}

func BalanceOf(symbol string, owner address) int64 {
	return mustTok(symbol).token.BalanceOf(owner)
}

func TotalSupply(symbol string) int64 {
	return mustTok(symbol).token.TotalSupply()
}

func Allowance(symbol string, owner, spender address) int64 {
	return mustTok(symbol).token.Allowance(owner, spender)
}

func TokenCount() int {
	return tokens.Size()
}

func ListSymbols() string {
	out := ""
	tokens.Iterate("", "", func(key string, _ any) bool {
		if out != "" {
			out += "\n"
		}
		out += key
		return false
	})
	return out
}

func Meta(symbol string) string {
	r := mustTok(symbol)
	tok := r.token
	return tok.GetName() + "|" + tok.GetSymbol() + "|" + strconv.Itoa(tok.GetDecimals()) + "|" + strconv.FormatInt(tok.TotalSupply(), 10)
}

func mustTok(symbol string) *rec {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	v := tokens.Get(symbol)
	if v == nil {
		panic("market: unknown token " + symbol)
	}
	return v.(*rec)
}

func validSymbol(s string) bool {
	if len(s) < minSymbolLen || len(s) > maxSymbolLen {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
			return false
		}
	}
	return true
}

func pullFromCaller(cur realm, symbol string, amount int64) {
	r := mustTok(symbol)
	if err := r.token.CallerTeller().Transfer(0, cur, self, amount); err != nil {
		panic("market: escrow: " + err.Error())
	}
}

func pushFromEscrow(marketAddr, to address, symbol string, amount int64) {
	r := mustTok(symbol)
	if err := r.ledger.Transfer(marketAddr, to, amount); err != nil {
		panic("market: payout: " + err.Error())
	}
}

package grc20

import (
	"errors"

	"gno.land/p/nt/avl/v0"
)

type Teller interface {
	GetName() string
	GetSymbol() string
	GetDecimals() int
	TotalSupply() int64
	BalanceOf(account address) int64
	Transfer(_ int, rlm realm, to address, amount int64) error
	Allowance(owner, spender address) int64
	Approve(_ int, rlm realm, spender address, amount int64) error
	TransferFrom(_ int, rlm realm, from, to address, amount int64) error
}

type Token struct {
	id        string
	name      string
	symbol    string
	decimals  int
	ledger    *PrivateLedger
	origRealm string
}

type PrivateLedger struct {
	totalSupply int64
	balances    avl.Tree
	allowances  avl.Tree
	token       *Token
}

var (
	ErrInsufficientBalance   = errors.New("insufficient balance")
	ErrInsufficientAllowance = errors.New("insufficient allowance")
	ErrInvalidAddress        = errors.New("invalid address")
	ErrCannotTransferToSelf  = errors.New("cannot send transfer to self")
	ErrReadonly              = errors.New("banker is readonly")
	ErrRestrictedTokenOwner  = errors.New("restricted to bank owner")
	ErrMintOverflow          = errors.New("mint overflow")
	ErrInvalidAmount         = errors.New("invalid amount")
	ErrSpoofedRealm          = errors.New("rlm does not match the current crossing frame")
	ErrForeignCallerTeller   = errors.New("caller teller is confined to the token's own realm")
	ErrNotRealm              = errors.New("rlm must be a realm (got EOA/origin)")
	ErrInvalidName           = errors.New("invalid token name (empty, too long, or contains control chars)")
	ErrInvalidSymbol         = errors.New("invalid token symbol (empty, too long, or contains chars outside [A-Za-z0-9_-])")
	ErrInvalidDecimals       = errors.New("invalid decimals (must be 0..18)")
)

const (
	MaxNameLen   = 64
	MaxSymbolLen = 11
	MaxDecimals  = 18
)

const (
	NewTokenEvent = "NewToken"
	MintEvent     = "Mint"
	BurnEvent     = "Burn"
	TransferEvent = "Transfer"
	ApprovalEvent = "Approval"
)

type fnTeller struct {
	accountFn func(_ int, rlm realm) address
	homeGuard bool
	*Token
}

var _ Teller = (*fnTeller)(nil)

func IsCanonicalTeller(t Teller) bool {
	_, ok := t.(*fnTeller)
	return ok
}

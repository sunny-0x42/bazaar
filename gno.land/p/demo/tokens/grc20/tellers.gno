package grc20

func (ledger *PrivateLedger) CallerTeller() Teller {
	if ledger == nil {
		panic("Ledger cannot be nil")
	}
	return &fnTeller{
		accountFn: func(_ int, rlm realm) address {
			return rlm.Previous().Address()
		},
		homeGuard: true,
		Token:     ledger.token,
	}
}

// Sapphire GRC20 exposes CallerTeller on *Token (Pearl uses *PrivateLedger).
func (tok *Token) CallerTeller() Teller {
	if tok == nil {
		panic("Token cannot be nil")
	}
	return &fnTeller{
		accountFn: func(_ int, rlm realm) address {
			return rlm.Previous().Address()
		},
		Token: tok,
	}
}

func (tok *Token) ReadonlyTeller() Teller {
	if tok == nil {
		panic("Token cannot be nil")
	}
	return &fnTeller{
		accountFn: nil,
		Token:     tok,
	}
}

func (tok *Token) RealmTeller(_ int, rlm realm) Teller {
	if tok == nil {
		panic("Token cannot be nil")
	}
	if !rlm.IsCurrent() {
		panic(ErrSpoofedRealm)
	}
	caller := rlm.Address()
	return &fnTeller{
		accountFn: func(_ int, _ realm) address {
			return caller
		},
		Token: tok,
	}
}

func (ledger *PrivateLedger) ImpersonateTeller(addr address) Teller {
	if ledger == nil {
		panic("Ledger cannot be nil")
	}
	return &fnTeller{
		accountFn: func(_ int, _ realm) address {
			return addr
		},
		Token: ledger.token,
	}
}

func (ft *fnTeller) guardHome(_ int, rlm realm) error {
	if !ft.homeGuard {
		return nil
	}
	if rlm.PkgPath() != ft.Token.origRealm {
		return ErrForeignCallerTeller
	}
	return nil
}

func (ft *fnTeller) Transfer(_ int, rlm realm, to address, amount int64) error {
	if ft.accountFn == nil {
		return ErrReadonly
	}
	if !rlm.IsCurrent() {
		return ErrSpoofedRealm
	}
	if err := ft.guardHome(0, rlm); err != nil {
		return err
	}
	caller := ft.accountFn(0, rlm)
	return ft.Token.ledger.Transfer(caller, to, amount)
}

func (ft *fnTeller) Approve(_ int, rlm realm, spender address, amount int64) error {
	if ft.accountFn == nil {
		return ErrReadonly
	}
	if !rlm.IsCurrent() {
		return ErrSpoofedRealm
	}
	if err := ft.guardHome(0, rlm); err != nil {
		return err
	}
	caller := ft.accountFn(0, rlm)
	return ft.Token.ledger.Approve(caller, spender, amount)
}

func (ft *fnTeller) TransferFrom(_ int, rlm realm, owner, to address, amount int64) error {
	if ft.accountFn == nil {
		return ErrReadonly
	}
	if !rlm.IsCurrent() {
		return ErrSpoofedRealm
	}
	if err := ft.guardHome(0, rlm); err != nil {
		return err
	}
	spender := ft.accountFn(0, rlm)
	return ft.Token.ledger.TransferFrom(owner, spender, to, amount)
}

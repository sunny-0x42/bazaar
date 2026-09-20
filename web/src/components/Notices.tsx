type Props = {
  wrongNet: boolean;
  chainId?: string;
  wantChainId: string;
  err: string;
  msg: string;
  busy: string;
};

export function Notices({ wrongNet, chainId, wantChainId, err, msg, busy }: Props) {
  return (
    <div className="notices" aria-live="polite">
      {wrongNet ? (
        <div className="banner-warn" role="alert">
          Adena is on {chainId}. Switch to {wantChainId} to buy or sell.
        </div>
      ) : null}
      {err ? (
        <div className="toast toast-err" role="alert">
          {err}
        </div>
      ) : null}
      {msg ? <div className="toast toast-ok">{msg}</div> : null}
      {busy ? <div className="toast toast-busy">Waiting for {busy}… Sign in Adena if a prompt is open.</div> : null}
    </div>
  );
}

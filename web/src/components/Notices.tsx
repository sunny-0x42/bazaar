import { useEffect } from "react";

type Props = {
  wrongNet: boolean;
  chainId?: string;
  wantChainId: string;
  err: string;
  msg: string;
  busy: string;
  onClearMsg: () => void;
  onClearErr: () => void;
};

export function Notices({
  wrongNet,
  chainId,
  wantChainId,
  err,
  msg,
  busy,
  onClearMsg,
  onClearErr,
}: Props) {
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(onClearMsg, 3200);
    return () => window.clearTimeout(t);
  }, [msg, onClearMsg]);

  useEffect(() => {
    if (!err) return;
    const t = window.setTimeout(onClearErr, 4800);
    return () => window.clearTimeout(t);
  }, [err, onClearErr]);

  if (!wrongNet && !err && !msg && !busy) return null;

  return (
    <div className="notices" aria-live="polite">
      {wrongNet ? (
        <div className="toast toast-warn" role="alert">
          Switch Adena to {wantChainId}
          {chainId ? ` (now ${chainId})` : ""}.
        </div>
      ) : null}
      {err ? (
        <div className="toast toast-err" role="alert" key={err}>
          {err}
        </div>
      ) : null}
      {msg ? (
        <div className="toast toast-ok" key={msg}>
          {msg}
        </div>
      ) : null}
      {busy ? <div className="toast toast-busy">Waiting for {busy}…</div> : null}
    </div>
  );
}

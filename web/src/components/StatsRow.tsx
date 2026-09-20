import { protocolFeeLabel } from "../lib/chain";

type Props = {
  open: number;
};

export function StatsRow({ open }: Props) {
  return (
    <div className="stats-row">
      <div>
        <span className="muted">Open listings</span>
        <strong className="num">{open}</strong>
      </div>
      <div>
        <span className="muted">Collection</span>
        <strong>Bazaar</strong>
      </div>
      <div>
        <span className="muted">Protocol fee</span>
        <strong className="num">{protocolFeeLabel()}</strong>
      </div>
    </div>
  );
}

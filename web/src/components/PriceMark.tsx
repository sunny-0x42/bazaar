import { gnotFromUgnot } from "../lib/chain";
import { useQuote } from "./Quote";

export function GnotIcon() {
  return <img className="gnot-icon" src="/gnot-token.svg" alt="" aria-hidden />;
}

export function PriceMark({
  ugnot,
  size,
  className = "",
}: {
  ugnot: number;
  size?: number;
  className?: string;
}) {
  const { quote, formatUgnot } = useQuote();
  const style = size ? { fontSize: size } : undefined;
  if (!(ugnot > 0) || !Number.isFinite(ugnot)) {
    return (
      <span className={`price-mark ${className}`} style={style}>
        —
      </span>
    );
  }
  if (quote === "usd") {
    return (
      <span className={`price-mark num ${className}`} style={style}>
        {formatUgnot(ugnot)}
      </span>
    );
  }
  return (
    <span className={`price-mark num ${className}`} style={style}>
      <GnotIcon />
      <span className="price-mark-amt">{gnotFromUgnot(ugnot)}</span>
    </span>
  );
}

import { symbolHue, tickerLetters } from "../lib/chain";

export function TokenMark({
  symbol,
  size = 56,
  fill = false,
}: {
  symbol: string;
  size?: number;
  fill?: boolean;
}) {
  const hue = symbolHue(symbol);
  const letters = tickerLetters(symbol);
  return (
    <div
      className={fill ? "token-mark token-mark-fill" : "token-mark"}
      style={{
        width: fill ? undefined : size,
        height: fill ? undefined : size,
        fontSize: fill ? undefined : size >= 56 ? 15 : 12,
        background: `linear-gradient(145deg, hsl(${hue} 44% 40%), hsl(${(hue + 28) % 360} 50% 22%))`,
      }}
      aria-hidden
    >
      {letters}
    </div>
  );
}

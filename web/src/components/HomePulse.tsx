import { useEffect, useMemo, useRef, useState } from "react";
import { UGNOT, type ChainCollection, type NetworkId } from "../lib/chain";
import { formatUsd } from "../lib/fx";
import { loadMonthPulse, pulsePacks, readPulse, warmPulsePacks, type PulseSnapshot } from "../lib/pulse";
import { GnotIcon } from "./PriceMark";
import { useQuote } from "./Quote";

function formatPulseAmount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const whole = Math.abs(n - Math.round(n)) < 1e-6;
  const shown = whole ? Math.round(n) : n;
  return shown.toLocaleString(undefined, {
    maximumFractionDigits: whole ? 0 : 2,
    minimumFractionDigits: whole ? 0 : 2,
  });
}

function PulseRoll({ digits }: { digits: number }) {
  const strip = "01234567890123456789".split("");
  return (
    <span className="pulse-roll" aria-hidden>
      {Array.from({ length: digits }, (_, index) => (
        <span key={index} style={{ animationDelay: `${index * 0.12}s` }}>
          {strip.map((digit, place) => (
            <span key={place}>{digit}</span>
          ))}
        </span>
      ))}
    </span>
  );
}

function PulseAnim({
  value,
  kind,
  rate,
  digits = 3,
}: {
  value: number | null;
  kind: "usd" | "gnot" | "int";
  rate: number;
  digits?: number;
}) {
  const shown =
    kind === "usd" ? (rate > 0 && value != null ? (value / UGNOT) * rate : null) : kind === "gnot" ? (value != null ? value / UGNOT : null) : value;
  const from = useRef(0);
  const prevKind = useRef(kind);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    if (shown == null) {
      setCurrent(null);
      return;
    }
    if (prevKind.current !== kind) {
      prevKind.current = kind;
      from.current = 0;
    }
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      from.current = shown;
      setCurrent(shown);
      return;
    }
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / 1100);
      const next = start + (shown - start) * (1 - (1 - progress) ** 3);
      from.current = next;
      setCurrent(next);
      if (progress < 1) frame = requestAnimationFrame(step);
      else from.current = shown;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [shown, kind]);

  if (current == null) return <PulseRoll digits={digits} />;
  if (kind === "int") return <>{Math.max(0, Math.round(current)).toLocaleString()}</>;
  if (kind === "usd") return <>{current > 0 ? formatUsd(current) : "$0"}</>;
  return <>{formatPulseAmount(current)}</>;
}

function PulseStat({
  label,
  value,
  kind,
  rate,
  digits,
}: {
  label: string;
  value: number | null;
  kind: "usd" | "gnot" | "int";
  rate: number;
  digits: number;
}) {
  return (
    <p className="pulse-stat">
      <span className="pulse-num">
        <PulseAnim value={value} kind={kind} rate={rate} digits={digits} />
      </span>
      <span className="pulse-label">{label}</span>
    </p>
  );
}

export function HomePulse({ collections, networkId }: { collections: ChainCollection[]; networkId: NetworkId }) {
  const { quote, gnotUsd } = useQuote();
  const packed = useMemo(() => pulsePacks(collections), [collections]);
  const colsRef = useRef(collections);
  colsRef.current = collections;
  const [pulse, setPulse] = useState<PulseSnapshot>(() => {
    const saved = readPulse("", networkId);
    if (!saved) return { state: "load" };
    return { state: "ok", vol: saved.vol, sales: saved.sales, traded: saved.traded, collections: saved.collections };
  });

  useEffect(() => {
    const saved = readPulse("", networkId);
    if (!saved?.packs?.length) return;
    warmPulsePacks(networkId, saved.packs);
  }, [networkId]);

  useEffect(() => {
    if (!packed.key) return;
    const saved = readPulse(packed.key);
    let live = true;
    if (saved) {
      setPulse({
        state: "ok",
        vol: saved.vol,
        sales: saved.sales,
        traded: saved.traded,
        collections: packed.packs.length,
      });
    } else {
      setPulse({ state: "load", collections: packed.packs.length });
    }
    void loadMonthPulse(networkId, colsRef.current, () => live, !!saved).then((next) => {
      if (live && next) setPulse(next);
    });
    return () => {
      live = false;
    };
  }, [packed.key, packed.packs.length, networkId]);

  const ready = pulse.state === "ok";
  const usd = quote === "usd";
  return (
    <section className="pulse" data-state={pulse.state} aria-label="Platform stats for the past 30 days" aria-busy={pulse.state === "load"}>
      <div className="pulse-main">
        <p className="pulse-window">Past 30 days</p>
        <p className="pulse-vol">
          <span className="pulse-num">
            <PulseAnim value={ready && pulse.vol != null ? pulse.vol : null} kind={usd ? "usd" : "gnot"} rate={gnotUsd} digits={5} />
          </span>
          {ready && !usd ? <GnotIcon /> : null}
          {ready && !usd ? <span className="pulse-unit">GNOT</span> : null}
        </p>
        <p className="pulse-note">{pulse.state === "fail" ? "Stats are unavailable right now." : "Sales and mints"}</p>
      </div>
      <PulseStat label="Sales" value={ready && pulse.sales != null ? pulse.sales : null} kind="int" rate={gnotUsd} digits={2} />
      <PulseStat
        label="Collections"
        value={pulse.collections != null && Number.isFinite(pulse.collections) ? pulse.collections : null}
        kind="int"
        rate={gnotUsd}
        digits={2}
      />
      <PulseStat
        label="Trade volume"
        value={ready && pulse.traded != null ? pulse.traded : null}
        kind={usd ? "usd" : "gnot"}
        rate={gnotUsd}
        digits={4}
      />
    </section>
  );
}

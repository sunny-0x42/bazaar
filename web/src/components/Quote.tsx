import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchGnotUsd, formatUgnot, loadQuote, saveQuote, type Quote } from "../lib/fx";

type QuoteCtx = {
  quote: Quote;
  gnotUsd: number;
  source: string;
  setQuote: (q: Quote) => void;
  formatUgnot: (ugnot: number) => string;
};

const Ctx = createContext<QuoteCtx | null>(null);

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [quote, setQuoteState] = useState<Quote>(loadQuote);
  const [gnotUsd, setGnotUsd] = useState(0);
  const [source, setSource] = useState("none");

  useEffect(() => {
    let live = true;
    void (async () => {
      const fx = await fetchGnotUsd();
      if (!live) return;
      setGnotUsd(fx.gnotUsd);
      setSource(fx.source);
    })();
    const id = window.setInterval(() => {
      void fetchGnotUsd().then((fx) => {
        if (!live) return;
        setGnotUsd(fx.gnotUsd);
        setSource(fx.source);
      });
    }, 60_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  function setQuote(q: Quote) {
    setQuoteState(q);
    saveQuote(q);
  }

  const value = useMemo<QuoteCtx>(
    () => ({
      quote,
      gnotUsd,
      source,
      setQuote,
      formatUgnot: (ugnot: number) => formatUgnot(ugnot, quote, gnotUsd),
    }),
    [quote, gnotUsd, source],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQuote(): QuoteCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      quote: "gnot",
      gnotUsd: 0,
      source: "none",
      setQuote: () => undefined,
      formatUgnot: (ugnot: number) => formatUgnot(ugnot, "gnot", 0),
    };
  }
  return ctx;
}

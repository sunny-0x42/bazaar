import { useEffect, useState } from "react";
import {
  artSrc,
  gnotFromUgnot,
  isArtSrc,
  isG1,
  ONYX_EDITION_PKG,
  ONYX_EFACTORY_PKG,
  parseEditionBook,
  parseEditions,
  parseEvalInt,
  parseEvalString,
  parseOpenListings,
  ugnotFromGnot,
  type EditionListing,
  type EditionRow,
  type Network,
} from "../lib/chain";
import { doContractCall, evalExpr, queryGasPrice } from "../lib/wallets";
import { ItemArt } from "./ItemArt";

const GAS_WANTED = 20_000_000;

type Props = {
  rpc: string;
  network: Network;
  address: string;
  connected: boolean;
  blocked: boolean;
  onConnect: () => void;
};

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function whole(raw: string): number {
  const s = raw.trim();
  if (!/^[1-9]\d*$/.test(s)) return 0;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : 0;
}

export function EditionsPage({ rpc, network, address, connected, blocked, onConnect }: Props) {
  const onyx = network.id === "onyx";
  const [loading, setLoading] = useState(onyx);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [reload, setReload] = useState(0);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [creator, setCreator] = useState("");
  const [royaltyBps, setRoyaltyBps] = useState(0);
  const [editions, setEditions] = useState<EditionRow[]>([]);
  const [listings, setListings] = useState<EditionListing[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [mintAmt, setMintAmt] = useState<Record<string, string>>({});
  const [listAmt, setListAmt] = useState<Record<string, string>>({});
  const [listPrice, setListPrice] = useState<Record<string, string>>({});
  const [sendTo, setSendTo] = useState<Record<string, string>>({});
  const [sendAmt, setSendAmt] = useState<Record<string, string>>({});
  const [buyAmt, setBuyAmt] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!onyx) return;
    let stop = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const [nm, sym, eds, open, book] = await Promise.all([
          evalExpr(rpc, ONYX_EDITION_PKG, "Name()"),
          evalExpr(rpc, ONYX_EDITION_PKG, "Symbol()"),
          evalExpr(rpc, ONYX_EDITION_PKG, "Editions()"),
          evalExpr(rpc, ONYX_EDITION_PKG, "OpenListings()"),
          evalExpr(rpc, ONYX_EFACTORY_PKG, "ListEditions()"),
        ]);
        if (stop) return;
        const rows = parseEditions(eds);
        const meta = parseEditionBook(book);
        const held: Record<string, number> = {};
        if (isG1(address)) {
          await Promise.all(
            rows.map(async (row) => {
              const raw = await evalExpr(rpc, ONYX_EDITION_PKG, `BalanceOf("${address}","${row.id}")`);
              held[row.id] = parseEvalInt(raw);
            }),
          );
        }
        if (stop) return;
        setName(parseEvalString(nm));
        setSymbol(parseEvalString(sym));
        setEditions(rows);
        setListings(parseOpenListings(open));
        setCreator(meta.creator);
        setRoyaltyBps(meta.royaltyBps);
        setBalances(held);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [onyx, rpc, address, reload]);

  async function sign(func: string, args: string[], send: string, pkg = ONYX_EDITION_PKG): Promise<void> {
    if (!connected || !isG1(address)) throw new Error("Connect Adena on Onyx first.");
    if (blocked) throw new Error(`Switch Adena to ${network.chainName} (${network.chainId}).`);
    const price = await queryGasPrice(rpc);
    const gasFee = Math.max(1, Math.ceil((GAS_WANTED * price.ugnot) / Math.max(1, price.gas)));
    const res = await doContractCall({
      caller: address,
      pkgPath: pkg,
      func,
      args,
      send,
      gasWanted: GAS_WANTED,
      gasFee,
      memo: "nomaq editions",
      network,
    });
    setNote(res.hash ? `Submitted ${res.hash.slice(0, 10)}…` : "Submitted.");
    setReload((n) => n + 1);
  }

  async function run(label: string, job: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNote("");
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  if (!onyx) {
    return (
      <section className="page">
        <header className="page-head">
          <p className="explore-kicker">Editions</p>
          <h1>Trial prints</h1>
        </header>
        <p className="notice">This trial is on Onyx. The mainnet book does not include it.</p>
      </section>
    );
  }

  const mine = creator && same(address, creator);

  return (
    <section className="page editions-page">
      <header className="page-head">
        <p className="explore-kicker">Onyx trial</p>
        <h1>{name || "Trial prints"}</h1>
        <p className="muted">
          {symbol ? `${symbol}. ` : ""}
          One id is one edition. List locks copies in this realm until Cancel or Buy. A buy can take part of a listing.
          Primary mint pays the creator. A secondary buy pays the edition-factory fee plus royalty
          {royaltyBps > 0 ? ` (${(royaltyBps / 100).toFixed(2)}%)` : ""}. This book is not Bazaar Gens and it does not
          join the holder pool. Adena’s NFT grid does not list these copies.
        </p>
      </header>

      {error ? <p className="notice err">{error}</p> : null}
      {note ? <p className="notice">{note}</p> : null}
      {loading ? <p className="muted">Reading the edition realm…</p> : null}
      {!connected ? (
        <button className="btn primary" type="button" onClick={onConnect}>
          Connect Adena
        </button>
      ) : null}

      <div className="edition-grid">
        {editions.map((row) => {
          const held = balances[row.id] || 0;
          const mintN = whole(mintAmt[row.id] || "1");
          const listN = whole(listAmt[row.id] || "1");
          const unit = ugnotFromGnot(listPrice[row.id] || "");
          const sendN = whole(sendAmt[row.id] || "1");
          const to = (sendTo[row.id] || "").trim();
          const mintSend = mine || row.mintPrice <= 0 ? "" : `${row.mintPrice * mintN}ugnot`;
          const canMint = mintN > 0 && row.minted + mintN <= row.max && (mine || row.mintPrice > 0);
          const canList = listN > 0 && listN <= held && unit > 0;
          const canSend = sendN > 0 && sendN <= held && isG1(to) && !same(to, address);
          return (
            <article className="listing-card edition-card" key={row.id}>
              <div className="listing-card-media">
                {isArtSrc(row.image) ? <ItemArt name={row.name} image={artSrc(row.image)} priority /> : null}
              </div>
              <h2>{row.name}</h2>
              <p className="listing-id">
                {row.id} · {row.minted}/{row.max} minted
              </p>
              <p className="listing-price">
                {gnotFromUgnot(row.mintPrice)} <span>GNOT mint</span>
              </p>
              {isG1(address) ? <p className="listing-id">You hold {held}</p> : null}
              <div className="panel edition-actions">
                <label>
                  Mint copies
                  <input
                    value={mintAmt[row.id] ?? "1"}
                    inputMode="numeric"
                    onChange={(e) => setMintAmt((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />
                </label>
                <button
                  className="btn primary"
                  type="button"
                  disabled={!connected || blocked || !!busy || !canMint}
                  onClick={() =>
                    void run("Mint", () => sign("Mint", [row.id, address, String(mintN)], mintSend))
                  }
                >
                  {busy === "Mint" ? "Minting…" : mine ? "Mint" : `Mint · ${gnotFromUgnot(row.mintPrice * mintN)} GNOT`}
                </button>
                <label>
                  List copies
                  <input
                    value={listAmt[row.id] ?? "1"}
                    inputMode="numeric"
                    onChange={(e) => setListAmt((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />
                </label>
                <label>
                  Unit price (GNOT)
                  <input
                    value={listPrice[row.id] ?? ""}
                    inputMode="decimal"
                    placeholder="2"
                    onChange={(e) => setListPrice((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />
                </label>
                <button
                  className="btn"
                  type="button"
                  disabled={!connected || blocked || !!busy || !canList}
                  onClick={() => void run("List", () => sign("List", [row.id, String(listN), String(unit)], ""))}
                >
                  {busy === "List" ? "Listing…" : "List"}
                </button>
                <label>
                  Send to
                  <input
                    value={sendTo[row.id] ?? ""}
                    placeholder="g1…"
                    onChange={(e) => setSendTo((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />
                </label>
                <label>
                  Send copies
                  <input
                    value={sendAmt[row.id] ?? "1"}
                    inputMode="numeric"
                    onChange={(e) => setSendAmt((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />
                </label>
                <button
                  className="btn"
                  type="button"
                  disabled={!connected || blocked || !!busy || !canSend}
                  onClick={() => void run("Transfer", () => sign("Transfer", [to, row.id, String(sendN)], ""))}
                >
                  {busy === "Transfer" ? "Sending…" : "Transfer"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <section className="panel edition-book">
        <h2>Open listings</h2>
        {listings.length === 0 ? <p className="muted">No open listing.</p> : null}
        {listings.map((row) => {
          const key = `${row.seller}|${row.id}`;
          const n = whole(buyAmt[key] || "1");
          const own = same(address, row.seller);
          const edition = editions.find((ed) => ed.id === row.id);
          return (
            <div className="edition-listing" key={key}>
              <p>
                <strong>{edition?.name || row.id}</strong>
                <span className="muted">
                  {" "}
                  {row.amount} at {gnotFromUgnot(row.unit)} GNOT · {row.seller.slice(0, 8)}…
                </span>
              </p>
              {own ? (
                <button
                  className="btn"
                  type="button"
                  disabled={!connected || blocked || !!busy}
                  onClick={() => void run("Cancel", () => sign("Cancel", [row.id], ""))}
                >
                  {busy === "Cancel" ? "Cancelling…" : "Cancel"}
                </button>
              ) : (
                <div className="edition-buy">
                  <label>
                    Buy copies
                    <input
                      value={buyAmt[key] ?? "1"}
                      inputMode="numeric"
                      onChange={(e) => setBuyAmt((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </label>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={!connected || blocked || !!busy || n < 1 || n > row.amount}
                    onClick={() =>
                      void run("Buy", () => sign("Buy", [row.seller, row.id, String(n)], `${row.unit * n}ugnot`))
                    }
                  >
                    {busy === "Buy" ? "Buying…" : `Buy · ${gnotFromUgnot(row.unit * n)} GNOT`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <p className="mono footer-pkg">{ONYX_EDITION_PKG}</p>
    </section>
  );
}

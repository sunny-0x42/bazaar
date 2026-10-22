import type { Network } from "./chain";
import { PEARL } from "./chain";
import { adenaIndexerOrigin } from "./indexer";

export function hasAdena(): boolean {
  return typeof window !== "undefined" && !!window.adena;
}

function assertAdena(): NonNullable<Window["adena"]> {
  if (!hasAdena() || !window.adena) throw new Error("Install Adena at https://adena.app/");
  return window.adena;
}

function explainAdenaError(msg: string, res?: { type?: string; code?: number }): string {
  const raw = String(msg || "");
  if (/unauthorizederror|signature is unauthorized|signature verification failed|unauthorized/i.test(raw)) {
    return (
      "Adena signature was rejected (UnauthorizedError). Switch Adena to this site's network, " +
      "disconnect this site, unlock, reconnect, then retry. Do not mix Mainnet, Pearl, Sapphire, or a custom RPC."
    );
  }
  return raw || res?.type || `Adena error ${res?.code ?? ""}`.trim();
}

function ok(res: { code?: number; status?: string; type?: string; message?: string } | null) {
  if (!res) throw new Error("Adena did not respond");
  if (res.code === 0 || res.status === "success") return res;
  if (res.type === "CONNECTION_SUCCESS" || /already/i.test(res.message || "")) return res;
  throw new Error(explainAdenaError(res.message || res.type || "", res));
}

export async function connectAdena(
  net: Network,
): Promise<{ address: string; coins: string; chainId: string }> {
  const adena = assertAdena();
  const est = await adena.AddEstablish("Nomaq");
  if (est && est.code !== 0 && est.type !== "CONNECTION_SUCCESS" && !/already/i.test(est.message || "")) {
    if (est.code !== 4000 && est.code !== 4001) ok(est);
  }
  await ensureAdenaNetwork(adena, net);
  const acc = ok(await adena.GetAccount()) as { data?: { address?: string; coins?: string; chainId?: string } };
  const d = acc.data || {};
  if (!d.address || !/^g1/i.test(d.address)) throw new Error("Adena did not return a g1 address");
  const chainId = (d.chainId || "").trim();
  if (!chainId) throw new Error(`Adena did not report a chain. Switch to ${net.chainName} (${net.chainId}).`);
  if (chainId !== net.chainId) {
    throw new Error(`Adena is on ${chainId}. Switch to ${net.chainName} (${net.chainId}) and reconnect.`);
  }
  return { address: d.address, coins: d.coins || "", chainId };
}

export async function disconnectAdena(): Promise<void> {
  if (!hasAdena() || !window.adena?.Disconnect) return;
  try {
    await window.adena.Disconnect();
  } catch {
    /* session is still cleared in the app */
  }
}

async function ensureAdenaNetwork(adena: NonNullable<Window["adena"]>, net: Network) {
  try {
    const acc = await adena.GetAccount();
    const live = String(acc?.data?.chainId || "").trim();
    if (live === net.chainId) return;
  } catch {
    /* not connected yet */
  }
  // Do not AddNetwork for built-in Adena nets — a custom entry can shadow RPC.
  const builtIn =
    net.chainId === "pearl-1" ||
    net.chainId === "gnoland-1" ||
    net.id === "pearl" ||
    net.id === "mainnet";
  if (!builtIn) {
    let rpcUrl = net.rpcUrl.replace(/\/$/, "");
    if (/^https:\/\/(127\.0\.0\.1|localhost)/i.test(rpcUrl)) {
      rpcUrl = rpcUrl.replace(/^https:/i, "http:");
    }
    try {
      const indexerUrl = adenaIndexerOrigin(net.id);
      // Adena 1.21.6 stores this empty on approve. The mint page tells the user to set it.
      await adena.AddNetwork({
        chainId: net.chainId,
        chainName: net.chainName,
        rpcUrl,
        ...(indexerUrl ? { indexerUrl } : {}),
      });
    } catch {
      /* already added */
    }
  }
  let switched = false;
  for (const arg of [net.chainId, { chainId: net.chainId }] as const) {
    try {
      const sw = await adena.SwitchNetwork(arg);
      if (sw && (sw.code === 0 || sw.status === "success" || /same|success/i.test(sw.type || sw.message || ""))) {
        switched = true;
        break;
      }
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e).toLowerCase();
      if (msg.includes("same")) {
        switched = true;
        break;
      }
    }
  }
  if (!switched && builtIn) {
    throw new Error(
      `Adena did not switch to ${net.chainName} (${net.chainId}). In Adena: Change Network to the built-in ${net.chainName}. ` +
        "Remove any custom entry for that chainId. Then disconnect this site and Connect again.",
    );
  }
}

function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(s: string): string {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function abciErrorMessage(log: string, fallback: string): string {
  const pkg = log.match(/package not found:\s*([^\n]+)/i);
  if (pkg) return `Realm not on this chain yet: ${pkg[1].trim()}`;
  const missingNode = log.match(/unexpected node with location\s+(gno\.land\/[^\s:]+)/i);
  if (missingNode) return `Realm not on this chain yet: ${missingNode[1].trim()}`;
  if (/InternalError/i.test(log) && /unexpected node/i.test(log)) {
    return "Realm not on this chain yet. Run local gnodev or deploy the NFT package.";
  }
  if (/nft:\s*self buy/i.test(log)) {
    return "This is your listing. Connect a different Adena account to buy, or Cancel.";
  }
  const undeclared = log.match(/name\s+(\w+)\s+not declared/i);
  if (undeclared) {
    const fn = undeclared[1];
    if (/^(Offer|CancelOffer|AcceptOffer|InstantSell|ListOffers)$/i.test(fn)) {
      return `This NFT package has no ${fn}. Point Settings at nftv7 (or a newer last path).`;
    }
    if (/^Init$/i.test(fn)) {
      return "This collection package has no Init. Wait until local gnodev loads gno.land/r/bazaar/c/{slug}, then retry.";
    }
    if (/^(Sweep|DepositPool|WithdrawPool|DepositNftPool|LaunchCollection|AddDropItems|AddAllowlist|SetDropSale|SetMintCap|SetPhaseMintCap|SetMintSchedule|SetHidden|SetPrereveal|RevealCollection|Reveal)$/i.test(fn)) {
      return `This NFT package has no ${fn}. Deploy a newer module path and point Settings at it.`;
    }
    return `This package has no ${fn}.`;
  }
  const panic = log.match(/VM panic:\s*([^\n]+)/i);
  if (panic) return panic[1].trim();
  const first = log
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("--") && !l.startsWith("Data:") && !l.startsWith("Stack"));
  return first || fallback;
}

export type ContractMsg = {
  pkgPath: string;
  func: string;
  args?: string[];
  send?: string;
};

/** Latest committed block. null when status does not include a height and time. */
export async function fetchChainHead(rpcUrl: string): Promise<{ height: number; time: number } | null> {
  try {
    const r = await fetch(rpcUrl.replace(/\/$/, ""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "status", params: {} }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const info = j?.result?.sync_info;
    const height = Math.floor(Number(info?.latest_block_height));
    const ms = Date.parse(String(info?.latest_block_time || ""));
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(ms)) return null;
    return { height, time: Math.floor(ms / 1000) };
  } catch {
    return null;
  }
}

/** Unix seconds of a committed block. null when the RPC does not return a header time. */
export async function fetchBlockUnix(rpcUrl: string, height: number): Promise<number | null> {
  const h = Math.floor(height);
  if (!Number.isFinite(h) || h <= 0) return null;
  try {
    const r = await fetch(rpcUrl.replace(/\/$/, ""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "block",
        params: { height: String(h) },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const time = j?.result?.block?.header?.time;
    if (typeof time !== "string" || !time) return null;
    const ms = Date.parse(time);
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / 1000);
  } catch {
    return null;
  }
}

/** Current floor is 1 ugnot per 1000 gas. Launch uses this instead of a flat 2 GNOT. */
export async function queryGasPrice(rpcUrl: string): Promise<{ gas: number; ugnot: number }> {
  try {
    const text = await abciQuery(rpcUrl, "auth/gasprice", "");
    const gas = Number(text.match(/"gas"\s*:\s*"(\d+)"/)?.[1] || 0);
    const ugnot = Number(text.match(/"price"\s*:\s*"(\d+)\s*ugnot"/i)?.[1] || 0);
    if (gas > 0 && ugnot > 0) return { gas, ugnot };
  } catch {
    /* floor below */
  }
  return { gas: 1000, ugnot: 1 };
}

async function submitContract({
  caller,
  messages,
  gasWanted,
  gasFee,
  memo,
  network,
}: {
  caller: string;
  messages: ContractMsg[];
  gasWanted: number;
  gasFee: number;
  memo: string;
  network: Network;
}): Promise<{ ok: true; hash: string; height: string }> {
  if (messages.length === 0) throw new Error("No contract messages.");
  for (const msg of messages) {
    if (!msg.pkgPath.trim()) throw new Error("Set the NFT package path first (after Pearl addpkg).");
  }
  const adena = assertAdena();
  await ensureAdenaNetwork(adena, network);
  const acc = ok(await adena.GetAccount()) as { data?: { address?: string; chainId?: string } };
  const live = (acc.data?.chainId || "").trim();
  if (live && live !== network.chainId) {
    throw new Error(`Adena is on ${live}. Switch to ${network.chainName} (${network.chainId}) before signing.`);
  }
  const signer = (acc.data?.address || caller).trim();
  if (signer.toLowerCase() !== caller.toLowerCase()) {
    throw new Error("Adena account changed. Reconnect, then Buy again.");
  }
  // Same shape as gnomi.fun (works on Pearl). Do not wrap in `tx` or add max_deposit —
  // those break Adena's sign doc and the node returns UnauthorizedError.
  const contractPayload = {
    messages: messages.map((msg) => ({
      type: "/vm.m_call",
      value: {
        caller: signer,
        send: msg.send || "",
        pkg_path: msg.pkgPath.trim(),
        func: msg.func,
        args: (msg.args || []).map(String),
      },
    })),
    gasFee,
    gasWanted,
    memo,
  };
  let res: { code?: number; status?: string; type?: string; message?: string; data?: { hash?: string; height?: number | string } };
  try {
    res = await adena.DoContract(contractPayload);
  } catch (e) {
    const em = String(e instanceof Error ? e.message : e);
    if (/connection has not been established/i.test(em)) {
      await adena.AddEstablish("Nomaq");
      res = await adena.DoContract(contractPayload);
    } else {
      throw new Error(explainAdenaError(em));
    }
  }
  ok(res);
  const data = res.data || {};
  return { ok: true, hash: data.hash || "", height: String(data.height || "") };
}

export async function doContractCall({
  caller,
  pkgPath,
  func,
  args = [],
  send = "",
  gasWanted = 50_000_000,
  gasFee = 2_000_000,
  memo = "bazaar",
  network = PEARL,
}: {
  caller: string;
  pkgPath: string;
  func: string;
  args?: string[];
  send?: string;
  gasWanted?: number;
  gasFee?: number;
  memo?: string;
  network?: Network;
}): Promise<{ ok: true; hash: string; height: string }> {
  return submitContract({
    caller,
    messages: [{ pkgPath, func, args, send }],
    gasWanted,
    gasFee,
    memo,
    network,
  });
}

/** Several MsgCall values in one Adena signature. One fee for the whole list. */
export async function doContractCalls({
  caller,
  messages,
  gasWanted,
  gasFee,
  memo = "bazaar",
  network = PEARL,
}: {
  caller: string;
  messages: ContractMsg[];
  gasWanted: number;
  gasFee: number;
  memo?: string;
  network?: Network;
}): Promise<{ ok: true; hash: string; height: string }> {
  return submitContract({ caller, messages, gasWanted, gasFee, memo, network });
}

/**
 * ugnot on this account. null when every query failed, so a poll can keep the last balance.
 * 0 means the chain answered and this account has no ugnot.
 */
export async function readBankUgnot(rpcUrl: string, addr: string): Promise<number | null> {
  const who = addr.trim();
  if (!who) return 0;
  const paths = [`auth/accounts/${who}`, `bank/balances/${who}`];
  let saw = false;
  for (const path of paths) {
    try {
      const r = await fetch(rpcUrl.replace(/\/$/, ""), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "abci_query",
          params: { path, data: "", prove: false },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j.error) continue;
      const resp = j?.result?.response || {};
      const base = resp.ResponseBase || {};
      if (base.Error) continue;
      saw = true;
      const raw = base.Data || resp.value || resp.Value || "";
      if (!raw) continue;
      let text = "";
      try {
        text = atob(String(raw).replace(/-/g, "+").replace(/_/g, "/"));
      } catch {
        text = String(raw);
      }
      const m = text.match(/(\d+)\s*ugnot/i);
      if (m) return Number(m[1]);
      const n = text.match(/"amount"\s*:\s*"(\d+)"/);
      if (n) return Number(n[1]);
    } catch {
      /* try next path */
    }
  }
  return saw ? 0 : null;
}

export async function fetchBankUgnot(rpcUrl: string, addr: string): Promise<number> {
  const n = await readBankUgnot(rpcUrl, addr);
  return n ?? 0;
}

async function abciQuery(rpcUrl: string, path: string, data: string): Promise<string> {
  const r = await fetch(rpcUrl.replace(/\/$/, ""), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "abci_query",
      params: { path, data: toBase64(data), prove: false },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.data || j.error.message || "RPC error");
  const resp = j?.result?.response || {};
  const base = resp.ResponseBase || {};
  if (base.Error) throw new Error(abciErrorMessage(String(base.Log || ""), "query failed"));
  const raw = base.Data || resp.value || resp.Value || "";
  if (!raw) return "";
  try {
    return fromBase64(raw);
  } catch {
    return String(raw);
  }
}

export async function queryAbci(rpcUrl: string, path: string, data: string): Promise<string> {
  return abciQuery(rpcUrl, path, data);
}

export async function evalExpr(rpcUrl: string, pkgPath: string, expr: string): Promise<string> {
  const pkg = pkgPath.trim().replace(/\/+$/, "");
  const expression = expr.trim();
  if (!pkg) throw new Error("Set the package path first.");
  if (!expression) throw new Error("Empty eval expression");
  return abciQuery(rpcUrl, "vm/qeval", `${pkg}.${expression}`);
}

/** Empty string when the package was never submitted. Inert means addpkg landed and GPAO has not enabled it. */
export async function queryPkgMeta(rpcUrl: string, pkgPath: string): Promise<string> {
  const pkg = pkgPath.trim().replace(/\/+$/, "");
  if (!pkg) return "";
  try {
    return await abciQuery(rpcUrl, "vm/qpkgmeta_json", pkg);
  } catch {
    return "";
  }
}

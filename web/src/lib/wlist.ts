export const WLIST_CAP = 333;
export const GENESIS_SUPPLY = 1111;

export const GENESIS_RARITIES = [
  { rarity: "Common", supply: 666, discount: "25 bps", protocolAfter: "1.75%", shareWeight: "25" },
  { rarity: "Uncommon", supply: 222, discount: "50 bps", protocolAfter: "1.50%", shareWeight: "50" },
  { rarity: "Rare", supply: 111, discount: "75 bps", protocolAfter: "1.25%", shareWeight: "75" },
  { rarity: "Epic", supply: 66, discount: "100 bps", protocolAfter: "1.00%", shareWeight: "100" },
  { rarity: "Legendary", supply: 33, discount: "125 bps", protocolAfter: "0.75%", shareWeight: "125" },
  { rarity: "Mythic", supply: 13, discount: "150 bps", protocolAfter: "0.50%", shareWeight: "150" },
] as const;
export const WLIST_OPENS_AT = 1_790_553_600;
export const WLIST_OPENS_UTC_MS = WLIST_OPENS_AT * 1000;
export const WLIST_EARLY_MS = 5 * 3600 * 1000;

export function crewTitle(place: number): string {
  if (place <= 13) return "MYTHIC CREW";
  if (place <= 46) return "LEGENDARY CREW";
  if (place <= 112) return "EPIC CREW";
  return "BAZAAR GENS CREW";
}

export type WlistRow = {
  place: number;
  address: string;
  handle: string;
  at: string;
  seeded?: boolean;
};

export type WlistState = { rows: WlistRow[] };

export type WlistStats = {
  cap: number;
  count: number;
  opensAt: number;
  registered: boolean;
  place: number;
  handle: string;
  rows?: WlistRow[];
};

export function wlistUrl(): string {
  return import.meta.env.DEV ? "/local/wlist" : "/api/wlist";
}

export function isG1(addr: string): boolean {
  return /^g1[0-9a-z]{38,}$/.test(addr.trim());
}

export function applyWlistSubmit(
  state: WlistState,
  input: { address: string; handle: string; nowMs: number },
): { ok: true; state: WlistState; row: WlistRow } | { ok: false; error: "not open" | "handle" | "wallet" | "already" | "full" } {
  const address = input.address.trim().toLowerCase();
  const handle = input.handle.trim();
  if (!isG1(address)) return { ok: false, error: "wallet" };
  if (!handle || handle.length > 32 || !/^[A-Za-z0-9_]+$/.test(handle)) return { ok: false, error: "handle" };
  const rows = state.rows || [];
  const existing = rows.find((row) => row.address.toLowerCase() === address);
  if (existing) {
    if (existing.handle) return { ok: false, error: "already" };
    if (rows.some((row) => row.handle && row.handle.toLowerCase() === handle.toLowerCase())) {
      return { ok: false, error: "already" };
    }
    const row: WlistRow = { ...existing, handle, at: new Date(input.nowMs).toISOString() };
    return { ok: true, state: { rows: rows.map((r) => (r.address.toLowerCase() === address ? row : r)) }, row };
  }
  if (Math.floor(input.nowMs / 1000) < WLIST_OPENS_AT) return { ok: false, error: "not open" };
  if (rows.some((row) => row.handle && row.handle.toLowerCase() === handle.toLowerCase())) {
    return { ok: false, error: "already" };
  }
  if (rows.length >= WLIST_CAP) return { ok: false, error: "full" };
  const row: WlistRow = {
    place: rows.length + 1,
    address,
    handle,
    at: new Date(input.nowMs).toISOString(),
  };
  return { ok: true, state: { rows: [...rows, row] }, row };
}

export function wlistCsv(rows: WlistRow[]): string {
  const head = "place,address,handle,submitted_at_utc";
  const body = rows
    .map((row) => `${row.place},${row.address},${row.handle ? `@${row.handle}` : ""},${row.at}`)
    .join("\n");
  return body ? `${head}\n${body}\n` : `${head}\n`;
}

export async function fetchWlist(opts?: { address?: string; full?: boolean }): Promise<WlistStats> {
  const u = new URL(wlistUrl(), window.location.origin);
  if (opts?.address) u.searchParams.set("addr", opts.address);
  if (opts?.full) u.searchParams.set("full", "1");
  const res = await fetch(`${u.pathname}${u.search}`);
  if (!res.ok) throw new Error("Whitelist store is unavailable.");
  return (await res.json()) as WlistStats;
}

export async function patchWlist(patch: {
  address: string;
  handle?: string;
  newAddress?: string;
}): Promise<{ count: number }> {
  const res = await fetch(wlistUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; count?: number };
  if (!res.ok || !data.ok) throw new Error("Update failed.");
  return { count: data.count || 0 };
}

export async function removeWlist(address: string): Promise<{ count: number }> {
  const res = await fetch(wlistUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remove: address }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; count?: number };
  if (!res.ok || !data.ok) throw new Error("Remove failed.");
  return { count: data.count || 0 };
}

export async function seedWlist(addresses: string[]): Promise<{ count: number; added: number }> {
  const res = await fetch(wlistUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seed: addresses }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; count?: number; added?: number };
  if (!res.ok || !data.ok) throw new Error("Seed failed.");
  return { count: data.count || 0, added: data.added || 0 };
}

export async function postWlist(address: string, handle: string): Promise<{ place: number; count: number; handle: string }> {
  const res = await fetch(wlistUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, handle }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; place?: number; count?: number; handle?: string };
  if (!res.ok || !data.ok) {
    const err = data.error || "submit";
    throw new Error(
      err === "not open"
        ? "Not open yet."
        : err === "full"
          ? "List is full."
          : err === "already"
            ? "This wallet or handle is already on the list."
            : err === "handle"
              ? "Enter a valid X handle."
              : err === "wallet"
                ? "Connect Adena."
                : "Submit failed.",
    );
  }
  return { place: data.place || 0, count: data.count || 0, handle: data.handle || handle };
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

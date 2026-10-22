import fs from "node:fs";
import path from "node:path";

export const CAP = 333;
export const OPENS_AT = 1_790_553_600;
export const EARLY_SECS = 5 * 3600;

export function emptyState() {
  return { rows: [] };
}

export function readState(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
    return { rows };
  } catch {
    return emptyState();
  }
}

export function writeState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ cap: CAP, opensAt: OPENS_AT, rows: state.rows }, null, 2));
}

export function normalizeHandle(raw) {
  let s = String(raw || "").trim();
  if (s.startsWith("@")) s = s.slice(1);
  s = s.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "");
  const cut = s.search(/[/?]/);
  if (cut >= 0) s = s.slice(0, cut);
  if (!s || s.length > 32 || !/^[A-Za-z0-9_]+$/.test(s)) return "";
  return s;
}

export function seedRows(state, addresses) {
  const rows = [...(state.rows || [])];
  let added = 0;
  for (const raw of addresses || []) {
    const addr = String(raw || "").trim();
    if (!/^g1[0-9a-z]{38,}$/.test(addr)) continue;
    if (rows.some((row) => row.address === addr)) continue;
    if (rows.length >= CAP) break;
    rows.push({
      place: rows.length + 1,
      address: addr,
      handle: "",
      at: new Date().toISOString(),
      seeded: true,
    });
    added++;
  }
  return { ok: true, added, state: { rows } };
}

export function addRow(state, { address, handle, nowMs }) {
  const addr = String(address || "").trim().toLowerCase();
  const x = normalizeHandle(handle);
  const nowSec = Math.floor(nowMs / 1000);
  if (!/^g1[0-9a-z]{38,}$/.test(addr)) return { ok: false, error: "wallet" };
  if (!x) return { ok: false, error: "handle" };
  const rows = state.rows || [];
  const existing = rows.find((row) => String(row.address).toLowerCase() === addr);
  if (existing) {
    if (existing.handle) return { ok: false, error: "already" };
    if (rows.some((row) => row.handle && String(row.handle).toLowerCase() === x.toLowerCase())) {
      return { ok: false, error: "already" };
    }
    const row = { ...existing, handle: x, at: new Date(nowMs).toISOString() };
    return { ok: true, state: { rows: rows.map((r) => (String(r.address).toLowerCase() === addr ? row : r)) }, row };
  }
  if (nowSec < OPENS_AT) return { ok: false, error: "not open" };
  if (rows.some((row) => String(row.handle).toLowerCase() === x.toLowerCase())) {
    return { ok: false, error: "already" };
  }
  if (rows.length >= CAP) return { ok: false, error: "full" };
  const row = { place: rows.length + 1, address: addr, handle: x, at: new Date(nowMs).toISOString(), seeded: false };
  return { ok: true, state: { rows: [...rows, row] }, row };
}

function reindex(rows) {
  return rows.map((row, i) => ({ ...row, place: i + 1 }));
}

export function removeRow(state, address) {
  const addr = String(address || "").trim();
  const rows = (state.rows || []).filter((row) => row.address !== addr);
  if (rows.length === (state.rows || []).length) return { ok: false, error: "missing" };
  return { ok: true, state: { rows: reindex(rows) } };
}

export function patchRow(state, { address, handle, newAddress }) {
  const addr = String(address || "").trim();
  const rows = [...(state.rows || [])];
  const i = rows.findIndex((row) => row.address === addr);
  if (i < 0) return { ok: false, error: "missing" };
  let nextAddr = addr;
  if (newAddress != null && String(newAddress).trim() !== "") {
    const n = String(newAddress).trim();
    if (!/^g1[0-9a-z]{38,}$/.test(n)) return { ok: false, error: "wallet" };
    if (rows.some((row, j) => j !== i && row.address === n)) return { ok: false, error: "already" };
    nextAddr = n;
  }
  let h = rows[i].handle || "";
  if (handle != null) {
    const raw = String(handle).trim();
    if (raw === "") {
      h = "";
    } else {
      const x = normalizeHandle(raw);
      if (!x) return { ok: false, error: "handle" };
      if (rows.some((row, j) => j !== i && row.handle && String(row.handle).toLowerCase() === x.toLowerCase())) {
        return { ok: false, error: "already" };
      }
      h = x;
    }
  }
  rows[i] = { ...rows[i], address: nextAddr, handle: h };
  return { ok: true, state: { rows }, row: rows[i] };
}

export function stats(state, { address, full } = {}) {
  const rows = state.rows || [];
  const out = { cap: CAP, count: rows.length, opensAt: OPENS_AT, registered: false, place: 0, handle: "" };
  if (address) {
    const want = String(address).trim().toLowerCase();
    const hit = rows.find((row) => String(row.address).toLowerCase() === want);
    if (hit) {
      out.registered = true;
      out.place = hit.place;
      out.handle = hit.handle;
    }
  }
  if (full) out.rows = rows;
  return out;
}

export async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export function sendJson(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

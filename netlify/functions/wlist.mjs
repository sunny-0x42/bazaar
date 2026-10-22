import { connectLambda, getStore } from "@netlify/blobs";
import { addRow, patchRow, removeRow, seedRows, stats } from "../../web/server/wlist-store.mjs";
import { updateWlist } from "../../web/server/wlist-durable.mjs";

const KEY = "state";

function blobs() {
  return getStore("bazaar-wlist");
}

function io() {
  const store = blobs();
  return {
    async read() {
      const got = await store.getWithMetadata(KEY, { type: "json" });
      if (!got || got.data == null) return { state: { rows: [] }, etag: "" };
      const rows = Array.isArray(got.data.rows) ? got.data.rows : [];
      return { state: { rows }, etag: got.etag || "" };
    },
    async write(state, etag) {
      const opts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
      const saved = await store.setJSON(KEY, state, opts);
      return !!saved.modified;
    },
    async wait() {
      await new Promise((resolve) => setTimeout(resolve, 400));
    },
  };
}

function reply(code, body) {
  return {
    statusCode: code,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  connectLambda(event);
  const qs = event.queryStringParameters || {};
  const disk = io();
  if (event.httpMethod === "GET") {
    try {
      const current = await disk.read();
      return reply(200, stats(current.state, { address: qs.addr || "", full: qs.full === "1" }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "store";
      return reply(500, { ok: false, error: message });
    }
  }
  if (event.httpMethod !== "POST") {
    return reply(405, { ok: false, error: "POST" });
  }
  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    body = {};
  }
  try {
    if (Array.isArray(body.seed)) {
      const result = await updateWlist(disk, (state) => seedRows(state, body.seed));
      if (!result.state) return reply(400, { ok: false, error: result.error || "conflict" });
      return reply(200, { ok: true, added: result.added, count: result.state.rows.length, rows: result.state.rows });
    }
    if (body.remove) {
      const result = await updateWlist(disk, (state) => removeRow(state, body.remove));
      if (!result.ok) return reply(400, { ok: false, error: result.error });
      return reply(200, { ok: true, count: result.state.rows.length, rows: result.state.rows });
    }
    if (body.patch) {
      const result = await updateWlist(disk, (state) => patchRow(state, body.patch));
      if (!result.ok) return reply(400, { ok: false, error: result.error });
      return reply(200, { ok: true, count: result.state.rows.length, row: result.row, rows: result.state.rows });
    }
    const result = await updateWlist(disk, (state) => addRow(state, { address: body.address, handle: body.handle, nowMs: Date.now() }));
    if (!result.ok) return reply(400, { ok: false, error: result.error });
    return reply(200, {
      ok: true,
      place: result.row.place,
      count: result.state.rows.length,
      handle: result.row.handle,
      address: result.row.address,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "store";
    return reply(500, { ok: false, error: message });
  }
}

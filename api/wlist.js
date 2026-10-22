const path = require("node:path");
const os = require("node:os");

const FILE = process.env.WLIST_FILE || path.join(os.tmpdir(), "bazaar-wlist.json");

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const store = await import("../web/server/wlist-store.mjs");
  const url = new URL(req.url || "", "http://127.0.0.1");
  if (req.method === "GET") {
    const state = store.readState(FILE);
    json(
      res,
      200,
      store.stats(state, { address: url.searchParams.get("addr") || "", full: url.searchParams.get("full") === "1" }),
    );
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST" });
    return;
  }
  let body = {};
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    body = {};
  }
  const state = store.readState(FILE);
  if (Array.isArray(body.seed)) {
    const result = store.seedRows(state, body.seed);
    store.writeState(FILE, result.state);
    json(res, 200, { ok: true, added: result.added, count: result.state.rows.length, rows: result.state.rows });
    return;
  }
  if (body.remove) {
    const result = store.removeRow(state, body.remove);
    if (!result.ok) {
      json(res, 400, { ok: false, error: result.error });
      return;
    }
    store.writeState(FILE, result.state);
    json(res, 200, { ok: true, count: result.state.rows.length, rows: result.state.rows });
    return;
  }
  if (body.patch) {
    const result = store.patchRow(state, body.patch);
    if (!result.ok) {
      json(res, 400, { ok: false, error: result.error });
      return;
    }
    store.writeState(FILE, result.state);
    json(res, 200, { ok: true, count: result.state.rows.length, row: result.row, rows: result.state.rows });
    return;
  }
  const result = store.addRow(state, { address: body.address, handle: body.handle, nowMs: Date.now() });
  if (!result.ok) {
    json(res, 400, { ok: false, error: result.error });
    return;
  }
  store.writeState(FILE, result.state);
  json(res, 200, {
    ok: true,
    place: result.row.place,
    count: result.state.rows.length,
    handle: result.row.handle,
    address: result.row.address,
  });
};

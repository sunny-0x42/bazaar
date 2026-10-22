// One JSON document, compare-and-swap. A failed match retries so a new
// signup cannot replace an admin seed that was written a moment earlier.

export async function updateWlist(io, mutate) {
  let last = { ok: false, error: "conflict" };
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await io.read();
    const state = current && current.state && Array.isArray(current.state.rows) ? current.state : { rows: [] };
    last = mutate(state);
    if (!last || last.ok === false || !last.state) return last;
    const etag = current && current.etag ? current.etag : "";
    if (await io.write(last.state, etag)) return last;
    if (typeof io.wait === "function") await io.wait();
  }
  return { ok: false, error: "conflict" };
}

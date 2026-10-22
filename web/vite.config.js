import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addRow, patchRow, readBody, readState, removeRow, seedRows, sendJson, stats, writeState } from "./server/wlist-store.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.dirname(fileURLToPath(import.meta.url));
const wlistFile = path.join(webRoot, ".data", "whitelist.json");

function newColPlugin() {
  return {
    name: "bazaar-new-col",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (url === "/local/bazaar-gens.json") {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end("GET");
            return;
          }
          const file = path.join(repoRoot, "genesis", "bazaar-genesis-launch.json");
          if (!fs.existsSync(file)) {
            res.statusCode = 404;
            res.end("missing");
            return;
          }
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          fs.createReadStream(file).pipe(res);
          return;
        }
        if (url !== "/local/new-col") return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST");
          return;
        }
        let rawBody = "";
        for await (const chunk of req) rawBody += chunk;
        let slug = "";
        try {
          slug = String(JSON.parse(rawBody).slug || "")
            .trim()
            .toLowerCase();
        } catch {
          slug = "";
        }
        if (!/^[a-z][a-z0-9]{1,10}$/.test(slug)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "slug must be [a-z][a-z0-9]{1,10} (package name, no hyphen)" }));
          return;
        }
        const src = path.join(repoRoot, "gno.land", "r", "bazaar", "col");
        const dst = path.join(repoRoot, "gno.land", "r", "bazaar", "c", slug);
        const pkg = `gno.land/r/bazaar/c/${slug}`;
        if (!fs.existsSync(src)) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "collection template missing" }));
          return;
        }
        const colSrc = fs.readFileSync(path.join(src, "col.gno"), "utf8");
        if (!colSrc.includes("gno.land/p/nt/grc721/v0") || !colSrc.includes("func OwnerOf(tid string) (address, error)")) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "col template is not the Adena Shown recipe (p/nt/grc721 + OwnerOf tuple)" }));
          return;
        }
        if (fs.existsSync(dst)) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, exists: true, pkg }));
          return;
        }
        fs.mkdirSync(dst, { recursive: true });
        for (const name of fs.readdirSync(src)) {
          if (name !== "gnomod.toml" && !name.endsWith(".gno")) continue;
          let text = fs.readFileSync(path.join(src, name), "utf8");
          text = text.replace(/package col\b/g, "package " + slug);
          text = text.replace('module = "gno.land/r/bazaar/col"', `module = "${pkg}"`);
          let out = name;
          if (name === "col.gno") out = `${slug}.gno`;
          if (name === "col_test.gno") out = `${slug}_test.gno`;
          fs.writeFileSync(path.join(dst, out), text);
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, exists: false, pkg }));
      });
    },
  };
}

function wlistPlugin() {
  return {
    name: "bazaar-wlist",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "", "http://127.0.0.1");
        if (url.pathname !== "/local/wlist") return next();
        if (req.method === "GET") {
          const state = readState(wlistFile);
          sendJson(res, 200, stats(state, { address: url.searchParams.get("addr") || "", full: url.searchParams.get("full") === "1" }));
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST");
          return;
        }
        const body = await readBody(req);
        const state = readState(wlistFile);
        if (Array.isArray(body.seed)) {
          const result = seedRows(state, body.seed);
          writeState(wlistFile, result.state);
          sendJson(res, 200, { ok: true, added: result.added, count: result.state.rows.length, rows: result.state.rows });
          return;
        }
        if (body.remove) {
          const result = removeRow(state, body.remove);
          if (!result.ok) {
            sendJson(res, 400, { ok: false, error: result.error });
            return;
          }
          writeState(wlistFile, result.state);
          sendJson(res, 200, { ok: true, count: result.state.rows.length, rows: result.state.rows });
          return;
        }
        if (body.patch) {
          const result = patchRow(state, body.patch);
          if (!result.ok) {
            sendJson(res, 400, { ok: false, error: result.error });
            return;
          }
          writeState(wlistFile, result.state);
          sendJson(res, 200, { ok: true, count: result.state.rows.length, row: result.row, rows: result.state.rows });
          return;
        }
        const result = addRow(state, { address: body.address, handle: body.handle, nowMs: Date.now() });
        if (!result.ok) {
          sendJson(res, 400, { ok: false, error: result.error });
          return;
        }
        writeState(wlistFile, result.state);
        sendJson(res, 200, {
          ok: true,
          place: result.row.place,
          count: result.state.rows.length,
          handle: result.row.handle,
          address: result.row.address,
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), newColPlugin(), wlistPlugin()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5176,
    host: "127.0.0.1",
    proxy: {
      "/api": "http://127.0.0.1:8788",
      "/gnoswap-prices": {
        target: "https://api.gnoswap.io",
        changeOrigin: true,
        rewrite: () => "/v1/tokens/prices",
      },
      "/coingecko-gnot": {
        target: "https://api.coingecko.com",
        changeOrigin: true,
        rewrite: () => "/api/v3/simple/price?ids=gno-land&vs_currencies=usd",
      },
    },
    watch: { ignored: ["**/tmp-qa/**"] },
  },
});
